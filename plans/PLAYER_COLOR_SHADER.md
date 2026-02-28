# Player Color Shader System

## Overview

Replace the current per-color PNG variant system with a single base sprite + mask texture per unit type, applying a GLSL hue-rotation shader at render time. Each player gets an arbitrary hex color, enabling unlimited player colors without new art assets.

This follows the industry-standard **mask-based colorization** approach used in Age of Empires IV, Warcraft III, and other modern RTS games.

---

## Background

### Current System

- Colors are **baked into PNG files** — `Human-Soldier-Cyan.png`, `Human-Soldier-Red.png`, etc.
- `Player.getColor()` returns `'cyan'` (human) or `'red'` (AI) — hardcoded binary
- Unit `spriteName` is constructed as `'human-soldier-' + this.owner.getColor()`
- Only 2 player colors are possible; adding a third requires new PNG variants for every unit

### Target System

- One base PNG per unit type (neutral/cyan variant reused as base)
- One grayscale **mask PNG** per unit type — white = player color zone, black = unchanged
- A PixiJS GLSL **filter** applied to each unit sprite at creation time
- Each `Player` has a `color` hex property (e.g. `0x00BFBF`, `0xCC2222`, `0xCCCC00`)
- The shader performs **HSL hue rotation** on masked pixels, preserving shading and luminance

### Mask Assets (Already Generated)

The following mask PNGs have been generated in `assets/units/` by pixel-diffing cyan vs red variants:

| Mask file | Source pair |
|-----------|------------|
| `Human-Soldier-Mask.png` | Cyan vs Red |
| `Human-Worker-Mask.png` | Cyan vs Red |
| `Mage-Mask.png` | Cyan vs Red |
| `Soldier-Mask.png` | Red vs Blue |
| `Warrior-Mask.png` | Red vs Blue |
| `Archer-Mask.png` | Green vs Purple |
| `Orc-Peon-Mask.png` | Cyan vs Red |
| `Orc-Soldier-Mask.png` | Cyan vs Red |

---

## Implementation Steps

### ~~Step 1 — Create `js/playerColorFilter.mjs`~~ ✅ DONE

Create a new module exporting a reusable PixiJS `Filter` subclass wrapping a custom GLSL shader.

