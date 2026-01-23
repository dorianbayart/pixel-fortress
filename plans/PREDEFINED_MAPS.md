# Predefined Maps Implementation Plan

## Overview

Add support for predefined custom maps in Pixel Fortress. Players can select from curated maps in Skirmish mode with dynamic canvas-based previews (like the minimap).

**Current State:**
- ✓ Seed-based map generation working well
- ✓ Random map generation with smart tent placement
- Basic placeholder for `loadPredefinedMap` exists (js/maps.mjs:24-39)
- Skirmish menu only offers random generation

**Primary Goals:**
1. Support custom predefined maps (manually crafted terrain in JSON)
2. Dynamic canvas-based map previews in skirmish menu (NO static images)
3. Map creation and validation tools for developers
4. Browse and select predefined maps in UI
5. Maintain backwards compatibility with random generation

---

## 1. Map Data Format

### Custom Map JSON Structure

Simple 2D array format (defer compression to later):

```json
{
  "id": "valley_crossing",
  "version": "1.0",
  "name": "Valley Crossing",
  "description": "A narrow valley forces tactical positioning",
  "category": "skirmish",
  "difficulty": "medium",
  "size": "medium",
  "mapSize": { "width": 80, "height": 80 },
  "terrain": [
    ["GRASS", "GRASS", "WATER", "WATER", ...],
    ["GRASS", "TREE", "WATER", "WATER", ...],
    ["GRASS", "GRASS", "SAND", "SAND", ...]
  ],
  "startingPositions": [
    { "player": "human", "x": 10, "y": 70 },
    { "player": "ai_1", "x": 70, "y": 10 }
  ]
}
```

**Valid Terrain Types:** `GRASS`, `TREE`, `DEPLETED_TREE`, `ROCK`, `GOLD`, `WATER`, `SAND`

### Enhanced seeds.json

Add predefined maps to existing `maps/seeds.json`:

```json
{
  "interesting_seeds": [...],
  "predefined_maps": [
    {
      "id": "valley_crossing",
      "name": "Valley Crossing",
      "type": "custom",
      "data_file": "maps/custom/valley_crossing.json",
      "difficulty": "medium",
      "size": "medium",
      "description": "A narrow valley forces tactical positioning"
    },
    {
      "id": "roads_574",
      "name": "Crossroads",
      "type": "seed",
      "seed": 574,
      "difficulty": "medium",
      "size": "medium"
    }
  ]
}
```

---

## 2. Map Creation Workflow

### Development Tools (Build First)

1. **Map Exporter** (`scripts/export-map.mjs`)
   - Export current game map to JSON format
   - Usage: `npm run export-map <filename>`

2. **Map Validator** (`scripts/validate-map.mjs`)
   - Validate custom map JSON files
   - Check: valid JSON, required fields, terrain types, dimensions
   - Usage: `npm run validate-map <filepath>`

3. **Map Previewer** (`scripts/preview-map.mjs`)
   - Canvas-based preview without loading full game
   - Opens HTML page showing minimap-style visualization
   - Usage: `npm run preview-map <filepath>`

### Creation Process

1. Generate interesting seed-based map OR start from scratch
2. Export map: `npm run export-map my_new_map`
3. Edit JSON file manually (customize terrain, positions)
4. Validate: `npm run validate-map maps/custom/my_new_map.json`
5. Preview: `npm run preview-map maps/custom/my_new_map.json`
6. Test in game
7. Add entry to `maps/seeds.json`

---

## 3. Map Preview System

### Dynamic Canvas Rendering (Like Minimap)

**All previews are rendered dynamically on canvas - NO static images.**

**Implementation approach:**
- Render map on canvas element using simplified terrain colors
- Show minimap-style visualization in skirmish menu
- Mark starting positions with icons
- Generate previews on-demand (with caching)

**Preview locations:**
1. **Development tool** - `scripts/preview-map.mjs` opens HTML page
2. **Skirmish menu** - Canvas element in map browser shows selected map
3. **Map selection cards** - Small canvas preview for each map

**Terrain colors** (same as minimap):
```javascript
GRASS: '#90B850', TREE: '#4A7023', ROCK: '#6B6B6B',
GOLD: '#FFD700', WATER: '#4A9EFF', SAND: '#E0D0A0'
```

---

## 4. Map Loading System

### Update js/maps.mjs

Add functions:
- `loadMapsList()` - Load and cache maps/seeds.json
- `getMapById(mapId)` - Find map by ID
- `loadPredefinedMap(mapId)` - Load seed-based OR custom map
- `loadCustomMap(dataFile)` - Parse custom map JSON and build gameState.map

