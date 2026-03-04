// GB Tile Swapper — © 2026 pixelPep — https://pixelpep.com/gbdev/gbtileswaper/
// Licensed under CC BY-NC 4.0 — https://creativecommons.org/licenses/by-nc/4.0/
// engine.js — GB Tile Swapper V2
// ─────────────────────────────────────────────────────────────────────────────
// RULES: Zero DOM.
//   FORBIDDEN : document.*, element.style, .innerHTML, .classList, addEventListener
//   ALLOWED   : Set, Array, Image (JS obj), OffscreenCanvas, ImageData, Math, JSON
// ─────────────────────────────────────────────────────────────────────────────

'use strict';

// ─── GLOBAL STATE (pure data) ─────────────────────────────────────────────────
// V1.5: single set. V2 future: const sets = [engineState]; let activeSetIndex = 0;
const engineState = {
    // Images (JS Image objects — NOT canvas/ctx DOM elements)
    image1:          null,
    image2:          null,
    imagesExtra:     [],
    image1Filename:  '',
    image2Filename:  '',
    filenamesExtra:  [],

    // Selections (Sets of "col,row" strings)
    img1Selection:   new Set(),
    img2Selection:   new Set(),
    selectionsExtra: [],

    // Animation state
    frameCount: 1,
    mode:       'anim',   // 'anim' | 'swap'

    // Behaviour toggles
    symmetric:    true,
    mirror:       false,
    bounceDouble: false,
    keepSel1:     false,
    keepSel2:     false,
    autoSort:     true,

    // Groups & project meta
    groups:      [],
    tilesetName: 'tileset',
};

// ─── GLOBAL PURE STATE VARS ───────────────────────────────────────────────────
let builderGbvmMode   = 'tiledata';
let builderTilesetType = 'tileset';

// Drag-selection state (written by canvas event handlers in ui.js, read here for logic)
let builderIsDragging = false;
let builderDragStart  = null;
let builderDragCanvas = null;
let builderDragFrame  = null;

// Sequences & work mode
let sequences = [];
let workMode  = 'create';   // 'create' | 'reference'

// Tileset generation cache
let tilesetImageData   = null;   // base64 PNG of generated tileset
let tilesetImageBackup = null;   // ImageData snapshot for hover highlight restore

// Tileset highlight state
let currentHighlightedGroup = -1;

// Group drag-reorder state
let draggedGroupIndex = null;

// ─── GETTERS / SETTERS ────────────────────────────────────────────────────────
function getTilesetName()      { return engineState.tilesetName || 'tileset'; }
function setTilesetName(n)     { engineState.tilesetName = n; }
function getTilesetType()      { return builderTilesetType; }
function setTilesetType(t)     { builderTilesetType = t; }
function getGbvmMode()         { return builderGbvmMode; }
function setGbvmMode(m)        { builderGbvmMode = m; }
function getWorkMode()         { return workMode; }
function setWorkMode(m)        { workMode = m; }
function getTilesetImageData() { return tilesetImageData; }
function setTilesetImageData(d){ tilesetImageData = d; }
function getTilesetImageBackup()  { return tilesetImageBackup; }
function setTilesetImageBackup(d) { tilesetImageBackup = d; }

// ─── TILE COORDINATE MATH ────────────────────────────────────────────────────
function getTileIndexFromCoordinates(col, row) {
    const tilesPerRow = engineState.image2 ? Math.floor(engineState.image2.width / 8) : 20;
    return row * tilesPerRow + col;
}

// ─── SELECTION DATA OPS ───────────────────────────────────────────────────────
// Pure: only touch engineState.img*Selection Sets. No DOM calls.
// Callers in ui.js are responsible for redrawing after calling these.

function toggleTileData(col, row, imageNumber) {
    const key = `${col},${row}`;
    const sel = imageNumber === 1 ? engineState.img1Selection : engineState.img2Selection;
    if (sel.has(key)) { sel.delete(key); } else { sel.add(key); }
}

function selectRectangleData(startCol, startRow, endCol, endRow, imageNumber) {
    const minCol = Math.min(startCol, endCol), maxCol = Math.max(startCol, endCol);
    const minRow = Math.min(startRow, endRow), maxRow = Math.max(startRow, endRow);
    const sel = imageNumber === 1 ? engineState.img1Selection : engineState.img2Selection;
    let allSelected = true;
    outer: for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
            if (!sel.has(`${c},${r}`)) { allSelected = false; break outer; }
        }
    }
    for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
            const key = `${c},${r}`;
            allSelected ? sel.delete(key) : sel.add(key);
        }
    }
}

