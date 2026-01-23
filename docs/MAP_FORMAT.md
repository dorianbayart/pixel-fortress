# Custom Map JSON Format

This document describes the JSON format used for custom maps in Pixel Fortress.

## Overview

Custom maps allow you to create pre-designed terrain layouts for the game. Maps are defined in JSON format and can be created by exporting an existing game map or by manually crafting the JSON structure.

## JSON Structure

```json
{
  "id": "unique_map_identifier",
  "version": "1.0",
  "name": "Display Name",
  "description": "Brief description of the map",
  "category": "custom",
  "difficulty": "medium",
  "size": "medium",
  "mapSize": {
    "width": 60,
    "height": 120
  },
  "seed": 123456,
  "terrain": [
    ["GRASS", "GRASS", "WATER", ...],
    ["GRASS", "TREE", "WATER", ...],
    ...
  ],
  "startingPositions": [
    { "player": "human", "x": 10, "y": 70 },
    { "player": "ai_1", "x": 50, "y": 50 }
  ],
  "exportDate": "2026-01-23T10:30:00.000Z"
}
```

## Field Descriptions

### Required Fields

- **`id`** (string): Unique identifier for the map. Should use lowercase with underscores.
  - Example: `"valley_crossing"`, `"custom_123456"`

- **`version`** (string): Map format version. Currently `"1.0"`.

- **`name`** (string): Human-readable display name for the map.
  - Example: `"Valley Crossing"`, `"Map Seed 123456"`

- **`description`** (string): Brief description of the map and its characteristics.
  - Example: `"A narrow valley forces tactical positioning"`

- **`category`** (string): Map category. Valid values:
  - `"custom"` - User-created custom map
  - `"skirmish"` - Official skirmish map
  - `"campaign"` - Campaign map (future use)

- **`difficulty`** (string): Suggested difficulty level. Valid values:
  - `"easy"`
  - `"medium"`
  - `"hard"`

- **`size`** (string): Map size category. Valid values:
  - `"small"` - 40x80 tiles
  - `"medium"` - 60x120 tiles
  - `"large"` - 80x160 tiles
  - `"huge"` - 100x200 tiles

- **`mapSize`** (object): Exact map dimensions in tiles.
  - `width` (number): Map width in tiles
  - `height` (number): Map height in tiles

- **`terrain`** (2D array): The terrain layout as a 2D array of strings.
  - First dimension (x-axis): columns from left to right
  - Second dimension (y-axis): rows from top to bottom
  - Each element is a terrain type string (see Terrain Types below)

- **`startingPositions`** (array): Starting positions for players.
  - Each position object contains:
    - `player` (string): Player identifier (`"human"`, `"ai_1"`, `"ai_2"`, etc.)
    - `x` (number): X coordinate (column)
    - `y` (number): Y coordinate (row)

### Optional Fields

- **`seed`** (number): Original seed used to generate this map (if applicable).
  - Range: 0 to 999,999,999

- **`exportDate`** (string): ISO 8601 timestamp of when the map was exported.

## Terrain Types

Valid terrain type strings for the `terrain` array:

| Type | Description | Walkable | Resource |
|------|-------------|----------|----------|
| `GRASS` | Standard grass terrain | Yes | - |
| `TREE` | Forest with wood resource | No | Wood |
| `DEPLETED_TREE` | Tree stump (no resources) | Yes | - |
| `ROCK` | Stone deposits | No | Stone |
| `GOLD` | Gold deposits | No | Gold |
| `WATER` | Water (impassable) | No | - |
| `SAND` | Sandy terrain (beach) | Yes | - |

**Note:** Buildings should NOT be included in the terrain array. Only place starting positions (tents) via the `startingPositions` field.

## Example: Complete Map

```json
{
  "id": "valley_crossing",
  "version": "1.0",
  "name": "Valley Crossing",
  "description": "A narrow valley forces tactical positioning",
  "category": "custom",
  "difficulty": "medium",
  "size": "medium",
  "mapSize": {
    "width": 60,
    "height": 120
  },
  "seed": 574821,
  "terrain": [
    ["GRASS", "GRASS", "TREE", "TREE", ...],
    ["GRASS", "GRASS", "GRASS", "TREE", ...],
    ["WATER", "WATER", "GRASS", "GRASS", ...],
    ...
  ],
  "startingPositions": [
    { "player": "human", "x": 10, "y": 100 },
    { "player": "ai_1", "x": 50, "y": 20 }
  ],
  "exportDate": "2026-01-23T15:30:45.123Z"
}
```

## Creating Maps

### Method 1: Export from Game

1. Start a game with your desired seed or random generation
2. During gameplay, press `ESC` to open the game menu
3. View the current map seed in the "Map Information" section
4. Click the "Export Map" button
5. The map will be downloaded as a JSON file

### Method 2: Manual Creation

1. Create a new JSON file following the structure above
2. Define your terrain layout in the `terrain` 2D array
3. Set starting positions for players
4. Validate the JSON structure (future: use `npm run validate-map`)

## File Location

Custom map files should be placed in:
```
/maps/custom/your_map_name.json
```

## Future Enhancements

- **Compression**: RLE (Run-Length Encoding) for large maps
- **Validation tool**: `npm run validate-map <filepath>`
- **Preview tool**: `npm run preview-map <filepath>`
- **Map editor**: Web-based visual map editor

## Technical Notes

- The `terrain` array is indexed as `terrain[x][y]`
- Coordinate system origin (0,0) is at the top-left corner
- Maps must have at least one starting position for the human player
- Starting positions should be placed on walkable terrain (GRASS, SAND, or DEPLETED_TREE)

---

*Last Updated: 2026-01-23*
*Format Version: 1.0*
