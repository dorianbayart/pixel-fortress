# Adding a New Combat Building + Unit

This guide documents every step required to add a new combat building (like Barracks, Archery) paired with a new unit (like Soldier, Archer). It was written after the Archery/Archer implementation and reflects the actual codebase patterns.

---

## Overview of files to touch

| File | What to do |
|------|------------|
| `assets/units/` | Add sprite PNG + mask PNG for the unit |
| `assets/buildings/` | Add icon PNG for the build menu |
| `assets/unitsSpritesDescription.json` | Describe sprite sheet frame layout |
| `js/unit.mjs` | Add unit class + export |
| `js/building.mjs` | Add building type + class + factory case + export |
| `js/players.mjs` | Import unit, add `addXxx()` method, update AI logic |
| `js/ui.mjs` | Add building to the build menu list |
| `locales/en.json` + `fr/de/es` | Add translations for the new building |

---

## Step 1 — Sprite assets

Place the following files in `assets/units/`:

- **`UnitName-Green.png`** — the unit sprite sheet (cyan/green palette for player coloring)
- **`UnitName-Mask.png`** — black-and-white mask at the same dimensions (see mask format below)

Place in `assets/buildings/`:

- **`building-icon.png`** — the UI icon shown in the build menu (any small PNG)

### Mask PNG format

The mask must be a 2-bit indexed palette PNG:
- Index 0: `(0,0,0)` alpha=0 — transparent (background, not recolored)
- Index 1: `(0,0,0)` alpha=255 — opaque black (not player-colored)
- Index 2: `(255,255,255)` alpha=255 — white (player-colored zone)

The player color shader (`js/playerColorFilter.mjs`) maps white pixels to the player's team color via HSL hue rotation.

---

## Step 2 — `assets/unitsSpritesDescription.json`

Add an entry for the new unit. The key is the `spriteName` you will assign in the unit class (e.g. `"archer"`).

```json
"my-unit": {
    "sprite": "MyUnit-Green.png",
    "relativeToRoot": "./assets/units/MyUnit-Green.png",
    "static": {
        "_0": { "s": {"x":0,"y":0}, "se":{"x":0,"y":1}, "e":{"x":0,"y":2}, "ne":{"x":0,"y":3}, "n":{"x":0,"y":4}, "nw":{"x":0,"y":5}, "w":{"x":0,"y":6}, "sw":{"x":0,"y":7} },
        "_1": { "s": {"x":1,"y":0}, ... }
    },
    "walk": {
        "_0": { ... }, "_1": { ... }, "_2": { ... }, "_3": { ... }
    },
    "attack": {
        "_0": { ... }, "_1": { ... }, "_2": { ... }, "_3": { ... }
    },
    "mask": "./assets/units/MyUnit-Mask.png"
}
```

### Coordinate system

- `x` = column index in the sprite sheet (0-based, left to right)
- `y` = direction row (0=S, 1=SE, 2=E, 3=NE, 4=N, 5=NW, 6=W, 7=SW)
- Each frame is `UNIT_SPRITE_SIZE × UNIT_SPRITE_SIZE` pixels (32×32 by default)

### Animation sections

| Section | Frames | Notes |
|---------|--------|-------|
| `static` | `_0`, `_1` | Idle/standing animation (2 frames) |
| `walk` | `_0`–`_3` | Walking animation (4 frames) |
| `attack` | `_0`–`_3` | Attack animation (4 frames) |

The sprite sheet columns for each section depend on the source artwork. Inspect the actual PNG to map columns to frame indices. The `"archer"` entry uses attack frames at columns 8–11 because the bow-draw animation sits there in the Archer spritesheet.

---

## Step 3 — `js/unit.mjs`

### 3a. Import (if using projectiles)

If the unit fires projectiles instead of applying continuous melee damage, add:

```js
import { Projectile } from 'projectile'
```

This import is already present if `Archer` was added before your unit. Do not duplicate it.

### 3b. Add the unit class

Add your class **after** the most similar existing unit. For a ranged unit, place it near `Mage`/`Archer`. For a melee unit, place it near `Soldier`/`HeavyInfantry`.

**Melee unit template:**
```js
class MyUnit extends MeleeUnit {
  constructor(x, y, owner) {
    super(x, y, owner)
    this.spriteName = 'my-unit'
    this.sprite = unitsSprites[this.spriteName]['static']['_0']['s']
    this.life = 12
    this.maxLife = this.life
    applyGameModeModifiers(this)   // ← must come AFTER setting life/maxLife
    this.attack = 6
    this.speed = 1.0
    // this.range is inherited: 0.75 * getTileSize() for melee
  }
}
```