function clearSelectionsData() {
    engineState.img1Selection.clear();
    engineState.img2Selection.clear();
    engineState.selectionsExtra.forEach(s => s.clear());
}

function sortSelectionsData() {
    const sortSet = s => {
        if (s.size === 0) return;
        const sorted = Array.from(s)
            .map(k => k.split(',').map(Number))
            .sort((a, b) => a[1] === b[1] ? a[0] - b[0] : a[1] - b[1])
            .map(coords => coords.join(','));
        s.clear();
        sorted.forEach(k => s.add(k));
    };
    sortSet(engineState.img1Selection);
    sortSet(engineState.img2Selection);
}

// ─── PIXEL COMPARISON ─────────────────────────────────────────────────────────
function pixelsEqual(a, b) {
    for (let i = 0; i < 256; i++) if (a[i] !== b[i]) return false;
    return true;
}

// ─── TILESET DEDUPLICATION ────────────────────────────────────────────────────
// Pure algorithm. Assigns savedTile.tilesetIndex for every savedTile in every group.
// Returns metadata used by ui.js to draw the tileset canvas.
//
// Returns: { uniquePixels, uniqueImages, totalUnique, tilesPerRow }
function generateTilesetDedup(groups) {
    const tilesPerRow   = 20;
    const uniquePixels  = [];
    const uniqueImages  = [];

    function findOrAddTile(savedTile) {
        if (savedTile.pixels) {
            for (let u = 0; u < uniquePixels.length; u++) {
                if (uniquePixels[u] && pixelsEqual(savedTile.pixels, uniquePixels[u])) return u;
            }
            uniquePixels.push(savedTile.pixels);
            uniqueImages.push(savedTile.imageData);
        } else {
            for (let u = 0; u < uniqueImages.length; u++) {
                if (savedTile.imageData === uniqueImages[u]) return u;
            }
            uniquePixels.push(null);
            uniqueImages.push(savedTile.imageData);
        }
        return uniqueImages.length - 1;
    }

    groups.forEach(group => {
        const frameSets = (group.frames > 1 && group.allFrames)
            ? group.allFrames.map(f => f.savedTiles)
            : [group.savedTiles];
        frameSets.forEach(tiles =>
            tiles.forEach(t => { t.tilesetIndex = findOrAddTile(t); })
        );
    });

    return { uniquePixels, uniqueImages, totalUnique: uniqueImages.length, tilesPerRow };
}

// ─── TILESETMANAGER PURE HELPERS ──────────────────────────────────────────────
// Called by TilesetManager in ui.js — exposed as standalone for engine purity.

function tmGetGroupRange(groupIndex) {
    if (workMode === 'reference') return 'ref';
    let start = 0;
    for (let i = 0; i < groupIndex; i++) {
        const g = engineState.groups[i];
        start += g.frames > 1 ? g.img1Tiles.length * g.frames : g.img1Tiles.length;
    }
    const g = engineState.groups[groupIndex];
    const total = g.frames > 1 ? g.img1Tiles.length * g.frames : g.img1Tiles.length;
    return `${start}-${start + total - 1}`;
}

function tmGetResolvedTileIndex(group, frameIndex, tileInFrame, seqFallback) {
    let savedTile;
    if (group.frames > 1 && group.allFrames) {
        savedTile = group.allFrames[frameIndex]?.savedTiles?.[tileInFrame];
    } else {
        savedTile = group.savedTiles?.[tileInFrame];
    }
    return savedTile?.tilesetIndex ?? seqFallback;
}

// ─── V2 MULTI-SET MANAGEMENT ──────────────────────────────────────────────────
// V2 architecture: LEVEL (image1) is GLOBAL — shared by all sets.
// GROUPS, SEQUENCES, tilesetName, workMode, gbvmMode, tilesetType are also GLOBAL
// — they define what gets swapped and how code is exported, same for every set.
// Each set = one named collection of tileset frame images (image2 + imagesExtra)
// providing different pixel data for the same global groups.
//
// Strategy: engineState is always the LIVE runtime object. sets[] holds serialisable
// snapshots. Switching sets = snapshot current → restore new → rebuild DOM (ui.js).
//
// DOM refs (canvas, ctx, highlight…) are NEVER stored in snapshots — they always
// reference the same DOM elements regardless of which set is active.

