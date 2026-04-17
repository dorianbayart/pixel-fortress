# Pixel Fortress — Voxel Unit Reconstruction

Prototype for reconstructing 3D voxel models of Pixel Fortress units from their 2D directional sprites.

---

## Goal

Each unit has multiple 32×32 directional sprites (South, N, E, W, NE, NW, SE, SW).
The aim is to combine those views to reconstruct a coherent 3D voxel volume — **not by extruding a single sprite**, but by using multiple projections to carve a volume, similar to *shape-from-silhouette* / *voxel space carving*.

---

## Sprite Conventions

- Each sprite frame is **32×32 pixels**.
- The 2D view is **orthographic, from ~13° above** (empirically found to give the best reconstruction quality via automated IoU/color benchmark across all units and animations; the slider range is 5°–75° for experimentation).
- Fully transparent pixels are empty space.
- **Black pixels adjacent to a transparent pixel are outline/border pixels and should be ignored** during reconstruction (they're 2D rendering artifacts, not actual surface voxels).

---

## Direction Mapping to 3D Projections

The sprite directions correspond to these camera orientations around the Y axis of the voxel model:

| Sprite direction | Meaning                        | Y-axis rotation to apply |
|-----------------|--------------------------------|--------------------------|
| **South**       | Unit facing viewer (front)     | 0°                       |
| **North**       | Unit walking away (back)       | 180°                     |
| **East**        | Unit moving right (right face) | −90°                     |
| **West**        | Unit moving left (left face)   | +90°                     |
| **SE**          | Front-right diagonal           | −45°                     |
| **SW**          | Front-left diagonal            | +45°                     |
| **NE**          | Back-right diagonal            | −135°                    |
| **NW**          | Back-left diagonal             | +135°                    |

No sprite is mirrored — each direction is an independent view of the same 3D form.

---

## Reconstruction Algorithm (Space Carving)

1. **Initialize** a 3D voxel grid (e.g. 32×32×32), all voxels ON.
2. **For each available direction**:
   a. Project the voxel grid onto a 2D plane from that direction's camera angle (accounting for the ~13° elevation).
   b. For every projected pixel that is **transparent** in the sprite, carve (turn OFF) all voxels along that ray.
3. **After all directions**, surviving voxels form the reconstructed 3D shape.
4. **Color assignment**: for each surviving voxel, pick the color from the sprite that best matches its projected position (prefer the most "frontal" view — South, then diagonals, then back).

---

## Key Differences from the Old (Wrong) Extrusion Approach

| Old approach (extrusion)                         | Correct approach (space carving)                     |
|--------------------------------------------------|------------------------------------------------------|
| Single sprite extruded along Z axis              | Multiple sprites used as projections                 |
| Depth assigned per-pixel (luma, edge, flat)      | Voxels carved from a full 3D volume                  |
| Result: flat slab, wrong shape (see screenshot)  | Result: 3D form consistent with all views            |
| Ignores directional sprite information           | Uses all 8 directions                                |

---

## Input Data

- **Sprites**: `../assets/units/*.png` (sprite sheets)
- **Metadata**: `unitSpriteDescription` JSON — defines frame layout (row = direction, col = animation frame)
- **Grid size**: 32×32 per frame; target voxel volume ~32×32×32

---

## How to Run

These pages load images from `../assets/` and read pixel data via canvas (requires same-origin HTTP):

```bash
# From project root
python3 -m http.server 8000
# Then open http://localhost:8000/voxel-test/
```

Or via Electron: `npm run start`, then navigate to `voxel-test/index.html`.

---

## Tools

| Page | Purpose |
|------|---------|
| `index.html` | Single-unit 3D viewer with animation playback |
| `scene.html` | All units at once, gallery view |
| `steps.html` | Step-by-step carving visualizer — shows each view's contribution |
| `analyze.html` | 2D sprite direction analyzer with per-row stats |
| `evaluate.html` | **Quality benchmark** — sweeps (elevDeg × maxFront) parameter grid, measures silhouette IoU + color similarity vs. original sprites across all units/animations, ranks results in a sortable table with visual diff viewer |

---

## Known Limitations

### Foreground object extrusion (weapons / tools)
When a unit holds a weapon or tool (axe, bow, sword) that extends in front of or beside the body, the object often appears **extruded as a Z-slab** rather than as a small foreground object. This happens because:

1. The S sprite shows the weapon opaque at `(x_weapon, y_weapon)` → S carving keeps the **entire Z-column** alive at that position.
2. All other views (N, E, W, diagonals) see the **body** at the same `(world_x, world_y)` projection, so they don't carve those Z positions away.
3. Result: the weapon pixel creates a 32-deep voxel slab because the body "shields" it from carving in every other view.

The `steps.html` tool makes this visible: after step `+S`, a full Z-curtain appears at the weapon position. No subsequent view removes it.

### Eye colors on side faces
Voxels at the south face of the head (z≈0) with exposed east/west faces appear with face/eye colors from the south sprite. This is a fundamental single-color-per-voxel limitation: the same voxel cannot have a different color for its south face vs its east face.

### Best elevation angle
**13°** — confirmed by automated quality benchmark (`evaluate.html`) measuring silhouette IoU and color similarity across all units, animations, and sprite directions. The `maxFront` foreground-clip parameter has no measurable effect (always best at 0 because `findForegroundPixels` returns empty for connected silhouettes) and has been removed from the UI.
