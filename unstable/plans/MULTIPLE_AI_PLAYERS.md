# Multiple AI Players Support

## Goal
Extend the game from supporting only 1 AI opponent to supporting unlimited AI players (2-10+ AI opponents).

## Current State Analysis

### Already Multi-AI Ready
- `state.mjs`: AI players stored as array `_players.ais[]` with methods `addAiPlayer()`, `removeAiPlayer()`, `clearAiPlayers()`
- `game.mjs`: AI update loop already iterates over all AI players (line 242-244)
- `game.mjs`: Win condition already checks if ANY AI player has tents (line 247)

### Needs Changes
- Player identification and colors (currently hardcoded cyan/red)
- Tent placement algorithm (currently only places 2 tents)
- Enemy detection logic (assumes human vs all AI)
- Game settings/configuration for AI count

---

## Implementation TODO List

### 1. State Management (js/state.mjs)
- [ ] Add `aiPlayerCount` to `_settings` object (default: 1, min: 1, max: 10)
- [ ] Add getter/setter for `aiPlayerCount` with validation
- [ ] Add event emission for `ai-player-count-changed`
- [ ] Update constructor to initialize `aiPlayerCount: 1` in `_settings`

### 2. Player Module (js/players.mjs)

#### 2.1 Player Identification
- [ ] Add `playerId` property to Player constructor (auto-increment or passed in)
- [ ] Add `playerIndex` property for AI players (0, 1, 2, ...) to determine color
- [ ] Add static counter `Player._nextId = 0` for auto-incrementing IDs

#### 2.2 Player Colors
- [ ] Create color palette array for AI players (e.g., red, orange, purple, pink, yellow, brown, ...)
- [ ] Update `getColor()` method to return:
  - 'cyan' for human player
  - Color from palette based on `playerIndex` for AI players
- [ ] Ensure at least 10 distinct colors are available in the palette
- [ ] Consider color contrast for visibility (avoid colors too similar to terrain)

#### 2.3 Enemy Detection Logic
- [ ] Update `getEnemies()` method to return all players except self:
  ```javascript
  getEnemies() {
    // Return all other players' units and buildings
    const allPlayers = [gameState.humanPlayer, ...gameState.aiPlayers]
    const enemies = allPlayers
      .filter(p => p && p !== this)
      .flatMap(p => [...p.getUnits(), ...p.getBuildings()])
    return enemies
  }
  ```
- [ ] Update caching logic accordingly (cache key might need player ID)

#### 2.4 AI Resource Tiles Pre-calculation
- [ ] Verify that `goldTiles` and `rockTiles` calculation (lines 67-83) works correctly for multiple AI players
- [ ] Ensure timeout doesn't conflict with game initialization

### 3. Game Logic (js/game.mjs)

#### 3.1 Player Initialization
- [ ] Update `initGame()` to create multiple AI players:
  ```javascript
  // Create human player
  new Player(PlayerType.HUMAN)

  // Create AI players based on settings
  const aiCount = gameState.settings.aiPlayerCount
  for (let i = 0; i < aiCount; i++) {
    new Player(PlayerType.AI, gameState.settings.difficulty)
  }
  ```
- [ ] Pass player index to AI Player constructor for color assignment

#### 3.2 Win/Loss Conditions
- [ ] Update win condition to check if ALL AI players are eliminated:
  - Current: `if (!gameState.aiPlayers.some(ai => ai.getTents().length))`
  - This already works correctly for multiple AI!
- [ ] Consider: Should game continue when one AI is eliminated but others remain? (Yes - already handled)
- [ ] Consider: Add notification when an AI player is eliminated (optional enhancement)

