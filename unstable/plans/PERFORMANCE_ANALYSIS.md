# Performance Analysis: Zoom Out Bottleneck on Large Maps

## Executive Summary

When zooming out significantly on large maps (especially "Huge" 100x200 = 20,000 tiles), the rendering system experiences severe performance degradation due to several architectural issues in the tile rendering pipeline.

## Critical Performance Bottlenecks

### 1. **Full Sprite Map Iteration Every Frame** ⚠️ MOST CRITICAL

**Location:** `js/renderer.mjs:783-819`

**Issue:**
```javascript
// Lines 783-794: Iterate through ALL background sprites
for (const [key, sprite] of backgroundSpriteMap.entries()) {
    if (!visibleBackgroundSprites.has(key)) {
        // ... hide or remove logic
    }
}

// Lines 798-819: Iterate through ALL world object sprites
for (const [key, sprite] of worldObjectSpriteMap.entries()) {
    if (!visibleWorldObjectSprites.has(key)) {
        // ... hide or remove logic
    }
}
```

**Impact:**
- These sprite maps accumulate entries as the camera pans around the map
- On a "Huge" map (20,000 tiles), after exploring, `backgroundSpriteMap` could contain 20,000+ entries
- `worldObjectSpriteMap` could contain thousands of tree/rock/building sprites
- **Every frame**, the code iterates through ALL entries to check visibility
- At 60 FPS with 20,000 sprites: **1.2 million Map iterations per second**

**Why It's Bad:**
- O(n) complexity where n = total sprites ever created (not just visible ones)
- Map iteration is expensive in JavaScript
- Scales terribly with map size and exploration
- Gets worse the more you pan around the map

### 2. **Large Nested Loop in drawBackground()** ⚠️ CRITICAL

**Location:** `js/renderer.mjs:659-773`

**Issue:**
```javascript
for (let x = startX; x < endX; x++) {
    for (let y = startY; y < endY; y++) {
        // Process each tile:
        // - Fog of war check (line 662)
        // - Background sprite handling
        // - World object sprite handling
        // - Texture comparison and updates
        // - Gold particle random check (lines 765-771)
    }
}
```

**Impact:**
- When zoomed out to show 80x160 tiles: **12,800 iterations per frame**
- When zoomed out to show entire Huge map: **20,000 iterations per frame**
- Each iteration does:
  - Fog of war exploration check: `isPositionExplored(x, y)` (line 662)
  - Multiple map lookups: `map[x][y]`
  - Sprite existence checks
  - Texture comparisons
  - Container operations
  - Random number generation for gold particles (Math.random() on line 765)

**Performance Math:**
- 12,800 tiles × 60 FPS = **768,000 tile checks per second**
- Each check involves multiple operations, object property accesses, and conditionals

### 3. **Inefficient Sprite Cleanup Logic**

**Location:** `js/renderer.mjs:776-819`

**Issue:**
```javascript
// Define extended viewport for memory management
const extendedBuffer = viewport.buffer * 3
const farStartX = Math.max(0, viewport.x - extendedBuffer)
// ... calculate far boundaries

// Then iterate through ALL sprites to check if they're far away
for (const [key, sprite] of backgroundSpriteMap.entries()) {
    if (!visibleBackgroundSprites.has(key)) {
        const y = Math.floor(key / 10 / width)  // Calculate position from key
        const x = (key / 10) % width

        if (x < farStartX || x >= farEndX || y < farStartY || y >= farEndY) {
            // Remove sprite
        } else {
            sprite.visible = false  // Just hide it
        }
    }
}
```

**Problems:**
- Recalculates sprite position from encoded key every frame
- Does math operations (division, modulo) on every sprite
- Iterates through all sprites even when most are visible
- No early exit optimization

### 4. **No Spatial Indexing**

**Issue:**
The code stores all sprites in flat Map structures without spatial organization:
```javascript
const backgroundSpriteMap = new Map()
const worldObjectSpriteMap = new Map()
```

**Better Approach Would Be:**
- Spatial hash grid (divide map into chunks)
- Quadtree structure
- Only iterate sprites in/near visible chunks
- O(visible sprites) instead of O(all sprites)

### 5. **Redundant Operations in Inner Loop**

**Location:** `js/renderer.mjs:659-773`

**Issues:**
- **Line 662:** `isPositionExplored(x, y)` called for every tile when fog is enabled
  - This likely involves array lookups: `exploredGrid[x][y]`
  - Could be cached or batched

- **Lines 726-731:** Water animation frame lookup:
  ```javascript
  if (map[x][y].waterFrames && map[x][y].waterFrames.length === 4) {
      const currentFrame = getCurrentWaterFrame()
      spriteTexture = map[x][y].waterFrames[currentFrame]
  }
  ```
  - `getCurrentWaterFrame()` function call every time
  - Array access and length check
  - Could be done once before the loop

- **Lines 765-771:** Gold particle spawning:
  ```javascript
  if (gameState.map[x]?.[y]?.type === TERRAIN_TYPES.GOLD.type && Math.random() > 0.945) {
      createParticleEmitter(ParticleEffect.GOLD_SPARKLE, {
          x: x * getTileSize() + getTileSize()/2,
          y: y * getTileSize() + getTileSize()/2,
          duration: 1000
      })
  }
  ```
  - `Math.random()` called in hot loop
  - Particle creation during render pass
  - Should be in update pass, not render pass