**Fragment shader logic:**
1. Sample `uSampler` (base unit texture) at current UV → get RGBA
2. Sample `uMask` (mask texture) at same UV → get mask value (R channel, 0.0–1.0)
3. If mask value < 0.5 → output base pixel unchanged (armor, skin, shadows)
4. If mask value ≥ 0.5 → perform hue rotation:
   - Convert base pixel RGB → HSL
   - Replace H with `uHue` (the player color's hue in degrees)
   - Keep S and L unchanged (preserves all shading gradients)
   - Convert back HSL → RGB
   - Output result with original alpha

**JS class interface:**
```js
class PlayerColorFilter extends PIXI.Filter {
  constructor(maskTexture, playerHex) { ... }
  set color(hex) { /* recompute uHue and update uniform */ }
}

export { PlayerColorFilter }
```

**Uniforms:**
- `uMask` — `PIXI.Texture` of the mask PNG
- `uHue` — `float`, target hue in degrees (0–360), derived from the player's hex color

**Helper function:**
```js
// Converts 0xRRGGBB hex integer to HSL hue (0–360)
function hexToHue(hex) { ... }
```

---

### ~~Step 2 — Update `assets/unitsSpritesDescription.json`~~ ✅ DONE

Add a `mask` field to each colorable unit entry and merge color-variant duplicates into a single entry per unit type.

**Before:**
```json
"human-soldier-cyan": { "relativeToRoot": "./assets/units/Human-Soldier-Cyan.png", ... },
"human-soldier-red":  { "relativeToRoot": "./assets/units/Human-Soldier-Red.png",  ... }
```

**After:**
```json
"human-soldier": {
  "relativeToRoot": "./assets/units/Human-Soldier-Cyan.png",
  "mask": "./assets/units/Human-Soldier-Mask.png",
  ...
}
```

**Full list of entries to merge:**

| Old entries | New single entry |
|-------------|-----------------|
| `human-soldier-cyan` + `human-soldier-red` | `human-soldier` |
| `human-worker-cyan` + `human-worker-red` | `human-worker` |
| `mage-cyan` + `mage-red` | `mage` |
| `soldier-cyan` + `soldier-red` | `soldier` |
| `warrior-cyan` + `warrior-red` | `warrior` |
| `orc-peon-cyan` + `orc-peon-red` | `orc-peon` |
| `orc-soldier-cyan` + `orc-soldier-red` | `orc-soldier` |

Units with no player color (`character-base`, `orc-grunt`, `slime`) keep their existing entry unchanged with no `mask` field.

---

### ~~Step 3 — Update `js/sprites.mjs`~~ ✅ DONE

**3a — Load mask textures alongside base textures.**

For each unit entry that has a `mask` field, load the mask PNG as a `PIXI.Texture`:
```js
// New export
let unitsMaskTextures = {}   // unitsMaskTextures[spriteName] = PIXI.Texture
```

Loading follows the same pattern as base sprites — `PIXI.Texture.from(unitDesc.mask)` — during the existing `loadSprites()` call.

**3b — Export `unitsMaskTextures` from the module.**

---

### ~~Step 4 — Update `js/players.mjs`~~ ✅ DONE

Replace the `getColor()` string return with a numeric hex `color` property on each `Player` instance.

**Before (`players.mjs:129`):**
```js
getColor() {
  return this.isHuman() ? 'cyan' : 'red'
}
```

**After:**
```js
const PLAYER_COLORS = [
  0x00BFBF,  // Cyan   (human default)
  0xCC2222,  // Red    (AI slot 1)
  0xCCCC00,  // Yellow (AI slot 2)
  0x8822CC,  // Violet (AI slot 3)
  0x22AA22,  // Green  (AI slot 4)
  0xFF8800,  // Orange (AI slot 5)
]

// In constructor:
this.color = PLAYER_COLORS[colorIndex]   // hex integer, e.g. 0x00BFBF
```

`getColor()` can be kept as a legacy alias returning `this.color` for any remaining call sites, or removed once all usages are updated.

**Call sites to update:**
- `players.mjs:608` — building creation: pass `this.color` (hex) instead of string
- All unit constructors in `unit.mjs` (see Step 5)

---

### ~~Step 5 — Update `js/unit.mjs`~~ ✅ DONE

**Remove the color suffix from all `spriteName` assignments.**

All 10 unit classes currently concatenate the player color into the sprite name:
```js
this.spriteName = 'human-soldier-' + this.owner.getColor()   // before
this.spriteName = 'human-soldier'                             // after
```

**Lines to update:**

| Line | Class | Before | After |
|------|-------|--------|-------|
| 525 | `Peon` | `'human-worker-' + color` | `'human-worker'` |
| 540 | `LumberjackWorker` | `'human-worker-' + color` | `'human-worker'` |
| 748 | `QuarryMiner` | `'human-worker-' + color` | `'human-worker'` |
| 928 | `WaterCarrier` | `'human-worker-' + color` | `'human-worker'` |
| 1121 | `GoldMiner` | `'human-worker-' + color` | `'human-worker'` |
| 1640 | `PeonSoldier` | `'human-worker-' + color` | `'human-worker'` |
| 1658 | `Mage` | `'mage-' + color` | `'mage'` |
| 1674 | `Soldier` | `'human-soldier-' + color` | `'human-soldier'` |
| 1692 | `HeavyInfantry` | `'soldier-' + color` | `'soldier'` |
| 1709 | `EliteWarrior` | `'warrior-' + color` | `'warrior'` |

The `updateSprite()` method at line 448 requires no changes — it continues to look up `unitsSprites[this.spriteName][type][frame][dir]` which now resolves to the single base sprite.

---

### ~~Step 6 — Update `js/renderer.mjs`~~ ✅ DONE

Attach a `PlayerColorFilter` to each unit sprite at creation time. This is the core rendering change.

**6a — Add imports at top of file:**
```js
import { PlayerColorFilter } from 'playerColorFilter'
import { unitsMaskTextures } from 'sprites'
```

**6b — Add a filter cache map alongside `unitSpriteMap`:**
```js
const unitFilterMap = new Map()   // entity.uid → PlayerColorFilter
```

**6c — On sprite creation (after line 622 — `new PIXI.Sprite(entity.sprite)`):**
```js
const maskTex = unitsMaskTextures[entity.spriteName]
if (maskTex) {
  const filter = new PlayerColorFilter(maskTex, entity.owner.color)
  sprite.filters = [filter]
  unitFilterMap.set(entity.uid, filter)
}
```

**6d — On sprite removal**, also clean up the filter map wherever `unitSpriteMap.delete(entity.uid)` is called:
```js
unitFilterMap.delete(entity.uid)
```

**6e — Runtime color changes** (future feature): if a player's color is ever changed at runtime, iterate `unitFilterMap` for all units belonging to that player and call `filter.color = newHex`.

> Note: No per-frame filter updates are needed. The `uHue` uniform is set once at sprite creation.

---

### ~~Step 7 — Add import map entry in `play.html`~~ ✅ DONE (done alongside Step 1)

In the `<script type="importmap">` block:
```json
"playerColorFilter": "./js/playerColorFilter.mjs"
```

---

### ~~Step 8 — Update `js/building.mjs`~~ ✅ DONE

Buildings also use color suffixes in their sprite names, passed as a string via `players.mjs:608`. Apply the same treatment:

1. Audit all `spriteName` assignments in `building.mjs` for color-string concatenation
2. Remove the color suffix, keeping only the base sprite name
3. In `renderer.mjs`, apply the same `PlayerColorFilter` logic to building sprites using `entity.owner.color`

---

### Step 9 — Tests & Visual Verification

```bash
npm run test
```

Then open `play.html` in browser and verify:

- [ ] Human units display in cyan (default `PLAYER_COLORS[0]`)
- [ ] AI units display in red (default `PLAYER_COLORS[1]`)
- [ ] Armor, skin, and shadow pixels are unaffected by the shader
- [ ] All 8 directional animations work correctly
- [ ] Attack and walk animations work correctly
- [ ] Buildings display correct player colors
- [ ] No visual artifacts at sprite edges (transparency preserved)
- [ ] No performance regression (filters created once, not per frame)

---

## File Change Summary

| File | Change type | Description |
|------|-------------|-------------|
| `js/playerColorFilter.mjs` | **New file** | GLSL hue-rotation shader + PixiJS Filter subclass |
| `assets/unitsSpritesDescription.json` | Edit | Merge color variants, add `mask` field |
| `js/sprites.mjs` | Edit | Load mask textures, export `unitsMaskTextures` |
| `js/players.mjs` | Edit | Replace `getColor()` string with hex `color` property |
| `js/unit.mjs` | Edit | Remove color suffix from all `spriteName` assignments |
| `js/renderer.mjs` | Edit | Create and attach `PlayerColorFilter` on sprite creation |
| `js/building.mjs` | Edit | Same color-suffix removal as units |
| `play.html` | Edit | Add `playerColorFilter` to import map |

---

## Future Extensions

Once this system is in place, the following become trivial to implement:

- **Player color picker in lobby** — expose `player.color = hex` in the game menu UI
- **More than 2 AI players** — assign each AI a different slot in `PLAYER_COLORS`
- **Team colors** — group players by team, assign matching colors
- **Animated color effects** — cycle `filter.color` over time for special unit states (e.g. enraged, frozen)