function createSetData(name) {
    return {
        name:            name || 'Set 1',
        // Per-set: tileset frame images only (image1/LEVEL, groups, sequences are GLOBAL)
        image2:          null,
        imagesExtra:     [],
        image2Filename:  '',
        filenamesExtra:  [],
        // Per-set: current pending selections
        img1Selection:   new Set(),
        img2Selection:   new Set(),
        selectionsExtra: [],
        // Per-set: animation/swap state
        frameCount:  1,
        mode:        'anim',
        // Per-set: behaviour toggles
        symmetric:    true,
        mirror:       false,
        bounceDouble: false,
        keepSel1:     false,
        keepSel2:     false,
        autoSort:     true,
        // Per-set: generated tileset cache (same structure as global groups, different pixels)
        tilesetImageData: null,
        // NOTE: groups, sequences, tilesetName, workMode, gbvmMode, tilesetType are GLOBAL
        //       and live permanently in engineState / module-level vars.
    };
}

let sets           = [createSetData('Set 1')];
let activeSetIndex = 0;

function getActiveSetIndex() { return activeSetIndex; }
function getSetsList()       { return sets.map((s, i) => ({ index: i, name: s.name })); }
function getActiveSetName()  { return sets[activeSetIndex] ? sets[activeSetIndex].name : 'Set 1'; }
function renameSet(idx, name) { if (idx >= 0 && idx < sets.length) sets[idx].name = name; }

// Snapshot the current live state into sets[activeSetIndex].
// Must be called before switching sets or before serialising all sets.
function snapshotCurrentSet() {
    const s = sets[activeSetIndex];
    // Per-set data only — no canvas/ctx/highlight DOM refs.
    // GLOBAL state (image1, groups, sequences, tilesetName, workMode, gbvmMode, tilesetType)
    // is NOT snapshotted — it stays in engineState / module-level vars permanently.
    s.image2          = engineState.image2;
    s.imagesExtra     = [...engineState.imagesExtra];
    s.image2Filename  = engineState.image2Filename;
    s.filenamesExtra  = [...engineState.filenamesExtra];
    s.img1Selection   = new Set(engineState.img1Selection);
    s.img2Selection   = new Set(engineState.img2Selection);
    s.selectionsExtra = engineState.selectionsExtra.map(x => new Set(x));
    s.frameCount      = engineState.frameCount;
    s.mode            = engineState.mode;
    s.symmetric       = engineState.symmetric;
    s.mirror          = engineState.mirror;
    s.bounceDouble    = engineState.bounceDouble;
    s.keepSel1        = engineState.keepSel1;
    s.keepSel2        = engineState.keepSel2;
    s.autoSort        = engineState.autoSort;
    s.tilesetImageData = tilesetImageData;
}

// Restore live state from sets[idx] into engineState + module-level globals.
// Does NOT touch canvas/ctx/highlight DOM refs — those are rebuilt by ui.js.
function restoreFromSet(idx) {
    const s = sets[idx];
    // Restore per-set state only.
    // GLOBAL state (image1, groups, sequences, tilesetName, workMode, gbvmMode, tilesetType)
    // is intentionally NOT touched here — it stays as-is in engineState / module-level vars.
    engineState.image2          = s.image2         ?? null;
    engineState.imagesExtra     = [...(s.imagesExtra  || [])];
    engineState.image2Filename  = s.image2Filename ?? '';
    engineState.filenamesExtra  = [...(s.filenamesExtra || [])];
    engineState.img1Selection   = new Set(s.img1Selection || []);
    engineState.img2Selection   = new Set(s.img2Selection || []);
    engineState.selectionsExtra = (s.selectionsExtra || []).map(x => new Set(x));
    engineState.frameCount      = s.frameCount      ?? 1;
    engineState.mode            = s.mode            ?? 'anim';
    engineState.symmetric       = s.symmetric       ?? true;
    engineState.mirror          = s.mirror          ?? false;
    engineState.bounceDouble    = s.bounceDouble    ?? false;
    engineState.keepSel1        = s.keepSel1        ?? false;
    engineState.keepSel2        = s.keepSel2        ?? false;
    engineState.autoSort        = s.autoSort        ?? true;
    tilesetImageData   = s.tilesetImageData ?? null;
    tilesetImageBackup = null;       // always reset
    currentHighlightedGroup = -1;    // always reset
    draggedGroupIndex = null;        // always reset
}

// Switch to a different set (engine side only — ui.js must rebuild DOM after this).
function switchActiveSet(idx) {
    if (idx === activeSetIndex || idx < 0 || idx >= sets.length) return false;
    snapshotCurrentSet();
    activeSetIndex = idx;
    restoreFromSet(idx);
    return true;
}

// Add a new empty set and switch to it. Returns new index.
function addSet(name) {
    snapshotCurrentSet();
    const newSet = createSetData(name || `Set ${sets.length + 1}`);
    sets.push(newSet);
    activeSetIndex = sets.length - 1;
    restoreFromSet(activeSetIndex);
    return activeSetIndex;
}