**Ranged unit with projectile template:**
```js
class MyUnit extends RangedUnit {
  constructor(x, y, owner) {
    super(x, y, owner)
    this.spriteName = 'my-unit'
    this.sprite = unitsSprites[this.spriteName]['static']['_0']['s']
    this.life = 10
    this.maxLife = this.life
    applyGameModeModifiers(this)   // ← must come AFTER setting life/maxLife
    this.attack = 8
    this.speed = 1.0
    this.range = 5 * getTileSize()   // override default RangedUnit range (4 tiles)
    this.attackCooldown = 1500       // ms between projectile shots
    this.attackTimer = 0
  }

  attackEnemy(delay) {
    this.attackTimer += delay
    if (this.attackTimer >= this.attackCooldown) {
      this.attackTimer -= this.attackCooldown
      if (this.goal?.life > 0) {
        const SPRITE_SIZE = getTileSize()
        // unit x/y are pixel positions; add half tile to center the shot
        new Projectile(this.x + SPRITE_SIZE / 2, this.y + SPRITE_SIZE / 2, this.goal, this.attack)
      }
    }
    // Award kill/XP when a previously-fired arrow kills the target
    if (this.goal?.life <= 0) {
      this.kills++
      this.gainExperience(5)
    }
  }
}
```

> **Why override `attackEnemy` for ranged?**
> The default `CombatUnit.attackEnemy` applies `attack * delay / 1000` damage every frame (continuous DPS). Projectile-based units must use a cooldown to fire discrete shots instead.

> **`applyGameModeModifiers` placement**: always call it after `this.life = X` / `this.maxLife = X`, and before any post-modifier stat overrides (like `this.attack`, `this.speed`). The modifier may override `life` to 1 in One Shot mode.

### 3c. Export the class

Add the class name to the export list at line 1–3 of the file (kept alphabetical):

```js
export {
  Archer, CombatUnit, EliteWarrior, ..., MyUnit, ...
}
```

---

## Step 4 — `js/building.mjs`

### 4a. Add to `Building.TYPES`

Inside the static `TYPES` object (around line 210), add your entry. Position it logically relative to other combat buildings.

```js
MY_BUILDING: {
  key: 'myBuilding',          // matches locale key in buildings.myBuilding
  name: 'My Building',        // fallback display name
  icon: '🗡️',                 // emoji shown in build menu slot
  costs: { wood: 20, stone: 10, water: 15, gold: 10 },
  UPGRADES: {
    benefits: { life: 50, productionSpeed: 10 }
  },
  description: 'Trains XYZ',
  details: 'Short tooltip detail.',
  sprite_coords: {
    cyan: { x: 6, y: 34 },   // tile coords in the buildings tileset PNG
    red:  { x: 6, y: 34 },
  },
  sprite: './assets/buildings/my-icon.png'  // build menu icon
},
```

`sprite_coords` references the overworld tileset (`punyworld-overworld-tileset.png`). `x` is the column, `y` is the row of the tile to render in-world. `cyan` and `red` can point to different tiles if different colors are available; otherwise they can be the same.

### 4b. Add the building class

Add after the closest sibling (e.g., after `Barracks`):

```js
class MyBuilding extends CombatBuilding {
  constructor(x, y, color, owner) {
    super(x, y, color, owner)
    this.type = Building.TYPES.MY_BUILDING
    this.life = 100
    this.maxLife = 100
    applyGameModeModifiers(this)
    this.productionCooldown = 16000  // ms to produce one unit
  }

  async produceWarrior() {
    if (this.owner) {
      const enemy = this.owner.getEnemies()[0]
      if (!enemy) {
        console.warn('No enemy tent found to target for combat unit spawn.')
        return
      }
      const target = enemy.currentNode ? enemy.currentNode : enemy
      const spawnLocation = await findBestSpawnLocation(this.x, this.y, target.x, target.y)
      if (spawnLocation) {
        this.owner.addMyUnit(spawnLocation.x, spawnLocation.y)
      } else {
        console.warn(`No valid spawn location found for my-unit from ${this.type.name} at (${this.x}, ${this.y})`)
      }
    }
  }
}
```

`produceWarrior()` is called automatically by `CombatBuilding.update()` when `productionCooldown` elapses.