#### 3.3 AI Player Elimination
- [ ] Add logic to detect when an AI player loses all tents
- [ ] Add `removeAiPlayer()` call or mark as eliminated (don't remove immediately to avoid index issues)
- [ ] Consider: Should eliminated AI's units/buildings be removed immediately or gradually?

### 4. Map Generation (js/mapGeneration.mjs)

#### 4.1 Tent Position Algorithm
- [ ] Update `findValidTentPositions()` to find N+1 positions (1 human + N AI):
  - Input: `aiPlayerCount` (number of AI players)
  - Output: `{humanPos, aiPositions: [{x, y}, ...], validated: boolean}`

- [ ] Design position distribution strategy:
  - **Option A - Radial**: Place players in a circle around map center
    - Human at bottom (south)
    - AI players distributed clockwise around the circle
    - Calculate angles: `angle = (2 * Math.PI * i) / (aiCount + 1)`

  - **Option B - Grid corners**: Place players at map corners/edges
    - For 2 players: top-center and bottom-center (current)
    - For 3 players: form triangle (top, bottom-left, bottom-right)
    - For 4 players: all four corners
    - For 5+ players: distribute along edges

  - **Recommended: Option A** - More scalable and symmetric

- [ ] Implement position generation logic:
  ```javascript
  const generateTentPositions = (mapWidth, mapHeight, totalPlayers) => {
    const positions = []
    const centerX = mapWidth / 2
    const centerY = mapHeight / 2
    const radius = Math.min(mapWidth, mapHeight) * 0.4 // Stay away from edges

    // Human player at bottom (angle = -90 degrees = 3π/2)
    const humanAngle = 3 * Math.PI / 2
    positions.push({
      x: Math.floor(centerX + radius * Math.cos(humanAngle)),
      y: Math.floor(centerY + radius * Math.sin(humanAngle)),
      isHuman: true
    })

    // AI players distributed around the circle
    const aiCount = totalPlayers - 1
    const startAngle = Math.PI / 2 // Start at top
    const angleStep = (2 * Math.PI) / totalPlayers

    for (let i = 0; i < aiCount; i++) {
      const angle = startAngle + angleStep * i
      positions.push({
        x: Math.floor(centerX + radius * Math.cos(angle)),
        y: Math.floor(centerY + radius * Math.sin(angle)),
        isHuman: false,
        aiIndex: i
      })
    }

    return positions
  }
  ```

#### 4.2 Path Validation
- [ ] Update `testTentPositionPair()` to validate all pairs of positions
- [ ] Create `validateAllTentPositions()` that:
  - Takes array of N+1 positions
  - Tests pathfinding between ALL pairs (N*(N+1)/2 tests)
  - Returns true only if ALL pairs have valid paths
  - Optimization: Use minimum spanning tree approach - only need N paths to connect N+1 nodes

- [ ] Implement validation logic:
  ```javascript
  const validateAllTentPositions = async (positions) => {
    // We only need to verify that all positions are connected via paths
    // We can do this by checking if each position connects to position 0
    // If all connect to 0, then all are mutually connected
    const basePos = positions[0]

    for (let i = 1; i < positions.length; i++) {
      const result = await testTentPositionPair(
        basePos.x, basePos.y,
        positions[i].x, positions[i].y
      )

      if (!result.valid) {
        return false
      }
    }

    return true
  }
  ```

#### 4.3 Fallback Strategy
- [ ] If radial positions don't work naturally, try multiple candidate sets:
  - Increase/decrease radius
  - Rotate starting angle
  - Try different offset patterns

- [ ] If all natural attempts fail and carving is allowed:
  - Use radial positions as defaults
  - Carve paths from center to each tent position
  - Or carve star-pattern connecting all positions

#### 4.4 Update placeTents()
- [ ] Refactor `placeTents()` to:
  ```javascript
  const placeTents = async (allowCarving = true) => {
    const totalPlayers = 1 + gameState.settings.aiPlayerCount

    // Step 1: Generate candidate positions
    const positions = generateTentPositions(MAP_WIDTH, MAP_HEIGHT, totalPlayers)

    // Step 2: Validate all positions are connected
    const isValid = await validateAllTentPositions(positions)

    if (isValid) {
      // Place tents at validated positions
      const humanPos = positions.find(p => p.isHuman)
      gameState.humanPlayer.addBuilding(humanPos.x, humanPos.y, Building.TYPES.TENT)

      const aiPositions = positions.filter(p => !p.isHuman)
      aiPositions.forEach((pos, index) => {
        gameState.aiPlayers[index].addBuilding(pos.x, pos.y, Building.TYPES.TENT)
      })

      return true
    }

    // Step 3: Try carving if allowed
    if (allowCarving) {
      // Carve paths from center to all positions
      carveStarPatternPaths(positions)
      // Validate and place tents
      // ...
    }

    return false
  }
  ```

- [ ] Implement `carveStarPatternPaths()` helper:
  ```javascript
  const carveStarPatternPaths = (positions) => {
    const centerX = MAP_WIDTH / 2
    const centerY = MAP_HEIGHT / 2

    // Carve clearing at center
    carveClearing(centerX, centerY, 3)

    // Carve path from center to each tent position
    positions.forEach(pos => {
      carvePathBetweenPositions(centerX, centerY, pos.x, pos.y)
    })
  }
  ```

### 5. UI and Settings (js/menu.mjs, js/ui.mjs)

#### 5.1 Menu Settings
- [ ] Add "Number of AI Players" dropdown/slider to game menu
- [ ] Options: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10
- [ ] Update settings when changed
- [ ] Display current selection in menu

#### 5.2 In-Game UI
- [ ] Update resource display/minimap to show all AI players if needed
- [ ] Consider showing AI player colors in some indicator
- [ ] Optional: Show AI player status (alive/defeated) in corner or minimap

### 6. Rendering (js/renderer.mjs)

#### 6.1 Color Rendering
- [ ] Verify that units/buildings render with correct player colors
- [ ] Update any hardcoded red/cyan references to use `player.getColor()`
- [ ] Test that all AI player colors are visually distinct

#### 6.2 Minimap
- [ ] Verify minimap shows all AI players with their respective colors
- [ ] Ensure minimap remains readable with many players

### 7. Combat and Fog of War

#### 7.1 Combat
- [ ] Verify units correctly target all enemy players (not just one AI)
- [ ] Test that units don't attack their own player's units
- [ ] Verify AI players attack each other (not just human)

#### 7.2 Fog of War
- [ ] Current fog of war is only for human player - verify this is intentional
- [ ] Consider: Should each AI have its own fog of war? (Future enhancement)
- [ ] Ensure AI vision doesn't break with multiple AI players

### 8. Testing and Validation

#### 8.1 Unit Tests
- [ ] Test `getEnemies()` with 2, 3, 5, 10 players
- [ ] Test color assignment for each player index
- [ ] Test tent position generation for various player counts
- [ ] Test path validation for multi-player configurations

#### 8.2 Integration Tests
- [ ] Test game initialization with 1-10 AI players
- [ ] Test map generation succeeds for various player counts and map sizes
- [ ] Test game loop with multiple AI players
- [ ] Test win condition with multiple AI players being eliminated sequentially

#### 8.3 Manual Testing
- [ ] Start game with 2 AI players - verify both have different colors
- [ ] Start game with 5 AI players - verify they are spread around map
- [ ] Play game and verify AI players attack each other
- [ ] Verify game ends only when ALL AI players are defeated
- [ ] Test with maximum (10) AI players on different map sizes

### 9. Performance Optimization

#### 9.1 Game Loop
- [ ] Profile game loop performance with 10 AI players
- [ ] Optimize AI update loops if needed
- [ ] Consider throttling AI decision-making frequency for many players

#### 9.2 Pathfinding
- [ ] Monitor pathfinding performance with many units from many players
- [ ] Ensure pathfinding cache works efficiently with multiple AI

#### 9.3 Rendering
- [ ] Profile rendering with many players' units/buildings
- [ ] Optimize sprite rendering if needed

---

## Implementation Order

### Phase 1: Core Infrastructure (Prerequisite for everything)
1. State management: Add `aiPlayerCount` setting
2. Player module: Add `playerId` and `playerIndex` properties
3. Player module: Implement color palette and update `getColor()`
4. Player module: Update `getEnemies()` to handle multiple opponents

### Phase 2: Game Initialization
5. Game logic: Update player creation to support multiple AI
6. UI: Add AI player count setting to menu

### Phase 3: Map Generation (Most Complex)
7. Map generation: Implement `generateTentPositions()` with radial distribution
8. Map generation: Implement `validateAllTentPositions()`
9. Map generation: Update `placeTents()` to handle N+1 positions
10. Map generation: Implement `carveStarPatternPaths()` fallback

### Phase 4: Testing and Polish
11. Test with 2-10 AI players
12. Verify combat, win conditions, and rendering
13. Performance optimization if needed
14. Update documentation

---

## Technical Considerations

### Color Palette Suggestions
```javascript
const AI_COLORS = [
  'red',      // AI 0
  'orange',   // AI 1
  'purple',   // AI 2
  'pink',     // AI 3
  'yellow',   // AI 4
  'brown',    // AI 5
  'magenta',  // AI 6
  'lime',     // AI 7
  'teal',     // AI 8
  'indigo'    // AI 9
]
```

### Minimum Distances Between Tents
- Ensure tents are placed far enough apart
- Minimum distance: `Math.max(MAP_WIDTH, MAP_HEIGHT) * 0.3`
- This prevents players from starting too close together

### Map Size Considerations
- Small maps (50x50): Limit to 2-3 AI players
- Medium maps (100x100): Support up to 5 AI players
- Large maps (200x200): Support up to 8 AI players
- Huge maps (300x300): Support full 10 AI players
- Add validation to prevent too many players on small maps

### AI Behavior with Multiple Opponents
- Current AI logic should work - `getEnemies()` returns all enemies
- AI may become more challenging as they gang up on human player
- Consider: Should AI players form temporary alliances? (Future enhancement)

---

## Future Enhancements (Not in Initial Scope)

- [ ] AI alliances and diplomacy
- [ ] Teams (e.g., 2v2, 3v3)
- [ ] Individual fog of war for each AI player
- [ ] Spectator mode showing all AI players
- [ ] AI difficulty per player (e.g., 1 hard AI + 2 easy AI)
- [ ] Dynamic player elimination notifications
- [ ] Leaderboard showing player standings during game
- [ ] Configurable starting positions (manual placement)
