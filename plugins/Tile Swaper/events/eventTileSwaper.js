/**
 * Tile Swaper Plugin for GB Studio
 *
 * Replace tiles from a tileset in your scene with support for multi-frame animations.
 *
 * @author pixelPep.com — https://pixelpep.com
 * @license CC BY-NC 4.0 — https://creativecommons.org/licenses/by-nc/4.0/
 * @copyright 2026 pixelPep
 * @version 1.0.1
 * @gbstudio 4.x compatible
 *
 * Free to use with attribution. Commercial use requires permission.
 *
 * ── HOW TO USE ────────────────────────────────────────────────────────────────
 *
 * STEP 1 — Register the tileset at scene start
 *   Add an empty GBVM Script event at the very beginning of your scene's
 *   On Init script. Inside it, click "Add Reference", choose "Tileset",
 *   and select your tileset PNG from the Tilesets folder of your project.
 *   This tells GB Studio to load the tileset into memory for the scene.
 *
 * STEP 2 — Name your tileset carefully
 *   ⚠️ Avoid spaces, hyphens (-) and underscores (_) in your tileset filename.
 *   GB Studio uses these characters internally and they can cause GBVM symbol
 *   conflicts. Prefer CamelCase or a single lowercase word: e.g., "mytileset".
 *
 * STEP 3 — Enter the tileset name in the plugin
 *   In the "Tileset Name" field, enter the filename of your tileset PNG
 *   WITHOUT the extension (e.g., if your file is "mytileset.png", enter
 *   "mytileset").
 *
 * STEP 4 — Paste the Tile Swap Coordinates
 *   Open the GB Tile Swapper tool (https://pixelpep.com/gbdev/gbtileswaper/), load your level
 *   and tileset images, select your tiles and click "Add Swap". Then copy
 *   the generated Tile Data and paste it into the "Tile Data" field here.
 *   Format: x,y,tile;x,y,tile; — use | to separate animation frames.
 *
 * STEP 5 — Adjust timing and repeat count
 *   Frame Delay: number of game frames between each animation frame.
 *   Animation Cycles: how many times to repeat (0 = infinite loop).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

const id = "EVENT_TILE_SWAPER";
const groups = ["EVENT_GROUP_SCENE"];
const name = "Tile Swaper";

const fields = [
  {
    key: "tilesetInfo",
    label: "⚠️ Setup Required",
    type: "label",
    defaultValue: "First time using a tileset? You must register it first! See README for instructions."
  },
  {
    key: "tileset",
    label: "Tileset Name",
    description: "Enter the tileset filename without extension (e.g., TilesetName) | Plugin by pixelPep.com",
    type: "text",
    defaultValue: "",
    placeholder: "TilesetName"
  },
  {
    key: "tileData",
    label: "Tile Data",
    description: "Format: x,y,t;x,y,t; Use | to separate animation frames. Use REPAINT in a frame to restore entire scene.",
    type: "textarea",
    placeholder: "x,y,tile;x,y,tile;",
    defaultValue: "",
    rows: 5
  },
  {
    key: "frameDelay",
    label: "Frame Delay",
    description: "Number of frames to wait between animation frames",
    type: "number",
    min: 1,
    max: 60,
    defaultValue: 2
  },
  {
    key: "cycles",
    label: "Animation Cycles",
    description: "Number of times to repeat animation (0 = infinite, for animations use Actor Update)",
    type: "number",
    min: 0,
    max: 255,
    defaultValue: 0
  },
  {
    key: "addRepaintFrame",
    label: "Add REPAINT frame at end",
    description: "Automatically add a frame that repaints the entire scene to original state at the end of the animation sequence",
    type: "checkbox",
    defaultValue: false
  }
];

const compile = (input, helpers) => {
  const { tileData, tileset, frameDelay, cycles, addRepaintFrame } = input;
  const { _addComment, _addCmd, _addNL, _declareLocal } = helpers;

  // Validate inputs
  if (!tileData) {
    _addComment("Tile Swaper - Error: Missing tile data");
    return;
  }

  // Parse frames
  let frames = tileData.split("|").map(f => f.trim()).filter(f => f);

  if (frames.length === 0) {
    _addComment("Tile Swaper - Error: No valid tile data");
    _addComment("Tile data format: x,y,t;x,y,t; Use REPAINT to restore scene, | for animation frames");
    return;
  }

  // Add REPAINT frame automatically if checkbox is enabled
  if (addRepaintFrame === true) {
    frames.push("REPAINT");
    _addComment("Auto-adding REPAINT frame at end (from checkbox option)");
  }

  // Check if we have custom tiles (not REPAINT-only)
  const hasCustomTiles = /\d+,\d+,\d+/.test(tileData);

  // Validate tileset if using custom tiles
  if (hasCustomTiles && !tileset) {
    _addComment("Tile Swaper - Error: Tileset name required for custom tiles");
    _addComment("Tileset is only optional if using REPAINT alone");
    return;
  }

  // Tileset references (remove extension if user included it)
  const tilesetName = tileset ? tileset.replace(/\.[^/.]+$/, "") : "";
  const tilesetBank = tilesetName ? `___bank_tileset_${tilesetName}` : "";
  const tilesetData = tilesetName ? `_tileset_${tilesetName}` : "";

  _addComment("=== Tile Swaper by pixelPep.com ===");
  if (tilesetName) {
    _addComment(`Tileset: ${tilesetName}`);
    _addComment(`GBVM Symbol References: ${tilesetBank}, ${tilesetData}`);
  }
  _addComment(`Frames: ${frames.length}${addRepaintFrame ? " (includes auto REPAINT)" : ""}`);
  _addComment(`Delay: ${frameDelay} | Cycles: ${cycles === 0 ? "infinite" : cycles}`);
  _addNL();

  // Try to add asset references if the helper exists
  if (helpers._addAsset) {
    try {
      if (tilesetName) helpers._addAsset("tileset", tilesetName);
    } catch (e) {
      // _addAsset might not exist or work, that's ok
    }
  }

  // Single frame - just replace tiles once
  if (frames.length === 1) {
    _addComment("Single frame mode - replacing tiles");
    const parsed = parseTiles(frames[0]);

    if (parsed.type === "repaint") {
      _addComment("Repainting entire scene to original state");
      _addCmd("VM_CALL_NATIVE", "b_scroll_repaint", "_scroll_repaint");
    } else {
      applyTiles(parsed.data, tilesetBank, tilesetData, { _addCmd, _addComment, _addNL, _declareLocal });
    }

    _addNL();
    _addComment("=== Tile Swaper Complete ===");
    return;
  }

  // Multi-frame animation - inline all frames with delays
  _addComment("Multi-frame animation mode");

  if (cycles === 0) {
    _addComment("IMPORTANT: Infinite loop! Use this ONLY in Actor Update script");
    _addComment("The animation will loop forever until the actor is removed or scene changes");
  }

  _addNL();

  // If cycles = 0, create infinite loop. Otherwise, loop the specified number of times.
  if (cycles === 0) {
    // Infinite loop - use "1 .LOOP" label
    _addComment("Starting infinite animation loop");
    _addCmd("VM_PUSH_CONST", 0); // Dummy label marker
    const loopLabel = "1$";

    // Play through all frames
    for (let i = 0; i < frames.length; i++) {
      _addComment(`Frame ${i + 1}/${frames.length}`);
      const parsed = parseTiles(frames[i]);

      if (parsed.type === "repaint") {
        _addComment("Repainting entire scene to original state");
        _addCmd("VM_CALL_NATIVE", "b_scroll_repaint", "_scroll_repaint");
      } else {
        applyTiles(parsed.data, tilesetBank, tilesetData, { _addCmd, _addComment, _addNL, _declareLocal });
      }

      // Add delay after EVERY frame (including last frame before loop)
      _addComment(`Wait ${frameDelay} frames`);
      for (let d = 0; d < frameDelay; d++) {
        _addCmd("VM_IDLE");
      }
      _addNL();
    }

    _addCmd("VM_JUMP", loopLabel); // Jump back to loop start
    _addCmd("VM_POP", 1); // Clean up label marker
  } else {
    // Finite cycles
    _addComment(`Running ${cycles} cycle(s)`);

    for (let cycle = 0; cycle < cycles; cycle++) {
      if (cycles > 1) {
        _addComment(`=== Cycle ${cycle + 1} of ${cycles} ===`);
      }

      // Play through all frames
      for (let i = 0; i < frames.length; i++) {
        _addComment(`Frame ${i + 1}/${frames.length}`);
        const parsed = parseTiles(frames[i]);

        if (parsed.type === "repaint") {
          _addComment("Repainting entire scene to original state");
          _addCmd("VM_CALL_NATIVE", "b_scroll_repaint", "_scroll_repaint");
        } else {
          applyTiles(parsed.data, tilesetBank, tilesetData, { _addCmd, _addComment, _addNL, _declareLocal });
        }

        // Add delay after EVERY frame (including last frame before loop)
        _addComment(`Wait ${frameDelay} frames`);
        for (let d = 0; d < frameDelay; d++) {
          _addCmd("VM_IDLE");
        }
        _addNL();
      }
    }
  }

  _addComment("=== Tile Swaper Complete ===");

  // Helper: Parse tile string into array
  function parseTiles(frameStr) {
    const tiles = [];

    // Check for REPAINT keyword (restores entire scene)
    if (frameStr.toUpperCase().trim() === "REPAINT") {
      return { type: "repaint" };
    }

    const entries = frameStr.split(";").map(e => e.trim()).filter(e => e);

    for (const entry of entries) {
      const parts = entry.split(",").map(p => p.trim());
      if (parts.length === 3) {
        const x = parseInt(parts[0], 10);
        const y = parseInt(parts[1], 10);
        const tile = parseInt(parts[2], 10);

        if (!isNaN(x) && !isNaN(y) && !isNaN(tile)) {
          tiles.push({ x, y, tile });
        }
      }
    }
    return { type: "tiles", data: tiles };
  }

  // Helper: Apply tiles to scene
  function applyTiles(tiles, tilesetBank, tilesetData, helpers) {
    const { _addCmd, _addComment, _addNL, _declareLocal } = helpers;

    _addComment(`Applying ${tiles.length} tiles from tileset`);
    for (const t of tiles) {
      _addComment(`  (${t.x},${t.y}) -> tile ${t.tile}`);
      const tempVar = _declareLocal("tile_temp", 1, true);
      _addCmd("VM_SET_CONST", tempVar, t.tile);
      _addCmd("VM_REPLACE_TILE_XY", t.x, t.y, tilesetBank, tilesetData, tempVar);
      _addNL();
    }
  }
};

module.exports = {
  id,
  name,
  groups,
  fields,
  compile,
  waitUntilAfterInitFade: true
};
