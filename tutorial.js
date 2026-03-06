// ============================================================
// GB Tile Swapper — Tutorial System
// Bottom panel, orange theme, step-by-step walkthroughs
// ============================================================

const TutorialManager = (function () {

    // ── SVG Diagrams ─────────────────────────────────────────

    const SVG = {

        overview: `<svg viewBox="0 0 300 110" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:580px;">
            <rect x="2" y="25" width="72" height="58" fill="#000d00" stroke="#00ff00" stroke-width="1.5"/>
            <text x="38" y="18" fill="#00ff00" font-size="7.5" text-anchor="middle" font-family="monospace" font-weight="bold">LEVEL.PNG</text>
            <line x1="2" y1="44" x2="74" y2="44" stroke="#00ff00" stroke-width="0.5" opacity="0.35"/>
            <line x1="2" y1="63" x2="74" y2="63" stroke="#00ff00" stroke-width="0.5" opacity="0.35"/>
            <line x1="26" y1="25" x2="26" y2="83" stroke="#00ff00" stroke-width="0.5" opacity="0.35"/>
            <line x1="50" y1="25" x2="50" y2="83" stroke="#00ff00" stroke-width="0.5" opacity="0.35"/>
            <rect x="10" y="44" width="24" height="19" fill="none" stroke="#ff8800" stroke-width="1" stroke-dasharray="2,2"/>
            <text x="85" y="57" fill="#ff8800" font-size="14" font-family="monospace">→</text>
            <rect x="104" y="25" width="72" height="58" fill="#000d00" stroke="#00ff00" stroke-width="1.5"/>
            <text x="140" y="18" fill="#00ff00" font-size="7.5" text-anchor="middle" font-family="monospace" font-weight="bold">TILESET.PNG</text>
            <line x1="104" y1="44" x2="176" y2="44" stroke="#00ff00" stroke-width="0.5" opacity="0.35"/>
            <line x1="104" y1="63" x2="176" y2="63" stroke="#00ff00" stroke-width="0.5" opacity="0.35"/>
            <line x1="128" y1="25" x2="128" y2="83" stroke="#00ff00" stroke-width="0.5" opacity="0.35"/>
            <line x1="152" y1="25" x2="152" y2="83" stroke="#00ff00" stroke-width="0.5" opacity="0.35"/>
            <rect x="128" y="44" width="24" height="19" fill="#001a00" stroke="#00ff00" stroke-width="1"/>
            <text x="187" y="57" fill="#ff8800" font-size="14" font-family="monospace">→</text>
            <rect x="206" y="25" width="90" height="58" fill="#000a12" stroke="#04d9ff" stroke-width="1.5"/>
            <text x="251" y="18" fill="#04d9ff" font-size="7.5" text-anchor="middle" font-family="monospace" font-weight="bold">GB STUDIO</text>
            <text x="214" y="43" fill="#04d9ff" font-size="6.5" font-family="monospace">VM_LOAD_DATA</text>
            <text x="214" y="55" fill="#04d9ff" font-size="6.5" font-family="monospace">SWAP_TILES</text>
            <text x="214" y="67" fill="#04d9ff" font-size="6.5" font-family="monospace">...</text>
            <text x="151" y="103" fill="#ff8800" font-size="6" text-anchor="middle" font-family="monospace" opacity="0.7">LEVEL → TILESET → SWAP → CODE</text>
        </svg>`,

        loadLevel: `<svg viewBox="0 0 300 100" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:580px;">
            <rect x="2" y="8" width="296" height="30" fill="#000d00" stroke="#00ff00" stroke-width="1" opacity="0.6"/>
            <text x="10" y="20" fill="#888" font-size="7" font-family="monospace">FILE</text>
            <rect x="28" y="12" width="30" height="14" fill="#04d9ff" rx="1"/>
            <text x="43" y="22" fill="#000" font-size="6.5" text-anchor="middle" font-family="monospace" font-weight="bold">LOAD</text>
            <rect x="62" y="12" width="44" height="14" fill="#04d9ff" opacity="0.3" rx="1"/>
            <text x="84" y="22" fill="#04d9ff" font-size="6.5" text-anchor="middle" font-family="monospace">SAVE GBTS</text>
            <rect x="116" y="12" width="56" height="14" fill="#00ff00" rx="1"/>
            <text x="144" y="22" fill="#000" font-size="7" text-anchor="middle" font-family="monospace" font-weight="bold">LEVEL.PNG</text>
            <rect x="113" y="9" width="62" height="20" fill="none" stroke="#ff8800" stroke-width="1.5" stroke-dasharray="3,2" rx="1"/>
            <rect x="178" y="12" width="40" height="14" fill="#00ff00" opacity="0.3" rx="1"/>
            <text x="198" y="22" fill="#00ff00" font-size="7" text-anchor="middle" font-family="monospace">Set 1</text>
            <line x1="144" y1="38" x2="144" y2="55" stroke="#ff8800" stroke-width="1.5" stroke-dasharray="3,2"/>
            <polygon points="139,53 144,62 149,53" fill="#ff8800"/>
            <rect x="90" y="63" width="106" height="32" fill="#000d00" stroke="#00ff00" stroke-width="1.5" rx="1"/>
            <text x="143" y="72" fill="#00ff00" font-size="6.5" text-anchor="middle" font-family="monospace">Your level image</text>
            <line x1="103" y1="76" x2="185" y2="76" stroke="#00ff00" stroke-width="0.5" opacity="0.4"/>
            <line x1="103" y1="83" x2="185" y2="83" stroke="#00ff00" stroke-width="0.5" opacity="0.4"/>
            <line x1="121" y1="63" x2="121" y2="95" stroke="#00ff00" stroke-width="0.5" opacity="0.4"/>
            <line x1="139" y1="63" x2="139" y2="95" stroke="#00ff00" stroke-width="0.5" opacity="0.4"/>
            <line x1="157" y1="63" x2="157" y2="95" stroke="#00ff00" stroke-width="0.5" opacity="0.4"/>
        </svg>`,

        loadTileset: `<svg viewBox="0 0 300 100" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:580px;">
            <rect x="2" y="8" width="296" height="30" fill="#000d00" stroke="#00ff00" stroke-width="1" opacity="0.6"/>
            <text x="10" y="20" fill="#888" font-size="7" font-family="monospace">FILE</text>
            <rect x="28" y="12" width="30" height="14" fill="#04d9ff" rx="1"/>
            <text x="43" y="22" fill="#000" font-size="6.5" text-anchor="middle" font-family="monospace" font-weight="bold">LOAD</text>
            <rect x="62" y="12" width="44" height="14" fill="#04d9ff" opacity="0.3" rx="1"/>
            <text x="84" y="22" fill="#04d9ff" font-size="6.5" text-anchor="middle" font-family="monospace">SAVE GBTS</text>
            <rect x="116" y="12" width="56" height="14" fill="#00ff00" opacity="0.3" rx="1"/>
            <text x="144" y="22" fill="#00ff00" font-size="7" text-anchor="middle" font-family="monospace">LEVEL.PNG</text>
            <rect x="178" y="12" width="40" height="14" fill="#00ff00" rx="1"/>
            <text x="198" y="22" fill="#000" font-size="7" text-anchor="middle" font-family="monospace" font-weight="bold">Set 1</text>
            <rect x="175" y="9" width="46" height="20" fill="none" stroke="#ff8800" stroke-width="1.5" stroke-dasharray="3,2" rx="1"/>
            <line x1="198" y1="38" x2="198" y2="55" stroke="#ff8800" stroke-width="1.5" stroke-dasharray="3,2"/>
            <polygon points="193,53 198,62 203,53" fill="#ff8800"/>
            <rect x="144" y="63" width="106" height="32" fill="#000d00" stroke="#00ff00" stroke-width="1.5" rx="1"/>
            <text x="197" y="72" fill="#00ff00" font-size="6.5" text-anchor="middle" font-family="monospace">Your tileset image</text>
            <line x1="157" y1="76" x2="239" y2="76" stroke="#00ff00" stroke-width="0.5" opacity="0.4"/>
            <line x1="157" y1="83" x2="239" y2="83" stroke="#00ff00" stroke-width="0.5" opacity="0.4"/>
            <line x1="175" y1="63" x2="175" y2="95" stroke="#00ff00" stroke-width="0.5" opacity="0.4"/>
            <line x1="193" y1="63" x2="193" y2="95" stroke="#00ff00" stroke-width="0.5" opacity="0.4"/>
            <line x1="211" y1="63" x2="211" y2="95" stroke="#00ff00" stroke-width="0.5" opacity="0.4"/>
        </svg>`,

        selectTiles: `<svg viewBox="0 0 300 125" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:580px;">
            <text x="70" y="10" fill="#00ff00" font-size="7.5" text-anchor="middle" font-family="monospace" font-weight="bold">LEVEL.PNG</text>
            <rect x="2" y="14" width="136" height="90" fill="#000d00" stroke="#00ff00" stroke-width="1.5"/>
            <line x1="2" y1="30" x2="138" y2="30" stroke="#00ff00" stroke-width="0.5" opacity="0.3"/>
            <line x1="2" y1="46" x2="138" y2="46" stroke="#00ff00" stroke-width="0.5" opacity="0.3"/>
            <line x1="2" y1="62" x2="138" y2="62" stroke="#00ff00" stroke-width="0.5" opacity="0.3"/>
            <line x1="2" y1="78" x2="138" y2="78" stroke="#00ff00" stroke-width="0.5" opacity="0.3"/>
            <line x1="2" y1="94" x2="138" y2="94" stroke="#00ff00" stroke-width="0.5" opacity="0.3"/>
            <line x1="18" y1="14" x2="18" y2="104" stroke="#00ff00" stroke-width="0.5" opacity="0.3"/>
            <line x1="34" y1="14" x2="34" y2="104" stroke="#00ff00" stroke-width="0.5" opacity="0.3"/>
            <line x1="50" y1="14" x2="50" y2="104" stroke="#00ff00" stroke-width="0.5" opacity="0.3"/>
            <line x1="66" y1="14" x2="66" y2="104" stroke="#00ff00" stroke-width="0.5" opacity="0.3"/>
            <line x1="82" y1="14" x2="82" y2="104" stroke="#00ff00" stroke-width="0.5" opacity="0.3"/>
            <line x1="98" y1="14" x2="98" y2="104" stroke="#00ff00" stroke-width="0.5" opacity="0.3"/>
            <line x1="114" y1="14" x2="114" y2="104" stroke="#00ff00" stroke-width="0.5" opacity="0.3"/>
            <rect x="34" y="46" width="48" height="32" fill="rgba(255,136,0,0.08)" stroke="#ff8800" stroke-width="2" stroke-dasharray="4,2"/>
            <text x="58" y="65" fill="#ff8800" font-size="8" text-anchor="middle" font-family="monospace">✓</text>
            <text x="70" y="119" fill="#ff8800" font-size="6.5" text-anchor="middle" font-family="monospace" opacity="0.8">click &amp; drag to select</text>
            <text x="190" y="10" fill="#00ff00" font-size="7.5" text-anchor="middle" font-family="monospace" font-weight="bold">TILESET.PNG</text>
            <rect x="160" y="14" width="136" height="90" fill="#000d00" stroke="#00ff00" stroke-width="1.5" opacity="0.5"/>
            <text x="228" y="65" fill="#00ff00" font-size="8" text-anchor="middle" font-family="monospace" opacity="0.3">next →</text>
        </svg>`,

        selectBoth: `<svg viewBox="0 0 300 125" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:580px;">
            <text x="70" y="10" fill="#00ff00" font-size="7.5" text-anchor="middle" font-family="monospace" font-weight="bold">LEVEL.PNG</text>
            <rect x="2" y="14" width="136" height="90" fill="#000d00" stroke="#00ff00" stroke-width="1.5"/>
            <line x1="2" y1="30" x2="138" y2="30" stroke="#00ff00" stroke-width="0.5" opacity="0.3"/>
            <line x1="2" y1="46" x2="138" y2="46" stroke="#00ff00" stroke-width="0.5" opacity="0.3"/>
            <line x1="2" y1="62" x2="138" y2="62" stroke="#00ff00" stroke-width="0.5" opacity="0.3"/>
            <line x1="2" y1="78" x2="138" y2="78" stroke="#00ff00" stroke-width="0.5" opacity="0.3"/>
            <line x1="34" y1="14" x2="34" y2="104" stroke="#00ff00" stroke-width="0.5" opacity="0.3"/>
            <line x1="66" y1="14" x2="66" y2="104" stroke="#00ff00" stroke-width="0.5" opacity="0.3"/>
            <line x1="98" y1="14" x2="98" y2="104" stroke="#00ff00" stroke-width="0.5" opacity="0.3"/>
            <rect x="34" y="46" width="48" height="32" fill="rgba(255,136,0,0.08)" stroke="#ff8800" stroke-width="2" stroke-dasharray="4,2"/>
            <text x="58" y="65" fill="#ff8800" font-size="9" text-anchor="middle" font-family="monospace" font-weight="bold">✓</text>
            <text x="190" y="10" fill="#00ff00" font-size="7.5" text-anchor="middle" font-family="monospace" font-weight="bold">TILESET.PNG</text>
            <rect x="160" y="14" width="136" height="90" fill="#000d00" stroke="#00ff00" stroke-width="1.5"/>
            <line x1="160" y1="30" x2="296" y2="30" stroke="#00ff00" stroke-width="0.5" opacity="0.3"/>
            <line x1="160" y1="46" x2="296" y2="46" stroke="#00ff00" stroke-width="0.5" opacity="0.3"/>
            <line x1="160" y1="62" x2="296" y2="62" stroke="#00ff00" stroke-width="0.5" opacity="0.3"/>
            <line x1="160" y1="78" x2="296" y2="78" stroke="#00ff00" stroke-width="0.5" opacity="0.3"/>
            <line x1="192" y1="14" x2="192" y2="104" stroke="#00ff00" stroke-width="0.5" opacity="0.3"/>
            <line x1="224" y1="14" x2="224" y2="104" stroke="#00ff00" stroke-width="0.5" opacity="0.3"/>
            <line x1="256" y1="14" x2="256" y2="104" stroke="#00ff00" stroke-width="0.5" opacity="0.3"/>
            <rect x="192" y="46" width="48" height="32" fill="#001a00" stroke="#00ff00" stroke-width="2" stroke-dasharray="4,2"/>
            <text x="216" y="65" fill="#00ff00" font-size="9" text-anchor="middle" font-family="monospace" font-weight="bold">✓</text>
            <text x="150" y="57" fill="#ff8800" font-size="11" text-anchor="middle" font-family="monospace">⇄</text>
            <text x="150" y="119" fill="#ff8800" font-size="6.5" text-anchor="middle" font-family="monospace" opacity="0.8">same tile count on both sides</text>
        </svg>`,

        addSwap: `<svg viewBox="0 0 300 100" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:580px;">
            <rect x="2" y="8" width="200" height="22" fill="#000d00" stroke="#04d9ff" stroke-width="1" rx="1"/>
            <text x="80" y="23" fill="#04d9ff" font-size="9" font-family="monospace" opacity="0.6">DOOR_OPEN</text>
            <text x="12" y="23" fill="#04d9ff" font-size="7" font-family="monospace" opacity="0.4">Swap Name...</text>
            <rect x="208" y="8" width="30" height="22" fill="#04d9ff" rx="1"/>
            <text x="223" y="22" fill="#000" font-size="14" text-anchor="middle" font-family="monospace" font-weight="bold">+</text>
            <text x="244" y="23" fill="#04d9ff" font-size="7" font-family="monospace" opacity="0.4">or press Enter</text>
            <line x1="60" y1="30" x2="60" y2="45" stroke="#ff8800" stroke-width="1.5" stroke-dasharray="3,2"/>
            <polygon points="55,43 60,52 65,43" fill="#ff8800"/>
            <rect x="2" y="55" width="100" height="38" fill="#000d00" stroke="#04d9ff" stroke-width="1" rx="1"/>
            <text x="12" y="68" fill="#04d9ff" font-size="7.5" font-family="monospace" font-weight="bold">DOOR_OPEN</text>
            <rect x="8" y="72" width="55" height="13" fill="#04d9ff" opacity="0.15" rx="1"/>
            <text x="35" y="81" fill="#04d9ff" font-size="6.5" text-anchor="middle" font-family="monospace">▶ VIEW CODE</text>
            <rect x="67" y="72" width="30" height="13" fill="#ff0066" opacity="0.6" rx="1"/>
            <text x="82" y="81" fill="#fff" font-size="6" text-anchor="middle" font-family="monospace">DELETE</text>
            <text x="180" y="75" fill="#ff8800" font-size="7" font-family="monospace" opacity="0.7">swap saved!</text>
        </svg>`,

        generate: `<svg viewBox="0 0 300 105" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:580px;">
            <rect x="2" y="8" width="130" height="22" fill="#000d00" stroke="#00ff00" stroke-width="2" rx="1"/>
            <text x="67" y="23" fill="#000" font-size="8" text-anchor="middle" font-family="monospace" font-weight="bold">CREATE TILESET MODE</text>
            <rect x="2" y="8" width="130" height="22" fill="#00ff00" rx="1"/>
            <text x="67" y="23" fill="#000" font-size="8" text-anchor="middle" font-family="monospace" font-weight="bold">CREATE TILESET MODE</text>
            <line x1="67" y1="30" x2="67" y2="45" stroke="#ff8800" stroke-width="1.5" stroke-dasharray="3,2"/>
            <polygon points="62,43 67,52 72,43" fill="#ff8800"/>
            <rect x="2" y="55" width="296" height="46" fill="#001100" stroke="#00ff00" stroke-width="1" rx="1"/>
            <text x="20" y="68" fill="#00ff00" font-size="6.5" font-family="monospace" opacity="0.6">Generated Tileset:</text>
            <rect x="8" y="72" width="12" height="12" fill="#224422" stroke="#00ff00" stroke-width="0.5"/>
            <rect x="22" y="72" width="12" height="12" fill="#334433" stroke="#00ff00" stroke-width="0.5"/>
            <rect x="36" y="72" width="12" height="12" fill="#224422" stroke="#00ff00" stroke-width="0.5"/>
            <rect x="50" y="72" width="12" height="12" fill="#445544" stroke="#00ff00" stroke-width="0.5"/>
            <rect x="64" y="72" width="12" height="12" fill="#334433" stroke="#00ff00" stroke-width="0.5"/>
            <rect x="78" y="72" width="12" height="12" fill="#224422" stroke="#00ff00" stroke-width="0.5"/>
            <text x="200" y="80" fill="#00ff00" font-size="7" font-family="monospace" opacity="0.5">20 tiles/row</text>
        </svg>`,

        exportCode: `<svg viewBox="0 0 300 100" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:580px;">
            <rect x="2" y="8" width="48" height="20" fill="#04d9ff" rx="1"/>
            <text x="26" y="21" fill="#000" font-size="7.5" text-anchor="middle" font-family="monospace" font-weight="bold">SAVE PNG</text>
            <rect x="56" y="8" width="48" height="20" fill="#04d9ff" rx="1"/>
            <text x="80" y="21" fill="#000" font-size="7.5" text-anchor="middle" font-family="monospace" font-weight="bold">SAVE CODE</text>
            <line x1="26" y1="28" x2="26" y2="44" stroke="#ff8800" stroke-width="1.5" stroke-dasharray="3,2"/>
            <polygon points="21,42 26,51 31,42" fill="#ff8800"/>
            <line x1="80" y1="28" x2="80" y2="44" stroke="#ff8800" stroke-width="1.5" stroke-dasharray="3,2"/>
            <polygon points="75,42 80,51 85,42" fill="#ff8800"/>
            <rect x="2" y="53" width="52" height="40" fill="#001122" stroke="#04d9ff" stroke-width="1" rx="1"/>
            <text x="28" y="65" fill="#04d9ff" font-size="6.5" text-anchor="middle" font-family="monospace">tileset.png</text>
            <rect x="4" y="69" width="48" height="20" fill="#001a33" stroke="#04d9ff" stroke-width="0.5"/>
            <text x="28" y="80" fill="#04d9ff" font-size="5.5" text-anchor="middle" font-family="monospace" opacity="0.7">→ GB Studio</text>
            <rect x="62" y="53" width="80" height="40" fill="#001122" stroke="#04d9ff" stroke-width="1" rx="1"/>
            <text x="66" y="65" fill="#04d9ff" font-size="5.5" font-family="monospace">VM_LOAD_DATA</text>
            <text x="66" y="74" fill="#04d9ff" font-size="5.5" font-family="monospace" opacity="0.7">SWAP_TILE 0,0,...</text>
            <text x="66" y="83" fill="#04d9ff" font-size="5.5" font-family="monospace" opacity="0.5">...</text>
            <text x="200" y="55" fill="#00ff00" font-size="6.5" font-family="monospace">→ TileSwapper</text>
            <text x="200" y="65" fill="#00ff00" font-size="6.5" font-family="monospace" opacity="0.7">   plugin event</text>
            <text x="200" y="75" fill="#00ff00" font-size="6.5" font-family="monospace" opacity="0.5">   in GB Studio</text>
        </svg>`,
    };

    // ── Tutorial Paths ────────────────────────────────────────

    const PATHS = {
        'first-swap': {
            title: 'My First Swap',
            icon: '⚡',
            steps: [
                {
                    title: 'Welcome — How it works',
                    svg: SVG.overview,
                    text: `<strong>What you need to start:</strong><br>
                           • A <strong style="color:#00ff00;">Background image</strong> — the PNG you use in GB Studio as a scene background<br>
                           • A <strong style="color:#00ff00;">second image</strong> — containing the new tiles you want to inject into the scene's tileset<br><br>
                           GB Tile Swapper lets you <em>visually select</em> which tiles on the background to replace, and which tiles from the second image to use as replacements. It generates a new tileset PNG and the swap coordinates — ready to paste into the <a href="https://github.com/pixelpep/gbtileswaper/releases/" target="_blank" style="color:#04d9ff;"><strong>Tile Swaper plugin</strong></a> in GB Studio.<br><br>
                           <span style="color:#ff8800;">⚠ Important:</span> In GB Studio, if your scene type is <strong>not LOGO</strong>, all tiles that look identical are deduplicated — meaning every occurrence of the same tile will be swapped at once, not just the one you clicked. Plan your graphics accordingly.<br><br>
                           <em style="color:rgba(255,136,0,0.7);">About 5 minutes — let's go!</em>`,
                },
                {
                    title: 'Step 1 — Load your Level image',
                    svg: SVG.loadLevel,
                    text: `Click the <strong>LEVEL.PNG</strong> button (top bar, under your images).<br><br>
                           Select your background image — the PNG you created in your pixel art tool (Aseprite, Tiled, etc.) and that you'll use directly in <strong>GB Studio's Assets</strong> as a Background.<br><br>
                           <span style="color:#ff8800;">Important:</span> GB Studio backgrounds have strict constraints (dimensions, tile count, color palette). Make sure your image respects them before loading it here.<br>
                           <a href="https://www.gbstudio.dev/docs/backgrounds" target="_blank" style="color:#04d9ff;font-size:11px;">→ GB Studio Background constraints (official docs)</a>`,
                },
                {
                    title: 'Step 2 — Load your Tileset image',
                    svg: SVG.loadTileset,
                    text: `Click the second image button — labeled <strong>Set 1</strong> by default (or your set name) — to load your tileset.<br><br>
                           This image contains the <em>replacement tiles</em> — what the tiles will look like after the swap. It can be the same image as your level, or a separate tileset PNG with new graphics.<br><br>
                           <span style="color:#ff8800;">Tip:</span> The button label updates to the filename once an image is loaded. It also shows the tile count in parentheses.`,
                },
                {
                    title: 'Step 3 — Select tiles on the Level',
                    svg: SVG.selectTiles,
                    text: `Click or click & drag on the <strong>LEVEL.PNG</strong> canvas (left side) to select the tiles you want to replace.<br><br>
                           These are the tiles that will <em>change during gameplay</em> — for example, a closed door, a dark torch, or an unopened chest.<br><br>
                           <span style="color:#ff8800;">Tip:</span> Drag to select a rectangular area. The tile count shows below the images.`,
                },
                {
                    title: 'Step 4 — Select replacement tiles on the Tileset',
                    svg: SVG.selectBoth,
                    text: `Now click the matching area on the <strong>TILESET.PNG</strong> canvas (right side).<br><br>
                           Select the tiles that will <em>replace</em> the ones you picked on the level — an open door, a lit torch, an opened chest.<br><br>
                           <span style="color:#ff8800;">Important:</span> Both selections must have the <strong>exact same number of tiles</strong>. The counter below shows how many are selected on each side.`,
                },
                {
                    title: 'Step 5 — Name and create the Swap',
                    svg: SVG.addSwap,
                    text: `Type a name for your swap in the <strong>Swap Name...</strong> field.<br><br>
                           Use something descriptive like <code style="color:#04d9ff;">DOOR_OPEN</code>, <code style="color:#04d9ff;">TORCH_LIT</code>, or <code style="color:#04d9ff;">CHEST_OPEN</code>.<br><br>
                           Then click the <strong>+ button</strong> or press <strong>Enter</strong>. Your swap appears in the SWAPS list.<br><br>
                           <span style="color:#ff8800;">Tip:</span> You can add multiple swaps before generating — great for scenes with many interactive elements!`,
                },
                {
                    title: 'Step 6 — Generate the Tileset',
                    svg: SVG.generate,
                    text: `Make sure <strong>CREATE TILESET MODE</strong> is active (green button in the top bar).<br><br>
                           The tileset is generated automatically as you add swaps. It combines all your tile selections into a single optimized PNG — duplicate tiles are merged automatically.<br><br>
                           You can see the preview in the SWAPS panel. The counter shows how many of the <strong>192 tile limit</strong> you've used.`,
                },
                {
                    title: 'Step 7 — Export PNG and Code',
                    svg: SVG.exportCode,
                    text: `Click <strong>SAVE TILESET</strong> in the top bar to download your generated tileset PNG.<br><br>
                           <span style="color:#00ff00;">Where to save the PNG:</span> Place it directly in your GB Studio project's <strong>assets/tilesets/</strong> folder — GB Studio will detect it automatically.<br><br>
                           Then expand a swap with the <strong>▶</strong> button and click <strong>Copy</strong> to copy its TileData code — or use <strong>SAVE CODE</strong> to export all swaps at once.<br><br>
                           <span style="color:#ff8800;">Recommended:</span> Save your <strong>.gbts project file</strong> in the same folder as the PNG — that way your source file stays alongside the asset for easy future edits.`,
                },
                {
                    title: 'Step 8 — Install the TileSwapper Plugin',
                    svg: null,
                    text: `Download the <strong>TileSwapper plugin</strong> from the releases page:<br>
                           <a href="https://github.com/pixelpep/gbtileswaper/releases" target="_blank" style="color:#04d9ff;font-size:11px;">→ github.com/pixelpep/gbtileswaper/releases</a><br><br>
                           To install it, copy the <strong>Tile Swaper</strong> folder into your GB Studio project's <code style="color:#04d9ff;">plugins/</code> folder (create it at the project root if it doesn't exist). Then <strong>restart GB Studio</strong> to load the plugin.<br><br>
                           <span style="color:#ff8800;">No plugin?</span> Switch the code Mode to <strong>GBVM</strong> in GB Tile Swapper to get standard GBVM scripts that work without any plugin.`,
                },
                {
                    title: 'You\'re all set!',
                    svg: null,
                    celebrate: true,
                    text: `<span style="font-size:14px;color:#ff8800;font-weight:bold;">Congratulations!</span><br><br>
                           You've created your first tile swap and you're ready to use it in GB Studio!<br><br>
                           <strong style="color:#00ff00;">Continue learning:</strong><br>
                           • <span style="color:#04d9ff;cursor:pointer;" onclick="TutorialManager.open('plugin')">→ Plugin Tutorial — how to set it up in GB Studio</span><br>
                           • Explore <strong>BOUNCE mode</strong> for ping-pong animations<br>
                           • Use <strong>FRAME mode</strong> for multi-image animations<br>
                           • Try <strong>Sets</strong> to manage multiple scenes in one project`,
                },
            ],
        },

        'plugin': {
            title: 'TileSwapper Plugin',
            icon: '🔌',
            steps: [
                {
                    title: 'Welcome — TileSwapper Plugin Setup',
                    svg: null,
                    text: `This tutorial walks you through installing and using the <a href="https://github.com/pixelpep/gbtileswaper/releases/" target="_blank" style="color:#04d9ff;"><strong>TileSwapper plugin</strong></a> for GB Studio.<br><br>
                           The plugin lets you swap tiles dynamically during gameplay using the tile data generated by GB Tile Swapper.<br><br>
                           <em style="color:#ff8800;opacity:0.8;">Make sure you've already created a swap and exported your tileset PNG before starting this tutorial.</em>`,
                },
                {
                    title: 'Step 1 — Download the Plugin',
                    svg: null,
                    text: `Download the latest version of the TileSwapper plugin from:<br>
                           <a href="https://github.com/pixelpep/gbtileswaper/releases" target="_blank" style="color:#04d9ff;">→ github.com/pixelpep/gbtileswaper/releases</a><br><br>
                           The download contains a <strong>Tile Swaper</strong> folder with the plugin files inside.`,
                },
                {
                    title: 'Step 2 — Install the Plugin',
                    svg: null,
                    text: `Copy the <strong>Tile Swaper</strong> folder into your GB Studio project's <code style="color:#04d9ff;">plugins/</code> folder.<br><br>
                           If the <code style="color:#04d9ff;">plugins/</code> folder doesn't exist yet, create it at the <strong>root of your GB Studio project</strong> (same level as <code style="color:#04d9ff;">assets/</code>).<br><br>
                           <strong>Restart GB Studio</strong> completely to load the new plugin. You should then see <strong>Tile Swaper</strong> appear in your event list.`,
                },
                {
                    title: 'Step 3 — Name your Tileset carefully',
                    svg: null,
                    text: `⚠️ <strong>Avoid spaces, hyphens and underscores in your tileset filename.</strong><br><br>
                           GB Studio uses these characters when generating internal symbol names, which can cause broken references.<br><br>
                           <span style="color:#00ff00;">Use instead:</span><br>
                           <code style="color:#04d9ff;">mytileset.png</code> &nbsp;✓<br>
                           <code style="color:#04d9ff;">MyTileset.png</code> &nbsp;✓<br>
                           <code style="color:#04d9ff;">tileset01.png</code> &nbsp;✓<br><br>
                           <span style="color:#ff0066;">Avoid:</span> <code style="color:#ff0066;">my-tileset.png</code> &nbsp; <code style="color:#ff0066;">my_tileset.png</code>`,
                },
                {
                    title: 'Step 4 — Register the Tileset in your Scene',
                    svg: null,
                    text: `Before the plugin can swap tiles, GB Studio needs to know your tileset exists in the scene.<br><br>
                           In your scene's <strong>On Init</strong> script:<br>
                           1. Add an <strong>empty GBVM Script</strong> event at the very top<br>
                           2. Click <strong>Add Reference</strong> inside it<br>
                           3. Choose <strong>Tileset</strong> and select your tileset PNG from the <strong>Tilesets</strong> folder<br><br>
                           <span style="color:#ff8800;">Important:</span> Without this step, the tile replacement will not work at all.`,
                },
                {
                    title: 'Step 5 — Add the Tile Swaper Event',
                    svg: null,
                    text: `In your scene or actor script, add a <strong>Tile Swaper</strong> event and fill in the fields:<br><br>
                           <strong style="color:#04d9ff;">Tileset Name</strong> — the filename without extension.<br>
                           Example: <code style="color:#04d9ff;">mytileset</code> for <code style="color:#04d9ff;">mytileset.png</code><br><br>
                           <strong style="color:#04d9ff;">Tile Data</strong> — paste the code copied from GB Tile Swapper.<br>
                           Format: <code style="color:#04d9ff;">x,y,tile;x,y,tile;</code><br>
                           Multi-frame: frames separated by <code style="color:#04d9ff;">|</code><br><br>
                           <strong style="color:#04d9ff;">Frame Delay</strong> — game frames between animation frames (1–60).<br>
                           <strong style="color:#04d9ff;">Animation Cycles</strong> — <code style="color:#04d9ff;">0</code> = infinite loop, <code style="color:#04d9ff;">1+</code> = play N times.`,
                },
                {
                    title: 'Step 6 — Infinite Loops',
                    svg: null,
                    text: `For <strong>infinite animations</strong> (water, fire, torches…) set <strong>Cycles to 0</strong>.<br><br>
                           ⚠️ Place the <strong>Tile Swaper</strong> event inside an <strong>Actor's On Update</strong> script — not in On Init. This keeps the animation running continuously during gameplay.<br><br>
                           For <strong>one-shot events</strong> (door opening, chest opening…) set Cycles to <code style="color:#04d9ff;">1</code> and place the event in any script triggered by a player interaction.`,
                },
                {
                    title: 'Step 7 — Troubleshooting',
                    svg: null,
                    text: `<strong style="color:#ff8800;">Tiles not appearing?</strong><br>
                           Make sure you added the <strong>Add Reference</strong> step in an empty GBVM Script at the top of your scene's On Init.<br><br>
                           <strong style="color:#ff8800;">Wrong tiles or missing symbols?</strong><br>
                           Check the tileset filename — no spaces, hyphens, or underscores. Rename and re-add if needed.<br><br>
                           <strong style="color:#ff8800;">Animation not looping?</strong><br>
                           Set Cycles to <code style="color:#04d9ff;">0</code> and move the event to an Actor's <strong>On Update</strong> script.<br><br>
                           <strong style="color:#ff8800;">Plugin not showing in GB Studio?</strong><br>
                           Make sure the <code style="color:#04d9ff;">Tile Swaper</code> folder is inside <code style="color:#04d9ff;">plugins/</code> at the project root, and restart GB Studio completely.`,
                },
                {
                    title: 'Plugin ready!',
                    svg: null,
                    celebrate: true,
                    text: `<span style="font-size:14px;color:#ff8800;font-weight:bold;">You're all set!</span><br><br>
                           The TileSwapper plugin is installed and configured. Your tiles will now swap dynamically during GB Studio gameplay!<br><br>
                           <strong style="color:#00ff00;">Quick recap:</strong><br>
                           • Tileset registered with <strong>Add Reference</strong> in On Init<br>
                           • <strong>Tile Swaper</strong> event added with your tile data<br>
                           • Infinite loops → On Update + Cycles: 0<br>
                           • One-shot → any script + Cycles: 1`,
                },
            ],
        },
    };

    // ── State ─────────────────────────────────────────────────

    let currentPathId = null;
    let currentStep   = 0;
    let panelHeight   = 300;
    let minimized     = false;
    let resizing      = false;
    let resizeStartY  = 0;
    let resizeStartH  = 0;

    // ── DOM Refs ──────────────────────────────────────────────

    function el(id) { return document.getElementById(id); }

    // ── Tracker ───────────────────────────────────────────────

    function track(event, payload) {
        if (window.GbtsTracker) GbtsTracker.trackEvent(event, payload);
    }

    // ── Open / Close / Minimize ───────────────────────────────

    function open(pathId) {
        currentPathId = pathId || 'first-swap';
        currentStep   = 0;
        minimized     = false;

        const panel = el('tutorialPanel');
        if (!panel) return;

        panel.style.display = 'flex';
        panel.style.height  = panelHeight + 'px';
        setMinimized(false);
        renderStep();
        track('tutorial_open', { path: currentPathId });
    }

    function close() {
        const panel = el('tutorialPanel');
        if (!panel) return;

        const path = PATHS[currentPathId];
        const total = path ? path.steps.length - 1 : 0;
        if (currentStep < total) {
            track('tutorial_abandon', { path: currentPathId, step: currentStep });
        }

        panel.style.display = 'none';
        currentPathId = null;
        currentStep   = 0;
    }

    function toggleMinimize() {
        setMinimized(!minimized);
    }

    function setMinimized(state) {
        minimized = state;
        const body = el('tutorialBody');
        const btn  = el('tutorialMinBtn');
        if (!body || !btn) return;
        if (minimized) {
            body.style.display = 'none';
            btn.textContent    = '▲';
            el('tutorialPanel').style.height = '36px';
        } else {
            body.style.display = 'flex';
            btn.textContent    = '▼';
            el('tutorialPanel').style.height = panelHeight + 'px';
        }
    }

    // ── Navigation ────────────────────────────────────────────

    function goToStep(n) {
        const path = PATHS[currentPathId];
        if (!path) return;
        currentStep = Math.max(0, Math.min(n, path.steps.length - 1));
        renderStep();
        track('tutorial_step', { path: currentPathId, step: currentStep, title: path.steps[currentStep].title });
    }

    function next() {
        const path = PATHS[currentPathId];
        if (!path) return;
        if (currentStep >= path.steps.length - 1) {
            track('tutorial_complete', { path: currentPathId });
            return;
        }
        goToStep(currentStep + 1);
    }

    function prev() {
        if (currentStep > 0) goToStep(currentStep - 1);
    }

    // ── Render ────────────────────────────────────────────────

    function renderStep() {
        const path = PATHS[currentPathId];
        if (!path) return;

        const step  = path.steps[currentStep];
        const total = path.steps.length;
        const isLast = currentStep === total - 1;

        // Title bar
        const titleEl = el('tutorialTitle');
        if (titleEl) titleEl.textContent = path.icon + ' ' + path.title + '  —  ' + step.title;

        // Progress dots
        const dotsEl = el('tutorialDots');
        if (dotsEl) {
            dotsEl.innerHTML = '';
            for (let i = 0; i < total; i++) {
                const d = document.createElement('span');
                d.className = 'tut-dot' + (i === currentStep ? ' tut-dot-active' : (i < currentStep ? ' tut-dot-done' : ''));
                d.onclick = (function(idx){ return function(){ goToStep(idx); }; })(i);
                dotsEl.appendChild(d);
            }
        }

        // Counter
        const counterEl = el('tutorialCounter');
        if (counterEl) counterEl.textContent = (currentStep + 1) + ' / ' + total;

        // SVG
        const svgEl = el('tutorialSvg');
        if (svgEl) {
            if (step.svg) {
                svgEl.innerHTML = step.svg;
                svgEl.style.display = 'flex';
            } else {
                svgEl.innerHTML = '';
                svgEl.style.display = 'none';
            }
        }

        // Text
        const textEl = el('tutorialText');
        if (textEl) textEl.innerHTML = step.text;

        // Buttons
        const prevBtn = el('tutorialPrevBtn');
        const nextBtn = el('tutorialNextBtn');
        if (prevBtn) prevBtn.style.opacity = currentStep === 0 ? '0.3' : '1';
        if (prevBtn) prevBtn.style.pointerEvents = currentStep === 0 ? 'none' : 'auto';
        if (nextBtn) {
            nextBtn.textContent = isLast ? 'Finish ✓' : 'Next →';
            if (isLast) {
                nextBtn.style.background = '#ff8800';
                nextBtn.onclick = function() { track('tutorial_complete', { path: currentPathId }); celebrate(); };
            } else {
                nextBtn.style.background = '#ff8800';
                nextBtn.onclick = next;
            }
        }

        // Celebrate on last step
        if (step.celebrate) {
            setTimeout(launchConfetti, 300);
        }
    }

    // ── Confetti ──────────────────────────────────────────────

    function celebrate() {
        launchConfetti();
        setTimeout(close, 3500);
    }

    function launchConfetti() {
        const colors = ['#ff8800', '#00ff00', '#04d9ff', '#ff0066', '#ffff00'];
        const container = document.body;
        for (let i = 0; i < 60; i++) {
            const c = document.createElement('div');
            c.className = 'tut-confetti';
            c.style.cssText = [
                'left:'            + (10 + Math.random() * 80) + 'vw',
                'background:'      + colors[Math.floor(Math.random() * colors.length)],
                'animation-delay:' + (Math.random() * 0.8) + 's',
                'animation-duration:' + (1.2 + Math.random() * 1.2) + 's',
                'width:'           + (5 + Math.random() * 7) + 'px',
                'height:'          + (5 + Math.random() * 7) + 'px',
                'border-radius:'   + (Math.random() > 0.5 ? '50%' : '0'),
                'transform:rotate('+ (Math.random()*360) + 'deg)',
            ].join(';');
            container.appendChild(c);
            c.addEventListener('animationend', function(){ c.remove(); });
        }
    }

    // ── Resize ────────────────────────────────────────────────

    function initResize() {
        const handle = el('tutorialResizeHandle');
        if (!handle) return;

        handle.addEventListener('mousedown', function (e) {
            resizing      = true;
            resizeStartY  = e.clientY;
            resizeStartH  = el('tutorialPanel').offsetHeight;
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', function (e) {
            if (!resizing) return;
            const delta  = resizeStartY - e.clientY;
            const newH   = Math.max(180, Math.min(500, resizeStartH + delta));
            panelHeight  = newH;
            el('tutorialPanel').style.height = newH + 'px';
        });

        document.addEventListener('mouseup', function () {
            if (resizing) {
                resizing = false;
                document.body.style.userSelect = '';
            }
        });
    }

    // ── Init ──────────────────────────────────────────────────

    function init() {
        initResize();
    }

    // ── Public API ────────────────────────────────────────────

    return { open, close, toggleMinimize, next, prev, goToStep, init };

})();

document.addEventListener('DOMContentLoaded', function () { TutorialManager.init(); });