// Remove set at idx. Cannot remove the last set. Returns true on success.
function removeSet(idx) {
    if (sets.length <= 1) return false;
    if (idx === activeSetIndex) {
        const newIdx = idx === 0 ? 1 : idx - 1;
        snapshotCurrentSet();
        sets.splice(idx, 1);
        activeSetIndex = idx === 0 ? 0 : newIdx;
        if (activeSetIndex >= sets.length) activeSetIndex = sets.length - 1;
        restoreFromSet(activeSetIndex);
    } else {
        sets.splice(idx, 1);
        if (activeSetIndex > idx) activeSetIndex--;
    }
    return true;
}

// ─── SEQUENCE CODE GENERATION ─────────────────────────────────────────────────
// Pure: reads sequences[], engineState.groups[], workMode, getters. Returns a string.
function generateSequenceCode(seqIndex) {
    const seq         = sequences[seqIndex];
    const tilesetName = getTilesetName();
    const tilesetType = getTilesetType();
    const gbvmMode    = getGbvmMode();

    let tiledataBank, tiledata;
    if (tilesetName) {
        tiledataBank = `___bank_${tilesetType}_${tilesetName}`;
        tiledata     = `_${tilesetType}_${tilesetName}`;
    } else {
        tiledataBank = `___bank_${tilesetType}_TILESET`;
        tiledata     = `_${tilesetType}_TILESET`;
    }

    function getGroupTileOffset(groupIndex) {
        let offset = 0;
        for (let i = 0; i < groupIndex; i++) {
            const g = engineState.groups[i];
            offset += g.frames > 1 ? g.img1Tiles.length * g.frames : g.img1Tiles.length;
        }
        return offset;
    }

    let frames = [[]];
    let currentFrame = 0;
    seq.items.forEach(item => {
        if (item.type === 'frameBreak') { currentFrame++; frames[currentFrame] = []; }
        else if (item.type === 'group') frames[currentFrame].push(item);
    });
    frames = frames.filter(f => f.length > 0);
    if (frames.length === 0) return '; No groups in sequence';

    let code = '';
    let frameLines = [];

    frames.forEach((frameItems, frameNum) => {
        const frameComment = `; ===== SEQUENCE FRAME ${frameNum + 1} =====`;
        let frameData = [];

        frameItems.forEach(item => {
            const group = engineState.groups[item.groupIndex];
            if (!group) return;
            const tileOffset = getGroupTileOffset(item.groupIndex);

            if (gbvmMode === 'tiledata') {
                const tileDataLines = group.img1Tiles.map((tile, index) => {
                    let tileIndex;
                    if (workMode === 'reference') {
                        tileIndex = getTileIndexFromCoordinates(
                            group.img2Tiles[index].col, group.img2Tiles[index].row);
                    } else {
                        tileIndex = tileOffset + index;
                    }
                    return `${tile.col},${tile.row},${tileIndex}`;
                }).join(';');
                frameData.push(tileDataLines);

            } else if (gbvmMode === 'arg0') {
                let vmCode = `; ${group.name}\n`;
                group.img1Tiles.forEach((tile, index) => {
                    const tileIndex = tileOffset + index;
                    vmCode += `VM_PUSH_CONST ${tileIndex}\n`;
                    vmCode += `VM_REPLACE_TILE_XY ${tile.col}, ${tile.row}, ${tiledataBank}, ${tiledata}, .ARG0\n`;
                    vmCode += `VM_POP 1\n\n`;
                });
                frameData.push(vmCode.trim());

            } else {
                let vmCode = `; ${group.name}\n`;
                group.img1Tiles.forEach((tile, index) => {
                    const tileIndex = tileOffset + index;
                    vmCode += `VM_REPLACE_TILE_XY ${tile.col}, ${tile.row}, ${tiledataBank}, ${tiledata}, ${tileIndex}\n`;
                });
                frameData.push(vmCode.trim());
            }
        });

        if (gbvmMode === 'tiledata') {
            frameLines.push(frameData.join(';'));
        } else {
            if (frameNum > 0) code += '\n\n';
            code += frameComment + '\n' + frameData.join('\n\n');
            if (frameNum < frames.length - 1) {
                code += `\n\n; Wait For 0.2 Seconds\n; Wait 2 Frames\nVM_SET_CONST            .LOCAL_TMP0_WAIT_ARGS, 2\nVM_INVOKE               b_wait_frames, _wait_frames, 0, .LOCAL_TMP0_WAIT`;
            }
        }
    });

    if (gbvmMode === 'tiledata') {
        code = frameLines.join('|\n');
    }
    return code.trim();
}