### 6. **Viewport Buffer Calculation**

**Location:** `js/renderer.mjs:465`

```javascript
viewport.buffer = Math.max(4, Math.ceil(Math.min(viewport.width, viewport.height) * 0.1))
```

**Issue:**
- Buffer grows with viewport size
- When zoomed out, viewport is larger, so buffer is larger
- Example: viewport 100 tiles → buffer = 10 tiles
- This means even more tiles to render (110x110 instead of 100x100)
- Consider clamping buffer to a maximum value

## Performance Impact Breakdown

### Huge Map (100x200) When Fully Zoomed Out

**Assumptions:**
- Zoomed out to see entire map
- 60 FPS target
- Fog of war enabled
- 10% of map has been explored

**Per Frame:**
1. Inner loop iterations: 20,000 tiles
2. Background sprite map iteration: 20,000 entries
3. World object sprite map iteration: ~4,000 entries (trees/rocks)
4. Fog checks: 20,000 calls to `isPositionExplored()`
5. Random number generation: ~100 gold tiles × random check

**Per Second (60 FPS):**
- Tile processing: 1,200,000 tiles
- Map iterations: 1,440,000 entries
- Function calls: 1,200,000+

**Estimated Performance Cost:**
- Inner loop: ~8-12ms per frame
- Sprite map iteration: ~5-10ms per frame
- **Total render time: ~15-25ms per frame**
- **Target budget at 60 FPS: 16.67ms**
- **Result: Drops to 40-50 FPS or worse**

## Recommended Solutions

### Solution 1: Spatial Chunking (High Impact, Medium Effort)

Divide the map into chunks (e.g., 16x16 tiles per chunk):

```javascript
// Store sprites in a spatial grid
const CHUNK_SIZE = 16
const spriteChunks = new Map() // Map<chunkKey, Map<tileKey, sprite>>

// Only iterate visible chunks
const startChunkX = Math.floor(viewport.startX / CHUNK_SIZE)
const endChunkX = Math.ceil(viewport.endX / CHUNK_SIZE)
// ... iterate only visible chunks
```

**Expected Improvement:** 90-95% reduction in sprite iteration time

### Solution 2: Visibility Dirty Tracking (High Impact, Low Effort)

Only check sprite visibility when viewport changes significantly:

```javascript
let lastViewportCheck = { x: 0, y: 0, width: 0, height: 0 }

function shouldUpdateVisibility(viewport) {
    // Only update if viewport moved significantly (e.g., 5+ tiles)
    return Math.abs(viewport.x - lastViewportCheck.x) > 5 ||
           Math.abs(viewport.y - lastViewportCheck.y) > 5
}
```

**Expected Improvement:** 80-90% reduction in visibility checks

### Solution 3: Batch Sprite Operations (Medium Impact, Low Effort)

Instead of checking every sprite individually, batch operations:

```javascript
// Collect sprites to hide/remove in batches
const spritesToHide = []
const spritesToRemove = []

// Process batches after main render loop
```

### Solution 4: Optimize Inner Loop (Medium Impact, Medium Effort)

Move operations out of the inner loop:

```javascript
// Calculate once before loop
const currentWaterFrame = getCurrentWaterFrame()
const tileSize = getTileSize()
const goldType = TERRAIN_TYPES.GOLD.type

// Reduce gold particle checks
const shouldCheckGold = Math.random() > 0.95 // Check only 5% of frames

for (let x = startX; x < endX; x++) {
    for (let y = startY; y < endY; y++) {
        // Simpler, faster checks inside loop
    }
}
```

**Expected Improvement:** 20-30% reduction in loop time

### Solution 5: Clamp Viewport Buffer (Low Impact, Very Low Effort)

```javascript
// Line 465 in renderer.mjs
viewport.buffer = Math.max(4, Math.min(10, Math.ceil(Math.min(viewport.width, viewport.height) * 0.1)))
//                              ^^^^ Add max clamp
```

**Expected Improvement:** 5-10% fewer tiles to render when zoomed out

### Solution 6: Use Culled Container (Low Impact, Low Effort)

PixiJS has built-in culling via `@pixi/culling` package:

```javascript
import { Cull } from '@pixi/culling'

const cull = new Cull()
cull.addContainer(containers.background)
cull.cull(app.renderer.screen)
```

**Expected Improvement:** Automatic culling by PixiJS, ~10-20% improvement

## Priority Recommendations

1. **IMMEDIATE:** Implement Solution 2 (Visibility Dirty Tracking) - Quick win
2. **HIGH:** Implement Solution 1 (Spatial Chunking) - Biggest impact
3. **MEDIUM:** Implement Solution 4 (Optimize Inner Loop) - Incremental gains
4. **LOW:** Implement Solution 5 (Clamp Buffer) - Easy safety net

## Testing Strategy

1. Test on Huge map (100x200)
2. Zoom out to show 80% of map
3. Pan around rapidly
4. Monitor FPS and frame timing
5. Use Chrome DevTools Performance profiler to identify hotspots

## Conclusion

The primary bottleneck is **iterating through all sprite maps every frame** regardless of viewport. This is an O(n) operation where n = total sprites created, not visible sprites. Combined with the large inner loop when zoomed out, this creates a perfect storm of performance issues.

Implementing spatial chunking (Solution 1) and dirty tracking (Solution 2) should improve performance by **~90%** on large zoomed-out views.