### 4c. Add factory case

In `Building.create()` (the static factory method), add a case alongside the others:

```js
case Building.TYPES.MY_BUILDING:
  building = new MyBuilding(x, y, color, owner)
  break
```

### 4d. Export the class

Add `MyBuilding` to the export at line 1:

```js
export { ..., MyBuilding, ... }
```

---

## Step 5 — `js/players.mjs`

### 5a. Import the new unit

```js
import { ..., MyUnit, ... } from 'unit'
```

### 5b. Add `addMyUnit()` method

Place alongside the other `addXxx()` methods (around line 706):

```js
addMyUnit(x, y) {
  this.units.push(new MyUnit(x, y, this))
}
```

### 5c. Update AI build logic (`decideNextBuildingType`)

Add a counter at the top of the method:

```js
const myBuildings = buildings.filter(b => b.type === Building.TYPES.MY_BUILDING).length
```

Then add `canBuild` checks in the appropriate difficulty blocks. Place them at a sensible priority — after basic resource buildings, near other combat buildings:

```js
// medium difficulty
if (canBuild(Building.TYPES.MY_BUILDING, myBuildings, 2) && this.findBuildingPlacement(Building.TYPES.MY_BUILDING)) return Building.TYPES.MY_BUILDING

// hard difficulty
if (canBuild(Building.TYPES.MY_BUILDING, myBuildings, 2) && this.findBuildingPlacement(Building.TYPES.MY_BUILDING)) return Building.TYPES.MY_BUILDING
```

Omit from `easy` difficulty unless the unit is intentionally part of the easy AI strategy.

---

## Step 6 — `js/ui.mjs`

In `createBuildingSlots()`, add the new building type to the `buildings` array (around line 1182):

```js
const buildings = [
  Building.TYPES.TENT,
  Building.TYPES.LUMBERJACK,
  Building.TYPES.QUARRY,
  Building.TYPES.WELL,
  Building.TYPES.GOLD_MINE,
  Building.TYPES.MY_BUILDING,   // ← add here
  Building.TYPES.BARRACKS,
  ...
]
```

Position reflects the visual order in the build menu bar.

---

## Step 7 — Locale files

Add to the `buildings` section of all four files: `locales/en.json`, `fr.json`, `de.json`, `es.json`.

The key **must match** `Building.TYPES.MY_BUILDING.key` (e.g. `"myBuilding"`).

```json
"myBuilding": {
  "name": "My Building",
  "description": "Trains XYZ",
  "details": "Short tooltip description."
}
```

Place it alphabetically or alongside peer buildings (e.g., near `barracks`).

---

## Checklist

Before considering the implementation complete:

- [ ] Sprite PNG and mask PNG exist in `assets/units/`
- [ ] Building icon PNG exists in `assets/buildings/`
- [ ] `unitsSpritesDescription.json` — entry added with correct column/row coords
- [ ] `js/unit.mjs` — class added, `applyGameModeModifiers` called after `life`/`maxLife`, exported
- [ ] `js/unit.mjs` — `import { Projectile }` added if projectile-based
- [ ] `js/unit.mjs` — `attackEnemy` overridden with cooldown if projectile-based
- [ ] `js/building.mjs` — type added to `Building.TYPES`
- [ ] `js/building.mjs` — class added with `produceWarrior()` calling `owner.addMyUnit()`
- [ ] `js/building.mjs` — factory case added in `Building.create()`
- [ ] `js/building.mjs` — class exported
- [ ] `js/players.mjs` — unit imported
- [ ] `js/players.mjs` — `addMyUnit()` method added
- [ ] `js/players.mjs` — AI counters and `canBuild` checks added for medium + hard
- [ ] `js/ui.mjs` — building added to build menu array
- [ ] All 4 locale files updated
- [ ] `npm run test` passes

---

## Reference implementations

The **Archery + Archer** pair (commit history, branch `main`) is the canonical reference:

| Concept | Location |
|---------|----------|
| Projectile-based ranged unit | `js/unit.mjs` — `class Archer` |
| Melee continuous-damage unit | `js/unit.mjs` — `class Soldier` |
| Combat building pattern | `js/building.mjs` — `class Archery` / `class Barracks` |
| AI build priorities | `js/players.mjs` — `decideNextBuildingType()` |
| Sprite frame layout (archer) | `assets/unitsSpritesDescription.json` — `"archer"` entry |