### Update js/game.mjs

- `initGame(mapId = null)` - Accept optional mapId parameter
- If mapId provided, load predefined map instead of generating
- Skip tent placement for custom maps (positions predefined)

### Update js/state.mjs

Add to settings:
```javascript
selectedMapId: null,  // ID of selected predefined map
mapType: 'random'     // 'random' or 'predefined'
```

---

## 5. UI Integration

### Skirmish Menu Updates

**Map Type Selector:**
- Tabs/buttons: "Random Map" | "Predefined Maps"
- Default: Random Map

**Predefined Maps Browser:**
- Scrollable grid of map cards
- Each card: name, difficulty badge, size badge, small canvas preview
- Click card to select and show full preview

**Map Preview Panel:**
- Large canvas preview (256x256) of selected map
- Map metadata: name, description, size, difficulty
- "Select Map" button

**Filters:**
- Difficulty dropdown (all, easy, medium, hard)
- Size dropdown (all, small, medium, large, huge)
- Search input (filter by name/description)

### Files to modify:
- `play.html` - Add map browser HTML
- `css/map-browser.css` - Map selection styles (new file)
- `js/menu.mjs` - Map browser logic, filter/search, selection handling

---

## 6. Implementation Phases

### Phase 1: Infrastructure (Week 1-2) ✅ COMPLETE
- [x] Define and document custom map JSON format (`docs/MAP_FORMAT.md`)
- [x] Implement map export function (`exportMapToJSON`, `downloadMapJSON`)
- [x] Add export button to in-game menu (shows seed, triggers download)
- [x] Implement custom map loader in js/maps.mjs (`loadCustomMap`, `applyCustomMap`)
- [x] Update game initialization to accept and load custom maps
- [x] Add map ID input field to skirmish menu
- [x] Wire up UI to pass map ID to game initialization
- [x] Test with exported custom map (custom_4698963)
- [ ] Create development tools (validate, preview scripts) - DEFERRED TO LATER PHASES
- [x] Create 2-3 additional test custom maps - OPTIONAL

### Phase 2: Preview System (Week 2-3)
- [ ] Implement canvas-based preview renderer (js/map-preview.mjs)
- [ ] Development preview tool (scripts/preview-map.mjs)
- [ ] In-game preview rendering for skirmish menu
- [ ] Test preview generation for various map sizes

### Phase 3: UI Integration (Week 3-4)
- [ ] Update maps/seeds.json with predefined maps structure
- [ ] Implement map list loader and filtering
- [ ] Build map browser UI (cards, grid, preview panel)
- [x] Connect UI to game initialization
- [ ] Add filters and search functionality

### Phase 4: Testing & Polish (Week 4-5)
- [ ] Unit tests (map loading, validation, filtering)
- [ ] Integration tests (end-to-end map selection)
- [ ] Manual testing (UI, responsiveness, errors)
- [ ] Create 5-10 curated custom maps
- [ ] Documentation (map creation guide)

### Future: Advanced Features
- RLE compression for large maps
- Web-based map editor tool
- Campaign mode integration
- Community map sharing

---

## 7. File Structure

```
pixel-fortress/
├── maps/
│   ├── seeds.json              # Enhanced with predefined_maps
│   └── custom/                 # Custom map JSON files
│       ├── valley_crossing.json
│       └── ...
├── js/
│   ├── maps.mjs                # Enhanced loader
│   ├── map-preview.mjs         # Canvas preview renderer (new)
│   ├── menu.mjs                # Map browser UI
│   ├── game.mjs                # Updated initGame
│   └── state.mjs               # Map selection state
├── css/
│   └── map-browser.css         # Map UI styles (new)
├── scripts/
│   ├── export-map.mjs          # Map exporter (new)
│   ├── validate-map.mjs        # Validator (new)
│   └── preview-map.mjs         # Preview generator (new)
└── tests/
    └── maps.test.mjs           # Map tests (new)
```

---

## 8. Success Criteria

- [ ] Players can browse predefined maps in Skirmish menu
- [ ] Dynamic canvas previews render correctly (like minimap)
- [ ] Players can filter/search maps
- [ ] Selected map loads and plays correctly
- [ ] Random map generation still works (default)
- [ ] At least 5 curated custom maps available
- [ ] Development tools work for creating new maps

**Timeline:** 4-6 weeks total

---

*Last Updated: 2026-01-23*
