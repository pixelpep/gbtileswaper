// GB Tile Swapper — © 2026 pixelPep — https://pixelpep.com/gbdev/gbtileswaper/
// Licensed under CC BY-NC 4.0 — https://creativecommons.org/licenses/by-nc/4.0/

        console.log('Script loading...');

        // Global error handler
        window.addEventListener('error', function(e) {
            console.error('Global error caught:', e.error);
        });

        window.addEventListener('unhandledrejection', function(e) {
            console.error('Unhandled promise rejection:', e.reason);
        });

        // ========================================
        // TILESET BUILDER MODE
        // ========================================
        
        // ── V2: engineState (pure data) defined in engine.js.
        // ui.js extends it with DOM refs so all existing code using activeSet still works.
        const activeSet = engineState;  // same object reference

        // DOM refs — added to activeSet so engine state + DOM refs are unified
        activeSet.canvas1       = document.getElementById('builderCanvas1');
        activeSet.ctx1          = activeSet.canvas1.getContext('2d', { willReadFrequently: true });
        activeSet.highlight1    = document.getElementById('builderHighlight1');
        activeSet.dragPreview1  = document.getElementById('builderDragPreview1');

        activeSet.canvas2       = document.getElementById('builderCanvas2');
        activeSet.ctx2          = activeSet.canvas2.getContext('2d', { willReadFrequently: true });
        activeSet.highlight2    = document.getElementById('builderHighlight2');
        activeSet.dragPreview2  = document.getElementById('builderDragPreview2');

        // Extra frame DOM ref arrays (populated by ImageManager.addFrame / loadExtra)
        activeSet.canvasesExtra     = [];
        activeSet.ctxsExtra         = [];
        activeSet.highlightsExtra   = [];
        activeSet.dragPreviewsExtra = [];
        // ─────────────────────────────────────────────────────────────────────────
        // builderGbvmMode, builderTilesetType, getters/setters → engine.js
        // builderIsDragging, builderDragStart, builderDragCanvas → engine.js

        let builderTilesetCanvas = null;
        let builderTilesetCtx = null;
        
        // ── ImageManager ──────────────────────────────────────────────────────────
        // Handles all image I/O: LEVEL (img1), Frame 2 (img2), and extra frames
        const ImageManager = {

            _loadTokens: [0, 0, 0], // race condition tokens per slot (index 1=img1, 2=img2)
            load(file, imageNumber) {
                if (!file) return;
                const token = ++this._loadTokens[imageNumber];
                const reader = new FileReader();
                reader.onload = function(event) {
                    const img = new Image();
                    img.onload = function() {
                        // Guard: abort if a newer load was started for this slot while we were loading
                        if (ImageManager._loadTokens[imageNumber] !== token) return;
                        const tileCount = Math.ceil(img.width/8) * Math.ceil(img.height/8);
                        if (imageNumber === 1) {
                            activeSet.image1 = img;
                            activeSet.image1Filename = file.name;
                            activeSet.canvas1.width = img.width;
                            activeSet.canvas1.height = img.height;
                            activeSet.ctx1.drawImage(img, 0, 0);
                            document.getElementById('builderReload1Btn').style.display = 'inline-flex';
                            document.getElementById('builderKeepSelContainer1').style.display = 'flex';
                            document.getElementById('builderLabel1').innerHTML = `${file.name}&nbsp;<span style="font-size: 9px; opacity: 0.7;">(${tileCount})</span>`;
                            builderSetupCanvasEvents(activeSet.canvas1, 1);
                            builderUpdateAllCode();
                            showToast('Reference image loaded');
                        } else {
                            activeSet.image2 = img;
                            activeSet.image2Filename = file.name;
                            activeSet.canvas2.width = img.width;
                            activeSet.canvas2.height = img.height;
                            activeSet.ctx2.drawImage(img, 0, 0);
                            document.getElementById('builderReload2Btn').style.display = 'inline-flex';
                            document.getElementById('builderKeepSelContainer2').style.display = 'flex';
                            document.getElementById('builderLabel2').innerHTML = `${file.name}&nbsp;<span style="font-size: 9px; opacity: 0.7;">(${tileCount})</span>`;
                            builderSetupCanvasEvents(activeSet.canvas2, 2);
                            // Auto-rename the active set to match the tileset filename (strip extension)
                            const autoName = file.name.replace(/\.[^.]+$/, '');
                            renameSet(getActiveSetIndex(), autoName);
                            renderSetTabs();
                            showToast('Source image loaded');
                        }
                        ImageManager.updateLayout();
                        if (activeSet.groups.length > 0) {
                            TilesetManager.generate();
                            builderUpdateAllCode();
                        } else if (workMode === 'reference' && imageNumber === 2 && activeSet.image2 && builderTilesetCanvas) {
                            builderTilesetCanvas.width = activeSet.image2.width;
                            builderTilesetCanvas.height = activeSet.image2.height;
                            builderTilesetCtx.clearRect(0, 0, builderTilesetCanvas.width, builderTilesetCanvas.height);
                            builderTilesetCtx.drawImage(activeSet.image2, 0, 0);
                            setTilesetImageData(builderTilesetCanvas.toDataURL());
                            TilesetManager.updateSaveButtons();
                        }
                    };
                    img.src = event.target.result;
                };
                reader.readAsDataURL(file);
            },

            unload(imageNumber) {
                if (imageNumber === 1) {
                    activeSet.image1 = null;
                    activeSet.canvas1.width = 0;
                    activeSet.canvas1.height = 0;
                    document.getElementById('builderImage1Input').value = '';
                    document.getElementById('builderReload1Btn').style.display = 'none';
                    document.getElementById('builderKeepSelContainer1').style.display = 'none';
                    document.getElementById('builderLabel1').textContent = 'LEVEL.PNG';
                    activeSet.keepSel1 = false;
                    const btn1 = document.getElementById('builderKeepSel1');
                    btn1.querySelector('span').textContent = '';
                    btn1.style.background = '#000';
                    btn1.style.boxShadow = 'none';
                } else {
                    activeSet.image2 = null;
                    activeSet.canvas2.width = 0;
                    activeSet.canvas2.height = 0;
                    document.getElementById('builderImage2Input').value = '';
                    document.getElementById('builderReload2Btn').style.display = 'none';
                    document.getElementById('builderKeepSelContainer2').style.display = 'none';
                    document.getElementById('builderLabel2').textContent = 'TILESET.PNG';
                    activeSet.keepSel2 = false;
                    const btn2 = document.getElementById('builderKeepSel2');
                    btn2.querySelector('span').textContent = '';
                    btn2.style.background = '#000';
                    btn2.style.boxShadow = 'none';
                }
                builderClearCurrentSelection();
                ImageManager.updateLayout();
            },

            reload(imageNumber) {
                const input = imageNumber === 1
                    ? document.getElementById('builderImage1Input')
                    : document.getElementById('builderImage2Input');
                if (input.files && input.files[0]) {
                    ImageManager.load(input.files[0], imageNumber);
                    showToast(`Image ${imageNumber === 1 ? 'LEVEL.PNG' : 'TILESET.PNG'} reloaded`);
                }
            },

            updateLayout() {
                const ghost1 = document.getElementById('builderGhostPlaceholder1');
                const ghost2 = document.getElementById('builderGhostPlaceholder2');
                const container1 = document.getElementById('builderContainer1');
                const container2 = document.getElementById('builderContainer2');

                if (activeSet.image1) {
                    ghost1.style.display = 'none';
                    container1.classList.remove('hidden');
                } else {
                    ghost1.style.display = 'flex';
                    container1.classList.add('hidden');
                }
                if (activeSet.image2) {
                    ghost2.style.display = 'none';
                    container2.classList.remove('hidden');
                } else {
                    ghost2.style.display = 'flex';
                    container2.classList.add('hidden');
                }
                if (activeSet.image1 || activeSet.image2) {
                    document.getElementById('builderCurrentSelection').classList.remove('hidden');
                } else {
                    document.getElementById('builderCurrentSelection').classList.add('hidden');
                }
                updateModeUI();
            },

            addFrame() {
                const frameIndex = activeSet.imagesExtra.length + 1;
                const container = document.getElementById('tilesetFramesContainer');
                const extraIdx = activeSet.imagesExtra.length;
                const frameNum = frameIndex + 2;   // 3, 4, 5…
                const emptyLabel = `${getActiveSetName()} · F${frameNum}`;
                const frameDiv = document.createElement('div');
                frameDiv.className = 'tileset-frame';
                frameDiv.setAttribute('data-frame', `extra_${extraIdx}`);
                frameDiv.style.cssText = 'display: flex; flex-direction: column; align-items: center; flex: 0 0 calc(50% - 4px); min-width: 0;';
                frameDiv.innerHTML = `
                    <div class="upload-controls" style="margin-bottom: 8px; display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 6px;">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <input type="file" id="builderImage2Input_extra_${extraIdx}" accept="image/*">
                            <label for="builderImage2Input_extra_${extraIdx}" class="file-button" id="builderLabel2_extra_${extraIdx}">${emptyLabel}</label>
                            <button class="reload-btn" id="builderReload2Btn_extra_${extraIdx}" onclick="ImageManager.reloadExtra(${extraIdx})" style="display: none;" title="Reload image">♺</button>
                        </div>
                        <div id="frameExtraRightControls_${extraIdx}" style="display: flex; align-items: center; gap: 8px;">
                            <button id="removeFrameBtn_extra_${extraIdx}" onclick="ImageManager.removeFrame(${extraIdx})" style="display: none; background: #000; color: #ff4444; border: 1px solid #ff4444; padding: 2px 6px; font-size: 11px; font-weight: bold; border-radius: 2px; cursor: pointer; line-height: 1;" title="Remove this frame slot">✕</button>
                        </div>
                    </div>
                    <div id="builderGhostPlaceholder2_extra_${extraIdx}" style="width: 100%; min-height: 288px; border: 2px dashed rgba(0, 255, 0, 0.2); border-radius: 2px; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(0, 255, 0, 0.05); transition: all 0.3s ease; cursor: pointer;">
                        <span style="color: rgba(0, 255, 0, 0.3); font-size: 18px; font-weight: 600; letter-spacing: 2px;">${emptyLabel}</span>
                    </div>
                    <div class="canvas-container hidden" id="builderContainer2_extra_${extraIdx}" style="width: 100%;">
                        <canvas id="builderCanvas2_extra_${extraIdx}" style="max-width: 100%; height: auto;"></canvas>
                        <div class="pixel-grid" id="builderHighlight2_extra_${extraIdx}"></div>
                        <div class="drag-preview" id="builderDragPreview2_extra_${extraIdx}"></div>
                    </div>
                `;
                container.appendChild(frameDiv);
                const canvas = document.getElementById(`builderCanvas2_extra_${extraIdx}`);
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                activeSet.imagesExtra.push(null);
                activeSet.canvasesExtra.push(canvas);
                activeSet.ctxsExtra.push(ctx);
                activeSet.highlightsExtra.push(document.getElementById(`builderHighlight2_extra_${extraIdx}`));
                activeSet.dragPreviewsExtra.push(document.getElementById(`builderDragPreview2_extra_${extraIdx}`));
                activeSet.selectionsExtra.push(new Set());
                activeSet.filenamesExtra.push('');
                const ghost = document.getElementById(`builderGhostPlaceholder2_extra_${extraIdx}`);
                ghost.addEventListener('click', () => document.getElementById(`builderImage2Input_extra_${extraIdx}`).click());
                ghost.addEventListener('dragover', e => { e.preventDefault(); ghost.style.background = 'rgba(0,255,0,0.2)'; });
                ghost.addEventListener('dragleave', () => { ghost.style.background = 'rgba(0,255,0,0.05)'; });
                ghost.addEventListener('drop', e => {
                    e.preventDefault();
                    ghost.style.background = 'rgba(0,255,0,0.05)';
                    if (e.dataTransfer.files.length > 0) ImageManager.loadExtra(e.dataTransfer.files[0], extraIdx);
                });
                document.getElementById(`builderImage2Input_extra_${extraIdx}`).addEventListener('change', function(e) {
                    if (e.target.files.length > 0) ImageManager.loadExtra(e.target.files[0], extraIdx);
                });
                builderSetupCanvasEventsExtra(canvas, extraIdx);
                ImageManager.updateLastFrameBtn();
                ImageManager.updateLayout();
                showToast(`Frame ${frameIndex + 1} added`);
            },

            loadExtra(file, extraIdx) {
                if (!file) return;
                const reader = new FileReader();
                reader.onload = function(e) {
                    const img = new Image();
                    img.onload = function() {
                        activeSet.imagesExtra[extraIdx] = img;
                        activeSet.filenamesExtra[extraIdx] = file.name;
                        activeSet.canvasesExtra[extraIdx].width = img.width;
                        activeSet.canvasesExtra[extraIdx].height = img.height;
                        activeSet.ctxsExtra[extraIdx].drawImage(img, 0, 0);
                        const tileCountExtra = Math.ceil(img.width/8) * Math.ceil(img.height/8);
                        document.getElementById(`builderLabel2_extra_${extraIdx}`).innerHTML = `${file.name}&nbsp;<span style="font-size: 9px; opacity: 0.7;">(${tileCountExtra})</span>`;
                        document.getElementById(`builderReload2Btn_extra_${extraIdx}`).style.display = 'inline-flex';
                        document.getElementById(`builderGhostPlaceholder2_extra_${extraIdx}`).style.display = 'none';
                        document.getElementById(`builderContainer2_extra_${extraIdx}`).classList.remove('hidden');
                        showToast(`Frame ${extraIdx + 2} loaded`);
                        ImageManager.updateLayout();
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(file);
            },

            unloadExtra(extraIdx) {
                activeSet.imagesExtra[extraIdx] = null;
                activeSet.selectionsExtra[extraIdx].clear();
                activeSet.canvasesExtra[extraIdx].width = 0;
                activeSet.canvasesExtra[extraIdx].height = 0;
                document.getElementById(`builderImage2Input_extra_${extraIdx}`).value = '';
                document.getElementById(`builderReload2Btn_extra_${extraIdx}`).style.display = 'none';
                document.getElementById(`builderLabel2_extra_${extraIdx}`).textContent = `FRAME ${extraIdx + 3}`;
                document.getElementById(`builderGhostPlaceholder2_extra_${extraIdx}`).style.display = 'flex';
                document.getElementById(`builderContainer2_extra_${extraIdx}`).classList.add('hidden');
                builderRedrawSelections();
            },

            reloadExtra(extraIdx) {
                document.getElementById(`builderImage2Input_extra_${extraIdx}`).click();
            },

            removeFrame(extraIdx) {
                // Only last frame can be removed (avoids DOM re-indexing)
                if (extraIdx !== activeSet.imagesExtra.length - 1) return;
                const container = document.getElementById('tilesetFramesContainer');
                const frameDiv = container.querySelector(`.tileset-frame[data-frame="extra_${extraIdx}"]`);
                if (frameDiv) frameDiv.remove();
                // Pop from all parallel arrays
                activeSet.imagesExtra.pop();
                activeSet.canvasesExtra.pop();
                activeSet.ctxsExtra.pop();
                activeSet.highlightsExtra.pop();
                activeSet.dragPreviewsExtra.pop();
                activeSet.selectionsExtra.pop();
                activeSet.filenamesExtra.pop();
                builderRedrawSelections();
                ImageManager.updateLastFrameBtn();
                ImageManager.updateLayout();
                showToast(`Frame ${extraIdx + 2} removed`);
            },

            updateLastFrameBtn() {
                const numExtras = activeSet.imagesExtra.length;
                const isAnim = activeSet.mode === 'anim';

                // Hide ✕ on all extras, show only on last
                for (let i = 0; i < numExtras; i++) {
                    const btn = document.getElementById(`removeFrameBtn_extra_${i}`);
                    if (btn) btn.style.display = 'none';
                }
                if (numExtras > 0 && isAnim) {
                    const lastBtn = document.getElementById(`removeFrameBtn_extra_${numExtras - 1}`);
                    if (lastBtn) lastBtn.style.display = 'inline-flex';
                }
            },

        };
        // ─────────────────────────────────────────────────────────────────────────
        
        function builderSetupCanvasEvents(canvas, imageNumber) {
            const tooltip = document.getElementById('builderTooltip');
            const gridPosSpan = document.getElementById('builderGridPos');
            const pixelPosSpan = document.getElementById('builderPixelPos');
            
            canvas.addEventListener('mousedown', function(e) {
                const rect = canvas.getBoundingClientRect();
                const scaleX = canvas.width / rect.width;
                const scaleY = canvas.height / rect.height;
                const x = (e.clientX - rect.left) * scaleX;
                const y = (e.clientY - rect.top) * scaleY;
                const gridCol = Math.floor(x / 8);
                const gridRow = Math.floor(y / 8);
                
                builderIsDragging = true;
                builderDragStart = { col: gridCol, row: gridRow };
                builderDragCanvas = imageNumber;
            });
            
            canvas.addEventListener('mouseup', function(e) {
                if (builderIsDragging && builderDragCanvas === imageNumber) {
                    const rect = canvas.getBoundingClientRect();
                    const scaleX = canvas.width / rect.width;
                    const scaleY = canvas.height / rect.height;
                    const x = (e.clientX - rect.left) * scaleX;
                    const y = (e.clientY - rect.top) * scaleY;
                    const gridCol = Math.floor(x / 8);
                    const gridRow = Math.floor(y / 8);
                    
                    const symmetricMode = activeSet.symmetric;
                    
                    if (builderDragStart.col === gridCol && builderDragStart.row === gridRow) {
                        // Single click
                        builderToggleTile(gridCol, gridRow, imageNumber);
                        if (symmetricMode) {
                            // Also toggle on the other image
                            const otherImageNumber = imageNumber === 1 ? 2 : 1;
                            builderToggleTile(gridCol, gridRow, otherImageNumber);
                            // ANIM mode: propagate to ALL extra tileset frames when selecting on LEVEL
                            if (activeSet.mode === 'anim' && imageNumber === 1) {
                                const key = `${gridCol},${gridRow}`;
                                activeSet.selectionsExtra.forEach(sel => {
                                    if (sel.has(key)) sel.delete(key); else sel.add(key);
                                });
                                builderRedrawSelections();
                            }
                        }
                    } else {
                        // Drag selection
                        builderSelectRectangle(builderDragStart.col, builderDragStart.row, gridCol, gridRow, imageNumber);
                        if (symmetricMode) {
                            // Also select on the other image
                            const otherImageNumber = imageNumber === 1 ? 2 : 1;
                            builderSelectRectangle(builderDragStart.col, builderDragStart.row, gridCol, gridRow, otherImageNumber);
                            // ANIM mode: propagate rectangle to ALL extra tileset frames when selecting on LEVEL
                            if (activeSet.mode === 'anim' && imageNumber === 1) {
                                const minCol = Math.min(builderDragStart.col, gridCol);
                                const maxCol = Math.max(builderDragStart.col, gridCol);
                                const minRow = Math.min(builderDragStart.row, gridRow);
                                const maxRow = Math.max(builderDragStart.row, gridRow);
                                activeSet.selectionsExtra.forEach(sel => {
                                    for (let r = minRow; r <= maxRow; r++) {
                                        for (let c = minCol; c <= maxCol; c++) {
                                            sel.add(`${c},${r}`);
                                        }
                                    }
                                });
                                builderRedrawSelections();
                            }
                        }
                    }
                }
                
                builderIsDragging = false;
                builderDragStart = null;
                builderDragCanvas = null;
            });
            
            canvas.addEventListener('mousemove', function(e) {
                const rect = canvas.getBoundingClientRect();
                const scaleX = canvas.width / rect.width;
                const scaleY = canvas.height / rect.height;
                const x = (e.clientX - rect.left) * scaleX;
                const y = (e.clientY - rect.top) * scaleY;
                const gridCol = Math.floor(x / 8);
                const gridRow = Math.floor(y / 8);
                const gridX = gridCol * 8;
                const gridY = gridRow * 8;
                
                // Update tooltip
                gridPosSpan.textContent = `(${gridCol}, ${gridRow})`;
                pixelPosSpan.textContent = `(${gridX}, ${gridY})`;
                tooltip.style.display = 'block';
                tooltip.style.left = (e.clientX + 15) + 'px';
                tooltip.style.top = (e.clientY + 15) + 'px';
                
                const symmetricMode = activeSet.symmetric;
                
                // Show drag preview if dragging
                if (builderIsDragging && builderDragCanvas === imageNumber && builderDragStart) {
                    const minCol = Math.min(builderDragStart.col, gridCol);
                    const maxCol = Math.max(builderDragStart.col, gridCol);
                    const minRow = Math.min(builderDragStart.row, gridRow);
                    const maxRow = Math.max(builderDragStart.row, gridRow);
                    
                    const startX = minCol * 8;
                    const startY = minRow * 8;
                    const width = (maxCol - minCol + 1) * 8;
                    const height = (maxRow - minRow + 1) * 8;
                    
                    const preview = imageNumber === 1 ? activeSet.dragPreview1 : activeSet.dragPreview2;
                    preview.style.left = (startX / scaleX) + 'px';
                    preview.style.top = (startY / scaleY) + 'px';
                    preview.style.width = (width / scaleX) + 'px';
                    preview.style.height = (height / scaleY) + 'px';
                    preview.classList.add('active');
                    
                    // Show drag preview on other side if symmetric mode
                    if (symmetricMode) {
                        const otherCanvas = imageNumber === 1 ? activeSet.canvas2 : activeSet.canvas1;
                        const otherRect = otherCanvas.getBoundingClientRect();
                        const otherScaleX = otherCanvas.width / otherRect.width;
                        const otherScaleY = otherCanvas.height / otherRect.height;
                        const otherPreview = imageNumber === 1 ? activeSet.dragPreview2 : activeSet.dragPreview1;
                        
                        otherPreview.style.left = (startX / otherScaleX) + 'px';
                        otherPreview.style.top = (startY / otherScaleY) + 'px';
                        otherPreview.style.width = (width / otherScaleX) + 'px';
                        otherPreview.style.height = (height / otherScaleY) + 'px';
                        otherPreview.classList.add('active');
                    } else {
                        const otherPreview = imageNumber === 1 ? activeSet.dragPreview2 : activeSet.dragPreview1;
                        otherPreview.classList.remove('active');
                    }
                } else {
                    // Hide drag preview
                    const preview = imageNumber === 1 ? activeSet.dragPreview1 : activeSet.dragPreview2;
                    preview.classList.remove('active');
                    activeSet.dragPreview1.classList.remove('active');
                    activeSet.dragPreview2.classList.remove('active');
                }
                
                // Update highlights
                const highlight = imageNumber === 1 ? activeSet.highlight1 : activeSet.highlight2;
                highlight.style.left = (gridX / scaleX) + 'px';
                highlight.style.top = (gridY / scaleY) + 'px';
                highlight.style.width = (8 / scaleX) + 'px';
                highlight.style.height = (8 / scaleY) + 'px';
                highlight.classList.add('active');
                
                // Symmetric mode: highlight same position on other image
                if (symmetricMode) {
                    const otherHighlight = imageNumber === 1 ? activeSet.highlight2 : activeSet.highlight1;
                    const otherCanvas = imageNumber === 1 ? activeSet.canvas2 : activeSet.canvas1;
                    const otherRect = otherCanvas.getBoundingClientRect();
                    const otherScaleX = otherCanvas.width / otherRect.width;
                    const otherScaleY = otherCanvas.height / otherRect.height;

                    otherHighlight.style.left = (gridX / otherScaleX) + 'px';
                    otherHighlight.style.top = (gridY / otherScaleY) + 'px';
                    otherHighlight.style.width = (8 / otherScaleX) + 'px';
                    otherHighlight.style.height = (8 / otherScaleY) + 'px';
                    otherHighlight.classList.add('active');
                    // ANIM mode: propagate hover to all extra frames when hovering on LEVEL
                    if (activeSet.mode === 'anim' && imageNumber === 1) {
                        activeSet.highlightsExtra.forEach((hl, i) => {
                            if (!hl || !activeSet.imagesExtra[i]) return;
                            const exCanvas = activeSet.canvasesExtra[i];
                            const exRect = exCanvas.getBoundingClientRect();
                            const exScaleX = exCanvas.width / exRect.width;
                            const exScaleY = exCanvas.height / exRect.height;
                            hl.style.left = (gridX / exScaleX) + 'px';
                            hl.style.top = (gridY / exScaleY) + 'px';
                            hl.style.width = (8 / exScaleX) + 'px';
                            hl.style.height = (8 / exScaleY) + 'px';
                            hl.classList.add('active');
                        });
                    } else {
                        activeSet.highlightsExtra.forEach(hl => { if (hl) hl.classList.remove('active'); });
                    }
                } else {
                    // Hide other highlight when not in symmetric mode
                    const otherHighlight = imageNumber === 1 ? activeSet.highlight2 : activeSet.highlight1;
                    otherHighlight.classList.remove('active');
                    activeSet.highlightsExtra.forEach(hl => { if (hl) hl.classList.remove('active'); });
                }
            });
            
            canvas.addEventListener('mouseleave', function() {
                const highlight = imageNumber === 1 ? activeSet.highlight1 : activeSet.highlight2;
                highlight.classList.remove('active');
                
                // Also hide other highlight
                const otherHighlight = imageNumber === 1 ? activeSet.highlight2 : activeSet.highlight1;
                otherHighlight.classList.remove('active');
                activeSet.highlightsExtra.forEach(hl => { if (hl) hl.classList.remove('active'); });

                tooltip.style.display = 'none';
                
                // Hide drag previews
                activeSet.dragPreview1.classList.remove('active');
                activeSet.dragPreview2.classList.remove('active');
                
                // Cancel drag if mouse leaves
                if (builderIsDragging && builderDragCanvas === imageNumber) {
                    builderIsDragging = false;
                    builderDragStart = null;
                    builderDragCanvas = null;
                }
            });
        }
        
        function builderToggleTile(col, row, imageNumber) {
            toggleTileData(col, row, imageNumber); // engine: updates Set
            if (activeSet.autoSort) {
                sortSelections();
            } else {
                builderUpdateSelectionDisplay();
                builderRedrawSelections();
            }
        }

        function builderSelectRectangle(startCol, startRow, endCol, endRow, imageNumber) {
            selectRectangleData(startCol, startRow, endCol, endRow, imageNumber); // engine
            if (activeSet.autoSort) {
                sortSelections();
            } else {
                builderUpdateSelectionDisplay();
                builderRedrawSelections();
            }
        }
        
        function builderRedrawSelections() {
            // Clear and redraw Image 1
            if (activeSet.image1) {
                activeSet.ctx1.clearRect(0, 0, activeSet.canvas1.width, activeSet.canvas1.height);
                activeSet.ctx1.drawImage(activeSet.image1, 0, 0);

                // Draw current selection
                activeSet.img1Selection.forEach(key => {
                    const [col, row] = key.split(',').map(Number);
                    activeSet.ctx1.fillStyle = 'rgba(0, 255, 0, 0.3)';
                    activeSet.ctx1.fillRect(col * 8, row * 8, 8, 8);
                    activeSet.ctx1.strokeStyle = '#00ff00';
                    activeSet.ctx1.lineWidth = 1;
                    // Border inside: offset by 0.5px and reduce size by 1px
                    activeSet.ctx1.strokeRect(col * 8 + 0.5, row * 8 + 0.5, 7, 7);
                });
            }

            // Clear and redraw Image 2 with frame highlights
            if (activeSet.image2) {
                // Use highlightFramesOnTileset which handles everything:
                // - Redrawing the image
                // - Drawing the selection
                // - Adding frame highlights if needed
                highlightFramesOnTileset();
            }

            // Redraw extra tileset frame canvases
            for (let i = 0; i < activeSet.imagesExtra.length; i++) {
                builderRedrawExtraFrameSelection(i);
            }
        }
        
        function builderUpdateSelectionDisplay() {
            document.getElementById('builderImg1Count').textContent = activeSet.img1Selection.size;
            document.getElementById('builderImg2Count').textContent = activeSet.img2Selection.size;

            // Show/hide CLEAR button based on selection
            const clearBtn = document.getElementById('builderClearBtn');
            if (activeSet.img1Selection.size > 0 || activeSet.img2Selection.size > 0) {
                clearBtn.style.display = 'inline-block';
            } else {
                clearBtn.style.display = 'none';
            }

            const selectedTilesCode = document.getElementById('builderSelectedTilesCode');

            if (!activeSet.mirror || activeSet.img2Selection.size === 0) {
                // Normal mode: show raw img2Selection coordinates
                selectedTilesCode.textContent = activeSet.img2Selection.size > 0
                    ? Array.from(activeSet.img2Selection).join('; ')
                    : '';
                return;
            }

            // Mirror mode: preview the full bounce sequence that would be created
            const img2Tiles = Array.from(activeSet.img2Selection)
                .map(key => { const [c, r] = key.split(',').map(Number); return { col: c, row: r }; })
                .sort((a, b) => a.row === b.row ? a.col - b.col : a.row - b.row);

            const selectionWidth = Math.max(...img2Tiles.map(t => t.col)) - Math.min(...img2Tiles.map(t => t.col)) + 1;
            const loadedFrames = getAllTilesetFrames();
            const useMultiImage = loadedFrames.length > 1;
            const effectiveFrameCount = useMultiImage ? loadedFrames.length : (activeSet.frameCount || 1);

            // Build forward frames (mirrors builderAddGroup logic)
            const forwardFrames = [];
            if (useMultiImage) {
                loadedFrames.forEach((frameData, i) => {
                    const frameSel = frameData.selection;
                    const tiles = (frameSel && frameSel.size > 0)
                        ? Array.from(frameSel).map(key => { const [c, r] = key.split(',').map(Number); return { col: c, row: r }; }).sort((a, b) => a.row === b.row ? a.col - b.col : a.row - b.row)
                        : img2Tiles;
                    forwardFrames.push({ label: i === 0 ? 'T' : `E${i}`, tiles });
                });
            } else {
                for (let f = 0; f < effectiveFrameCount; f++) {
                    const tiles = img2Tiles.map(t => ({ col: t.col + f * selectionWidth, row: t.row }));
                    forwardFrames.push({ label: `F${f + 1}`, tiles });
                }
            }

            // ANIM mode: prepend level tiles as first frame
            if (activeSet.mode === 'anim' && activeSet.img1Selection.size > 0) {
                const levelTiles = Array.from(activeSet.img1Selection)
                    .map(key => { const [c, r] = key.split(',').map(Number); return { col: c, row: r }; });
                forwardFrames.unshift({ label: 'L', tiles: levelTiles });
            }

            // Bounce: [f0, f1, ..., fN, fN-1, ..., f1]
            const allFrames = [...forwardFrames];
            for (let i = forwardFrames.length - 2; i >= 1; i--) {
                allFrames.push({ ...forwardFrames[i], repeated: true });
            }

            // Format: "[4f] F1:0,0 1,0 → F2:2,0 3,0 → F1↩"
            const parts = allFrames.map(f => {
                const coordStr = f.tiles.map(t => `${t.col},${t.row}`).join(' ');
                return f.repeated ? f.label + '↩' : `${f.label}:${coordStr}`;
            });
            selectedTilesCode.textContent = `[${allFrames.length}f] ` + parts.join(' → ');
        }
        
        function builderClearCurrentSelection() {
            clearSelectionsData(); // engine
            builderUpdateSelectionDisplay();
            builderRedrawSelections();
        }

        // Returns all loaded tileset frames as array: [{img, canvas, ctx, selection}, ...]
        // Frame 0 = existing activeSet.image2/activeSet.canvas2/activeSet.img2Selection
        function getAllTilesetFrames() {
            const frames = [];
            if (activeSet.image2) {
                frames.push({ img: activeSet.image2, canvas: activeSet.canvas2, ctx: activeSet.ctx2, selection: activeSet.img2Selection });
            }
            for (let i = 0; i < activeSet.imagesExtra.length; i++) {
                if (activeSet.imagesExtra[i]) {
                    frames.push({ img: activeSet.imagesExtra[i], canvas: activeSet.canvasesExtra[i], ctx: activeSet.ctxsExtra[i], selection: activeSet.selectionsExtra[i] });
                }
            }
            return frames;
        }

        // addFrame / loadExtra / unloadExtra / reloadExtra → ImageManager (above)

        function builderSetupCanvasEventsExtra(canvas, extraIdx) {
            canvas.addEventListener('mousedown', function(e) {
                builderIsDragging = true;
                builderDragCanvas = 2;
                builderDragFrame = extraIdx;
                const rect = canvas.getBoundingClientRect();
                const scaleX = canvas.width / rect.width;
                const scaleY = canvas.height / rect.height;
                const x = (e.clientX - rect.left) * scaleX;
                const y = (e.clientY - rect.top) * scaleY;
                builderDragStart = { col: Math.floor(x / 8), row: Math.floor(y / 8) };
            });

            canvas.addEventListener('mouseup', function(e) {
                if (!builderIsDragging || builderDragCanvas !== 2 || builderDragFrame !== extraIdx) return;
                builderIsDragging = false;
                const rect = canvas.getBoundingClientRect();
                const scaleX = canvas.width / rect.width;
                const scaleY = canvas.height / rect.height;
                const x = (e.clientX - rect.left) * scaleX;
                const y = (e.clientY - rect.top) * scaleY;
                const col = Math.floor(x / 8);
                const row = Math.floor(y / 8);
                const selection = activeSet.selectionsExtra[extraIdx];
                if (builderDragStart && builderDragStart.col === col && builderDragStart.row === row) {
                    // Single tile toggle
                    const key = `${col},${row}`;
                    if (selection.has(key)) selection.delete(key);
                    else selection.add(key);
                } else if (builderDragStart) {
                    // Drag selection rectangle
                    const minCol = Math.min(builderDragStart.col, col);
                    const maxCol = Math.max(builderDragStart.col, col);
                    const minRow = Math.min(builderDragStart.row, row);
                    const maxRow = Math.max(builderDragStart.row, row);
                    for (let r = minRow; r <= maxRow; r++) {
                        for (let c = minCol; c <= maxCol; c++) {
                            selection.add(`${c},${r}`);
                        }
                    }
                }
                activeSet.dragPreviewsExtra[extraIdx].classList.remove('active');
                builderRedrawExtraFrameSelection(extraIdx);
                builderUpdateSelectionDisplay();
                builderDragStart = null;
            });

            canvas.addEventListener('mousemove', function(e) {
                const rect = canvas.getBoundingClientRect();
                const scaleX = canvas.width / rect.width;
                const scaleY = canvas.height / rect.height;
                const x = (e.clientX - rect.left) * scaleX;
                const y = (e.clientY - rect.top) * scaleY;
                const gridCol = Math.floor(x / 8);
                const gridRow = Math.floor(y / 8);
                const gridX = gridCol * 8;
                const gridY = gridRow * 8;
                const hl = activeSet.highlightsExtra[extraIdx];
                if (hl) {
                    hl.style.left = (gridX / scaleX) + 'px';
                    hl.style.top = (gridY / scaleY) + 'px';
                    hl.style.width = (8 / scaleX) + 'px';
                    hl.style.height = (8 / scaleY) + 'px';
                    hl.classList.add('active');
                }
                if (activeSet.symmetric) {
                    const rect1 = activeSet.canvas1.getBoundingClientRect();
                    const scaleX1 = activeSet.canvas1.width / rect1.width;
                    const scaleY1 = activeSet.canvas1.height / rect1.height;
                    activeSet.highlight1.style.left = (gridX / scaleX1) + 'px';
                    activeSet.highlight1.style.top = (gridY / scaleY1) + 'px';
                    activeSet.highlight1.style.width = (8 / scaleX1) + 'px';
                    activeSet.highlight1.style.height = (8 / scaleY1) + 'px';
                    activeSet.highlight1.classList.add('active');
                } else {
                    activeSet.highlight1.classList.remove('active');
                }
            });

            canvas.addEventListener('mouseleave', function() {
                if (builderIsDragging && builderDragCanvas === 2 && builderDragFrame === extraIdx) {
                    activeSet.dragPreviewsExtra[extraIdx].classList.remove('active');
                }
                const hl = activeSet.highlightsExtra[extraIdx];
                if (hl) hl.classList.remove('active');
                activeSet.highlight1.classList.remove('active');
            });
        }

        function builderRedrawExtraFrameSelection(extraIdx) {
            const img = activeSet.imagesExtra[extraIdx];
            const ctx = activeSet.ctxsExtra[extraIdx];
            const canvas = activeSet.canvasesExtra[extraIdx];
            const selection = activeSet.selectionsExtra[extraIdx];
            if (!img) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            selection.forEach(key => {
                const [col, row] = key.split(',').map(Number);
                ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
                ctx.fillRect(col * 8, row * 8, 8, 8);
                ctx.strokeStyle = '#00ff00';
                ctx.lineWidth = 1;
                ctx.strokeRect(col * 8 + 0.5, row * 8 + 0.5, 7, 7);
            });
        }
        
        function builderAddGroup() {
            const groupName = document.getElementById('builderGroupName').value.trim();
            const mirrorMode = activeSet.mirror;
            const frameCount = activeSet.frameCount;

            if (!groupName) {
                alert('Please enter a swap name');
                return;
            }

            if (activeSet.img1Selection.size === 0 || activeSet.img2Selection.size === 0) {
                alert('Please select tiles from both images');
                return;
            }

            if (activeSet.img1Selection.size !== activeSet.img2Selection.size) {
                alert('Number of selected tiles must match on both images');
                return;
            }

            // Convert selections to arrays
            const img1Tiles = Array.from(activeSet.img1Selection).map(key => {
                const [col, row] = key.split(',').map(Number);
                return { col, row };
            }).sort((a, b) => a.row === b.row ? a.col - b.col : a.row - b.row);
            
            const img2Tiles = Array.from(activeSet.img2Selection).map(key => {
                const [col, row] = key.split(',').map(Number);
                return { col, row };
            }).sort((a, b) => a.row === b.row ? a.col - b.col : a.row - b.row);
            
            // Calculate selection width for frame offset (horizontal offset / single-image mode)
            const selectionWidth = Math.max(...img2Tiles.map(t => t.col)) - Math.min(...img2Tiles.map(t => t.col)) + 1;

            // Multi-image mode: check if user has loaded extra tileset frame images
            const loadedFrames = getAllTilesetFrames();
            const useMultiImage = loadedFrames.length > 1;
            // Effective frame count: loaded images take priority over the activeSet.frameCount counter
            const effectiveFrameCount = useMultiImage ? loadedFrames.length : frameCount;

            // Helper: capture tile pixels from an image
            function captureTiles(tiles, img) {
                return tiles.map(tile => {
                    const c = document.createElement('canvas');
                    c.width = 8; c.height = 8;
                    const ctx = c.getContext('2d', { willReadFrequently: true });
                    ctx.drawImage(img, tile.col * 8, tile.row * 8, 8, 8, 0, 0, 8, 8);
                    return {
                        col: tile.col, row: tile.row,
                        imageData: c.toDataURL(),
                        pixels: Array.from(ctx.getImageData(0, 0, 8, 8).data) // raw RGBA for dedup
                    };
                });
            }

            if (mirrorMode) {
                // Build raw tileset forward frames (without ping-pong or ANIM prepend yet)
                const rawForwardFrames = [];
                if (useMultiImage) {
                    for (let frameIdx = 0; frameIdx < loadedFrames.length; frameIdx++) {
                        const frameData = loadedFrames[frameIdx];
                        const frameSel = frameData.selection;
                        const frameImg2Tiles = (frameSel && frameSel.size > 0)
                            ? Array.from(frameSel).map(key => { const [c, r] = key.split(',').map(Number); return { col: c, row: r }; }).sort((a, b) => a.row === b.row ? a.col - b.col : a.row - b.row)
                            : img2Tiles;
                        rawForwardFrames.push({ img2Tiles: frameImg2Tiles, savedTiles: captureTiles(frameImg2Tiles, frameData.img) });
                    }
                } else {
                    for (let frame = 0; frame < effectiveFrameCount; frame++) {
                        const frameTiles = img2Tiles.map(tile => ({ col: tile.col + (frame * selectionWidth), row: tile.row }));
                        rawForwardFrames.push({ img2Tiles: frameTiles, savedTiles: captureTiles(frameTiles, activeSet.image2) });
                    }
                }

                const firstTilesetFrame = rawForwardFrames[0];
                const levelFrame = { img2Tiles: img1Tiles, savedTiles: captureTiles(img1Tiles, activeSet.image1) };

                if (activeSet.bounceDouble) {
                    // ── BOUNCE ×2: two separate swaps (_in forward, _out reverse) ──────
                    // Build _in frames (with ANIM level prepend if applicable)
                    const inFrames = [];
                    if (activeSet.mode === 'anim') inFrames.push(levelFrame);
                    inFrames.push(...rawForwardFrames);

                    // Build _out frames = reverse of _in (so the last state of _in is the start of _out)
                    const outFrames = [...inFrames].reverse();
                    const firstOutFrame = outFrames[0];

                    activeSet.groups.push({
                        name: groupName + '_in',
                        img1Tiles: img1Tiles,
                        img2Tiles: firstTilesetFrame.img2Tiles,
                        savedTiles: firstTilesetFrame.savedTiles,
                        frames: inFrames.length,
                        bounceMode: false,
                        setMode: activeSet.mode,
                        useMultiImage: useMultiImage,
                        allFrames: inFrames,
                        setIndex: getActiveSetIndex()
                    });
                    activeSet.groups.push({
                        name: groupName + '_out',
                        img1Tiles: img1Tiles,
                        img2Tiles: firstOutFrame.img2Tiles,
                        savedTiles: firstOutFrame.savedTiles,
                        frames: outFrames.length,
                        bounceMode: false,
                        setMode: activeSet.mode,
                        useMultiImage: useMultiImage,
                        allFrames: outFrames,
                        setIndex: getActiveSetIndex()
                    });

                } else {
                    // ── BOUNCE (single swap): ping-pong [f0..fN, fN-1..f1] ──────────────
                    const forwardFrames = [];
                    if (activeSet.mode === 'anim') forwardFrames.push(levelFrame);
                    forwardFrames.push(...rawForwardFrames);

                    // Ping-pong: ascending then descending, skipping first and last to avoid doubling
                    const allFrames = [...forwardFrames];
                    for (let i = forwardFrames.length - 2; i >= 1; i--) {
                        allFrames.push(forwardFrames[i]);
                    }

                    activeSet.groups.push({
                        name: groupName,
                        img1Tiles: img1Tiles,
                        img2Tiles: firstTilesetFrame.img2Tiles,
                        savedTiles: firstTilesetFrame.savedTiles,
                        frames: allFrames.length,
                        bounceMode: true,
                        setMode: activeSet.mode,
                        useMultiImage: useMultiImage,
                        allFrames: allFrames,
                        setIndex: getActiveSetIndex()
                    });
                }

            } else {
                // Normal mode: create one group with frames
                const allFrameTiles = [];

                if (useMultiImage) {
                    // Multi-image mode: each loaded frame image is a separate animation frame
                    for (let frameIdx = 0; frameIdx < loadedFrames.length; frameIdx++) {
                        const frameData = loadedFrames[frameIdx];
                        const frameSel = frameData.selection;
                        const frameImg2Tiles = (frameSel && frameSel.size > 0)
                            ? Array.from(frameSel).map(key => { const [c, r] = key.split(',').map(Number); return { col: c, row: r }; }).sort((a, b) => a.row === b.row ? a.col - b.col : a.row - b.row)
                            : img2Tiles;
                        allFrameTiles.push({ img2Tiles: frameImg2Tiles, savedTiles: captureTiles(frameImg2Tiles, frameData.img) });
                    }
                } else {
                    // Single-image mode: horizontal offset per frame
                    for (let frame = 0; frame < frameCount; frame++) {
                        const frameTiles = img2Tiles.map(tile => ({
                            col: tile.col + (frame * selectionWidth),
                            row: tile.row
                        }));
                        allFrameTiles.push({ img2Tiles: frameTiles, savedTiles: captureTiles(frameTiles, activeSet.image2) });
                    }
                }

                // Keep reference to first tileset frame for group.img2Tiles / savedTiles fields
                const firstTilesetFrame = allFrameTiles[0];

                // ANIM mode: prepend Level tiles as frame 0
                if (activeSet.mode === 'anim') {
                    allFrameTiles.unshift({ img2Tiles: img1Tiles, savedTiles: captureTiles(img1Tiles, activeSet.image1) });
                }

                activeSet.groups.push({
                    name: groupName,
                    img1Tiles: img1Tiles,
                    img2Tiles: firstTilesetFrame.img2Tiles,
                    savedTiles: firstTilesetFrame.savedTiles,
                    frames: allFrameTiles.length,
                    useMultiImage: useMultiImage,
                    allFrames: allFrameTiles,
                    setIndex: getActiveSetIndex()
                });
            }

            // Clear selection based on KEEPSEL flags
            if (!activeSet.keepSel1) {
                activeSet.img1Selection.clear();
            }
            if (!activeSet.keepSel2) {
                activeSet.img2Selection.clear();
                // Also clear extra frame selections
                for (let i = 0; i < activeSet.selectionsExtra.length; i++) {
                    if (activeSet.selectionsExtra[i]) activeSet.selectionsExtra[i].clear();
                }
            }
            builderUpdateSelectionDisplay();
            builderRedrawSelections();

            document.getElementById('builderGroupName').value = '';

            // Reset frame count to 1
            activeSet.frameCount = 1;
            document.getElementById('builderFrameCount').textContent = '1';
            
            // Update displays
            TilesetManager.generate();
            builderUpdateAllCode();
            if (typeof updateSequencesDisplay === 'function') {
                updateSequencesDisplay();
            }

            // Show code sections
            document.getElementById('builderCodeSection').classList.remove('hidden');

            // Show sequencer section when groups exist (so users can create sequences)
            if (activeSet.groups.length > 0) {
                document.getElementById('builderSequencerSection').classList.remove('hidden');
            }

            // Toast notification
            const totalFrames = activeSet.groups[activeSet.groups.length - 1].frames;
            if (mirrorMode) {
                showToast(`Swap "${groupName}" added (${totalFrames} frames, ping-pong)`);
            } else {
                showToast(`Swap "${groupName}" added (${totalFrames} frame${totalFrames > 1 ? 's' : ''})`);
            }
        }
        
        
        // ====== TILESET MANAGER ======
        const TilesetManager = {
            // Delegates to engine.js pure functions
            getGroupRange(groupIndex)                              { return tmGetGroupRange(groupIndex); },
            getResolvedTileIndex(group, fi, tileInFrame, fallback) { return tmGetResolvedTileIndex(group, fi, tileInFrame, fallback); },

            refreshPreview() {
                if (!tilesetPreviewVisible) return;
                const previewCanvas = document.getElementById('builderTilesetCanvasPreview');
                if (!previewCanvas || builderTilesetCanvas.width === 0) return;
                previewCanvas.width = builderTilesetCanvas.width;
                previewCanvas.height = builderTilesetCanvas.height;
                const ctx = previewCanvas.getContext('2d');
                ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
                ctx.drawImage(builderTilesetCanvas, 0, 0);
                applyPreviewZoom();
            },

            updateSaveButtons() {
                const hasGroups = activeSet.groups.length > 0;
                const hasTileset = builderTilesetCanvas && builderTilesetCanvas.width > 0 && builderTilesetCanvas.height > 0;
                const saveGBTSBtn = document.getElementById('builderSaveTilesetBtnHeader');
                if (saveGBTSBtn) {
                    saveGBTSBtn.disabled = !hasGroups;
                    saveGBTSBtn.style.opacity = hasGroups ? '1' : '0.3';
                }
                const savePNGBtn = document.getElementById('builderSavePNGBtnHeader');
                if (savePNGBtn) {
                    savePNGBtn.disabled = !hasTileset;
                    savePNGBtn.style.opacity = hasTileset ? '1' : '0.3';
                }
                const generatedBtn = document.getElementById('generatedBtn');
                if (generatedBtn) {
                    generatedBtn.disabled = !hasTileset;
                    generatedBtn.style.opacity = hasTileset ? '1' : '0.3';
                    generatedBtn.style.cursor = hasTileset ? 'pointer' : 'not-allowed';
                }
            },

            generate() {
                setTilesetImageData(null);
                setTilesetImageBackup(null);
                if (activeSet.groups.length === 0) {
                    builderTilesetCanvas.width = 0;
                    builderTilesetCanvas.height = 0;
                    TilesetManager.updateSaveButtons();
                    return;
                }
                if (workMode === 'reference') {
                    if (activeSet.image2) {
                        builderTilesetCanvas.width = activeSet.image2.width;
                        builderTilesetCanvas.height = activeSet.image2.height;
                        builderTilesetCtx.clearRect(0, 0, builderTilesetCanvas.width, builderTilesetCanvas.height);
                        builderTilesetCtx.drawImage(activeSet.image2, 0, 0);
                        setTilesetImageData(builderTilesetCanvas.toDataURL());
                    } else {
                        builderTilesetCanvas.width = 0;
                        builderTilesetCanvas.height = 0;
                    }
                    TilesetManager.updateSaveButtons();
                    return;
                }
                // CREATE mode — delegate pure deduplication to engine.js
                const { uniquePixels, uniqueImages, totalUnique, tilesPerRow } =
                    generateTilesetDedup(activeSet.groups);
                // Canvas sized to unique tile count
                const numRows = Math.ceil(totalUnique / tilesPerRow);
                builderTilesetCanvas.width = tilesPerRow * 8;
                builderTilesetCanvas.height = numRows * 8;
                builderTilesetCtx.clearRect(0, 0, builderTilesetCanvas.width, builderTilesetCanvas.height);
                // Draw unique tiles
                let asyncPending = 0;
                uniqueImages.forEach((imageData, u) => {
                    const destX = (u % tilesPerRow) * 8;
                    const destY = Math.floor(u / tilesPerRow) * 8;
                    if (uniquePixels[u]) {
                        builderTilesetCtx.putImageData(
                            new ImageData(new Uint8ClampedArray(uniquePixels[u]), 8, 8), destX, destY
                        );
                    } else {
                        asyncPending++;
                        const img = new Image();
                        img.onload = function() {
                            builderTilesetCtx.drawImage(img, destX, destY, 8, 8);
                            asyncPending--;
                            if (asyncPending === 0) { TilesetManager.updateSaveButtons(); TilesetManager.refreshPreview(); }
                        };
                        img.src = imageData;
                    }
                });
                builderTilesetCanvas.onmousemove = e => TilesetManager.handleHover(e);
                builderTilesetCanvas.onmouseleave = () => TilesetManager.clearHighlights();
                TilesetManager.updateSaveButtons();
                TilesetManager.refreshPreview();
            },

            highlightGroup(groupIndex) {
                if (currentHighlightedGroup === groupIndex) return;
                currentHighlightedGroup = groupIndex;
                const group = activeSet.groups[groupIndex];
                if (!group || builderTilesetCanvas.width === 0) return;
                if (!tilesetImageBackup) {
                    setTilesetImageBackup(builderTilesetCtx.getImageData(0, 0, builderTilesetCanvas.width, builderTilesetCanvas.height));
                }
                if (tilesetImageBackup && tilesetImageBackup instanceof ImageData) {
                    builderTilesetCtx.putImageData(tilesetImageBackup, 0, 0);
                }
                const tileIndices = new Set();
                const frameSets = (group.frames > 1 && group.allFrames)
                    ? group.allFrames.map(f => f.savedTiles) : [group.savedTiles];
                if (frameSets.every(tiles => tiles && tiles[0]?.tilesetIndex !== undefined)) {
                    frameSets.forEach(tiles => tiles.forEach(t => tileIndices.add(t.tilesetIndex)));
                } else {
                    let tileOffset = 0;
                    for (let i = 0; i < groupIndex; i++) {
                        const pg = activeSet.groups[i];
                        tileOffset += pg.frames > 1 ? pg.img1Tiles.length * pg.frames : pg.img1Tiles.length;
                    }
                    const totalTiles = group.frames > 1 ? group.img1Tiles.length * group.frames : group.img1Tiles.length;
                    for (let i = 0; i < totalTiles; i++) tileIndices.add(tileOffset + i);
                }
                const tilesPerRow = Math.floor(builderTilesetCanvas.width / 8);
                builderTilesetCtx.strokeStyle = '#04d9ff';
                builderTilesetCtx.lineWidth = 1;
                builderTilesetCtx.shadowColor = '#04d9ff';
                builderTilesetCtx.shadowBlur = 6;
                tileIndices.forEach(tileIndex => {
                    const col = tileIndex % tilesPerRow;
                    const row = Math.floor(tileIndex / tilesPerRow);
                    builderTilesetCtx.strokeRect(col * 8, row * 8, 8, 8);
                });
                builderTilesetCtx.shadowBlur = 0;
                TilesetManager.refreshPreview();
            },

            clearHighlight() {
                currentHighlightedGroup = -1;
                if (tilesetImageBackup && tilesetImageBackup instanceof ImageData && builderTilesetCanvas.width > 0) {
                    builderTilesetCtx.putImageData(tilesetImageBackup, 0, 0);
                }
                TilesetManager.refreshPreview();
            },

            handleHover(event) {
                const rect = builderTilesetCanvas.getBoundingClientRect();
                const x = event.clientX - rect.left;
                const y = event.clientY - rect.top;
                const tileCol = Math.floor(x / 8);
                const tileRow = Math.floor(y / 8);
                const tilesPerRow = Math.floor(builderTilesetCanvas.width / 8);
                const tileIndex = tileRow * tilesPerRow + tileCol;
                let currentIndex = 0;
                let foundGroupIndex = -1;
                let tileIndexInGroup = -1;
                for (let groupIndex = 0; groupIndex < activeSet.groups.length; groupIndex++) {
                    const group = activeSet.groups[groupIndex];
                    const groupTileCount = group.frames > 1 && group.allFrames
                        ? group.img1Tiles.length * group.frames
                        : group.savedTiles.length;
                    if (tileIndex >= currentIndex && tileIndex < currentIndex + groupTileCount) {
                        foundGroupIndex = groupIndex;
                        tileIndexInGroup = tileIndex - currentIndex;
                        break;
                    }
                    currentIndex += groupTileCount;
                }
                if (foundGroupIndex !== -1) {
                    highlightGroupEverywhere(foundGroupIndex);
                    const tooltip = document.getElementById('builderTooltip');
                    const group = activeSet.groups[foundGroupIndex];
                    const containingSequences = [];
                    sequences.forEach((seq, seqIdx) => {
                        seq.items.forEach(item => {
                            if (item.type === 'group' && item.groupIndex === foundGroupIndex) {
                                if (!containingSequences.includes(seqIdx)) containingSequences.push(seqIdx);
                            }
                        });
                    });
                    let tooltipHTML = `<div style="color: #04d9ff;">Tileset Position: (${tileCol}, ${tileRow})</div>`;
                    tooltipHTML += `<div style="color: #04d9ff;">Tile Index: ${tileIndex}</div>`;
                    tooltipHTML += `<div style="color: #04d9ff; margin-top: 4px;">Swap #${foundGroupIndex + 1}</div>`;
                    if (group.frames > 1) {
                        const frameIndex = Math.floor(tileIndexInGroup / group.img1Tiles.length);
                        tooltipHTML += `<div style="color: #00ff00;">Frame: ${frameIndex + 1}/${group.frames}</div>`;
                    }
                    tooltipHTML += `<div style="color: #00ff00;">Tiles in Swap: ${group.frames > 1 ? group.img1Tiles.length * group.frames : group.savedTiles.length}</div>`;
                    if (containingSequences.length > 0) {
                        tooltipHTML += `<div style="color: #FF13F0; margin-top: 4px;">In Sequences: ${containingSequences.map(idx => '#' + (idx + 1)).join(', ')}</div>`;
                    }
                    tooltip.innerHTML = tooltipHTML;
                    tooltip.style.display = 'block';
                    tooltip.style.left = (event.clientX + 15) + 'px';
                    tooltip.style.top = (event.clientY + 15) + 'px';
                } else {
                    TilesetManager.clearHighlights();
                }
            },

            clearHighlights() {
                const groupBlocks = document.querySelectorAll('.frame-code-block');
                groupBlocks.forEach(block => {
                    block.style.background = '#001122';
                    block.style.borderColor = '#04d9ff';
                });
                document.querySelectorAll('[ondragstart*="sequenceDragStart"]').forEach(elem => {
                    if (elem.style.background.includes('rgba(255, 19, 240')) {
                        elem.style.background = elem.querySelector('[style*="background: #330033"]') ? '#330033' : '#000';
                    }
                });
                activeSet.highlight1.innerHTML = '';
                activeSet.highlight2.innerHTML = '';
                const tooltip = document.getElementById('builderTooltip');
                if (tooltip) tooltip.style.display = 'none';
            },
        };
        
        // getTileIndexFromCoordinates / calculateTileIndex → engine.js


        function editGroupName(index, event) {
            event.stopPropagation(); // Prevent toggling code preview
            
            const currentName = activeSet.groups[index].name;
            const span = event.target;
            
            // Create input element
            const input = document.createElement('input');
            input.type = 'text';
            input.value = currentName;
            input.style.cssText = 'background: #000; color: #00ff00; border: 1px solid #00ff00; padding: 2px 6px; font-size: 13px; font-family: "Source Sans Pro", sans-serif; font-weight: bold; border-radius: 2px; width: 200px;';
            
            // Replace span with input
            span.style.display = 'none';
            span.parentElement.insertBefore(input, span);
            input.focus();
            input.select();
            
            // Save on Enter or blur
            const saveEdit = () => {
                const newName = input.value.trim();
                if (newName && newName !== currentName) {
                    activeSet.groups[index].name = newName;
                    builderUpdateAllCode();
                    builderRedrawSelections();
                } else {
                    // Restore original if cancelled or empty
                    span.style.display = '';
                    input.remove();
                }
            };
            
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    saveEdit();
                } else if (e.key === 'Escape') {
                    span.style.display = '';
                    input.remove();
                }
            });
            
            input.addEventListener('blur', saveEdit);
        }
        
        function builderDeleteGroup(index) {
            // Save state for undo
            const deletedGroup = JSON.parse(JSON.stringify(activeSet.groups[index])); // Deep copy
            const deletedIndex = index;

            // Delete the group
            activeSet.groups.splice(index, 1);

            // Update sequences - remove deleted group and adjust indices
            if (typeof sequences !== 'undefined' && sequences && Array.isArray(sequences)) {
                sequences.forEach(seq => {
                    if (seq && seq.frames && Array.isArray(seq.frames)) {
                        seq.frames.forEach(frame => {
                            if (Array.isArray(frame)) {
                                // Remove the deleted group from frames
                                const deleteIndex = frame.indexOf(index);
                                if (deleteIndex > -1) {
                                    frame.splice(deleteIndex, 1);
                                }
                                // Adjust indices of groups that were after the deleted one
                                for (let i = 0; i < frame.length; i++) {
                                    if (frame[i] > index) {
                                        frame[i]--;
                                    }
                                }
                            }
                        });
                    }
                });
            }

            if (typeof updateSequencesDisplay === 'function') {
                updateSequencesDisplay();
            }
            builderRedrawSelections();
            TilesetManager.generate();
            builderUpdateAllCode();

            if (activeSet.groups.length === 0) {
                document.getElementById('builderCodeSection').classList.add('hidden');
                document.getElementById('builderSequencerSection').classList.add('hidden');
            }

            // Show undo notification
            showUndo(`Delete "${deletedGroup.name}"`, () => {
                // Undo function: restore the deleted group
                activeSet.groups.splice(deletedIndex, 0, deletedGroup);
                builderRedrawSelections();
                TilesetManager.generate();
                builderUpdateAllCode();

                document.getElementById('builderCodeSection').classList.remove('hidden');
                if (typeof updateSequencesDisplay === 'function') {
                    updateSequencesDisplay();
                }
            });
        }
        
        // builderGenerateTileset / refreshTilesetPreviewCanvas / getResolvedTileIndex / updateSaveButtonStates → TilesetManager (above)
        
        async function builderDownloadTileset() {
            const tilesetName = getTilesetName() || 'tileset';
            const filename = `${tilesetName}.png`;
            
            // Try File System Access API first (Chrome/Edge 86+)
            if ('showSaveFilePicker' in window) {
                try {
                    const handle = await window.showSaveFilePicker({
                        suggestedName: filename,
                        types: [{
                            description: 'PNG Image',
                            accept: {'image/png': ['.png']}
                        }]
                    });
                    
                    // Convert canvas to blob
                    const blob = await new Promise(resolve => {
                        builderTilesetCanvas.toBlob(resolve, 'image/png');
                    });
                    
                    const writable = await handle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                    
                    showToast(`Exported ${filename}`);
                    return;
                } catch (err) {
                    // User cancelled or error - fall back to download
                    if (err.name !== 'AbortError') {
                        console.log('File System Access API failed, using fallback:', err);
                    } else {
                        return; // User cancelled
                    }
                }
            }
            
            // Fallback: Traditional download
            const link = document.createElement('a');
            link.download = filename;
            link.href = builderTilesetCanvas.toDataURL();
            link.click();
            showToast(`Exported ${filename}`);
        }
        
        function builderUpdateAllCode() {
            const container = document.getElementById('builderCodeContainer');
            const emptyState = document.getElementById('builderGroupsEmptyState');
            const tilesetName = getTilesetName();
            const tilesetType = getTilesetType();
            const gbvmMode = getGbvmMode();

            // Update SWAPS header stats
            const statsEl = document.getElementById('swapsTilesetStats');
            if (statsEl) {
                const levelTiles = activeSet.image1
                    ? Math.ceil(activeSet.image1.width / 8) * Math.ceil(activeSet.image1.height / 8)
                    : 0;
                const totalSwaps = activeSet.groups.length;
                const swapTiles = activeSet.groups.reduce((sum, g) =>
                    sum + (g.frames > 1 && g.allFrames ? g.img1Tiles.length * g.frames : g.img1Tiles.length), 0);
                const totalTiles = levelTiles + swapTiles;
                const pct = Math.round(totalTiles / 192 * 100);

                const levelPart = levelTiles > 0
                    ? `LEVEL <span style="font-weight:bold;">${levelTiles}</span> &nbsp;·&nbsp; `
                    : '';
                const swapPart = totalSwaps > 0
                    ? `${totalSwaps} swap${totalSwaps > 1 ? 's' : ''} <span style="font-weight:bold;">${swapTiles}</span> &nbsp;·&nbsp; `
                    : '';
                const totalPart = (levelTiles > 0 || totalSwaps > 0)
                    ? `total <span style="font-weight:bold;">${totalTiles}</span> / 192 (${pct}%)`
                    : '';

                statsEl.innerHTML = levelPart + swapPart + totalPart;
            }

            if (activeSet.groups.length === 0) {
                // Show empty state
                if (emptyState) emptyState.style.display = 'block';
                // Clear any existing groups HTML
                Array.from(container.children).forEach(child => {
                    if (child.id !== 'builderGroupsEmptyState') {
                        child.remove();
                    }
                });
                return;
            }
            
            // Hide empty state when groups exist
            if (emptyState) emptyState.style.display = 'none';
            
            // Generate bank and data variable names
            let tiledataBank, tiledata;
            if (tilesetName) {
                tiledataBank = `___bank_${tilesetType}_${tilesetName}`;
                tiledata = `_${tilesetType}_${tilesetName}`;
            } else {
                tiledataBank = `___bank_${tilesetType}_TILESET`;
                tiledata = `_${tilesetType}_TILESET`;
            }
            
            let tileOffset = 0;
            let codeBlocks = '';
            
            activeSet.groups.forEach((group, groupIndex) => {
                const tileRange = TilesetManager.getGroupRange(groupIndex);
                let groupCode = '';
                
                if (group.frames > 1 && group.allFrames) {
                    // Multi-frame group
                    const groupComment = `; === ${group.name} ===`;
                    const framesParts = [];

                    if (gbvmMode === 'tiledata') {
                        // TileData mode: output x,y,t format with | separator between frames
                        group.allFrames.forEach((frame, frameIndex) => {
                            const tileDataLines = group.img1Tiles.map((tile, index) => {
                                let tileIndex;
                                if (group.bounceMode && workMode === 'reference') {
                                    // Bounce group: each frame has explicit img2Tiles (no horizontal offset)
                                    // Frame 1 = out (img2 coords), Frame 2 = in/restore (img1 coords)
                                    const sourceTile = frame.img2Tiles[index];
                                    tileIndex = getTileIndexFromCoordinates(sourceTile.col, sourceTile.row);
                                } else if (workMode === 'reference') {
                                    // Normal multi-frame: horizontal offset in tileset
                                    const sourceTile = group.img2Tiles[index];
                                    tileIndex = getTileIndexFromCoordinates(sourceTile.col + (frameIndex * (Math.max(...group.img2Tiles.map(t => t.col)) - Math.min(...group.img2Tiles.map(t => t.col)) + 1)), sourceTile.row);
                                } else {
                                    tileIndex = tileOffset + (frameIndex * group.img1Tiles.length) + index;
                                }
                                return `${tile.col},${tile.row},${tileIndex}`;
                            }).join(';');
                            framesParts.push(tileDataLines);
                        });

                        groupCode = framesParts.join(';|\n');
                        
                    } else {
                        // GBVM modes (arg0/direct)
                        group.allFrames.forEach((frame, frameIndex) => {
                            const frameComment = `; ---- Frame ${frameIndex + 1} ----`;
                            let frameCode = '';
                            
                            if (gbvmMode === 'arg0') {
                                frameCode = group.img1Tiles.map((tile, index) => {
                                    const tileIndex = tileOffset + (frameIndex * group.img1Tiles.length) + index;
                                    return `VM_PUSH_CONST ${tileIndex}\nVM_REPLACE_TILE_XY ${tile.col}, ${tile.row}, ${tiledataBank}, ${tiledata}, .ARG0\nVM_POP 1`;
                                }).join('\n\n');
                            } else {
                                frameCode = group.img1Tiles.map((tile, index) => {
                                    const tileIndex = tileOffset + (frameIndex * group.img1Tiles.length) + index;
                                    return `VM_REPLACE_TILE_XY ${tile.col}, ${tile.row}, ${tiledataBank}, ${tiledata}, ${tileIndex}`;
                                }).join('\n');
                            }
                            
                            const waitCode = `; Wait For 0.2 Seconds
        ; Wait 2 Frames
        VM_SET_CONST            .LOCAL_TMP0_WAIT_ARGS, 2
        VM_INVOKE               b_wait_frames, _wait_frames, 0, .LOCAL_TMP0_WAIT`;
                            
                            framesParts.push(`${frameComment}\n${frameCode}\n\n${waitCode}`);
                        });
                        
                        groupCode = groupComment + '\n' + framesParts.join('\n\n');
                    }
                    
                } else {
                    // Single frame group
                    const groupComment = `; === ${group.name} ===`;
                    
                    if (gbvmMode === 'tiledata') {
                        // TileData mode: output x,y,t format
                        const tileDataLines = group.img1Tiles.map((tile, index) => {
                            let tileIndex;
                            if (workMode === 'reference') {
                                // Use tile coordinates from img2Tiles (TILESET.PNG)
                                const sourceTile = group.img2Tiles[index];
                                tileIndex = getTileIndexFromCoordinates(sourceTile.col, sourceTile.row);
                            } else {
                                tileIndex = tileOffset + index;
                            }
                            return `${tile.col},${tile.row},${tileIndex}`;
                        }).join(';');

                        groupCode = tileDataLines;
                        
                    } else if (gbvmMode === 'arg0') {
                        groupCode = groupComment + '\n' + group.img1Tiles.map((tile, index) => {
                            const tileIndex = tileOffset + index;
                            return `VM_PUSH_CONST ${tileIndex}\nVM_REPLACE_TILE_XY ${tile.col}, ${tile.row}, ${tiledataBank}, ${tiledata}, .ARG0\nVM_POP 1`;
                        }).join('\n\n');
                    } else {
                        groupCode = groupComment + '\n' + group.img1Tiles.map((tile, index) => {
                            const tileIndex = tileOffset + index;
                            return `VM_REPLACE_TILE_XY ${tile.col}, ${tile.row}, ${tiledataBank}, ${tiledata}, ${tileIndex}`;
                        }).join('\n');
                    }
                }
                
                // Display info
                let displayInfo = '';
                if (group.frames > 1) {
                    displayInfo = `${group.img1Tiles.length} tiles × ${group.frames} frames | Tileset: ${tileRange}`;
                } else {
                    displayInfo = `${group.img1Tiles.length} tiles | Tileset: ${tileRange}`;
                }
                
                codeBlocks += `
                    <div class="frame-code-block" data-group-index="${groupIndex}" draggable="true"
                         onmouseover="highlightGroupEverywhere(${groupIndex})"
                         onmouseout="clearGroupHighlights()">
                        <div class="frame-code-header" style="display: flex; justify-content: space-between; align-items: center;">
                            <div style="display: flex; gap: 5px; align-items: center; flex: 1;">
                                <span class="group-drag-handle" title="Drag to reorder">⋮⋮</span>
                                <div style="display: flex; gap: 15px; align-items: center; flex: 1; cursor: pointer;" onclick="toggleCodePreview(${groupIndex})">
                                    <span style="color: #04d9ff; font-size: 14px; user-select: none;">▶</span>
                                    <span class="frame-code-label"
                                          ondblclick="editGroupName(${groupIndex}, event)"
                                          style="cursor: text;"
                                          title="Double-click to edit">${group.name}</span>
                                    ${group.frames > 1 ? '<span style="display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; background: #04d9ff; border-radius: 50%; color: #000; font-size: 11px; line-height: 16px; margin-left: 5px;">➟</span>' : ''}
                                    <span style="color: #0399aa; font-size: 10px;">${displayInfo}</span>
                                </div>
                            </div>
                            <div style="display: flex; gap: 8px;" onclick="event.stopPropagation()">
                                <button class="frame-copy-btn" onclick="builderCopyGroupCode(${groupIndex})">COPY</button>
                                <button class="builder-group-btn" onclick="builderDeleteGroup(${groupIndex})" style="background: #000; color: #ff0066; border: 2px solid #ff0066; padding: 0; width: 28px; height: 28px; border-radius: 50%; font-size: 16px; font-weight: bold; display: flex; align-items: center; justify-content: center; line-height: 1;">×</button>
                                <button class="toggle-btn group-preview-btn" id="groupPreviewBtn${groupIndex}" onclick="previewActivateGroup(${groupIndex})" style="background: #000; color: #FF13F0; border: 2px solid #FF13F0; padding: 4px; font-size: 16px; font-weight: normal; font-family: FontAwesome; border-radius: 2px; cursor: pointer; transition: all 0.2s; line-height: 1; min-width: 28px; height: 28px;" title="Preview this swap">
                                    <i class="fa fa-eye"></i>
                                </button>
                            </div>
                        </div>
                        <div class="frame-code-content" id="builderGroupCode${groupIndex}" style="display: none;">${groupCode}</div>
                    </div>
                `;

                // Update tile offset
                if (group.frames > 1 && group.allFrames) {
                    tileOffset += group.img1Tiles.length * group.frames;
                } else {
                    tileOffset += group.img1Tiles.length;
                }
            });
            
            // Preserve empty state element before setting innerHTML
            const emptyStateHTML = emptyState ? emptyState.outerHTML : '';
            container.innerHTML = emptyStateHTML + codeBlocks;
            
            // Add drag and drop event listeners to all group blocks
            const groupBlocks = container.querySelectorAll('.frame-code-block');
            groupBlocks.forEach((block, index) => {
                block.addEventListener('dragstart', handleDragStart);
                block.addEventListener('dragend', handleDragEnd);
                block.addEventListener('dragover', handleDragOver);
                block.addEventListener('drop', handleDrop);
                block.addEventListener('dragleave', handleDragLeave);

                // Add hover listeners to the header only (not the whole block)
                const header = block.querySelector('.frame-code-header');
                if (header) {
                    header.addEventListener('mouseenter', () => TilesetManager.highlightGroup(index));
                    header.addEventListener('mouseleave', () => TilesetManager.clearHighlight());
                }

                // Add click listener for delete button
                const deleteBtn = block.querySelector('.builder-group-btn[onclick*="builderDeleteGroup"]');
                if (deleteBtn) {
                    // Remove the inline onclick to avoid conflicts
                    deleteBtn.removeAttribute('onclick');
                    deleteBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        builderDeleteGroup(index);
                    });
                }
            });

            // Update button states after updating code
            TilesetManager.updateSaveButtons();
        }

        function toggleCodePreview(groupIndex) {
            const codeElement = document.getElementById(`builderGroupCode${groupIndex}`);
            const isHidden = codeElement.style.display === 'none';
            
            // Toggle visibility
            if (isHidden) {
                codeElement.style.display = 'block';
                // Change arrow to down
                codeElement.previousElementSibling.querySelector('span').textContent = '▼';
            } else {
                codeElement.style.display = 'none';
                // Change arrow to right
                codeElement.previousElementSibling.querySelector('span').textContent = '▶';
            }
        }
        
        function builderCopyGroupCode(groupIndex) {
            const codeElement = document.getElementById(`builderGroupCode${groupIndex}`);
            const code = codeElement ? codeElement.textContent : '';
            
            if (!code || code.length === 0) {
                return;
            }
            
            navigator.clipboard.writeText(code).then(() => {
                copiedFeedback(event.target);
                showToast('Swap code copied to clipboard');
            }).catch(err => {
                console.error('Failed to copy code:', err);
            });
        }
        
        // ====== GROUP MANAGER ======
        // Facade over group management standalone functions
        const GroupManager = {
            addGroup()                    { return builderAddGroup(); },
            editName(index, event)        { return editGroupName(index, event); },
            remove(index)                 { return builderDeleteGroup(index); },
            updateAllCode()               { return builderUpdateAllCode(); },
            toggleCodePreview(groupIndex) { return toggleCodePreview(groupIndex); },
            copyCode(groupIndex)          { return builderCopyGroupCode(groupIndex); },
        };

        async function builderSaveAllCode() {
            if (activeSet.groups.length === 0) {
                alert('No swaps to save');
                return;
            }
            
            const tilesetName = getTilesetName();
            const tilesetType = getTilesetType();
            const gbvmMode = getGbvmMode();
            
            // Generate bank and data variable names
            let tiledataBank, tiledata;
            if (tilesetName) {
                tiledataBank = `___bank_${tilesetType}_${tilesetName}`;
                tiledata = `_${tilesetType}_${tilesetName}`;
            } else {
                tiledataBank = `___bank_${tilesetType}_TILESET`;
                tiledata = `_${tilesetType}_TILESET`;
            }
            
            // Generate all code with comments
            let allCode = [];
            let tileOffset = 0;
            
            activeSet.groups.forEach((group, groupIndex) => {
                if (group.frames > 1 && group.allFrames) {
                    // Multi-frame group
                    const groupComment = `; === ${group.name} ===`;
                    
                    if (gbvmMode === 'tiledata') {
                        // TileData mode
                        const framesParts = [];
                        group.allFrames.forEach((frame, frameIndex) => {
                            const tileDataLines = group.img1Tiles.map((tile, index) => {
                                let tileIndex;
                                if (workMode === 'reference') {
                                    // Use tile coordinates from img2Tiles (TILESET.PNG)
                                    const sourceTile = group.img2Tiles[index];
                                    tileIndex = getTileIndexFromCoordinates(sourceTile.col + (frameIndex * (Math.max(...group.img2Tiles.map(t => t.col)) - Math.min(...group.img2Tiles.map(t => t.col)) + 1)), sourceTile.row);
                                } else {
                                    tileIndex = tileOffset + (frameIndex * group.img1Tiles.length) + index;
                                }
                                return `${tile.col},${tile.row},${tileIndex}`;
                            }).join(';');
                            framesParts.push(tileDataLines);
                        });
                        
                        allCode.push(framesParts.join(';|\n'));
                        
                    } else {
                        // GBVM modes
                        const framesParts = [];
                        group.allFrames.forEach((frame, frameIndex) => {
                            const frameComment = `; ---- Frame ${frameIndex + 1} ----`;
                            let frameCode = '';
                            
                            if (gbvmMode === 'arg0') {
                                frameCode = group.img1Tiles.map((tile, index) => {
                                    const tileIndex = tileOffset + (frameIndex * group.img1Tiles.length) + index;
                                    return `VM_PUSH_CONST ${tileIndex}\nVM_REPLACE_TILE_XY ${tile.col}, ${tile.row}, ${tiledataBank}, ${tiledata}, .ARG0\nVM_POP 1`;
                                }).join('\n\n');
                            } else {
                                frameCode = group.img1Tiles.map((tile, index) => {
                                    const tileIndex = tileOffset + (frameIndex * group.img1Tiles.length) + index;
                                    return `VM_REPLACE_TILE_XY ${tile.col}, ${tile.row}, ${tiledataBank}, ${tiledata}, ${tileIndex}`;
                                }).join('\n');
                            }
                            
                            const waitCode = `; Wait For 0.2 Seconds
        ; Wait 2 Frames
        VM_SET_CONST            .LOCAL_TMP0_WAIT_ARGS, 2
        VM_INVOKE               b_wait_frames, _wait_frames, 0, .LOCAL_TMP0_WAIT`;
                            
                            framesParts.push(`${frameComment}\n${frameCode}\n\n${waitCode}`);
                        });
                        
                        allCode.push(groupComment + '\n' + framesParts.join('\n\n'));
                    }
                    
                    tileOffset += group.img1Tiles.length * group.frames;
                    
                } else {
                    // Single frame group
                    const groupComment = `; === ${group.name} ===`;
                    let groupCode = '';
                    
                    if (gbvmMode === 'tiledata') {
                        // TileData mode
                        groupCode = group.img1Tiles.map((tile, index) => {
                            let tileIndex;
                            if (workMode === 'reference') {
                                // Use tile coordinates from img2Tiles (TILESET.PNG)
                                const sourceTile = group.img2Tiles[index];
                                tileIndex = getTileIndexFromCoordinates(sourceTile.col, sourceTile.row);
                            } else {
                                tileIndex = tileOffset + index;
                            }
                            return `${tile.col},${tile.row},${tileIndex}`;
                        }).join(';');
                        allCode.push(groupCode);
                        
                    } else if (gbvmMode === 'arg0') {
                        groupCode = group.img1Tiles.map((tile, index) => {
                            const tileIndex = tileOffset + index;
                            return `VM_PUSH_CONST ${tileIndex}\nVM_REPLACE_TILE_XY ${tile.col}, ${tile.row}, ${tiledataBank}, ${tiledata}, .ARG0\nVM_POP 1`;
                        }).join('\n\n');
                        allCode.push(groupComment + '\n' + groupCode);
                    } else {
                        groupCode = group.img1Tiles.map((tile, index) => {
                            const tileIndex = tileOffset + index;
                            return `VM_REPLACE_TILE_XY ${tile.col}, ${tile.row}, ${tiledataBank}, ${tiledata}, ${tileIndex}`;
                        }).join('\n');
                        allCode.push(groupComment + '\n' + groupCode);
                    }
                    
                    tileOffset += group.img1Tiles.length;
                }
            });
            
            const finalCode = allCode.join('\n\n');
            const filename = tilesetName ? `${tilesetName}_code.txt` : 'tileset_code.txt';
            
            // Try File System Access API first (Chrome/Edge 86+)
            if ('showSaveFilePicker' in window) {
                try {
                    const handle = await window.showSaveFilePicker({
                        suggestedName: filename,
                        types: [{
                            description: 'Text File',
                            accept: {'text/plain': ['.txt']}
                        }]
                    });
                    
                    const writable = await handle.createWritable();
                    await writable.write(finalCode);
                    await writable.close();
                    
                    showToast(`Exported ${filename}`);
                    return;
                } catch (err) {
                    // User cancelled or error - fall back to download
                    if (err.name !== 'AbortError') {
                        console.log('File System Access API failed, using fallback:', err);
                    } else {
                        return; // User cancelled
                    }
                }
            }
            
            // Fallback: Traditional download
            const blob = new Blob([finalCode], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = filename;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
            showToast(`Exported ${filename}`);
        }
        
        // Save Project function - saves entire project state
        function builderSaveProject() {
            if (activeSet.groups.length === 0) {
                alert('No swaps to save. Create at least one swap first.');
                return;
            }
            
            const tilesetName = getTilesetName();
            const projectName = tilesetName || 'tileset';
            
            // Create project data object
            const projectData = {
                version: '1.0',
                tilesetName: tilesetName,
                groups: activeSet.groups,
                tilesetType: getTilesetType(),
                gbvmMode: getGbvmMode(),
                // Save reference images as base64 (optional - for reference only)
                image1Data: activeSet.image1 ? activeSet.canvas1.toDataURL() : null,
                image2Data: activeSet.image2 ? activeSet.canvas2.toDataURL() : null,
                image1Filename: activeSet.image1Filename,
                image2Filename: activeSet.image2Filename
            };
            
            // Convert to JSON and create download
            const json = JSON.stringify(projectData, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = `${projectName}.gbtiles`;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
            
            console.log('Project saved:', projectName);
        }
        
        // Load Project function - restores project state
        function builderLoadProject(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const projectData = JSON.parse(e.target.result);
                    
                    // Validate project data
                    if (!projectData.version || !projectData.groups) {
                        alert('Invalid project file format.');
                        return;
                    }
                    
                    // Restore tileset name
                    if (projectData.tilesetName) {
                        activeSet.tilesetName = projectData.tilesetName;
                    }
                    
                    // Restore groups
                    activeSet.groups = projectData.groups;
                    
                    // Restore tileset type and GBVM mode
                    if (projectData.tilesetType) {
                        setTilesetType(projectData.tilesetType);
                    }
                    if (projectData.gbvmMode) {
                        setGbvmMode(projectData.gbvmMode);
                    }
                    
                    // Optionally restore reference images
                    if (projectData.image1Data) {
                        const img1 = new Image();
                        img1.onload = function() {
                            activeSet.image1 = img1;
                            activeSet.image1Filename = projectData.image1Filename || 'loaded_reference.png';
                            activeSet.canvas1.width = img1.width;
                            activeSet.canvas1.height = img1.height;
                            activeSet.ctx1.drawImage(img1, 0, 0);
                            document.getElementById('builderLabel1').textContent = activeSet.image1Filename;
                            ImageManager.updateLayout();
                            builderRedrawSelections();
                        };
                        img1.src = projectData.image1Data;
                    }
                    
                    if (projectData.image2Data) {
                        const img2 = new Image();
                        img2.onload = function() {
                            activeSet.image2 = img2;
                            activeSet.image2Filename = projectData.image2Filename || 'loaded_source.png';
                            activeSet.canvas2.width = img2.width;
                            activeSet.canvas2.height = img2.height;
                            activeSet.ctx2.drawImage(img2, 0, 0);
                            document.getElementById('builderLabel2').textContent = activeSet.image2Filename;
                            ImageManager.updateLayout();
                            builderRedrawSelections();
                        };
                        img2.src = projectData.image2Data;
                    }
                    
                    // Regenerate tileset and code
                    TilesetManager.generate();
                    builderUpdateAllCode();
                    
                    // Show output sections
                    document.getElementById('builderCodeSection').classList.remove('hidden');
                    
                    // Clear the file input
                    event.target.value = '';
                    
                    // Success - no alert needed
                    
                } catch (error) {
                    console.error('Error loading project:', error);
                    alert('Failed to load project file. The file may be corrupted or invalid.');
                }
            };
            
            reader.readAsText(file);
        }
        
        // ── V2 LOAD HELPERS ──────────────────────────────────────────────────────

        // Parse one group JSON object into a runtime group object (shared by V1 + V2 load).
        function parseGroupFromJson(groupJson) {
            const frames = groupJson.frames || 1;
            let img1Tiles = [], img2Tiles = [], allFrames = null;

            if (frames > 1) {
                const frameStrings = groupJson.tileData.split(';|\n');
                allFrames = [];
                frameStrings.forEach((frameStr, frameIndex) => {
                    const tiles = frameStr.split(';').map(tile => {
                        const [col, row] = tile.split(',').map(Number);
                        return { col, row };
                    });
                    if (frameIndex === 0) img1Tiles = tiles;
                    const startIdx = frameIndex * tiles.length;
                    const frameSavedTiles = groupJson.savedTiles.slice(startIdx, startIdx + tiles.length);
                    allFrames.push({ img2Tiles: tiles, savedTiles: frameSavedTiles });
                });
                img2Tiles = allFrames[0].img2Tiles;
            } else {
                img1Tiles = (groupJson.tileData || '').split(';').map(tile => {
                    const [col, row] = tile.split(',').map(Number);
                    return { col, row };
                });
                img2Tiles = img1Tiles;
            }

            return {
                name:            groupJson.name,
                frames:          frames,
                bounceMode:      groupJson.bounceMode    || false,
                setMode:         groupJson.setMode       || 'anim',
                useMultiImage:   groupJson.useMultiImage || false,
                img1Tiles:       img1Tiles,
                img2Tiles:       img2Tiles,
                allFrames:       allFrames,
                savedTiles:      frames > 1 ? allFrames[0].savedTiles : (groupJson.savedTiles || []),
                restoreOriginal: groupJson.restoreOriginal || false,
                setIndex:        groupJson.setIndex ?? 0,
            };
        }

        // Load a V2 .gbts file (multi-set format).
        // Parses all sets, loads images for all sets in parallel, then switches to activeSetIndex.
        function loadV2Project(data) {
            const targetActiveIdx = Math.min(data.activeSetIndex || 0, data.sets.length - 1);

            // ── Global state from root (groups, sequences, project settings) ──────
            // These are loaded directly into engineState / module-level vars — NOT per-set.
            engineState.groups    = (data.groups    || []).map(g => parseGroupFromJson(g));
            sequences             = data.sequences  || [];
            engineState.tilesetName  = data.tilesetName  || 'tileset';
            builderTilesetType       = data.tilesetType  || 'tileset';
            builderGbvmMode          = data.gbvmMode     || 'tiledata';
            workMode                 = data.workMode     || 'create';

            // ── Per-set snapshot objects (frame images only, async below) ─────────
            const newSets = data.sets.map((setJson, i) => {
                const s = createSetData(setJson.name || `Set ${i + 1}`);
                s.mode             = setJson.setMode      || 'anim';
                // image1Filename is global (root level) — NOT per-set
                s.image2Filename   = setJson.image2Filename || '';
                s.tilesetImageData = setJson.referenceTilesetImage || null;
                s.filenamesExtra   = [...(setJson.filenamesExtra || [])];
                // groups/sequences are GLOBAL — not stored per-set snapshot
                // Preallocate extra frame slots (null → lazy loaded below)
                const extraCount = setJson.imagesExtraData ? setJson.imagesExtraData.length : 0;
                s.imagesExtra     = new Array(extraCount).fill(null);
                s.selectionsExtra = Array.from({ length: extraCount }, () => new Set());
                return s;
            });

            // LEVEL (image1) is global — loaded once from root, not per-set.
            let globalLevelImage = null;

            // Count async image loads needed
            let pending = 0;
            if (data.referenceLevelImage) pending++;       // root-level LEVEL — loaded once
            data.sets.forEach(setJson => {
                if (setJson.referenceTilesetFrameImage) pending++;
                if (setJson.imagesExtraData)            pending += setJson.imagesExtraData.filter(Boolean).length;
            });

            function onAllLoaded() {
                sets = newSets;
                activeSetIndex = targetActiveIdx;
                // Restore global LEVEL into engineState before restoreFromSet (which won't touch image1)
                engineState.image1         = globalLevelImage;
                engineState.image1Filename = data.image1Filename || '';
                // Also update canvas1 to reflect the loaded LEVEL
                if (globalLevelImage && activeSet.canvas1) {
                    activeSet.canvas1.width  = globalLevelImage.width;
                    activeSet.canvas1.height = globalLevelImage.height;
                    activeSet.ctx1.drawImage(globalLevelImage, 0, 0);
                } else if (activeSet.canvas1) {
                    activeSet.canvas1.width = 0; activeSet.canvas1.height = 0;
                }
                // Update LEVEL label
                const label1 = document.getElementById('builderLabel1');
                const reload1 = document.getElementById('builderReload1Btn');
                const keepSel1 = document.getElementById('builderKeepSelContainer1');
                if (globalLevelImage) {
                    const tc = Math.ceil(globalLevelImage.width / 8) * Math.ceil(globalLevelImage.height / 8);
                    if (label1) label1.innerHTML = `${engineState.image1Filename}&nbsp;<span style="font-size:9px;opacity:0.7">(${tc})</span>`;
                    if (reload1) reload1.style.display = 'inline-flex';
                    if (keepSel1) keepSel1.style.display = 'flex';
                } else {
                    if (label1) label1.textContent = 'LEVEL.PNG';
                    if (reload1) reload1.style.display = 'none';
                    if (keepSel1) keepSel1.style.display = 'none';
                }
                restoreFromSet(activeSetIndex);
                applySetSwitch();
                const setCount = sets.length;
                showToast(`Project loaded — ${setCount} set${setCount > 1 ? 's' : ''}`);
                builderFinishLoadTileset();
                checkScreensaver();
            }

            if (pending === 0) { onAllLoaded(); return; }

            let loaded = 0;
            function done() { if (++loaded >= pending) onAllLoaded(); }

            // Load LEVEL once from root
            if (data.referenceLevelImage) {
                const img = new Image();
                img.onload = () => { globalLevelImage = img; done(); };
                img.onerror = done;
                img.src = data.referenceLevelImage;
            }

            // Load per-set images
            data.sets.forEach((setJson, i) => {
                if (setJson.referenceTilesetFrameImage) {
                    const img = new Image();
                    img.onload = () => { newSets[i].image2 = img; done(); };
                    img.onerror = done;
                    img.src = setJson.referenceTilesetFrameImage;
                }
                if (setJson.imagesExtraData) {
                    setJson.imagesExtraData.forEach((src, ei) => {
                        if (!src) return;
                        const img = new Image();
                        img.onload = () => { newSets[i].imagesExtra[ei] = img; done(); };
                        img.onerror = done;
                        img.src = src;
                    });
                }
            });
        }

        // Load Tileset function - loads PNG then prompts for _code.txt
        function builderLoadTileset(event) {
            const gbtsFile = event.target.files[0];
            if (!gbtsFile) return;

            // Check if there's existing work that will be overwritten
            const hasImages = activeSet.image1 !== null || activeSet.image2 !== null;
            const hasGroups = activeSet.groups.length > 0;

            if (hasImages || hasGroups) {
                if (!confirm('Loading a GBTS file will overwrite your current project. All unsaved work will be lost. Do you want to continue?')) {
                    // Reset the file input
                    event.target.value = '';
                    return;
                }
            }

            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const data = JSON.parse(e.target.result);

                    // ── V2 multi-set format ─────────────────────────────────────
                    if (data.version === '2.0' && Array.isArray(data.sets) && data.sets.length > 0) {
                        loadV2Project(data);
                        event.target.value = '';
                        return;
                    }

                    // ── V1 single-set format (legacy) ───────────────────────────
                    if (data.groups && data.groups.length > 0) {
                        // Restore groups from GBTS
                        activeSet.groups = data.groups.map(group => {
                            // Parse tileData to reconstruct coordinate arrays
                            const frames = group.frames || 1;
                            let img1Tiles = [];
                            let img2Tiles = [];
                            let allFrames = null;

                            if (frames > 1) {
                                // Multi-frame: parse tileData with | separator
                                const frameStrings = group.tileData.split(';|\n');
                                allFrames = [];

                                frameStrings.forEach((frameStr, frameIndex) => {
                                    const tiles = frameStr.split(';').map(tile => {
                                        const [col, row, tileIdx] = tile.split(',').map(Number);
                                        return { col, row };
                                    });

                                    // First frame determines reference coordinates
                                    if (frameIndex === 0) {
                                        img1Tiles = tiles;
                                    }
                                    
                                    // Extract saved tiles for this frame
                                    const startIdx = frameIndex * tiles.length;
                                    const frameSavedTiles = group.savedTiles.slice(startIdx, startIdx + tiles.length);
                                    
                                    allFrames.push({
                                        img2Tiles: tiles,
                                        savedTiles: frameSavedTiles
                                    });
                                });
                                
                                img2Tiles = allFrames[0].img2Tiles;
                                
                            } else {
                                // Single frame: parse tileData
                                img1Tiles = group.tileData.split(';').map(tile => {
                                    const [col, row, tileIdx] = tile.split(',').map(Number);
                                    return { col, row };
                                });
                                img2Tiles = img1Tiles;
                            }
                            
                            return {
                                name: group.name,
                                frames: frames,
                                bounceMode: group.bounceMode || false,
                                setMode: group.setMode || 'anim',
                                useMultiImage: group.useMultiImage || false,
                                img1Tiles: img1Tiles,
                                img2Tiles: img2Tiles,
                                allFrames: allFrames,
                                savedTiles: frames > 1 ? allFrames[0].savedTiles : group.savedTiles,
                                restoreOriginal: group.restoreOriginal || false
                            };
                        });
                        
                        // Restore settings
                        if (data.tilesetName) {
                            setTilesetName(data.tilesetName);
                        }
                        if (data.tilesetType) {
                            setTilesetType(data.tilesetType);
                        }
                        if (data.gbvmMode) {
                            setGbvmMode(data.gbvmMode);
                        }

                        // Restore builder set mode (TILE SWAP / ANIM)
                        // 'setMode' is the V1.5+ key; 'builderSetMode' is the legacy key from older .gbts files
                        const savedMode = data.setMode || data.builderSetMode;
                        if (savedMode) {
                            activeSet.mode = savedMode;
                            updateModeUI();
                        }

                        // ALWAYS set mode to REFERENCE when loading a GBTS
                        setWorkMode('reference');
                        const createBtnEarly = document.getElementById('createModeBtn');
                        if (createBtnEarly) {
                            createBtnEarly.style.background = '#000';
                            createBtnEarly.style.color = '#00ff00';
                        }

                        // Load the tileset image (either from saved reference or generated from tiles)
                        if (data.referenceTilesetImage) {
                            const img = new Image();
                            img.onload = function() {
                                // Load into activeSet.image2 (TILESET.PNG)
                                activeSet.image2 = img;
                                activeSet.canvas2.width = img.width;
                                activeSet.canvas2.height = img.height;
                                activeSet.ctx2.drawImage(img, 0, 0);

                                // Update UI for image 2
                                const tileCount = Math.ceil(img.width/8) * Math.ceil(img.height/8);
                                document.getElementById('builderReload2Btn').style.display = 'inline-flex';
                                document.getElementById('builderKeepSelContainer2').style.display = 'flex';
                                document.getElementById('builderLabel2').innerHTML = `TILESET.PNG (from GBTS)&nbsp;<span style="font-size: 9px; opacity: 0.7;">(${tileCount})</span>`;
                                builderSetupCanvasEvents(activeSet.canvas2, 2);

                                // Also update the tileset canvas
                                builderTilesetCanvas.width = img.width;
                                builderTilesetCanvas.height = img.height;
                                builderTilesetCtx.clearRect(0, 0, img.width, img.height);
                                builderTilesetCtx.drawImage(img, 0, 0);
                                setTilesetImageData(data.referenceTilesetImage);

                                // Update layout
                                ImageManager.updateLayout();

                                // Update code display
                                builderUpdateAllCode();

                                // Update button states after tileset is loaded
                                TilesetManager.updateSaveButtons();
                                // Refresh preview panel if it's already open
                                TilesetManager.refreshPreview();
                            };
                            img.src = data.referenceTilesetImage;
                        } else {
                            // Rebuild the tileset from saved tile data (legacy file: no referenceTilesetImage saved)
                            // Must temporarily use 'create' mode — workMode was already set to 'reference' above,
                            // but generate() in reference mode won't rebuild from savedTiles (it needs image2).
                            const _savedWorkMode = workMode;
                            setWorkMode('create');
                            TilesetManager.generate();
                            setWorkMode(_savedWorkMode);

                            // After generating, load the result into activeSet.image2
                            if (builderTilesetCanvas.width > 0 && builderTilesetCanvas.height > 0) {
                                const img = new Image();
                                img.onload = function() {
                                    activeSet.image2 = img;
                                    activeSet.canvas2.width = img.width;
                                    activeSet.canvas2.height = img.height;
                                    activeSet.ctx2.drawImage(img, 0, 0);

                                    // Update UI for image 2
                                    const tileCount = Math.ceil(img.width/8) * Math.ceil(img.height/8);
                                    document.getElementById('builderReload2Btn').style.display = 'inline-flex';
                                    document.getElementById('builderKeepSelContainer2').style.display = 'flex';
                                    document.getElementById('builderLabel2').innerHTML = `TILESET.PNG (generated)&nbsp;<span style="font-size: 9px; opacity: 0.7;">(${tileCount})</span>`;
                                    builderSetupCanvasEvents(activeSet.canvas2, 2);

                                    // Update layout
                                    ImageManager.updateLayout();
                                };
                                img.src = builderTilesetCanvas.toDataURL();
                            }
                        }

                        // Load LEVEL.PNG if saved
                        if (data.referenceLevelImage) {
                            const img = new Image();
                            img.onload = function() {
                                // Load into activeSet.image1 (LEVEL.PNG)
                                activeSet.image1 = img;
                                activeSet.canvas1.width = img.width;
                                activeSet.canvas1.height = img.height;
                                activeSet.ctx1.drawImage(img, 0, 0);

                                // Update UI for image 1
                                const tileCount = Math.ceil(img.width/8) * Math.ceil(img.height/8);
                                document.getElementById('builderReload1Btn').style.display = 'inline-flex';
                                document.getElementById('builderKeepSelContainer1').style.display = 'flex';
                                document.getElementById('builderLabel1').innerHTML = `LEVEL.PNG (from GBTS)&nbsp;<span style="font-size: 9px; opacity: 0.7;">(${tileCount})</span>`;
                                builderSetupCanvasEvents(activeSet.canvas1, 1);

                                // Update layout
                                ImageManager.updateLayout();
                            };
                            img.src = data.referenceLevelImage;
                        }

                        // Update work mode UI to REFERENCE (always when loading GBTS)
                        const createBtn = document.getElementById('createModeBtn');
                        if (createBtn) {
                            createBtn.style.background = '#000';
                            createBtn.style.color = '#00ff00';
                        }

                        // Update displays
                        builderUpdateAllCode();
                        document.getElementById('builderCodeSection').classList.remove('hidden');
                        
                        // Load sequences if they exist
                        if (data.sequences && Array.isArray(data.sequences)) {
                            sequences = data.sequences;
                            if (sequences.length > 0) {
                                updateSequencesDisplay();
                                document.getElementById('builderSequencerSection').classList.remove('hidden');
                            }
                        }

                        // Update button states
                        TilesetManager.updateSaveButtons();

                        // Switch tabs based on content
                        const hasSequences = sequences.length > 0;

                        if (hasSequences) {
                            // Has sequences: close Images and Groups, open Sequences and Preview
                            document.getElementById('imagesSection').style.display = 'none';
                            document.getElementById('imagesTab').style.background = '#000';
                            document.getElementById('imagesTab').style.color = '#00ff00';

                            document.getElementById('groupsSection').style.display = 'none';
                            document.getElementById('groupsTab').style.background = '#000';
                            document.getElementById('groupsTab').style.color = '#04d9ff';

                            document.getElementById('sequencesSection').style.display = 'block';
                            document.getElementById('sequencesTab').style.background = '#FF13F0';
                            document.getElementById('sequencesTab').style.color = '#000';

                            document.getElementById('previewSection').style.display = 'block';
                            document.getElementById('previewTab').style.background = '#FF13F0';
                            document.getElementById('previewTab').style.color = '#000';

                            // Initialize preview canvas and display the level image
                            setTimeout(() => {
                                initPreviewCanvas();
                                previewLevelImage = activeSet.image1;
                                if (previewLevelImage) {
                                    previewCanvas.width = previewLevelImage.width;
                                    previewCanvas.height = previewLevelImage.height;
                                    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
                                    previewCtx.drawImage(previewLevelImage, 0, 0);
                                    document.getElementById('previewInfoText').textContent = 'Level image loaded - Click PREVIEW on a Swap or Sequence';
                                }
                            }, 100);
                        } else {
                            // No sequences: open Images and Groups, close Sequences and Preview
                            document.getElementById('imagesSection').style.display = 'block';
                            document.getElementById('imagesTab').style.background = '#00ff00';
                            document.getElementById('imagesTab').style.color = '#000';

                            document.getElementById('groupsSection').style.display = 'block';
                            document.getElementById('groupsTab').style.background = '#04d9ff';
                            document.getElementById('groupsTab').style.color = '#000';

                            document.getElementById('sequencesSection').style.display = 'none';
                            document.getElementById('sequencesTab').style.background = '#000';
                            document.getElementById('sequencesTab').style.color = '#FF13F0';

                            document.getElementById('previewSection').style.display = 'none';
                            document.getElementById('previewTab').style.background = '#000';
                            document.getElementById('previewTab').style.color = '#FF13F0';
                        }

                        checkScreensaver();

                        // Store image metadata if available
                        if (data.imageMetadata) {
                            window.gbtsImageMetadata = data.imageMetadata;
                        }
                        
                        // Sync live state → sets[activeSetIndex] so set-switching works correctly
                        snapshotCurrentSet();
                        renderSetTabs();
                        showToast(`Tileset loaded: ${data.tilesetName || 'untitled'}`);
                    } else {
                        alert('Could not load groups from GBTS file. The file may be empty or in the wrong format.');
                    }
                } catch (error) {
                    console.error('Error parsing GBTS:', error);
                    alert('Failed to parse GBTS file: ' + error.message);
                }

                builderFinishLoadTileset();
            };
            reader.readAsText(gbtsFile);
            event.target.value = '';
        }
        
        function builderFinishLoadTileset() {
            TilesetManager.updateSaveButtons();
        }
        
        // Create reference images from loaded groups so users can edit
        function builderCreateReferenceImagesFromGroups(tilesetImage) {
            // Find the maximum dimensions needed for reference images
            let maxCol1 = 0, maxRow1 = 0;
            activeSet.groups.forEach(group => {
                group.img1Tiles.forEach(tile => {
                    maxCol1 = Math.max(maxCol1, tile.col);
                    maxRow1 = Math.max(maxRow1, tile.row);
                });
            });
            
            // Create canvas for Image 1 (Reference - showing where tiles appear)
            const width1 = (maxCol1 + 1) * 8;
            const height1 = (maxRow1 + 1) * 8;
            
            // Create a blank reference image with grid
            activeSet.canvas1.width = width1;
            activeSet.canvas1.height = height1;
            activeSet.ctx1.fillStyle = '#000000';
            activeSet.ctx1.fillRect(0, 0, width1, height1);
            
            // Draw grid lines
            activeSet.ctx1.strokeStyle = '#00ff00';
            activeSet.ctx1.lineWidth = 0.5;
            for (let x = 0; x <= width1; x += 8) {
                activeSet.ctx1.beginPath();
                activeSet.ctx1.moveTo(x, 0);
                activeSet.ctx1.lineTo(x, height1);
                activeSet.ctx1.stroke();
            }
            for (let y = 0; y <= height1; y += 8) {
                activeSet.ctx1.beginPath();
                activeSet.ctx1.moveTo(0, y);
                activeSet.ctx1.lineTo(width1, y);
                activeSet.ctx1.stroke();
            }
            
            // Draw tiles from all groups on reference image
            activeSet.groups.forEach(group => {
                group.savedTiles.forEach((savedTile, index) => {
                    const refTile = group.img1Tiles[index];
                    const img = new Image();
                    img.onload = function() {
                        activeSet.ctx1.drawImage(img, refTile.col * 8, refTile.row * 8, 8, 8);
                    };
                    img.src = savedTile.imageData;
                });
            });
            
            activeSet.image1 = activeSet.canvas1;
            activeSet.image1Filename = 'loaded_reference.png';
            document.getElementById('builderLabel1').textContent = activeSet.image1Filename;
            // Create Image 2 (Source - the tileset itself)
            activeSet.canvas2.width = tilesetImage.width;
            activeSet.canvas2.height = tilesetImage.height;
            activeSet.ctx2.drawImage(tilesetImage, 0, 0);
            
            activeSet.image2 = tilesetImage;
            activeSet.image2Filename = 'loaded_tileset.png';
            document.getElementById('builderLabel2').textContent = activeSet.image2Filename;
            // Show images and update layout
            ImageManager.updateLayout();
            builderRedrawSelections();
        }
        
        // Parse GBVM code to extract group information
        function builderParseGBVMCode(code, tilesetImage) {
            const groups = [];
            const lines = code.split('\n');
            let currentGroup = null;
            let tileIndex = 0;
            
            for (let line of lines) {
                line = line.trim();
                
                // Check for group comment
                if (line.startsWith('; ===') && line.endsWith('===')) {
                    if (currentGroup) {
                        groups.push(currentGroup);
                    }
                    const groupName = line.replace(/; === | ===/g, '').trim();
                    currentGroup = {
                        name: groupName,
                        img1Tiles: [],
                        img2Tiles: [],
                        savedTiles: []
                    };
                    continue;
                }
                
                // Parse VM_REPLACE_TILE_XY commands
                const match = line.match(/VM_REPLACE_TILE_XY\s+(\d+),\s*(\d+),/);
                if (match && currentGroup) {
                    const col = parseInt(match[1]);
                    const row = parseInt(match[2]);

                    // Calculate tiles per row based on tileset width
                    const tilesPerRow = Math.floor(tilesetImage.width / 8);

                    currentGroup.img1Tiles.push({ col, row });
                    currentGroup.img2Tiles.push({ col: tileIndex % tilesPerRow, row: Math.floor(tileIndex / tilesPerRow) });

                    // Extract tile from tileset image
                    const tileCanvas = document.createElement('canvas');
                    tileCanvas.width = 8;
                    tileCanvas.height = 8;
                    const tileCtx = tileCanvas.getContext('2d');
                    const srcX = (tileIndex % tilesPerRow) * 8;
                    const srcY = Math.floor(tileIndex / tilesPerRow) * 8;
                    tileCtx.drawImage(tilesetImage, srcX, srcY, 8, 8, 0, 0, 8, 8);

                    currentGroup.savedTiles.push({
                        col: tileIndex % tilesPerRow,
                        row: Math.floor(tileIndex / tilesPerRow),
                        imageData: tileCanvas.toDataURL()
                    });

                    tileIndex++;
                }
            }
            
            if (currentGroup && currentGroup.img1Tiles.length > 0) {
                groups.push(currentGroup);
            }
            
            return groups;
        }
        
        // ── V2 SAVE HELPERS ──────────────────────────────────────────────────────

        // Render a JS Image object to a base64 PNG data URL via an offscreen canvas.
        function imageToDataUrl(img) {
            if (!img) return null;
            const c = document.createElement('canvas');
            c.width = img.width; c.height = img.height;
            c.getContext('2d').drawImage(img, 0, 0);
            return c.toDataURL('image/png');
        }

        // Serialize one group from a snapshot — pure data, no DOM.
        function serializeGroup(group, wm, tileOffset) {
            let tileData = '';
            if (group.frames > 1 && group.allFrames) {
                const framesParts = group.allFrames.map((frame, frameIndex) => {
                    return group.img1Tiles.map((tile, index) => {
                        let tileIndex;
                        if (group.bounceMode && wm === 'reference') {
                            const sourceTile = frame.img2Tiles[index];
                            tileIndex = getTileIndexFromCoordinates(sourceTile.col, sourceTile.row);
                        } else if (wm === 'reference') {
                            const sourceTile = group.img2Tiles[index];
                            const selW = Math.max(...group.img2Tiles.map(t => t.col)) - Math.min(...group.img2Tiles.map(t => t.col)) + 1;
                            tileIndex = getTileIndexFromCoordinates(sourceTile.col + frameIndex * selW, sourceTile.row);
                        } else {
                            tileIndex = tileOffset + frameIndex * group.img1Tiles.length + index;
                        }
                        return `${tile.col},${tile.row},${tileIndex}`;
                    }).join(';');
                });
                tileData = framesParts.join(';|\n');
            } else {
                tileData = group.img1Tiles.map((tile, index) => {
                    let tileIndex;
                    if (wm === 'reference') {
                        const sourceTile = group.img2Tiles[index];
                        tileIndex = getTileIndexFromCoordinates(sourceTile.col, sourceTile.row);
                    } else {
                        tileIndex = tileOffset + index;
                    }
                    return `${tile.col},${tile.row},${tileIndex}`;
                }).join(';');
            }

            let savedTilesRaw = [];
            if (group.frames > 1 && group.allFrames) {
                group.allFrames.forEach(f => { savedTilesRaw = savedTilesRaw.concat(f.savedTiles); });
            } else {
                savedTilesRaw = group.savedTiles || [];
            }
            const savedTiles = savedTilesRaw.map(({ col, row, imageData }) => ({ col, row, imageData }));

            return {
                name:            group.name,
                frames:          group.frames,
                bounceMode:      group.bounceMode      || false,
                setMode:         group.setMode         || 'anim',
                useMultiImage:   group.useMultiImage   || false,
                tileData:        tileData,
                savedTiles:      savedTiles,
                restoreOriginal: group.restoreOriginal || false,
                setIndex:        group.setIndex        ?? 0,
            };
        }

        // Build the complete V2 JSON payload covering all sets.
        // Must call snapshotCurrentSet() before this to capture live state.
        // activeTilesetCanvasUrl: current builderTilesetCanvas content as dataURL (active set only).
        function buildV2JsonData(activeTilesetCanvasUrl) {
            // ── Global groups (serialised once at root — same for all sets) ────────
            const wm = workMode || 'create';
            let tileOffset = 0;
            const serializedGroups = engineState.groups.map(group => {
                const g = serializeGroup(group, wm, tileOffset);
                tileOffset += group.frames > 1
                    ? group.img1Tiles.length * group.frames
                    : group.img1Tiles.length;
                return g;
            });

            // ── Per-set frame images only ─────────────────────────────────────────
            const setsJson = sets.map((snap, setIdx) => {
                const tilesetImgUrl = (setIdx === activeSetIndex)
                    ? activeTilesetCanvasUrl
                    : (snap.tilesetImageData || null);

                const setJson = {
                    name:           snap.name           || `Set ${setIdx + 1}`,
                    setMode:        snap.mode           || 'anim',
                    image2Filename: snap.image2Filename || '',
                    // groups/sequences are NOT here — they are GLOBAL (see root level)
                    referenceTilesetImage:      tilesetImgUrl,
                    referenceTilesetFrameImage: imageToDataUrl(snap.image2),
                };

                // Extra animation frames
                if (snap.imagesExtra && snap.imagesExtra.length > 0) {
                    setJson.imagesExtraData = snap.imagesExtra.map(img => imageToDataUrl(img));
                    setJson.filenamesExtra  = [...(snap.filenamesExtra || [])];
                }

                return setJson;
            });

            // ── Root: LEVEL + global groups/sequences/project settings ────────────
            return {
                version:             '2.0',
                activeSetIndex,
                // LEVEL is global
                image1Filename:      engineState.image1Filename || '',
                referenceLevelImage: imageToDataUrl(engineState.image1),
                // Groups and sequences are global
                groups:              serializedGroups,
                sequences:           sequences || [],
                // Project/export settings are global
                tilesetName:         engineState.tilesetName    || 'tileset',
                tilesetType:         builderTilesetType          || 'tileset',
                gbvmMode:            builderGbvmMode             || 'tiledata',
                workMode:            wm,
                sets:                setsJson,
            };
        }

        // Download / save a JSON string as a .gbts file (file picker with fallback).
        async function saveJsonAsGbts(jsonString, filename) {
            if ('showSaveFilePicker' in window) {
                try {
                    const handle = await window.showSaveFilePicker({
                        suggestedName: `${filename}.gbts`,
                        types: [{ description: 'GB Tileset', accept: {'application/json': ['.gbts']} }],
                    });
                    const writable = await handle.createWritable();
                    await writable.write(jsonString);
                    await writable.close();
                    showToast(`Saved as ${filename}.gbts`);
                    return;
                } catch (err) {
                    if (err.name === 'AbortError') return;
                    console.log('File System Access API failed, using fallback:', err);
                }
            }
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url  = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = `${filename}.gbts`;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);
            showToast(`Saved as ${filename}.gbts`);
        }

        // Save Tileset function — V2 multi-set .gbts
        async function builderSaveTileset() {
            if (activeSet.groups.length === 0) {
                alert('No swaps to save. Create at least one swap first.');
                return;
            }
            const tilesetName = getTilesetName() || 'tileset';
            snapshotCurrentSet();
            const tilesetCanvasUrl = (builderTilesetCanvas && builderTilesetCanvas.width > 0)
                ? builderTilesetCanvas.toDataURL('image/png') : null;
            const jsonData = buildV2JsonData(tilesetCanvasUrl);
            await saveJsonAsGbts(JSON.stringify(jsonData, null, 2), tilesetName);
        }

        // Save Modal Functions
        function openSaveModal() {
            // Clear any group highlights before saving
            clearGroupHighlights();

            if (activeSet.groups.length === 0) {
                alert('No swaps to save. Create at least one swap first.');
                return;
            }

            const modal = document.getElementById('saveModal');
            const filenameInput = document.getElementById('saveModalFilename');

            // Pre-fill with current global values
            document.querySelector(`input[name="saveModalMode"][value="${builderGbvmMode}"]`).checked = true;
            document.querySelector(`input[name="saveModalType"][value="${builderTilesetType}"]`).checked = true;

            // Set filename from LEVEL.PNG filename (without extension) or fallback to tileset name
            let defaultFilename = 'tileset';
            if (activeSet.image1Filename && activeSet.image1Filename.trim()) {
                // Remove .png extension if present
                defaultFilename = activeSet.image1Filename.replace(/\.png$/i, '').trim();
            } else if (activeSet.tilesetName && activeSet.tilesetName.trim()) {
                defaultFilename = activeSet.tilesetName.trim();
            }
            filenameInput.value = defaultFilename;

            // Show tileset preview if available
            const previewContainer = document.getElementById('saveModalPreviewContainer');
            const previewCanvas = document.getElementById('saveModalPreviewCanvas');

            if (previewContainer && previewCanvas && builderTilesetCanvas && builderTilesetCanvas.width > 0 && builderTilesetCanvas.height > 0) {
                try {
                    previewCanvas.width = builderTilesetCanvas.width;
                    previewCanvas.height = builderTilesetCanvas.height;
                    const previewCtx = previewCanvas.getContext('2d');
                    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
                    previewCtx.drawImage(builderTilesetCanvas, 0, 0);
                    previewContainer.style.display = 'block';
                } catch (error) {
                    previewContainer.style.display = 'none';
                }
            } else if (previewContainer) {
                previewContainer.style.display = 'none';
            }

            modal.style.display = 'flex';
        }

        function closeSaveModal() {
            const modal = document.getElementById('saveModal');
            modal.style.display = 'none';
        }

        async function saveGBTSFromModal() {
            const filename = document.getElementById('saveModalFilename').value.trim() || 'tileset';
            const mode = document.querySelector('input[name="saveModalMode"]:checked').value;
            const type = document.querySelector('input[name="saveModalType"]:checked').value;

            // Apply modal settings to active set before snapshotting
            activeSet.tilesetName = filename;
            builderGbvmMode    = mode;
            builderTilesetType = type;

            snapshotCurrentSet();
            const tilesetCanvasUrl = (builderTilesetCanvas && builderTilesetCanvas.width > 0)
                ? builderTilesetCanvas.toDataURL('image/png') : null;
            const jsonData = buildV2JsonData(tilesetCanvasUrl);
            await saveJsonAsGbts(JSON.stringify(jsonData, null, 2), filename);
            closeSaveModal();
        }

        async function savePNGFromModal() {
            const filename = document.getElementById('saveModalFilename').value.trim() || 'tileset';

            if (builderTilesetCanvas.width === 0 || builderTilesetCanvas.height === 0) {
                alert('No tileset to save. Generate a tileset first.');
                return;
            }

            builderTilesetCanvas.toBlob(async function(blob) {
                // Try to use File System Access API first
                if ('showSaveFilePicker' in window) {
                    try {
                        const handle = await window.showSaveFilePicker({
                            suggestedName: `${filename}.png`,
                            types: [{
                                description: 'PNG Image',
                                accept: { 'image/png': ['.png'] }
                            }]
                        });

                        const writable = await handle.createWritable();
                        await writable.write(blob);
                        await writable.close();

                        showToast(`Saved as ${filename}.png`);
                        closeSaveModal();
                        return;
                    } catch (err) {
                        if (err.name !== 'AbortError') {
                            console.log('File System Access API failed, using fallback:', err);
                        } else {
                            return;
                        }
                    }
                }

                // Fallback to download link
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.download = `${filename}.png`;
                link.href = url;
                link.click();
                URL.revokeObjectURL(url);

                showToast(`Saved as ${filename}.png`);
                closeSaveModal();
            });
        }

        async function saveTilesetPNGDirect() {
            if (!builderTilesetCanvas || builderTilesetCanvas.width === 0 || builderTilesetCanvas.height === 0) {
                alert('No tileset to save. Generate a tileset first.');
                return;
            }
            const filename = getTilesetName() || 'tileset';
            builderTilesetCanvas.toBlob(async function(blob) {
                if ('showSaveFilePicker' in window) {
                    try {
                        const handle = await window.showSaveFilePicker({
                            suggestedName: `${filename}.png`,
                            types: [{ description: 'PNG Image', accept: { 'image/png': ['.png'] } }]
                        });
                        const writable = await handle.createWritable();
                        await writable.write(blob);
                        await writable.close();
                        showToast(`Saved as ${filename}.png`);
                        return;
                    } catch (err) {
                        if (err.name === 'AbortError') return;
                        console.log('File System Access API failed, using fallback:', err);
                    }
                }
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.download = `${filename}.png`;
                link.href = url;
                link.click();
                URL.revokeObjectURL(url);
                showToast(`Saved as ${filename}.png`);
            });
        }

        // Tileset Preview Toggle and Resize
        let tilesetPreviewVisible = false;
        let previewZoom = 4; // display scale multiplier (1×, 2×, 3×, …)

        function applyPreviewZoom() {
            const previewCanvas = document.getElementById('builderTilesetCanvasPreview');
            const label = document.getElementById('previewZoomLabel');
            if (!previewCanvas) return;
            previewCanvas.style.width  = (previewCanvas.width  * previewZoom) + 'px';
            previewCanvas.style.height = (previewCanvas.height * previewZoom) + 'px';
            if (label) label.textContent = previewZoom + '×';
        }

        function changePreviewZoom(delta) {
            previewZoom = Math.max(1, Math.min(16, previewZoom + delta));
            applyPreviewZoom();
        }

        function toggleTilesetPreviewNew() {
            const container = document.getElementById('tilesetPreviewNewContainer');
            const previewCanvas = document.getElementById('builderTilesetCanvasPreview');

            if (!container || !previewCanvas) return;

            const btn = document.getElementById('generatedBtn');
            tilesetPreviewVisible = !tilesetPreviewVisible;

            if (tilesetPreviewVisible) {
                // Copy tileset to preview canvas
                previewCanvas.width = builderTilesetCanvas.width;
                previewCanvas.height = builderTilesetCanvas.height;
                const previewCtx = previewCanvas.getContext('2d');
                previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
                previewCtx.drawImage(builderTilesetCanvas, 0, 0);

                // Apply current zoom
                applyPreviewZoom();

                container.style.display = 'block';

                // Update button to "on" state (inverted background)
                btn.style.background = '#00ff00';
                btn.style.color = '#000';
            } else {
                container.style.display = 'none';

                // Update button to "off" state (outlined)
                btn.style.background = '#000';
                btn.style.color = '#00ff00';
            }
        }

        function updatePreviewScale() {
            const container = document.getElementById('tilesetPreviewNewContainer');
            const previewCanvas = document.getElementById('builderTilesetCanvasPreview');

            if (!container || !previewCanvas || !tilesetPreviewVisible) return;

            // Canvas will scale naturally based on its container
        }

        // Resize handle functionality
        let isResizingPreview = false;
        let resizeStartY = 0;
        let resizeStartHeight = 0;

        // Helper function to generate all code as string
        function builderGenerateAllCodeString() {
            const tilesetName = getTilesetName();
            const tilesetType = getTilesetType();
            const gbvmMode = getGbvmMode();
            
            let tiledataBank, tiledata;
            if (tilesetName) {
                tiledataBank = `___bank_${tilesetType}_${tilesetName}`;
                tiledata = `_${tilesetType}_${tilesetName}`;
            } else {
                tiledataBank = `___bank_${tilesetType}_TILESET`;
                tiledata = `_${tilesetType}_TILESET`;
            }
            
            let tileOffset = 0;
            const allCode = [];
            
            activeSet.groups.forEach((group) => {
                const groupComment = `; === ${group.name} ===`;
                let groupCode = '';

                if (gbvmMode === 'arg0') {
                    groupCode = group.img1Tiles.map((tile, index) => {
                        let tileIndex;
                        if (workMode === 'reference') {
                            const sourceTile = group.img2Tiles[index];
                            tileIndex = getTileIndexFromCoordinates(sourceTile.col, sourceTile.row);
                        } else {
                            tileIndex = tileOffset + index;
                        }
                        return `VM_PUSH_CONST ${tileIndex}\nVM_REPLACE_TILE_XY ${tile.col}, ${tile.row}, ${tiledataBank}, ${tiledata}, .ARG0\nVM_POP 1`;
                    }).join('\n\n');
                } else {
                    groupCode = group.img1Tiles.map((tile, index) => {
                        let tileIndex;
                        if (workMode === 'reference') {
                            const sourceTile = group.img2Tiles[index];
                            tileIndex = getTileIndexFromCoordinates(sourceTile.col, sourceTile.row);
                        } else {
                            tileIndex = tileOffset + index;
                        }
                        return `VM_REPLACE_TILE_XY ${tile.col}, ${tile.row}, ${tiledataBank}, ${tiledata}, ${tileIndex}`;
                    }).join('\n');
                }

                allCode.push(groupComment + '\n' + groupCode);
                tileOffset += group.img1Tiles.length;
            });
            
            return allCode.join('\n\n');
        }
        
        // Modal functions
        
        function resetApp() {
            if (confirm('Are you sure you want to reset everything? This will clear all images, swaps, and the tileset.')) {
                // Clear images
                activeSet.image1 = null;
                activeSet.image2 = null;
                activeSet.image1Filename = '';
                activeSet.image2Filename = '';
                
                // Clear canvases
                activeSet.ctx1.clearRect(0, 0, activeSet.canvas1.width, activeSet.canvas1.height);
                activeSet.ctx2.clearRect(0, 0, activeSet.canvas2.width, activeSet.canvas2.height);
                activeSet.canvas1.width = 0;
                activeSet.canvas1.height = 0;
                activeSet.canvas2.width = 0;
                activeSet.canvas2.height = 0;
                
                // Clear selections
                activeSet.img1Selection.clear();
                activeSet.img2Selection.clear();
                activeSet.selectionsExtra.forEach(s => s.clear());
                
                // Clear groups
                activeSet.groups = [];
                builderUpdateAllCode();

                // Clear sequences
                sequences = [];
                updateSequencesDisplay();
                
                // Clear tileset
                builderTilesetCtx.clearRect(0, 0, builderTilesetCanvas.width, builderTilesetCanvas.height);
                builderTilesetCanvas.width = 0;
                builderTilesetCanvas.height = 0;
                
                // Clear inputs
                document.getElementById('builderGroupName').value = '';
                activeSet.tilesetName = '';
                
                // Reset file inputs
                document.getElementById('builderImage1Input').value = '';
                document.getElementById('builderImage2Input').value = '';
                document.getElementById('builderLoadTilesetInput').value = '';
                
                // Hide UI elements
                document.getElementById('builderCurrentSelection').classList.add('hidden');
                document.getElementById('builderCodeSection').classList.add('hidden');
                document.getElementById('builderSequencerSection').classList.add('hidden');

                // Update button states
                TilesetManager.updateSaveButtons();

                // Reset image titles
                document.getElementById('builderLabel1').textContent = '';
                document.getElementById('builderLabel2').textContent = '';

                // Close tileset preview and disable Generated button
                const tilesetPreviewContainer = document.getElementById('tilesetPreviewNewContainer');
                if (tilesetPreviewContainer) {
                    tilesetPreviewContainer.style.display = 'none';
                }
                tilesetPreviewVisible = false;

                const generatedBtn = document.getElementById('generatedBtn');
                if (generatedBtn) {
                    generatedBtn.disabled = true;
                    generatedBtn.style.opacity = '0.3';
                    generatedBtn.style.background = '#000';
                    generatedBtn.style.color = '#00ff00';
                }

                // Clear preview canvas
                const previewCanvas = document.getElementById('builderTilesetCanvasPreview');
                if (previewCanvas) {
                    const previewCtx = previewCanvas.getContext('2d');
                    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
                    previewCanvas.width = 0;
                    previewCanvas.height = 0;
                }

                // Update layout
                ImageManager.updateLayout();

                // V2: reset to a single empty set
                sets = [createSetData('Set 1')];
                activeSetIndex = 0;
                snapshotCurrentSet();
                renderSetTabs();

                console.log('App reset complete');
            }
        }
        
        function showBuilderInstructions() {
            document.getElementById('builderInstructionsModal').classList.add('active');
        }
        
        
        // Toggle button functions
        // (builderSetMode, symmetricModeActive, mirrorModeActive, keepSel1Active, keepSel2Active, autoSortActive
        //  migrated to activeSet.mode / .symmetric / .mirror / .keepSel1 / .keepSel2 / .autoSort)
        
        // Single DOMContentLoaded — all init in one place
        window.addEventListener('DOMContentLoaded', function() {
            // Initialize canvas elements
            builderTilesetCanvas = document.getElementById('builderTilesetCanvas');
            if (builderTilesetCanvas) {
                builderTilesetCtx = builderTilesetCanvas.getContext('2d', { willReadFrequently: true });
            }

            // Preview panel resize handle
            const previewHandle = document.getElementById('tilesetPreviewResizeHandle');
            const previewContainer = document.getElementById('tilesetPreviewNewContainer');
            if (previewHandle && previewContainer) {
                previewHandle.addEventListener('mousedown', function(e) {
                    isResizingPreview = true;
                    resizeStartY = e.clientY;
                    resizeStartHeight = previewContainer.clientHeight;
                    e.preventDefault();
                });
                document.addEventListener('mousemove', function(e) {
                    if (!isResizingPreview) return;
                    const deltaY = e.clientY - resizeStartY;
                    const newHeight = Math.max(100, Math.min(600, resizeStartHeight + deltaY));
                    previewContainer.style.height = `${newHeight}px`;
                    updatePreviewScale();
                });
                document.addEventListener('mouseup', function() { isResizingPreview = false; });
            }

            // Animation preview canvas resize handle
            let _animPreviewResizing = false, _animPreviewStartY = 0, _animPreviewStartH = 0;
            const animPreviewHandle    = document.getElementById('previewCanvasResizeHandle');
            const animPreviewContainer = document.getElementById('previewCanvasContainer');
            if (animPreviewHandle && animPreviewContainer) {
                animPreviewHandle.addEventListener('mousedown', function(e) {
                    _animPreviewResizing = true;
                    _animPreviewStartY   = e.clientY;
                    _animPreviewStartH   = animPreviewContainer.clientHeight;
                    e.preventDefault();
                });
                document.addEventListener('mousemove', function(e) {
                    if (!_animPreviewResizing) return;
                    const newH = Math.max(100, Math.min(1200, _animPreviewStartH + (e.clientY - _animPreviewStartY)));
                    animPreviewContainer.style.height = newH + 'px';
                });
                document.addEventListener('mouseup', function() { _animPreviewResizing = false; });
            }

            // Initialize set tabs
            renderSetTabs();

            // Initialize mode UI (ANIM by default)
            updateModeUI();

            // Initialize toggle buttons visual state to match default variables
            function applyToggleStyle(btn, active) {
                if (!btn) return;
                btn.style.background = active ? '#04d9ff' : '#000';
                btn.style.color      = active ? '#000' : '#04d9ff';
                btn.style.boxShadow  = active ? '0 0 10px rgba(4, 217, 255, 0.5)' : 'none';
            }
            applyToggleStyle(document.getElementById('autoSortBtn'),        activeSet.autoSort);
            applyToggleStyle(document.getElementById('builderSymmetricMode'), activeSet.symmetric);
            applyToggleStyle(document.getElementById('builderMirrorMode'),   activeSet.mirror);
            applyToggleStyle(document.getElementById('builderBounceDouble'), activeSet.bounceDouble);
            const bdBtn = document.getElementById('builderBounceDouble');
            if (bdBtn) bdBtn.style.display = activeSet.mirror ? 'inline-flex' : 'none';

            // Hide screensaver on load (Images tab is open by default)
            checkScreensaver();

            // Initialize panel resizers (drag-to-resize between sections)
            initPanelResizers();
            updateResizerVisibility();

            // Set up image input event listeners
            document.getElementById('builderImage1Input').addEventListener('change', function(e) {
                ImageManager.load(e.target.files[0], 1);
            });

            document.getElementById('builderImage2Input').addEventListener('change', function(e) {
                ImageManager.load(e.target.files[0], 2);
            });

            // Drag & Drop functionality for placeholders
            function setupDropZone(placeholderId, imageNumber) {
                const placeholder = document.getElementById(placeholderId);
                const dropHint = document.getElementById(`builderDropHint${imageNumber}`);
                const ghostText = document.getElementById(`builderGhostText${imageNumber}`);

                placeholder.addEventListener('click', function() {
                    document.getElementById(`builderImage${imageNumber}Input`).click();
                });

                placeholder.addEventListener('dragover', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    placeholder.style.background = 'rgba(0, 255, 0, 0.2)';
                    placeholder.style.borderColor = 'rgba(0, 255, 0, 0.8)';
                    placeholder.style.boxShadow = '0 0 20px rgba(0, 255, 0, 0.5)';
                    ghostText.style.color = 'rgba(0, 255, 0, 0.8)';
                    dropHint.style.display = 'block';
                });

                placeholder.addEventListener('dragleave', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    placeholder.style.background = 'rgba(0, 255, 0, 0.05)';
                    placeholder.style.borderColor = 'rgba(0, 255, 0, 0.2)';
                    placeholder.style.boxShadow = 'none';
                    ghostText.style.color = 'rgba(0, 255, 0, 0.3)';
                    dropHint.style.display = 'none';
                });

                placeholder.addEventListener('drop', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    placeholder.style.background = 'rgba(0, 255, 0, 0.05)';
                    placeholder.style.borderColor = 'rgba(0, 255, 0, 0.2)';
                    placeholder.style.boxShadow = 'none';
                    ghostText.style.color = 'rgba(0, 255, 0, 0.3)';
                    dropHint.style.display = 'none';

                    const files = e.dataTransfer.files;
                    if (files.length > 0 && files[0].type.startsWith('image/')) {
                        ImageManager.load(files[0], imageNumber);
                    }
                });
            }

            setupDropZone('builderGhostPlaceholder1', 1);
            setupDropZone('builderGhostPlaceholder2', 2);

            // (toggle button visual states already initialized above via applyToggleStyle)
            
            // Sticky behavior for Current Selection (desktop only)
            if (window.innerWidth >= 768) {
                const currentSelection = document.getElementById('builderCurrentSelection');
                const imagesDisplay = document.getElementById('builderImagesDisplay');

                window.addEventListener('scroll', function() {
                    if (!currentSelection.classList.contains('hidden')) {
                        const rect = currentSelection.getBoundingClientRect();

                        if (rect.top <= 0) {
                            currentSelection.classList.add('sticky');
                        } else {
                            currentSelection.classList.remove('sticky');
                        }
                    }

                    // Sticky behavior for images - stick when currentSelection is sticky
                    if (imagesDisplay && !currentSelection.classList.contains('hidden')) {
                        const imagesRect = imagesDisplay.getBoundingClientRect();
                        const currentSelectionHeight = currentSelection.classList.contains('sticky') ? currentSelection.offsetHeight : 0;

                        if (imagesRect.top <= currentSelectionHeight) {
                            imagesDisplay.classList.add('sticky');
                            imagesDisplay.style.top = currentSelectionHeight + 'px';
                        } else {
                            imagesDisplay.classList.remove('sticky');
                            imagesDisplay.style.top = '0';
                        }
                    }
                });
            }
        });
        
        // Tab system functions
        function toggleTilesetPreview() {
            const preview = document.getElementById('tilesetPreviewContainer');
            const toggle = document.getElementById('tilesetPreviewToggle');
            
            if (preview.style.display === 'none') {
                preview.style.display = 'block';
                toggle.textContent = '▪'; // Filled square when open
            } else {
                preview.style.display = 'none';
                toggle.textContent = '▫'; // Empty square when closed
            }
        }
        
        // ─── Panel Resizer Logic ─────────────────────────────────────────────────
        let _resizerDragState = null;

        function initPanelResizers() {
            document.querySelectorAll('.panel-resizer').forEach(function(resizer) {
                resizer.addEventListener('mousedown', function(e) {
                    e.preventDefault();
                    const leftEl  = document.getElementById(resizer.dataset.left);
                    const rightEl = document.getElementById(resizer.dataset.right);

                    // Freeze ALL visible sections to pixel widths so only the dragged pair moves
                    const sectionIds = ['imagesSection', 'groupsSection', 'sequencesSection', 'previewSection'];
                    sectionIds.forEach(function(id) {
                        const el = document.getElementById(id);
                        if (el.style.display !== 'none') {
                            const w = el.getBoundingClientRect().width;
                            el.style.flex = '0 0 ' + w + 'px';
                        }
                    });

                    _resizerDragState = {
                        resizer:         resizer,
                        leftEl:          leftEl,
                        rightEl:         rightEl,
                        startX:          e.clientX,
                        leftStartWidth:  leftEl.getBoundingClientRect().width,
                        rightStartWidth: rightEl.getBoundingClientRect().width,
                    };
                    document.body.style.cursor    = 'col-resize';
                    document.body.style.userSelect = 'none';
                    resizer.classList.add('resizing');
                });
            });

            document.addEventListener('mousemove', function(e) {
                if (!_resizerDragState) return;
                const { leftEl, rightEl, startX, leftStartWidth, rightStartWidth } = _resizerDragState;
                const delta    = e.clientX - startX;
                const minWidth = 100;
                let newLeft  = leftStartWidth  + delta;
                let newRight = rightStartWidth - delta;
                if (newLeft  < minWidth) { newLeft  = minWidth; newRight = leftStartWidth + rightStartWidth - minWidth; }
                if (newRight < minWidth) { newRight = minWidth; newLeft  = leftStartWidth + rightStartWidth - minWidth; }
                leftEl.style.flex  = '0 0 ' + newLeft  + 'px';
                rightEl.style.flex = '0 0 ' + newRight + 'px';
            });

            document.addEventListener('mouseup', function() {
                if (!_resizerDragState) return;
                _resizerDragState.resizer.classList.remove('resizing');
                document.body.style.cursor    = '';
                document.body.style.userSelect = '';
                _resizerDragState = null;
            });
        }

        // Show resizers between every consecutive pair of VISIBLE sections.
        // Resets section flex values to their defaults (toggle resets user sizing).
        function updateResizerVisibility() {
            const sectionIds  = ['imagesSection', 'groupsSection', 'sequencesSection', 'previewSection'];
            const resizerIds  = ['resizer_ig', 'resizer_gs', 'resizer_sp'];
            const visible     = sectionIds.filter(function(id) {
                return document.getElementById(id).style.display !== 'none';
            });

            // Hide all resizers first
            resizerIds.forEach(function(id) {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });

            // Reset all sections to their default flex ratios
            sectionIds.forEach(function(id) {
                const el = document.getElementById(id);
                if (el && el.style.display !== 'none') {
                    const def = el.dataset.flexDefault || '1';
                    el.style.flex = def;
                }
            });

            // Show one resizer between each consecutive visible pair.
            // We reuse the resizer that lives immediately after the left section in DOM order.
            for (let i = 0; i < visible.length - 1; i++) {
                const leftId    = visible[i];
                const rightId   = visible[i + 1];
                const leftIdx   = sectionIds.indexOf(leftId);
                const resizerEl = document.getElementById(resizerIds[leftIdx]);
                if (resizerEl) {
                    resizerEl.style.display = 'block';
                    resizerEl.dataset.left  = leftId;
                    resizerEl.dataset.right = rightId;
                }
            }
        }
        // ─────────────────────────────────────────────────────────────────────────

        function toggleSection(sectionId, tabId) {
            const section = document.getElementById(sectionId);
            const tab = document.getElementById(tabId);
            
            // Determine colors based on tab
            let fillColor, textColor;
            if (tabId === 'imagesTab') {
                fillColor = '#00ff00';
                textColor = '#000';
            } else if (tabId === 'groupsTab') {
                fillColor = '#04d9ff';
                textColor = '#000';
            } else if (tabId === 'sequencesTab') {
                fillColor = '#FF13F0';
                textColor = '#000';
            } else if (tabId === 'previewTab') {
                fillColor = '#FF13F0';
                textColor = '#000';
            }
            
            if (section.style.display === 'none') {
                // Open section - fill the tab
                section.style.display = 'block';
                tab.style.background = fillColor;
                tab.style.color = textColor;
                tab.style.opacity = '1';
                
                // Show subsections for Groups and Sequences to reveal empty states
                if (tabId === 'groupsTab') {
                    document.getElementById('builderCodeSection').classList.remove('hidden');
                } else if (tabId === 'sequencesTab') {
                    document.getElementById('builderSequencerSection').classList.remove('hidden');
                }
            } else {
                // Close section - outline only
                section.style.display = 'none';
                tab.style.background = '#000';
                tab.style.color = fillColor;
                tab.style.opacity = '1';
            }
            
            // Update resizer handles and reset flex proportions
            updateResizerVisibility();
            // Check if all sections are closed
            checkScreensaver();
        }

        function checkScreensaver() {
            const images = document.getElementById('imagesSection').style.display !== 'none';
            const groups = document.getElementById('groupsSection').style.display !== 'none';
            const sequences = document.getElementById('sequencesSection').style.display !== 'none';
            const preview = document.getElementById('previewSection').style.display !== 'none';
            const screensaver = document.getElementById('screensaver');

            // Show screensaver if all sections are closed
            if (!images && !groups && !sequences && !preview) {
                screensaver.style.display = 'flex';
                initPsychedelicLines();
            } else {
                screensaver.style.display = 'none';
            }
        }
        
        function initPsychedelicLines() {
            const container = document.getElementById('psychedelicLines');
            if (container.children.length > 0) return; // Already initialized
            
            const colors = ['#00ff00', '#04d9ff', '#FF13F0'];
            const numLines = 12;
            
            for (let i = 0; i < numLines; i++) {
                const line = document.createElement('div');
                const color = colors[i % colors.length];
                const animDuration = 8 + Math.random() * 6; // 8-14 seconds
                const animName = 'moveLine' + ((i % 6) + 1);
                const delay = Math.random() * -10; // Start at different positions
                const opacity = 0.3 + Math.random() * 0.3; // 0.3-0.6
                
                line.style.cssText = `
                    position: absolute;
                    width: 200%;
                    height: 2px;
                    background: linear-gradient(90deg, transparent, ${color}, transparent);
                    box-shadow: 0 0 10px ${color};
                    animation: ${animName} ${animDuration}s linear infinite;
                    animation-delay: ${delay}s;
                    opacity: ${opacity};
                `;
                
                container.appendChild(line);
            }
        }
        
        
        function toggleSymmetric(event) {
            event.preventDefault();
            event.stopPropagation();
            const btn = document.getElementById('builderSymmetricMode');
            activeSet.symmetric = !activeSet.symmetric;

            if (activeSet.symmetric) {
                btn.style.background = '#04d9ff';
                btn.style.color = '#000';
                btn.style.border = '2px solid #04d9ff';
                btn.style.boxShadow = '0 0 10px rgba(4, 217, 255, 0.5)';
            } else {
                btn.style.background = '#000';
                btn.style.color = '#04d9ff';
                btn.style.border = '2px solid #04d9ff';
                btn.style.boxShadow = 'none';
            }
        }

        function toggleMirror(event) {
            event.preventDefault();
            event.stopPropagation();
            const btn = document.getElementById('builderMirrorMode');
            activeSet.mirror = !activeSet.mirror;

            if (activeSet.mirror) {
                btn.style.background = '#04d9ff';
                btn.style.color = '#000';
                btn.style.border = '2px solid #04d9ff';
                btn.style.boxShadow = '0 0 10px rgba(4, 217, 255, 0.5)';
            } else {
                btn.style.background = '#000';
                btn.style.color = '#04d9ff';
                btn.style.border = '2px solid #04d9ff';
                btn.style.boxShadow = 'none';
                // Deactivate ×2 when BOUNCE is turned off
                activeSet.bounceDouble = false;
                const db = document.getElementById('builderBounceDouble');
                if (db) { db.style.background = '#000'; db.style.color = '#04d9ff'; db.style.boxShadow = 'none'; }
            }
            // Show/hide ×2 button
            const doubleBtn = document.getElementById('builderBounceDouble');
            if (doubleBtn) doubleBtn.style.display = activeSet.mirror ? 'inline-flex' : 'none';
        }

        function toggleBounceDouble(event) {
            event.preventDefault();
            event.stopPropagation();
            const btn = document.getElementById('builderBounceDouble');
            activeSet.bounceDouble = !activeSet.bounceDouble;
            if (activeSet.bounceDouble) {
                btn.style.background = '#04d9ff';
                btn.style.color = '#000';
                btn.style.boxShadow = '0 0 10px rgba(4, 217, 255, 0.5)';
            } else {
                btn.style.background = '#000';
                btn.style.color = '#04d9ff';
                btn.style.boxShadow = 'none';
            }
        }

        // ── MODE TOGGLE (V1) ─────────────────────────────────────────────────
        // V2 migration: activeSet.mode → activeSet.mode

        function setBuilderMode(mode) {
            activeSet.mode = mode;
            // Reset current selection when switching mode (groups already created are preserved)
            if (activeSet.img1Selection.size > 0 || activeSet.img2Selection.size > 0) {
                builderClearCurrentSelection();
            }
            // Deactivate symmetric mode when entering TILE SWAP (not useful there)
            if (mode === 'swap' && activeSet.symmetric) {
                activeSet.symmetric = false;
                const symBtn = document.getElementById('builderSymmetricMode');
                if (symBtn) {
                    symBtn.style.background = '#000';
                    symBtn.style.color = '#04d9ff';
                    symBtn.style.boxShadow = 'none';
                }
            }
            updateModeUI();
        }

        function updateModeUI() {
            const isSwap = activeSet.mode === 'swap';

            // FRAMES counter — visible in TILE SWAP (horizontal offset), hidden in ANIM (separate images)
            const framesBlock = document.getElementById('framesControlBlock');
            if (framesBlock) framesBlock.style.display = isSwap ? 'flex' : 'none';

            // Extra frame divs — hidden entirely in TILE SWAP (images stay in memory)
            const tilesetContainer = document.getElementById('tilesetFramesContainer');
            if (tilesetContainer) {
                tilesetContainer.querySelectorAll('.tileset-frame[data-frame^="extra_"]').forEach(div => {
                    div.style.display = isSwap ? 'none' : 'flex';
                });
                // Frame 0 width: 50% (2-per-row) when extras visible, full width otherwise
                const frame0 = tilesetContainer.querySelector('.tileset-frame[data-frame="0"]');
                const extrasVisible = !isSwap && activeSet.imagesExtra.length > 0;
                if (frame0) {
                    frame0.style.flex = extrasVisible ? '0 0 calc(50% - 4px)' : '1';
                    frame0.style.minWidth = '0';
                }
            }

            // +FRAME button — visible in ANIM only
            const addFrameBtn = document.getElementById('addFrameBtn');
            if (addFrameBtn) addFrameBtn.style.display = isSwap ? 'none' : 'inline-block';

            // Delete frame button — only on last extra frame, only in ANIM
            ImageManager.updateLastFrameBtn();

            // Reset frame count to 1 when switching to ANIM mode
            if (!isSwap) {
                activeSet.frameCount = 1;
                const fcEl = document.getElementById('builderFrameCount');
                if (fcEl) fcEl.textContent = '1';
                highlightFramesOnTileset();
            }

            // Update mirror button title to reflect mode
            const mirrorBtn = document.getElementById('builderMirrorMode');
            if (mirrorBtn) {
                mirrorBtn.title = isSwap
                    ? 'Bounce — encode aller/retour dans un swap (| séparateur)'
                    : 'Create in/out swap pairs';
            }

            // Toggle button styles
            const btnSwap = document.getElementById('modeBtnSwap');
            const btnAnim = document.getElementById('modeBtnAnim');
            if (btnSwap && btnAnim) {
                btnSwap.style.background = isSwap ? '#00ff00' : '#000';
                btnSwap.style.color      = isSwap ? '#000' : '#00ff00';
                btnAnim.style.background = isSwap ? '#000' : '#00ff00';
                btnAnim.style.color      = isSwap ? '#00ff00' : '#000';
            }
        }
        // ─────────────────────────────────────────────────────────────────────

        function toggleAutoSort(event) {
            event.preventDefault();
            event.stopPropagation();
            const btn = document.getElementById('autoSortBtn');
            activeSet.autoSort = !activeSet.autoSort;

            if (activeSet.autoSort) {
                btn.style.background = '#04d9ff';
                btn.style.color = '#000';
                btn.style.border = '2px solid #04d9ff';
                btn.style.boxShadow = '0 0 10px rgba(4, 217, 255, 0.5)';

                // Sort current selections
                sortSelections();
            } else {
                btn.style.background = '#000';
                btn.style.color = '#04d9ff';
                btn.style.border = '2px solid #04d9ff';
                btn.style.boxShadow = 'none';
            }
        }

        function sortSelections() {
            sortSelectionsData(); // engine
            builderUpdateSelectionDisplay();
            builderRedrawSelections();
        }

        function toggleKeepSel(event, imageNumber) {
            event.preventDefault();
            event.stopPropagation();
            const btn = document.getElementById(`builderKeepSel${imageNumber}`);

            if (imageNumber === 1) {
                activeSet.keepSel1 = !activeSet.keepSel1;
                if (activeSet.keepSel1) {
                    btn.querySelector('span').textContent = '×';
                    btn.style.background = '#001122';
                    btn.style.color = '#04d9ff';
                    btn.style.border = '2px solid #04d9ff';
                    btn.style.boxShadow = '0 0 10px rgba(4, 217, 255, 0.5)';
                } else {
                    btn.querySelector('span').textContent = '';
                    btn.style.background = '#000';
                    btn.style.color = '#04d9ff';
                    btn.style.border = '2px solid #04d9ff';
                    btn.style.boxShadow = 'none';
                }
            } else if (imageNumber === 2) {
                activeSet.keepSel2 = !activeSet.keepSel2;
                if (activeSet.keepSel2) {
                    btn.querySelector('span').textContent = '×';
                    btn.style.background = '#001122';
                    btn.style.color = '#04d9ff';
                    btn.style.border = '2px solid #04d9ff';
                    btn.style.boxShadow = '0 0 10px rgba(4, 217, 255, 0.5)';
                } else {
                    btn.querySelector('span').textContent = '';
                    btn.style.background = '#000';
                    btn.style.color = '#04d9ff';
                    btn.style.border = '2px solid #04d9ff';
                    btn.style.boxShadow = 'none';
                }
            }
        }

        function increaseFrames() {
            activeSet.frameCount++;
            document.getElementById('builderFrameCount').textContent = activeSet.frameCount;
            highlightFramesOnTileset();
        }

        function decreaseFrames() {
            if (activeSet.frameCount > 1) {
                activeSet.frameCount--;
                document.getElementById('builderFrameCount').textContent = activeSet.frameCount;
                highlightFramesOnTileset();
            }
        }

        function highlightFramesOnTileset() {
            // Clear and redraw TILESET.PNG
            if (!activeSet.image2) return;

            activeSet.ctx2.clearRect(0, 0, activeSet.canvas2.width, activeSet.canvas2.height);
            activeSet.ctx2.drawImage(activeSet.image2, 0, 0);

            // Draw current selection first (green)
            activeSet.img2Selection.forEach(key => {
                const [col, row] = key.split(',').map(Number);
                activeSet.ctx2.fillStyle = 'rgba(0, 255, 0, 0.3)';
                activeSet.ctx2.fillRect(col * 8, row * 8, 8, 8);
                activeSet.ctx2.strokeStyle = '#00ff00';
                activeSet.ctx2.lineWidth = 1;
                // Border inside: offset by 0.5px and reduce size by 1px
                activeSet.ctx2.strokeRect(col * 8 + 0.5, row * 8 + 0.5, 7, 7);
            });

            // If there's a selection and frames > 1, highlight additional frames on TILESET (blue)
            // Frame 1 stays green (current selection), frames 2+ are highlighted in blue
            if (activeSet.frameCount > 1 && activeSet.img2Selection.size > 0) {
                const tiles = Array.from(activeSet.img2Selection).map(key => {
                    const [col, row] = key.split(',').map(Number);
                    return { col, row };
                });
                if (tiles.length === 0) return;

                // Calculate selection width
                const cols = tiles.map(t => t.col);
                const minCol = Math.min(...cols);
                const maxCol = Math.max(...cols);
                const selectionWidth = maxCol - minCol + 1;

                // Highlight additional frames (start at frame 1, since frame 0 is the green selection)
                for (let frame = 1; frame < activeSet.frameCount; frame++) {
                    tiles.forEach(tile => {
                        const frameCol = tile.col + (frame * selectionWidth);
                        activeSet.ctx2.strokeStyle = '#04d9ff';
                        activeSet.ctx2.lineWidth = 1;
                        // Border inside: offset by 0.5px and reduce size by 1px
                        activeSet.ctx2.strokeRect(frameCol * 8 + 0.5, tile.row * 8 + 0.5, 7, 7);
                    });
                }
            }
        }
        
        // ========================================
        // GROUP SEQUENCER FUNCTIONS
        // ========================================
        
        // sequences, workMode → engine.js
        // Preview variables
        let currentSequenceForAdding = null;
        let currentFrameForAdding = null;
        
        function toggleGroupsCollapse() {
            const content = document.getElementById('groupsContent');
            const btn = document.getElementById('groupsCollapseBtn');
            if (content.style.display === 'none') {
                content.style.display = 'block';
                btn.textContent = '−';
            } else {
                content.style.display = 'none';
                btn.textContent = '+';
            }
        }
        
        function toggleSequencerCollapse() {
            const content = document.getElementById('sequencerContent');
            const btn = content.previousElementSibling.querySelector('button');
            if (content.style.display === 'none') {
                content.style.display = 'block';
                btn.textContent = '−';
            } else {
                content.style.display = 'none';
                btn.textContent = '+';
            }
        }
        
        function createSequence() {
            const name = document.getElementById('sequenceName').value.trim();
            if (!name) {
                alert('Please enter a sequence name');
                return;
            }
            
            sequences.push({
                name: name,
                items: [] // Flat array: {type: 'group', groupIndex: N} or {type: 'frameBreak'}
            });
            
            document.getElementById('sequenceName').value = '';
            updateSequencesDisplay();
            document.getElementById('builderSequencerSection').classList.remove('hidden');
            showToast(`Sequence "${name}" created`);
        }
        
        function editSequenceName(seqIndex) {
            const nameElement = document.getElementById(`seqName${seqIndex}`);
            const currentName = sequences[seqIndex].name;
            
            const input = document.createElement('input');
            input.type = 'text';
            input.value = currentName;
            input.style.cssText = 'background: #000; color: #FF13F0; border: 1px solid #FF13F0; padding: 2px 6px; font-size: 14px; font-family: "Source Sans Pro", sans-serif; border-radius: 2px; width: 200px;';
            
            const saveEdit = () => {
                const newName = input.value.trim();
                if (newName && newName !== currentName) {
                    sequences[seqIndex].name = newName;
                    showToast(`Sequence renamed to "${newName}"`);
                }
                updateSequencesDisplay();
            };
            
            input.onblur = saveEdit;
            input.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    saveEdit();
                } else if (e.key === 'Escape') {
                    updateSequencesDisplay();
                }
            };
            
            nameElement.replaceWith(input);
            input.focus();
            input.select();
        }
        
        function deleteSequence(index) {
            if (confirm(`Delete sequence "${sequences[index].name}"?`)) {
                sequences.splice(index, 1);
                updateSequencesDisplay();
                showToast('Sequence deleted');
                
                if (sequences.length === 0) {
                    document.getElementById('builderSequencerSection').classList.add('hidden');
                }
            }
        }
        
        function openGroupSelectModal(sequenceIndex) {
            currentSequenceForAdding = sequenceIndex;
            selectedGroupsForAdding = [];
            
            const listDiv = document.getElementById('groupSelectList');
            listDiv.innerHTML = '';
            
            if (activeSet.groups.length === 0) {
                listDiv.innerHTML = '<div style="color: #FF13F0; text-align: center; padding: 20px;">No swaps available. Create swaps first.</div>';
            } else {
                activeSet.groups.forEach((group, index) => {
                    const item = document.createElement('div');
                    item.style.cssText = 'display: flex; align-items: center; gap: 10px; padding: 8px; background: #000; border: 2px solid #FF13F0; border-radius: 2px; cursor: pointer; transition: all 0.2s; margin-bottom: 8px;';
                    
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.id = `groupCheck${index}`;
                    checkbox.style.cssText = 'width: 18px; height: 18px; cursor: pointer;';
                    checkbox.onchange = (e) => {
                        e.stopPropagation();
                        toggleGroupSelection(index, checkbox.checked);
                    };
                    
                    const label = document.createElement('label');
                    label.htmlFor = `groupCheck${index}`;
                    label.textContent = group.name;
                    label.style.cssText = 'color: #FF13F0; font-size: 12px; font-family: "Source Sans Pro", sans-serif; font-weight: 600; cursor: pointer; flex: 1;';
                    
                    item.onclick = () => {
                        checkbox.checked = !checkbox.checked;
                        toggleGroupSelection(index, checkbox.checked);
                    };
                    
                    item.onmouseover = () => {
                        item.style.background = '#330033';
                        item.style.boxShadow = '0 0 10px rgba(255, 19, 240, 0.5)';
                    };
                    item.onmouseout = () => {
                        item.style.background = '#000';
                        item.style.boxShadow = 'none';
                    };
                    
                    item.appendChild(checkbox);
                    item.appendChild(label);
                    listDiv.appendChild(item);
                });
            }
            
            document.getElementById('groupSelectModal').style.display = 'flex';
        }
        
        let selectedGroupsForAdding = [];
        
        function toggleGroupSelection(groupIndex, isSelected) {
            if (isSelected) {
                if (!selectedGroupsForAdding.includes(groupIndex)) {
                    selectedGroupsForAdding.push(groupIndex);
                }
            } else {
                const idx = selectedGroupsForAdding.indexOf(groupIndex);
                if (idx > -1) {
                    selectedGroupsForAdding.splice(idx, 1);
                }
            }
        }
        
        function closeGroupSelectModal() {
            document.getElementById('groupSelectModal').style.display = 'none';
            currentSequenceForAdding = null;
            selectedGroupsForAdding = [];
        }
        
        function addSelectedGroupsToSequence() {
            if (currentSequenceForAdding === null) return;
            if (selectedGroupsForAdding.length === 0) {
                showToast('No swaps selected');
                return;
            }
            
            // Add all selected groups to the sequence items
            selectedGroupsForAdding.forEach(groupIndex => {
                sequences[currentSequenceForAdding].items.push({
                    type: 'group',
                    groupIndex: groupIndex
                });
            });
            
            closeGroupSelectModal();
            updateSequencesDisplay();
            showToast(`Added ${selectedGroupsForAdding.length} swap(s) to sequence`);
        }
        
        function addGroupToSequence(groupIndex) {
            if (currentSequenceForAdding === null || currentFrameForAdding === null) return;
            
            sequences[currentSequenceForAdding].frames[currentFrameForAdding].push(groupIndex);
            closeGroupSelectModal();
            updateSequencesDisplay();
            showToast(`Added "${activeSet.groups[groupIndex].name}" to sequence`);
        }
        
        function removeGroupFromFrame(sequenceIndex, frameIndex, groupIndexInFrame) {
            sequences[sequenceIndex].frames[frameIndex].splice(groupIndexInFrame, 1);
            updateSequencesDisplay();
            showToast('Swap removed from frame');
        }
        
        function addFrameToSequence(sequenceIndex) {
            sequences[sequenceIndex].frames.push([]);
            updateSequencesDisplay();
            showToast('Frame added to sequence');
        }
        
        function deleteFrame(sequenceIndex, frameIndex) {
            if (sequences[sequenceIndex].frames.length <= 1) {
                alert('Sequence must have at least one frame');
                return;
            }
            sequences[sequenceIndex].frames.splice(frameIndex, 1);
            updateSequencesDisplay();
            showToast('Frame deleted');
        }
        
        function moveGroupInFrame(sequenceIndex, frameIndex, fromIndex, toIndex) {
            const frame = sequences[sequenceIndex].frames[frameIndex];
            const [movedItem] = frame.splice(fromIndex, 1);
            frame.splice(toIndex, 0, movedItem);
            updateSequencesDisplay();
        }
        
        function updateSequencesDisplay() {
            const container = document.getElementById('sequencesContainer');
            const emptyState = document.getElementById('sequencesEmptyState');
            
            if (sequences.length === 0) {
                // Show empty state
                if (emptyState) emptyState.style.display = 'block';
                // Clear any existing sequences HTML
                Array.from(container.children).forEach(child => {
                    if (child.id !== 'sequencesEmptyState') {
                        child.remove();
                    }
                });
                return;
            }
            
            // Hide empty state when sequences exist
            if (emptyState) emptyState.style.display = 'none';
            
            let html = '';
            sequences.forEach((seq, seqIndex) => {
                html += `
                    <div style="background: #000; border: 2px solid #FF13F0; border-radius: 2px; padding: 15px; margin-bottom: 15px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <h4 id="seqName${seqIndex}" ondblclick="editSequenceName(${seqIndex})" style="color: #FF13F0; margin: 0; font-size: 14px; cursor: pointer;" title="Double-click to edit">${seq.name}</h4>
                                <button onclick="toggleSequenceCodeCollapse(${seqIndex})" id="seqCodeCollapseBtn${seqIndex}" style="background: none; border: none; color: #FF13F0; font-size: 16px; cursor: pointer; padding: 0; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">+</button>
                            </div>
                            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                                <button onclick="openGroupSelectModal(${seqIndex})" style="background: #FF13F0; color: #000; border: none; padding: 4px 12px; border-radius: 2px; cursor: pointer; font-size: 11px; font-weight: 600; transition: all 0.2s;"
                                        onmouseover="this.style.background='#cc00cc';"
                                        onmouseout="this.style.background='#FF13F0';">+SWAP</button>
                                <button onclick="addFrameBreak(${seqIndex})" style="background: #FF13F0; color: #000; border: none; padding: 4px 12px; border-radius: 2px; cursor: pointer; font-size: 11px; font-weight: 600; transition: all 0.2s;"
                                        onmouseover="this.style.background='#cc00cc';"
                                        onmouseout="this.style.background='#FF13F0';">+FRAME</button>
                                <button onclick="copySequenceCode(${seqIndex}, this)" style="background: #000; color: #FF13F0; border: 2px solid #FF13F0; padding: 4px 12px; border-radius: 2px; cursor: pointer; font-size: 11px; font-weight: 600; transition: all 0.2s;"
                                        onmouseover="this.style.background='#330033'; this.style.boxShadow='0 0 10px rgba(255,19,240,0.5)';"
                                        onmouseout="this.style.background='#000'; this.style.boxShadow='none';">COPY</button>
                                <button onclick="deleteSequence(${seqIndex})" style="background: #000; color: #ff0066; border: 2px solid #ff0066; padding: 0; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-size: 16px; font-weight: bold; transition: all 0.2s; display: flex; align-items: center; justify-content: center; line-height: 1;"
                                        onmouseover="this.style.background='#1a0000'; this.style.color='#ff0066';"
                                        onmouseout="this.style.background='#000'; this.style.color='#ff0066';">×</button>
                                <button class="toggle-btn sequence-preview-btn" id="seqPreviewBtn${seqIndex}" onclick="previewActivateSequence(${seqIndex})" style="background: #000; color: #FF13F0; border: 2px solid #FF13F0; padding: 4px; font-size: 16px; font-weight: normal; font-family: FontAwesome; border-radius: 2px; cursor: pointer; transition: all 0.2s; line-height: 1; min-width: 28px; height: 28px;" title="Preview this sequence">
                                    <i class="fa fa-eye"></i>
                                </button>
                            </div>
                        </div>
                        
                        <!-- Code Block (collapsed by default) -->
                        <div id="seqCodeBlock${seqIndex}" style="display: none; background: #001100; border: 1px solid #FF13F0; border-radius: 2px; padding: 10px; margin-bottom: 10px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                <span style="color: #FF13F0; font-size: 12px; font-weight: 600;">TileData Code</span>
                            </div>
                            <pre id="sequenceCode${seqIndex}" style="background: #000; color: #FF13F0; padding: 10px; border-radius: 2px; overflow-x: auto; font-family: 'Courier New', monospace; font-size: 11px; line-height: 1.5; margin: 0;"></pre>
                        </div>

                        <!-- Items (Groups and Frame Breaks) -->
                        <div style="display: flex; flex-wrap: wrap; gap: 8px; min-height: 40px; background: #001100; border: 1px solid #FF13F0; border-radius: 2px; padding: 10px;">
                `;
                
                if (seq.items.length === 0) {
                    html += '<div style="color: #FF13F0; opacity: 0.5; font-size: 11px;">No items yet - add swaps or frame breaks</div>';
                } else {
                    seq.items.forEach((item, itemIndex) => {
                        if (item.type === 'frameBreak') {
                            // Frame break item (pipe separator)
                            html += `
                                <div draggable="true" 
                                     ondragstart="sequenceDragStart(event, ${seqIndex}, ${itemIndex})"
                                     ondragover="event.preventDefault()"
                                     ondrop="sequenceDrop(event, ${seqIndex}, ${itemIndex})"
                                     style="background: #333; border: 1px solid #666; border-radius: 2px; padding: 6px 8px; display: flex; align-items: center; gap: 6px; cursor: move; min-width: 60px;">
                                    <span style="color: #666; font-size: 10px; cursor: move;">⋮⋮</span>
                                    <span style="color: #888; font-size: 14px; font-weight: bold;">|</span>
                                    <button onclick="removeSequenceItem(${seqIndex}, ${itemIndex})" style="background: none; border: none; color: #cc0044; cursor: pointer; font-size: 14px; padding: 0; margin-left: auto;">×</button>
                                </div>
                            `;
                        } else if (item.type === 'group') {
                            // Group item
                            const group = activeSet.groups[item.groupIndex];
                            if (group) {
                                html += `
                                    <div draggable="true"
                                         ondragstart="sequenceDragStart(event, ${seqIndex}, ${itemIndex})"
                                         ondragover="event.preventDefault()"
                                         ondrop="sequenceDrop(event, ${seqIndex}, ${itemIndex})"
                                         style="background: #330033; border: 1px solid #FF13F0; border-radius: 2px; padding: 6px 10px; display: flex; align-items: center; gap: 8px; cursor: move;">
                                        <span style="color: #FF13F0; font-size: 10px; cursor: move;">⋮⋮</span>
                                        <span style="color: #FF13F0; font-size: 11px;">${group.name}</span>
                                        ${group.frames > 1 ? '<span style="display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; background: #FF13F0; border-radius: 50%; color: #000; font-size: 11px; line-height: 16px;">➟</span>' : ''}
                                        <button onclick="removeSequenceItem(${seqIndex}, ${itemIndex})" style="background: none; border: none; color: #cc0044; cursor: pointer; font-size: 14px; padding: 0; margin-left: 5px;">×</button>
                                    </div>
                                `;
                            }
                        }
                    });
                }
                
                html += `
                        </div>
                    </div>
                `;
            });
            
            // Preserve empty state element before setting innerHTML
            const emptyStateHTML = emptyState ? emptyState.outerHTML : '';
            container.innerHTML = emptyStateHTML + html;
            
            // Populate sequence code after HTML insertion
            sequences.forEach((seq, seqIndex) => {
                const codeElement = document.getElementById(`sequenceCode${seqIndex}`);
                if (codeElement) {
                    codeElement.textContent = generateSequenceCode(seqIndex);
                }
            });
        }
        
        function toggleSequenceCodeCollapse(seqIndex) {
            const codeBlock = document.getElementById(`seqCodeBlock${seqIndex}`);
            const btn = document.getElementById(`seqCodeCollapseBtn${seqIndex}`);
            
            if (codeBlock.style.display === 'none') {
                codeBlock.style.display = 'block';
                btn.textContent = '−';
            } else {
                codeBlock.style.display = 'none';
                btn.textContent = '+';
            }
        }
        
        function copySequenceCode(seqIndex, btn) {
            const codeElement = document.getElementById(`sequenceCode${seqIndex}`);
            const code = codeElement.textContent;

            navigator.clipboard.writeText(code).then(() => {
                if (btn) copiedFeedback(btn);
                showToast('Sequence code copied to clipboard');
            }).catch(err => {
                console.error('Failed to copy:', err);
                alert('Failed to copy to clipboard');
            });
        }
        
        function handleSequenceGroupDrop(event, seqIndex, frameIndex, toIndex) {
            event.preventDefault();
            const data = event.dataTransfer.getData('text');
            const [fromSeqIndex, fromFrameIndex, fromIndex] = data.split(',').map(Number);
            
            // Only allow reordering within the same frame
            if (fromSeqIndex === seqIndex && fromFrameIndex === frameIndex && fromIndex !== toIndex) {
                moveGroupInFrame(seqIndex, frameIndex, fromIndex, toIndex);
            }
        }
        
        // New flat structure helper functions
        function addFrameBreak(seqIndex) {
            sequences[seqIndex].items.push({
                type: 'frameBreak'
            });
            updateSequencesDisplay();
            showToast('Frame break added');
        }
        
        function removeSequenceItem(seqIndex, itemIndex) {
            sequences[seqIndex].items.splice(itemIndex, 1);
            updateSequencesDisplay();
            showToast('Item removed');
        }
        
        function sequenceDragStart(event, seqIndex, itemIndex) {
            event.dataTransfer.setData('text', `${seqIndex},${itemIndex}`);
        }
        
        function sequenceDrop(event, seqIndex, toIndex) {
            event.preventDefault();
            const data = event.dataTransfer.getData('text');
            const [fromSeqIndex, fromIndex] = data.split(',').map(Number);
            
            // Only allow reordering within same sequence
            if (fromSeqIndex === seqIndex && fromIndex !== toIndex) {
                const items = sequences[seqIndex].items;
                const [movedItem] = items.splice(fromIndex, 1);
                items.splice(toIndex, 0, movedItem);
                updateSequencesDisplay();
            }
        }
        
        // ========================================
        // END SEQUENCER FUNCTIONS
        // ========================================
        
        function previewJSON() {
            if (activeSet.groups.length === 0) {
                alert('No swaps to preview. Create at least one swap first.');
                return;
            }

            // Build V2 preview (no images — too large for display)
            snapshotCurrentSet();
            const previewData = buildV2JsonData(null);
            // Strip image data from preview to keep it readable
            previewData.sets.forEach(s => {
                delete s.referenceLevelImage;
                delete s.referenceTilesetImage;
                delete s.referenceTilesetFrameImage;
                if (s.imagesExtraData) delete s.imagesExtraData;
            });
            document.getElementById('jsonPreviewContent').textContent = JSON.stringify(previewData, null, 2);
            document.getElementById('jsonPreviewModal').classList.add('active');
        }

        function _previewJSON_unused() {
            const tilesetName = getTilesetName() || 'tileset';
            // Generate JSON data
            let tileOffset = 0;
            const jsonData = {
                version: '1.0',
                tilesetName: tilesetName,
                tilesetType: getTilesetType(),
                gbvmMode: getGbvmMode(),
                groups: activeSet.groups.map((group, groupIndex) => {
                    // Generate compact TileData format
                    let tileData = '';
                    if (group.frames > 1 && group.allFrames) {
                        // Multi-frame: separate frames with |
                        const framesParts = group.allFrames.map((frame, frameIndex) => {
                            return group.img1Tiles.map((tile, index) => {
                                let tileIndex;
                                if (workMode === 'reference') {
                                    // Use tile coordinates from img2Tiles (TILESET.PNG)
                                    const sourceTile = group.img2Tiles[index];
                                    tileIndex = getTileIndexFromCoordinates(sourceTile.col + (frameIndex * (Math.max(...group.img2Tiles.map(t => t.col)) - Math.min(...group.img2Tiles.map(t => t.col)) + 1)), sourceTile.row);
                                } else {
                                    tileIndex = tileOffset + (frameIndex * group.img1Tiles.length) + index;
                                }
                                return `${tile.col},${tile.row},${tileIndex}`;
                            }).join(';');
                        });
                        tileData = framesParts.join(';|\n');
                        tileOffset += group.img1Tiles.length * group.frames;
                    } else {
                        // Single frame
                        tileData = group.img1Tiles.map((tile, index) => {
                            let tileIndex;
                            if (workMode === 'reference') {
                                // Use tile coordinates from img2Tiles (TILESET.PNG)
                                const sourceTile = group.img2Tiles[index];
                                tileIndex = getTileIndexFromCoordinates(sourceTile.col, sourceTile.row);
                            } else {
                                tileIndex = tileOffset + index;
                            }
                            return `${tile.col},${tile.row},${tileIndex}`;
                        }).join(';');
                        tileOffset += group.img1Tiles.length;
                    }

                    // Collect all saved tiles
                    let savedTilesRaw = [];
                    if (group.frames > 1 && group.allFrames) {
                        group.allFrames.forEach(frame => {
                            savedTilesRaw = savedTilesRaw.concat(frame.savedTiles);
                        });
                    } else {
                        savedTilesRaw = group.savedTiles;
                    }
                    // Strip runtime-only fields (pixels, tilesetIndex) before serialization
                    const savedTiles = savedTilesRaw.map(({ col, row, imageData }) => ({ col, row, imageData }));

                    return {
                        name: group.name,
                        frames: group.frames,
                        tileData: tileData,
                        savedTiles: savedTiles,
                        restoreOriginal: group.restoreOriginal || false
                    };
                })
            };
            
            // Display in modal
            document.getElementById('jsonPreviewContent').textContent = JSON.stringify(jsonData, null, 2);
            document.getElementById('jsonPreviewModal').classList.add('active');
        }
        
        function closeModal(modalId) {
            document.getElementById(modalId).classList.remove('active');
        }

        // Warning Modal System
        let warningModalCallback = null;

        function showWarning(message, title = 'Warning') {
            return new Promise((resolve) => {
                warningModalCallback = resolve;
                document.getElementById('warningModalTitle').textContent = title;
                document.getElementById('warningModalMessage').textContent = message;
                document.getElementById('warningModal').classList.add('active');

                // Add keyboard listener
                document.addEventListener('keydown', handleWarningKeypress);
            });
        }

        function closeWarningModal(confirmed) {
            document.getElementById('warningModal').classList.remove('active');
            document.removeEventListener('keydown', handleWarningKeypress);

            if (warningModalCallback) {
                warningModalCallback(confirmed);
                warningModalCallback = null;
            }
        }

        function handleWarningKeypress(e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeWarningModal(false);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                closeWarningModal(true);
            }
        }

        // Alert Modal System
        let alertModalCallback = null;

        function showAlert(message, title = 'Alert') {
            return new Promise((resolve) => {
                alertModalCallback = resolve;
                document.getElementById('alertModalTitle').textContent = title;
                document.getElementById('alertModalMessage').textContent = message;
                document.getElementById('alertModal').classList.add('active');

                // Add keyboard listener
                document.addEventListener('keydown', handleAlertKeypress);
            });
        }

        function closeAlertModal() {
            document.getElementById('alertModal').classList.remove('active');
            document.removeEventListener('keydown', handleAlertKeypress);

            if (alertModalCallback) {
                alertModalCallback(true);
                alertModalCallback = null;
            }
        }

        function handleAlertKeypress(e) {
            if (e.key === 'Escape' || e.key === 'Enter') {
                e.preventDefault();
                closeAlertModal();
            }
        }

        // Toast notification function
        function showToast(message) {
            const toast = document.getElementById('toastNotification');
            toast.textContent = message;
            toast.classList.add('show');

            setTimeout(() => {
                toast.classList.remove('show');
            }, 2000);
        }

        function copiedFeedback(btn) {
            const prev = {
                text: btn.textContent, bg: btn.style.background,
                color: btn.style.color, border: btn.style.borderColor, shadow: btn.style.boxShadow,
            };
            btn.textContent = '✓ COPIED';
            btn.style.background = '#00ff00'; btn.style.color = '#000000';
            btn.style.borderColor = '#00ff00';
            btn.style.boxShadow = '0 0 12px rgba(0,255,0,0.6)';
            setTimeout(() => {
                btn.textContent = prev.text; btn.style.background = prev.bg;
                btn.style.color = prev.color; btn.style.borderColor = prev.border;
                btn.style.boxShadow = prev.shadow;
            }, 1500);
        }

        // ====== V2 SET MANAGEMENT (UI side) ======
        // Engine functions: snapshotCurrentSet, restoreFromSet, switchActiveSet,
        //                   addSet, removeSet, renameSet — all in engine.js

        // Full DOM rebuild + UI sync after an engine set switch.
        // Call AFTER switchActiveSet(idx) has already mutated engineState.
        function applySetSwitch() {
            // ── 1. Canvases ─────────────────────────────────────────────────────
            // canvas1 (LEVEL) is global — no redraw here; builderRedrawSelections()
            // below handles it (clears + redraws image1 + per-set selection highlights).
            if (activeSet.image2) {
                activeSet.canvas2.width  = activeSet.image2.width;
                activeSet.canvas2.height = activeSet.image2.height;
                activeSet.ctx2.drawImage(activeSet.image2, 0, 0);
            } else {
                activeSet.canvas2.width = 0; activeSet.canvas2.height = 0;
            }

            // ── 2. Rebuild extra frames DOM ──────────────────────────────────────
            // Save what was restored from engine
            const restoredImages     = [...activeSet.imagesExtra];
            const restoredFilenames  = [...activeSet.filenamesExtra];
            const restoredSelections = activeSet.selectionsExtra.map(s => new Set(s));

            // Wipe arrays — addFrame() will rebuild them
            activeSet.imagesExtra     = [];
            activeSet.filenamesExtra  = [];
            activeSet.selectionsExtra = [];
            activeSet.canvasesExtra     = [];
            activeSet.ctxsExtra         = [];
            activeSet.highlightsExtra   = [];
            activeSet.dragPreviewsExtra = [];

            // Remove existing extra frame divs
            const tilesetContainer = document.getElementById('tilesetFramesContainer');
            tilesetContainer.querySelectorAll('.tileset-frame[data-frame^="extra_"]').forEach(d => d.remove());

            // Recreate a div for each extra frame and populate it
            for (let i = 0; i < restoredImages.length; i++) {
                ImageManager.addFrame();   // creates DOM, pushes null to arrays
                if (restoredImages[i]) {
                    activeSet.imagesExtra[i]     = restoredImages[i];
                    activeSet.filenamesExtra[i]  = restoredFilenames[i];
                    activeSet.selectionsExtra[i] = restoredSelections[i];
                    const canvas = activeSet.canvasesExtra[i];
                    const ctx    = activeSet.ctxsExtra[i];
                    canvas.width  = restoredImages[i].width;
                    canvas.height = restoredImages[i].height;
                    ctx.drawImage(restoredImages[i], 0, 0);
                    // Show canvas, hide ghost (mirrors what loadExtra() does)
                    const ghostEl = document.getElementById(`builderGhostPlaceholder2_extra_${i}`);
                    const containerEl = document.getElementById(`builderContainer2_extra_${i}`);
                    if (ghostEl)     ghostEl.style.display = 'none';
                    if (containerEl) containerEl.classList.remove('hidden');
                    const labelEl = document.getElementById(`builderLabel2_extra_${i}`);
                    if (labelEl) {
                        const tc = Math.ceil(restoredImages[i].width / 8) * Math.ceil(restoredImages[i].height / 8);
                        labelEl.innerHTML = `${restoredFilenames[i]}&nbsp;<span style="font-size:9px;opacity:0.7">(${tc})</span>`;
                    }
                    const reloadBtn = document.getElementById(`builderReload2Btn_extra_${i}`);
                    if (reloadBtn) reloadBtn.style.display = 'inline-flex';
                }
            }

            // ── 3. Image labels (TILESET only — LEVEL is global, its label is unchanged) ─
            const setName = getActiveSetName();
            function applyImageUI(img, filename, labelId, reloadId, keepSelId, defaultLabel) {
                const label = document.getElementById(labelId);
                const reloadBtn = document.getElementById(reloadId);
                const keepSelEl = document.getElementById(keepSelId);
                if (img) {
                    const tc = Math.ceil(img.width / 8) * Math.ceil(img.height / 8);
                    if (label) label.innerHTML = `${filename}&nbsp;<span style="font-size:9px;opacity:0.7">(${tc})</span>`;
                    if (reloadBtn) reloadBtn.style.display = 'inline-flex';
                    if (keepSelEl) keepSelEl.style.display = 'flex';
                } else {
                    if (label) label.textContent = defaultLabel;
                    if (reloadBtn) reloadBtn.style.display = 'none';
                    if (keepSelEl) keepSelEl.style.display = 'none';
                }
            }
            // Frame 2 empty label = set name (Frame 2 IS this set's tileset)
            applyImageUI(activeSet.image2, activeSet.image2Filename,
                'builderLabel2', 'builderReload2Btn', 'builderKeepSelContainer2', setName);
            // Update ghost text too
            const ghost2 = document.getElementById('builderGhostText2');
            if (ghost2 && !activeSet.image2) ghost2.textContent = setName;

            // ── 4. Toggle button visual state ────────────────────────────────────
            function applyToggleStyle(id, active) {
                const btn = document.getElementById(id);
                if (!btn) return;
                btn.style.background = active ? '#04d9ff' : '#000';
                btn.style.color      = active ? '#000'    : '#04d9ff';
                btn.style.boxShadow  = active ? '0 0 10px rgba(4, 217, 255, 0.5)' : 'none';
            }
            applyToggleStyle('autoSortBtn',          activeSet.autoSort);
            applyToggleStyle('builderSymmetricMode', activeSet.symmetric);
            applyToggleStyle('builderMirrorMode',    activeSet.mirror);
            applyToggleStyle('builderBounceDouble',  activeSet.bounceDouble);
            const bounceDoubleBtn = document.getElementById('builderBounceDouble');
            if (bounceDoubleBtn) bounceDoubleBtn.style.display = activeSet.mirror ? 'inline-flex' : 'none';

            // Work-mode button
            const createBtn = document.getElementById('createModeBtn');
            if (createBtn) {
                if (workMode === 'reference') {
                    createBtn.style.background = '#000'; createBtn.style.color = '#00ff00';
                } else {
                    createBtn.style.background = '#00ff00'; createBtn.style.color = '#000';
                }
            }

            // ── 5. Mode UI (anim / swap) & layout ───────────────────────────────
            updateModeUI();
            ImageManager.updateLayout();
            ImageManager.updateLastFrameBtn();

            // ── 6. Selection redraw ─────────────────────────────────────────────
            builderRedrawSelections();

            // ── 7. Groups + code ─────────────────────────────────────────────────
            builderUpdateAllCode();

            // ── 8. Sequences ──────────────────────────────────────────────────────
            if (typeof updateSequencesDisplay === 'function') updateSequencesDisplay();
            const seqSection = document.getElementById('builderSequencerSection');
            if (seqSection) seqSection.classList.toggle('hidden', sequences.length === 0);

            // ── 9. Tileset canvas — regenerate using global groups + this set's frames ─
            if (engineState.groups.length > 0) {
                TilesetManager.generate();
            } else if (getTilesetImageData() && builderTilesetCanvas) {
                const img = new Image();
                img.onload = () => {
                    builderTilesetCanvas.width  = img.width;
                    builderTilesetCanvas.height = img.height;
                    builderTilesetCtx.clearRect(0, 0, img.width, img.height);
                    builderTilesetCtx.drawImage(img, 0, 0);
                };
                img.src = getTilesetImageData();
            } else if (builderTilesetCanvas) {
                builderTilesetCanvas.width = 0; builderTilesetCanvas.height = 0;
            }
            TilesetManager.updateSaveButtons();

            // ── 10. Set tabs ──────────────────────────────────────────────────────
            renderSetTabs();
        }

        // Switch to a set by index — engine swap + full DOM rebuild.
        function switchToSet(idx) {
            if (idx === getActiveSetIndex()) return;
            if (!switchActiveSet(idx)) return;   // engine does snapshot + restore
            applySetSwitch();
        }

        // Render / refresh the set tabs bar.
        function renderSetTabs() {
            const bar = document.getElementById('setsTabsBar');
            if (!bar) return;
            bar.innerHTML = '';
            const list = getSetsList();
            const activeIdx = getActiveSetIndex();
            list.forEach(({ index, name }) => {
                const tab = document.createElement('div');
                tab.className = 'set-tab' + (index === activeIdx ? ' set-tab-active' : '');
                tab.dataset.setIndex = index;

                const nameSpan = document.createElement('span');
                nameSpan.className = 'set-tab-name';
                nameSpan.textContent = name;
                // Double-click → rename
                nameSpan.addEventListener('dblclick', () => startRenameSet(index, nameSpan));
                tab.appendChild(nameSpan);

                // ✕ button (only if more than 1 set)
                if (list.length > 1) {
                    const closeBtn = document.createElement('button');
                    closeBtn.className = 'set-tab-close';
                    closeBtn.textContent = '✕';
                    closeBtn.title = 'Delete set';
                    closeBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (!confirm(`Delete "${name}"? All data in this set will be lost.`)) return;
                        removeSet(index);   // engine removes + restores active
                        applySetSwitch();   // rebuild DOM for new active
                    });
                    tab.appendChild(closeBtn);
                }

                tab.addEventListener('click', () => switchToSet(index));
                bar.appendChild(tab);
            });

            // + New Set button
            const addBtn = document.createElement('button');
            addBtn.className = 'set-tab-add';
            addBtn.textContent = '+ SET';
            addBtn.title = 'Add new set';
            addBtn.addEventListener('click', () => {
                addSet();          // engine: snapshot current + create new + restore empty
                applySetSwitch();  // rebuild DOM
            });
            bar.appendChild(addBtn);
        }

        // Inline rename: replace text with an input field.
        function startRenameSet(idx, spanEl) {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'set-tab-rename-input';
            input.value = spanEl.textContent;
            spanEl.replaceWith(input);
            input.focus();
            input.select();
            const finish = () => {
                const newName = input.value.trim() || spanEl.textContent;
                renameSet(idx, newName);
                renderSetTabs();
            };
            input.addEventListener('blur', finish);
            input.addEventListener('keydown', e => {
                if (e.key === 'Enter')  { input.blur(); }
                if (e.key === 'Escape') { input.value = spanEl.textContent; input.blur(); }
            });
        }

        // ====== UI MANAGER ======
        // Facade over UI / notification functions
        const UIManager = {
            setMode(mode)        { return setBuilderMode(mode); },
            updateModeUI()       { return updateModeUI(); },
            showToast(msg)       { return showToast(msg); },
            copiedFeedback(btn)  { return copiedFeedback(btn); },
        };

        // Undo notification system
        let currentUndoCallback = null;
        let undoTimeout = null;

        function showUndo(actionName, undoCallback) {
            const undoNotif = document.getElementById('undoNotification');
            const undoMsg = document.getElementById('undoMessage');
            const undoBtn = document.getElementById('undoButton');
            const undoClose = document.getElementById('undoClose');

            // Clear any existing timeout
            if (undoTimeout) {
                clearTimeout(undoTimeout);
            }

            // Set the message and callback
            undoMsg.textContent = actionName;
            currentUndoCallback = undoCallback;

            // Show the notification
            undoNotif.style.display = 'block';

            // Setup button handlers
            undoBtn.onclick = () => {
                if (currentUndoCallback) {
                    currentUndoCallback();
                    currentUndoCallback = null;
                }
                undoNotif.style.display = 'none';
                if (undoTimeout) {
                    clearTimeout(undoTimeout);
                }
            };

            undoClose.onclick = () => {
                currentUndoCallback = null;
                undoNotif.style.display = 'none';
                if (undoTimeout) {
                    clearTimeout(undoTimeout);
                }
            };

            // Auto-hide after 8 seconds
            undoTimeout = setTimeout(() => {
                currentUndoCallback = null;
                undoNotif.style.display = 'none';
            }, 8000);
        }

        // Group drag and drop functionality
        // draggedGroupIndex, tilesetImageData, tilesetImageBackup, currentHighlightedGroup → engine.js
        
        // highlightGroupTiles / clearTilesetHighlight → TilesetManager (above)
        
        function handleDragStart(e) {
            const block = e.target.closest('.frame-code-block');
            draggedGroupIndex = parseInt(block.dataset.groupIndex);
            block.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', block.innerHTML);
        }
        
        function handleDragEnd(e) {
            const block = e.target.closest('.frame-code-block');
            block.classList.remove('dragging');
            
            // Remove drag-over class from all blocks
            document.querySelectorAll('.frame-code-block').forEach(b => {
                b.classList.remove('drag-over');
            });
        }
        
        function handleDragOver(e) {
            if (e.preventDefault) {
                e.preventDefault();
            }
            e.dataTransfer.dropEffect = 'move';
            
            const block = e.target.closest('.frame-code-block');
            if (block && draggedGroupIndex !== null) {
                const targetIndex = parseInt(block.dataset.groupIndex);
                if (targetIndex !== draggedGroupIndex) {
                    block.classList.add('drag-over');
                }
            }
            
            return false;
        }
        
        function handleDragLeave(e) {
            const block = e.target.closest('.frame-code-block');
            if (block) {
                block.classList.remove('drag-over');
            }
        }
        
        function handleDrop(e) {
            if (e.stopPropagation) {
                e.stopPropagation();
            }
            
            const block = e.target.closest('.frame-code-block');
            if (!block) return false;
            
            const targetIndex = parseInt(block.dataset.groupIndex);
            
            if (draggedGroupIndex !== null && draggedGroupIndex !== targetIndex) {
                // Reorder the groups array
                const draggedGroup = activeSet.groups[draggedGroupIndex];
                activeSet.groups.splice(draggedGroupIndex, 1);
                
                // Adjust target index if dragging down
                const newIndex = draggedGroupIndex < targetIndex ? targetIndex - 1 : targetIndex;
                activeSet.groups.splice(newIndex, 0, draggedGroup);
                
                // Regenerate tileset and code
                TilesetManager.generate();
                builderUpdateAllCode();
                
                showToast(`Swap moved to position ${newIndex + 1}`);
            }
            
            draggedGroupIndex = null;
            return false;
        }
        
        // ====== WORK MODE FUNCTIONS ======
        
        function toggleCreateMode() {
            const btn = document.getElementById('createModeBtn');

            // Toggle between create and reference modes
            if (workMode === 'create') {
                // Switch to REFERENCE mode
                setWorkMode('reference');
                btn.style.background = '#000';
                btn.style.color = '#00ff00';
            } else {
                // Switch to CREATE mode
                setWorkMode('create');
                btn.style.background = '#00ff00';
                btn.style.color = '#000';
            }

            // Regenerate if groups exist
            if (activeSet.groups.length > 0) {
                TilesetManager.generate();
                builderUpdateAllCode();
            }
        }
        
        // handleTilesetHover → TilesetManager.handleHover (above)
        
        function highlightGroupEverywhere(groupIndex) {
            // Highlight in Groups section
            const groupBlocks = document.querySelectorAll('.frame-code-block');
            groupBlocks.forEach((block, idx) => {
                if (idx === groupIndex) {
                    block.style.background = 'rgba(4, 217, 255, 0.2)';
                    block.style.borderColor = '#04d9ff';
                } else {
                    block.style.background = '#001122';
                    block.style.borderColor = '#04d9ff';
                }
            });

            // Highlight in Sequences
            sequences.forEach((seq, seqIndex) => {
                seq.items.forEach((item, itemIndex) => {
                    if (item.type === 'group' && item.groupIndex === groupIndex) {
                        // Find the element and highlight it
                        const elements = document.querySelectorAll(`[ondragstart*="sequenceDragStart(event, ${seqIndex},"]`);
                        if (elements[itemIndex]) {
                            elements[itemIndex].style.background = 'rgba(255, 19, 240, 0.4)';
                        }
                    }
                });
            });

            // Highlight tiles in LEVEL.PNG and TILESET.PNG
            const group = activeSet.groups[groupIndex];

            // Auto-switch to the set this group was created from
            if (group && group.setIndex !== undefined && group.setIndex !== getActiveSetIndex()) {
                switchToSet(group.setIndex);
            }

            if (group && activeSet.image1 && activeSet.image2) {
                // Redraw LEVEL.PNG with selection
                activeSet.ctx1.clearRect(0, 0, activeSet.canvas1.width, activeSet.canvas1.height);
                activeSet.ctx1.drawImage(activeSet.image1, 0, 0);

                // Draw current selection on LEVEL.PNG
                activeSet.img1Selection.forEach(key => {
                    const [col, row] = key.split(',').map(Number);
                    activeSet.ctx1.fillStyle = 'rgba(0, 255, 0, 0.3)';
                    activeSet.ctx1.fillRect(col * 8, row * 8, 8, 8);
                    activeSet.ctx1.strokeStyle = '#00ff00';
                    activeSet.ctx1.lineWidth = 1;
                    // Border inside: offset by 0.5px and reduce size by 1px
                    activeSet.ctx1.strokeRect(col * 8 + 0.5, row * 8 + 0.5, 7, 7);
                });

                // Highlight group tiles on LEVEL.PNG
                group.img1Tiles.forEach(tile => {
                    activeSet.ctx1.strokeStyle = '#04d9ff';
                    activeSet.ctx1.lineWidth = 1;
                    // Border inside: offset by 0.5px and reduce size by 1px
                    activeSet.ctx1.strokeRect(tile.col * 8 + 0.5, tile.row * 8 + 0.5, 7, 7);
                });

                // Redraw TILESET.PNG with selection AND frame highlights
                highlightFramesOnTileset();

                // Highlight group tiles on tileset canvas(es)
                if (group.allFrames && group.useMultiImage) {
                    // Multi-image: each forward frame on its corresponding canvas
                    const allLoadedFrames = getAllTilesetFrames();
                    group.allFrames.forEach((frame, i) => {
                        if (i >= allLoadedFrames.length) return;
                        // Redraw extra frame canvas cleanly before drawing highlight
                        if (i > 0) builderRedrawExtraFrameSelection(i - 1);
                        frame.img2Tiles.forEach(tile => {
                            allLoadedFrames[i].ctx.strokeStyle = '#04d9ff';
                            allLoadedFrames[i].ctx.lineWidth = 1;
                            allLoadedFrames[i].ctx.strokeRect(tile.col * 8 + 0.5, tile.row * 8 + 0.5, 7, 7);
                        });
                    });
                } else if (group.allFrames && group.frames > 1) {
                    // Single-image: all frames on canvas2 (allFrames already has offset positions)
                    group.allFrames.forEach(frame => {
                        frame.img2Tiles.forEach(tile => {
                            activeSet.ctx2.strokeStyle = '#04d9ff';
                            activeSet.ctx2.lineWidth = 1;
                            activeSet.ctx2.strokeRect(tile.col * 8 + 0.5, tile.row * 8 + 0.5, 7, 7);
                        });
                    });
                } else if (group.img2Tiles) {
                    // Single frame or legacy
                    group.img2Tiles.forEach(tile => {
                        activeSet.ctx2.strokeStyle = '#04d9ff';
                        activeSet.ctx2.lineWidth = 1;
                        activeSet.ctx2.strokeRect(tile.col * 8 + 0.5, tile.row * 8 + 0.5, 7, 7);
                    });
                }
            }
        }

        function clearGroupHighlights() {
            // Reset all group blocks to normal style
            const groupBlocks = document.querySelectorAll('.frame-code-block');
            groupBlocks.forEach(block => {
                block.style.background = '#001122';
                block.style.borderColor = '#04d9ff';
            });

            // Redraw canvases to remove tile highlights
            if (activeSet.image1) {
                activeSet.ctx1.clearRect(0, 0, activeSet.canvas1.width, activeSet.canvas1.height);
                activeSet.ctx1.drawImage(activeSet.image1, 0, 0);

                // Redraw current selection
                activeSet.img1Selection.forEach(key => {
                    const [col, row] = key.split(',').map(Number);
                    activeSet.ctx1.fillStyle = 'rgba(0, 255, 0, 0.3)';
                    activeSet.ctx1.fillRect(col * 8, row * 8, 8, 8);
                    activeSet.ctx1.strokeStyle = '#00ff00';
                    activeSet.ctx1.lineWidth = 1;
                    // Border inside: offset by 0.5px and reduce size by 1px
                    activeSet.ctx1.strokeRect(col * 8 + 0.5, row * 8 + 0.5, 7, 7);
                });
            }

            // Redraw image 2 with frame highlights if needed
            if (activeSet.image2) {
                highlightFramesOnTileset();
            }

            // Redraw extra frame canvases to remove group tile highlights
            for (let i = 0; i < activeSet.imagesExtra.length; i++) {
                builderRedrawExtraFrameSelection(i);
            }
        }

        // clearTilesetHighlights → TilesetManager.clearHighlights (above)
        
        // ====== PREVIEW FUNCTIONS ======
        let previewCanvas = null;
        let previewCtx = null;
        let previewMs = 200; // delay in milliseconds between frames
        let previewAnimationInterval = null;
        let previewCurrentFrame = 0;
        let previewActiveGroup = null;
        let previewActiveSequence = null;
        let previewLevelImage = null;
        let previewSwapAllActive = false;
        let previewSwapAllMappings = null; // [{col,row}[]] one entry per img1Tile

        // Initialize preview canvas
        function initPreviewCanvas() {
            if (!previewCanvas) {
                previewCanvas = document.getElementById('previewCanvas');
                previewCtx = previewCanvas.getContext('2d');
                previewCtx.imageSmoothingEnabled = false;
            }
        }

        // Update frame delay (ms)
        function previewUpdateMs(value) {
            previewMs = parseInt(value);
            document.getElementById('previewMsValue').textContent = previewMs + ' ms';
            if (previewActiveSequence !== null || previewActiveGroup !== null) {
                previewStartAnimation(); // Restart with new delay
            }
        }

        // Update all preview button backgrounds based on active state
        function updateAllPreviewButtons() {
            // Reset all group preview buttons
            const groupButtons = document.querySelectorAll('.group-preview-btn');
            groupButtons.forEach((btn, index) => {
                if (previewActiveGroup === index) {
                    // Active state - inverted background
                    btn.style.background = '#FF13F0';
                    btn.style.color = '#000';
                    btn.style.boxShadow = '0 0 10px rgba(255, 153, 0, 0.5)';
                } else {
                    // Inactive state - outlined
                    btn.style.background = '#000';
                    btn.style.color = '#FF13F0';
                    btn.style.boxShadow = 'none';
                }
            });

            // Reset all sequence preview buttons
            const sequenceButtons = document.querySelectorAll('.sequence-preview-btn');
            sequenceButtons.forEach((btn, index) => {
                if (previewActiveSequence === index) {
                    // Active state - inverted background
                    btn.style.background = '#FF13F0';
                    btn.style.color = '#000';
                    btn.style.boxShadow = '0 0 10px rgba(255, 153, 0, 0.5)';
                } else {
                    // Inactive state - outlined
                    btn.style.background = '#000';
                    btn.style.color = '#FF13F0';
                    btn.style.boxShadow = 'none';
                }
            });
        }

        // Activate preview for a group
        function previewActivateGroup(groupIndex) {
            initPreviewCanvas();

            // Open preview tab if not already open
            const section = document.getElementById('previewSection');
            const tab = document.getElementById('previewTab');
            if (section.style.display === 'none') {
                section.style.display = 'block';
                tab.style.background = '#FF13F0';
                tab.style.color = '#000';
                tab.style.opacity = '1';
                checkScreensaver();
            }

            // Toggle: if clicking the same group, deactivate it
            if (previewActiveGroup === groupIndex) {
                previewActiveGroup = null;
                previewSwapAllMappings = null;
                previewStopAnimation();
                // Just show the level image
                if (previewLevelImage) {
                    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
                    previewCtx.drawImage(previewLevelImage, 0, 0);
                }
                document.getElementById('previewInfoText').textContent = 'Preview deactivated - Click PREVIEW on a Swap or Sequence';

                // Reset all preview button backgrounds
                updateAllPreviewButtons();
                updatePreviewPlayButton();
                return;
            }

            // Stop any animation
            previewStopAnimation();

            // Set active group
            previewActiveGroup = groupIndex;
            previewActiveSequence = null;
            previewCurrentFrame = 0;

            // Start animation for multi-frame groups, static render for single-frame
            const group = activeSet.groups[groupIndex];
            if (group.frames > 1) {
                previewStartAnimation();
            } else {
                previewRender();
            }

            // If SWAP ALL is active, recompute mappings for this group
            if (previewSwapAllActive) {
                previewComputeSwapAllMappings(group);
            } else {
                // Update info text (overridden by previewComputeSwapAllMappings when SWAP ALL on)
                document.getElementById('previewInfoText').textContent = `Previewing Swap: ${group.name}`;
            }

            // Update all preview button backgrounds
            updateAllPreviewButtons();
            updatePreviewPlayButton();
        }

        // Activate preview for a sequence
        function previewActivateSequence(sequenceIndex) {
            initPreviewCanvas();

            // Open preview tab if not already open
            const section = document.getElementById('previewSection');
            const tab = document.getElementById('previewTab');
            if (section.style.display === 'none') {
                section.style.display = 'block';
                tab.style.background = '#FF13F0';
                tab.style.color = '#000';
                tab.style.opacity = '1';
                checkScreensaver();
            }

            // Toggle: if clicking the same sequence, deactivate it
            if (previewActiveSequence === sequenceIndex) {
                previewActiveSequence = null;
                previewSwapAllMappings = null;
                previewStopAnimation();
                // Just show the level image
                if (previewLevelImage) {
                    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
                    previewCtx.drawImage(previewLevelImage, 0, 0);
                }
                document.getElementById('previewInfoText').textContent = 'Preview deactivated - Click PREVIEW on a Swap or Sequence';

                // Reset all preview button backgrounds
                updateAllPreviewButtons();
                updatePreviewPlayButton();
                return;
            }

            // Stop any animation
            previewStopAnimation();

            // Set active sequence
            previewActiveSequence = sequenceIndex;
            previewActiveGroup = null;
            previewCurrentFrame = 0;

            // Start animation
            previewStartAnimation();

            // Update info text
            const sequence = sequences[sequenceIndex];
            document.getElementById('previewInfoText').textContent = `Previewing Sequence: ${sequence.name}`;

            // Update all preview button backgrounds
            updateAllPreviewButtons();
            updatePreviewPlayButton();
        }

        // Render preview
        function previewRender() {
            if (!previewCanvas || !previewCtx) return;

            // Load level image if not already loaded
            if (!previewLevelImage && activeSet.image1) {
                previewLevelImage = activeSet.image1;
                previewCanvas.width = previewLevelImage.width;
                previewCanvas.height = previewLevelImage.height;
            }

            if (!previewLevelImage) return;

            // Clear canvas
            previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

            // Draw level image
            previewCtx.drawImage(previewLevelImage, 0, 0);

            // Draw active group or sequence
            if (previewActiveGroup !== null) {
                const group = activeSet.groups[previewActiveGroup];
                const frameIndex = group.frames > 1 ? previewCurrentFrame % group.frames : 0;
                previewDrawGroup(group, frameIndex);
            } else if (previewActiveSequence !== null) {
                const sequence = sequences[previewActiveSequence];
                previewDrawSequence(sequence);
            }
        }

        // Draw a group on the preview canvas
        function previewDrawGroup(group, frameIndex) {
            if (!group || !group.img1Tiles) return;

            // Get saved tiles for this specific frame
            let savedTiles;
            if (group.allFrames && group.allFrames.length > frameIndex) {
                savedTiles = group.allFrames[frameIndex].savedTiles;
            } else {
                savedTiles = group.savedTiles;
            }
            if (!savedTiles || savedTiles.length === 0) return;

            // Use img1Tiles for positioning — or all matching positions when SWAP ALL is active
            const tiles = group.img1Tiles;

            // Draw each tile using saved tile images
            // Data URLs load synchronously in modern browsers; onload as fallback
            tiles.forEach((tile, index) => {
                if (index < savedTiles.length) {
                    const savedTile = savedTiles[index];
                    if (!savedTile || !savedTile.imageData) return;

                    // In SWAP ALL mode, draw at every identical tile position found in the level
                    const positions = (previewSwapAllActive && previewSwapAllMappings &&
                                       previewSwapAllMappings[index] && previewSwapAllMappings[index].length > 0)
                        ? previewSwapAllMappings[index]
                        : [tile];

                    const img = new Image();
                    img.src = savedTile.imageData;
                    const drawFn = () => {
                        positions.forEach(pos => previewCtx.drawImage(img, pos.col * 8, pos.row * 8));
                    };
                    if (img.complete && img.naturalWidth > 0) {
                        drawFn();
                    } else {
                        img.onload = drawFn;
                    }
                }
            });
        }

        // Draw a sequence on the preview canvas
        function previewDrawSequence(sequence) {
            if (!sequence.items || sequence.items.length === 0) return;

            // Count total frames
            const frameBreaks = sequence.items.filter(item => item.type === 'frameBreak').length;
            const totalFrames = frameBreaks + 1;

            // Determine which groups to show for current frame
            let currentFrameIndex = previewCurrentFrame % totalFrames;
            let frameCounter = 0;

            for (let i = 0; i < sequence.items.length; i++) {
                const item = sequence.items[i];

                if (item.type === 'frameBreak') {
                    frameCounter++;
                } else if (item.type === 'group' && frameCounter === currentFrameIndex) {
                    const group = activeSet.groups[item.groupIndex];
                    if (group) {
                        previewDrawGroup(group, 0);
                    }
                }
            }
        }

        // Start animation
        function previewStartAnimation() {
            if (previewAnimationInterval) {
                clearInterval(previewAnimationInterval);
            }

            previewAnimationInterval = setInterval(() => {
                if (previewActiveSequence !== null || previewActiveGroup !== null) {
                    previewCurrentFrame++;
                    previewRender();
                }
            }, Math.max(0, previewMs));
            updatePreviewPlayButton();
        }

        // Stop animation
        function previewStopAnimation() {
            if (previewAnimationInterval) {
                clearInterval(previewAnimationInterval);
                previewAnimationInterval = null;
            }
            previewRender();
            updatePreviewPlayButton();
        }

        // Toggle play/pause from the button in the PREVIEW section
        function previewToggleAnimation() {
            if (previewAnimationInterval) {
                previewStopAnimation();
            } else {
                if (previewActiveGroup !== null || previewActiveSequence !== null) {
                    previewStartAnimation();
                }
            }
        }

        // Sync the ▶/⏸ button state to current animation state
        function updatePreviewPlayButton() {
            const btn = document.getElementById('previewPlayPauseBtn');
            if (!btn) return;
            const hasActive = previewActiveGroup !== null || previewActiveSequence !== null;
            btn.disabled = !hasActive;
            btn.style.opacity = hasActive ? '1' : '0.35';
            btn.style.cursor = hasActive ? 'pointer' : 'default';
            if (previewAnimationInterval) {
                btn.innerHTML = '<i class="fa fa-pause"></i>';
                btn.style.background = '#FF13F0';
                btn.style.color = '#000';
                btn.style.boxShadow = '0 0 8px rgba(255,153,0,0.5)';
            } else {
                btn.innerHTML = '<i class="fa fa-play"></i>';
                btn.style.background = '#000';
                btn.style.color = '#FF13F0';
                btn.style.boxShadow = 'none';
            }

            // Also sync the SWAP ALL button enabled state
            const swapBtn = document.getElementById('previewSwapAllBtn');
            if (swapBtn) {
                swapBtn.disabled = !hasActive;
                swapBtn.style.opacity = hasActive ? '1' : '0.35';
                swapBtn.style.cursor = hasActive ? 'pointer' : 'default';
            }
        }

        // Toggle SWAP ALL mode — find every pixel-identical tile in the level and animate them all
        function togglePreviewSwapAll() {
            previewSwapAllActive = !previewSwapAllActive;
            const btn = document.getElementById('previewSwapAllBtn');
            if (btn) {
                btn.style.background  = previewSwapAllActive ? '#FF13F0' : '#000';
                btn.style.color       = previewSwapAllActive ? '#000'    : '#FF13F0';
                btn.style.boxShadow   = previewSwapAllActive ? '0 0 10px rgba(255,153,0,0.5)' : 'none';
            }
            if (previewSwapAllActive && previewActiveGroup !== null) {
                previewComputeSwapAllMappings(activeSet.groups[previewActiveGroup]);
            } else {
                previewSwapAllMappings = null;
                // Restore default info text when disabling
                if (previewActiveGroup !== null) {
                    const g = activeSet.groups[previewActiveGroup];
                    document.getElementById('previewInfoText').textContent = `Previewing Swap: ${g.name}`;
                }
            }
            if (previewLevelImage) previewRender();
        }

        // Scan the level image for every 8×8 tile pixel-identical to the group's img1Tiles
        function previewComputeSwapAllMappings(group) {
            // Ensure previewLevelImage is set even if previewRender() hasn't fired yet
            // (happens on first activation of animated groups where previewStartAnimation
            //  doesn't call previewRender() immediately)
            if (!previewLevelImage && activeSet.image1) {
                previewLevelImage = activeSet.image1;
                if (previewCanvas) {
                    previewCanvas.width = previewLevelImage.width;
                    previewCanvas.height = previewLevelImage.height;
                }
            }

            if (!previewLevelImage || !group || !group.img1Tiles || group.img1Tiles.length === 0) {
                previewSwapAllMappings = null;
                return;
            }

            const T = 8;
            const W = previewLevelImage.width;
            const H = previewLevelImage.height;
            const cols = Math.floor(W / T);
            const rows = Math.floor(H / T);

            // Rasterise the level once into a flat RGBA buffer
            const offCanvas = document.createElement('canvas');
            offCanvas.width = W; offCanvas.height = H;
            const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
            offCtx.drawImage(previewLevelImage, 0, 0);
            const buf = offCtx.getImageData(0, 0, W, H).data;

            function extractTile(col, row) {
                const out = new Uint8ClampedArray(T * T * 4);
                for (let ty = 0; ty < T; ty++) {
                    const srcBase = ((row * T + ty) * W + col * T) * 4;
                    const dstBase = ty * T * 4;
                    for (let tx = 0; tx < T * 4; tx++) out[dstBase + tx] = buf[srcBase + tx];
                }
                return out;
            }

            // Extract source tile pixel data
            const srcData = group.img1Tiles.map(t => extractTile(t.col, t.row));

            // Scan every tile position in the level
            const mappings = group.img1Tiles.map(() => []);
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const levelTile = extractTile(c, r);
                    for (let i = 0; i < srcData.length; i++) {
                        const src = srcData[i];
                        let match = true;
                        for (let p = 0; p < src.length; p++) {
                            if (levelTile[p] !== src[p]) { match = false; break; }
                        }
                        if (match) { mappings[i].push({ col: c, row: r }); break; }
                    }
                }
            }

            previewSwapAllMappings = mappings;

            // Update info text with instance count
            const totalInstances = mappings.reduce((sum, m) => sum + m.length, 0);
            const infoEl = document.getElementById('previewInfoText');
            if (infoEl) {
                infoEl.textContent = `${group.name} — ${totalInstances} instance${totalInstances !== 1 ? 's' : ''} found`;
            }

            // Re-render immediately so the new positions appear right away
            previewRender();
        }
