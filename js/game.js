export { TERRAIN_TYPES, ZOOM, gameLoop, initGame, updateSprite }

'use strict'

import { Building } from 'building'
import { getMapDimensions, getTileSize } from 'dimensions'
import { renderFog, updateVisibility } from 'fogOfWar'
import { drawBack, isDrawBackRequested } from 'globals'
import { updateAllParticles } from 'particles'
import { clearPathCache, searchPath, updateMapDimensionsInWorker, updateMapInWorker } from 'pathfinding'
import { Player, PlayerType } from 'players'
import { drawBackground, drawMain } from 'renderer'
import { offscreenSprite, sprites } from 'sprites'
import gameState from 'state'
import { handleMouseInteraction, updateUI, showModal } from 'ui'
import { PerlinNoise } from 'utils'

// Zoom configuration
const ZOOM = {
  FACTOR: 1.1,
  MAX: 1.4,
  MIN: 1,
  current: 1
}

const TERRAIN_TYPES = {
  WATER: { type: 'WATER', weight: 5, spriteRange: { x: [0, 0], y: [17, 17] } },
  ROCK: { type: 'ROCK', weight: getMapDimensions().maxWeight, spriteRange: { x: [0], y: [26] } },
  GOLD: { type: 'GOLD', weight: getMapDimensions().maxWeight, spriteRange: { x: [1], y: [26] } },
  TREE: { type: 'TREE', weight: 1024, spriteRange: { x: [2, 3], y: [26, 27] } },
  DEPLETED_TREE: { type: 'DEPLETED_TREE', weight: 2.5, spriteRange: { x: [1], y: [27] } },
  GRASS: { type: 'GRASS', weight: 1, spriteRange: { x: [0, 2], y: [0, 2] } },
  SAND: { type: 'SAND', weight: 1.75, spriteRange: { x: [3, 3], y: [3, 3] } },
  BUILDING: { type: 'BUILDING', weight: Building.WEIGHT }
}

// Game timing variables
let elapsed = -5000
let elapsedBack = -5000
let fps = new Array(100).fill(50)
let delays = new Array(100).fill(50)

// Initialize the game
const initGame = async () => {
  // Create players
  new Player(PlayerType.HUMAN)
  new Player(PlayerType.AI)
  
  // Generate map until we get a valid one
  let i = 0
  let isMapCorrect = true
  updateMapDimensionsInWorker()
  do {
    if(!isMapCorrect) gameState.mapSeed = null
    await generateMap()
    isMapCorrect = await placeTents()
  } while(!isMapCorrect && ++i < 150)

  updateMapInWorker() // Initial map update
  await assignSpritesOnMap()

  elapsedBack = elapsed = performance.now()

  return isMapCorrect
}

let lastMapUpdateTime = 0

/**
 * Generate the game map using Perlin noise
 * Creates a natural-looking terrain with water, rocks, trees, grass, and sand.
 * The map is stored in the global game state and contains:
 * - Terrain type
 * - Movement cost (weight)
 * - Resource information for harvestable tiles
 * 
 * TODO: needs to add gold
 * 
 * @returns {Promise<void>}
 */
const generateMap = async () => {
  // Clean the pathfinding algorithm
  clearPathCache()

  // Get map dimensions
  const { width: MAP_WIDTH, height: MAP_HEIGHT, maxWeight: MAX_WEIGHT } = getMapDimensions()

  // Create the map structure
  gameState.map = new Array(MAP_WIDTH).fill(null).map(() => new Array(MAP_HEIGHT).fill(null))
  gameState.mapSeed  = gameState.mapSeed ?? Math.floor(Math.random() * 10000)

  const noise = new PerlinNoise(gameState.mapSeed)

  const NOISE_SCALE = 0.08; // Controls terrain smoothness
  const TERRAIN_THRESHOLD = {
    WATER: 0.33,
    ROCK: 0.34,
    TREE_NEXT_TO_WATER: 0.35,
    GRASS_NEXT_TO_WATER: 0.45,
    SAND: 0.5,
    GRASS: 0.56,
    GOLD: 0.8,
    TREE: 1,
  }

  for (let x = 0; x < MAP_WIDTH; x++) {
    for (let y = 0; y < MAP_HEIGHT; y++) {
        const noiseValue = (noise.noise(x * NOISE_SCALE, y * NOISE_SCALE) + 1) / 2
        
        let terrainType = TERRAIN_TYPES.GRASS

        if (noiseValue < TERRAIN_THRESHOLD.WATER) terrainType = TERRAIN_TYPES.WATER
        else if (noiseValue < TERRAIN_THRESHOLD.ROCK) terrainType = TERRAIN_TYPES.ROCK
        else if (noiseValue < TERRAIN_THRESHOLD.TREE_NEXT_TO_WATER) terrainType = TERRAIN_TYPES.TREE
        else if (noiseValue < TERRAIN_THRESHOLD.GRASS_NEXT_TO_WATER) terrainType = TERRAIN_TYPES.GRASS
        else if (noiseValue < TERRAIN_THRESHOLD.SAND) terrainType = TERRAIN_TYPES.SAND
        else if (noiseValue < TERRAIN_THRESHOLD.GRASS) terrainType = TERRAIN_TYPES.GRASS
        else if (noiseValue < TERRAIN_THRESHOLD.TREE) terrainType = TERRAIN_TYPES.TREE

        if (terrainType.type === 'GRASS') {  // Only place on grass to avoid confusion with actual sand
          // Use a different offset and scale for secondary noise to get different distribution
          const goldNoise = (noise.noise((x + 500) * NOISE_SCALE * 3, (y + 500) * NOISE_SCALE * 3) + 1) / 2
          
          // Only place gold if secondary noise is above threshold (making it rare)
          if (goldNoise > TERRAIN_THRESHOLD.GOLD) {
            terrainType = TERRAIN_TYPES.GOLD
          }
        }

        if (terrainType.type === 'TREE') {
          gameState.map[x][y] = {
            uid: y * MAP_WIDTH + x,
            type: terrainType.type,
            weight: terrainType.weight,
            lifeRemaining: 50 // Each tree can produce 50 wood
          }
        } else {
          gameState.map[x][y] = {
            uid: y * MAP_WIDTH + x,
            type: terrainType.type,
            weight: terrainType.weight,
          }
        }
        
      }
  }
}

/**
 * Place starting tents for human and AI players
 * Creates bases at opposite sides of the map (human at bottom, AI at top).
 * Ensures there's a valid path between bases and clears terrain around them.
 * 
 * @returns {boolean} True if tents were successfully placed with a valid path between them
 */
const placeTents = async () => {
  const { width: MAP_WIDTH, height: MAP_HEIGHT } = getMapDimensions()
  
  // Find suitable locations for tents
  const humanY = MAP_HEIGHT * 19 / 20 // Near bottom for player
  const aiY = MAP_HEIGHT / 20 // Near top for AI

  const centerX = MAP_WIDTH / 2


  for (let x = centerX - 2; x <= centerX + 2; x++) {
    for (let y = -2; y <= 2; y++) {
      if(
        (x === centerX - 2 && y === -2)
        || (x === centerX - 2 && y === 2)
        || (x === centerX + 2 && y === -2)
        || (x === centerX + 2 && y === 2)
      ) continue

      // Clean the zone around human tent
      gameState.map[x][humanY + y] = {
        uid: (humanY + y) * MAP_WIDTH + x,
        type: TERRAIN_TYPES.GRASS.type,
        weight: TERRAIN_TYPES.GRASS.weight
      }

      // Clean the zone around AI tent
      gameState.map[x][aiY + y] = {
        uid: (aiY + y) * MAP_WIDTH + x,
        type: TERRAIN_TYPES.GRASS.type,
        weight: TERRAIN_TYPES.GRASS.weight
      }
    }
  }

  updateMapInWorker()
  const path = await searchPath(centerX, humanY, centerX, aiY)
  const weight = path?.reduce((p, c) => p + c.weight, 0)

  if(path?.length && weight < 3 * (MAP_WIDTH + MAP_HEIGHT)) {
    console.log('Path between the 2 tents:', path, weight)

    // Create actual tent buildings
    gameState.humanPlayer.addBuilding(centerX, humanY, Building.TYPES.TENT)
    gameState.aiPlayers[0].addBuilding(centerX, aiY, Building.TYPES.TENT)

    return true
  }

  return false
}

// Assign sprites to map tiles
/**
 * Determines the correct sand sprite based on neighboring tiles.
 * @param {number} x - The x-coordinate of the current tile.
 * @param {number} y - The y-coordinate of the current tile.
 * @param {Array<Array<object>>} map - The game map.
 * @param {number} MAP_WIDTH - The width of the map.
 * @param {number} MAP_HEIGHT - The height of the map.
 * @returns {{spriteX: number, spriteY: number}} The x and y coordinates of the appropriate sand sprite.
 */
const getSandSpriteCoordinates = (x, y, map, MAP_WIDTH, MAP_HEIGHT) => {
  // Base sprite for sand (isolated or full sand)
  let spriteX = 3
  let spriteY = 3

  // Check neighbors
  const isSand = (nx, ny) => {
    if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT) return true
    return map[nx][ny].type === TERRAIN_TYPES.SAND.type
  }

  const N = isSand(x, y - 1)
  const S = isSand(x, y + 1)
  const E = isSand(x + 1, y)
  const W = isSand(x - 1, y)
  const NE = isSand(x + 1, y - 1)
  const NW = isSand(x - 1, y - 1)
  const SE = isSand(x + 1, y + 1)
  const SW = isSand(x - 1, y + 1)

  // Default to isolated sand (3,3)
  spriteX = 3
  spriteY = 3

  // 1. Fully connected (all 8 neighbors)
  if (N && S && E && W && NE && NW && SE && SW) {
    spriteX = 11; spriteY = 1 // User-specified center tile for all 8 neighbors
  }
  // 2. Inner corners (cardinal neighbors present, but a diagonal is missing)
  else if (N && S && E && W && NW && SW && SE && !NE) {
    spriteX = 14; spriteY = 0 // Missing NE diagonal
  }
  else if (N && S && E && W && NE && SE && SW && !NW) {
    spriteX = 13; spriteY = 0 // Missing NW diagonal
  }
  else if (N && S && E && W && NE && NW && SW && !SE) {
    spriteX = 14; spriteY = 1 // Missing SE diagonal
  }
  else if (N && S && E && W && NE && NW && SE && !SW) {
    spriteX = 13; spriteY = 1 // Missing SW diagonal
  }
  // Missing 2 diagonals only
  else if (N && S && E && W && NE && SW && !NW && !SE) {
    spriteX = 14; spriteY = 2 // Missing NW && SE diagonal
  }
  else if (N && S && E && W && NW && SE && !NE && !SW) {
    spriteX = 13; spriteY = 2 // Missing NE && SW diagonal
  }
  else if (N && S && E && W && NE && NW && !SW && !SE) {
    spriteX = 8; spriteY = 2
  }
  else if (N && S && E && W && NW && SW && !NE && !SE) {
    spriteX = 9; spriteY = 1
  }
  else if (N && S && E && W && SE && SW && !NW && !NE) {
    spriteX = 8; spriteY = 0
  }
  else if (N && S && E && W && NE && SE && !NW && !SW) {
    spriteX = 7; spriteY = 1
  }

  // 3. Outer corners (L-shape with diagonal)
  else if (N && E && NE && !S && !W) {
    spriteX = 10; spriteY = 2 // N, E, NE
  }
  else if (N && W && NW && !S && !E) {
    spriteX = 12; spriteY = 2 // N, W, NW
  }
  else if (S && E && SE && !N && !W) {
    spriteX = 10; spriteY = 0 // S, E, SE
  }
  else if (S && W && SW && !N && !E) {
    spriteX = 12; spriteY = 0 // S, W, SW
  }
  // 4. All 4 cardinal neighbors
  else if (N && S && E && W) {
    spriteX = 5; spriteY = 1 // All cardinal neighbors
  }
  // 5. T-intersections (3 cardinal neighbors)
  else if (N && S && E && NE && SE && !W) {
    spriteX = 10; spriteY = 1 // N, S, E, NE, NW
  }
  else if (E && S && W && SE && SW && !N) {
    spriteX = 11; spriteY = 0 // E, S, W, SE, SW
  }
  else if (N && S && W && NW && SW && !E) {
    spriteX = 12; spriteY = 1 // N, S, W, NW, SW
  }
  else if (N && E && W && NE && NW && !S) {
    spriteX = 11; spriteY = 2 // N, E, W, NE, NW
  }
  else if (N && S && E && !W) {
    spriteX = 4; spriteY = 1 // N, S, E
  }
  else if (E && S && W && !N) {
    spriteX = 5; spriteY = 0 // E, S, W
  }
  else if (N && S && W && !E) {
    spriteX = 6; spriteY = 1 // N, S, W
  }
  else if (N && E && W && !S) {
    spriteX = 5; spriteY = 2 // N, E, W
  }
  // 6. Corners (2 cardinal neighbors)
  else if (S && E && !N && !W) {
    spriteX = 4; spriteY = 0 // S, E corner
  }
  else if (S && W && !N && !E) {
    spriteX = 6; spriteY = 0 // S, W corner
  }
  else if (N && E && !S && !W) {
    spriteX = 4; spriteY = 2 // N, E corner
  }
  else if (N && W && !S && !E) {
    spriteX = 6; spriteY = 2 // N, W corner
  }
  // 7. Side connections
  else if (W && E && !N && !S) {
    spriteX = 5; spriteY = 3 // Horizontal
  }
  else if (N && S && !W && !E) {
    spriteX = 3; spriteY = 1 // Vertical
  }
  // 8. Edges (single connections)
  else if (N && !S && !E && !W) {
    spriteX = 3; spriteY = 2 // Only N
  }
  else if (S && !N && !E && !W) {
    spriteX = 3; spriteY = 0 // Only S
  }
  else if (E && !N && !S && !W) {
    spriteX = 4; spriteY = 3 // Only E
  }
  else if (W && !N && !S && !E) {
    spriteX = 6; spriteY = 3 // Only W
  }
  // 9. Isolated tile (no sand neighbors) - Default is already (3,3)

  return { spriteX, spriteY }
}

/**
 * Determines the correct water sprite based on neighboring tiles.
 * @param {number} x - The x-coordinate of the current tile.
 * @param {number} y - The y-coordinate of the current tile.
 * @param {Array<Array<object>>} map - The game map.
 * @param {number} MAP_WIDTH - The width of the map.
 * @param {number} MAP_HEIGHT - The height of the map.
 * @returns {{spriteX: number, spriteY: number}} The x and y coordinates of the appropriate water sprite.
 */
const getWaterSpriteCoordinates = (x, y, map, MAP_WIDTH, MAP_HEIGHT) => {
  // Base sprite for water (isolated or full water)
  let spriteX = 3
  let spriteY = 3

  // Check neighbors
  const isWater = (nx, ny) => {
    if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT) return true
    return map[nx][ny].type === TERRAIN_TYPES.WATER.type
  }

  const N = isWater(x, y - 1)
  const S = isWater(x, y + 1)
  const E = isWater(x + 1, y)
  const W = isWater(x - 1, y)
  const NE = isWater(x + 1, y - 1)
  const NW = isWater(x - 1, y - 1)
  const SE = isWater(x + 1, y + 1)
  const SW = isWater(x - 1, y + 1)

  // Default to isolated water (3,3) relative to water tileset
  spriteX = 3
  spriteY = 3

  // 1. Fully connected (all 8 neighbors)
  if (N && S && E && W && NE && NW && SE && SW) {
    spriteX = 11; spriteY = 1
  }
  // 2. Inner corners (cardinal neighbors present, but a diagonal is missing)
  else if (N && S && E && W && NW && SW && SE && !NE) {
    spriteX = 14; spriteY = 0
  }
  else if (N && S && E && W && NE && SE && SW && !NW) {
    spriteX = 13; spriteY = 0
  }
  else if (N && S && E && W && NE && NW && SW && !SE) {
    spriteX = 14; spriteY = 1
  }
  else if (N && S && E && W && NE && NW && SE && !SW) {
    spriteX = 13; spriteY = 1
  }
  // Missing 2 diagonals only
  else if (N && S && E && W && NE && SW && !NW && !SE) {
    spriteX = 14; spriteY = 2
  }
  else if (N && S && E && W && NW && SE && !NE && !SW) {
    spriteX = 13; spriteY = 2
  }
  else if (N && S && E && W && NE && NW && !SW && !SE) {
    spriteX = 8; spriteY = 2
  }
  else if (N && S && E && W && NW && SW && !NE && !SE) {
    spriteX = 9; spriteY = 1
  }
  else if (N && S && E && W && SE && SW && !NW && !NE) {
    spriteX = 8; spriteY = 0
  }
  else if (N && S && E && W && NE && SE && !NW && !SW) {
    spriteX = 7; spriteY = 1
  }

  // 3. Outer corners (L-shape with diagonal)
  else if (N && E && NE && !S && !W) {
    spriteX = 10; spriteY = 2
  }
  else if (N && W && NW && !S && !E) {
    spriteX = 12; spriteY = 2
  }
  else if (S && E && SE && !N && !W) {
    spriteX = 10; spriteY = 0
  }
  else if (S && W && SW && !N && !E) {
    spriteX = 12; spriteY = 0
  }
  // 4. All 4 cardinal neighbors
  else if (N && S && E && W) {
    spriteX = 5; spriteY = 1
  }
  // 5. T-intersections (3 cardinal neighbors)
  else if (N && S && E && NE && SE && !W) {
    spriteX = 10; spriteY = 1
  }
  else if (E && S && W && SE && SW && !N) {
    spriteX = 11; spriteY = 0
  }
  else if (N && S && W && NW && SW && !E) {
    spriteX = 12; spriteY = 1
  }
  else if (N && E && W && NE && NW && !S) {
    spriteX = 11; spriteY = 2
  }
  else if (N && S && E && !W) {
    spriteX = 4; spriteY = 1
  }
  else if (E && S && W && !N) {
    spriteX = 5; spriteY = 0
  }
  else if (N && S && W && !E) {
    spriteX = 6; spriteY = 1
  }
  else if (N && E && W && !S) {
    spriteX = 5; spriteY = 2
  }
  // 6. Corners (2 cardinal neighbors)
  else if (S && E && !N && !W) {
    spriteX = 4; spriteY = 0
  }
  else if (S && W && !N && !E) {
    spriteX = 6; spriteY = 0
  }
  else if (N && E && !S && !W) {
    spriteX = 4; spriteY = 2
  }
  else if (N && W && !S && !E) {
    spriteX = 6; spriteY = 2
  }
  // 7. Side connections
  else if (W && E && !N && !S) {
    spriteX = 5; spriteY = 3
  }
  else if (N && S && !W && !E) {
    spriteX = 3; spriteY = 1
  }
  // 8. Edges (single connections)
  else if (N && !S && !E && !W) {
    spriteX = 3; spriteY = 2
  }
  else if (S && !N && !E && !W) {
    spriteX = 3; spriteY = 0
  }
  else if (E && !N && !S && !W) {
    spriteX = 4; spriteY = 3
  }
  else if (W && !N && !S && !E) {
    spriteX = 6; spriteY = 3
  }
  // 9. Isolated tile (no water neighbors) - Default is already (3,3)

  // Apply the offset (x-3, y+10)
  spriteX = spriteX - 3;
  spriteY = spriteY + 10;

  return { spriteX, spriteY }
}

// Assign sprites to map tiles
const assignSpritesOnMap = async () => {

  const { width: MAP_WIDTH, height: MAP_HEIGHT, maxWeight: MAX_WEIGHT } = getMapDimensions()
  const SPRITE_SIZE = getTileSize()

  for (let x = 0; x < MAP_WIDTH; x++) {
    for (let y = 0; y < MAP_HEIGHT; y++) {
      const terrainType = TERRAIN_TYPES[gameState.map[x][y].type]
      const grassSprite =
        sprites[
          Math.floor(Math.random() * (TERRAIN_TYPES.GRASS.spriteRange.x[1] - TERRAIN_TYPES.GRASS.spriteRange.x[0] + 1)) +
            TERRAIN_TYPES.GRASS.spriteRange.x[0]
        ][
          Math.floor(Math.random() * (TERRAIN_TYPES.GRASS.spriteRange.y[1] - TERRAIN_TYPES.GRASS.spriteRange.y[0] + 1)) +
            TERRAIN_TYPES.GRASS.spriteRange.y[0]
        ]
      let spriteX, spriteY
      switch (gameState.map[x][y].type) {
        case TERRAIN_TYPES.GRASS.type:
          spriteX = Math.floor(Math.random() * 
              (terrainType.spriteRange.x[1] - terrainType.spriteRange.x[0] + 1)) + 
              terrainType.spriteRange.x[0]
          spriteY = Math.floor(Math.random() * 
              (terrainType.spriteRange.y[1] - terrainType.spriteRange.y[0] + 1)) + 
              terrainType.spriteRange.y[0]
          gameState.map[x][y].sprite = offscreenSprite(sprites[spriteX][spriteY], SPRITE_SIZE)
          break
        case TERRAIN_TYPES.TREE.type:
          spriteX = Math.floor(Math.random() * 
              (terrainType.spriteRange.x[1] - terrainType.spriteRange.x[0] + 1)) + 
              terrainType.spriteRange.x[0]
          spriteY = Math.floor(Math.random() * 
              (terrainType.spriteRange.y[1] - terrainType.spriteRange.y[0] + 1)) + 
              terrainType.spriteRange.y[0]
          gameState.map[x][y].sprite = offscreenSprite(sprites[spriteX][spriteY], SPRITE_SIZE)
          gameState.map[x][y].back = offscreenSprite(grassSprite, SPRITE_SIZE)
          break
        case TERRAIN_TYPES.ROCK.type:
          spriteX = terrainType.spriteRange.x[0]
          spriteY = terrainType.spriteRange.y[0]
          gameState.map[x][y].sprite = offscreenSprite(sprites[spriteX][spriteY], SPRITE_SIZE)
          gameState.map[x][y].back = offscreenSprite(grassSprite, SPRITE_SIZE)
          break
        case TERRAIN_TYPES.GOLD.type:
          spriteX = terrainType.spriteRange.x[0]
          spriteY = terrainType.spriteRange.y[0]
          const goldRawCanvas = offscreenSprite(sprites[spriteX][spriteY], SPRITE_SIZE, 'gold_raw')
          goldRawCanvas.getContext('2d').globalCompositeOperation = 'source-atop'
          goldRawCanvas.getContext('2d').fillStyle = 'rgba(255, 215, 0, 0.5)' // Gold color with 50% opacity
          goldRawCanvas.getContext('2d').fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE)
          const goldSpriteData = goldRawCanvas.getContext('2d').getImageData(0, 0, SPRITE_SIZE, SPRITE_SIZE)
          gameState.map[x][y].sprite = offscreenSprite(goldSpriteData, SPRITE_SIZE, 'gold')
          gameState.map[x][y].back = offscreenSprite(grassSprite, SPRITE_SIZE)
          break
        case TERRAIN_TYPES.SAND.type:
          const { spriteX: sandSpriteX, spriteY: sandSpriteY } = getSandSpriteCoordinates(x, y, gameState.map, MAP_WIDTH, MAP_HEIGHT)
          gameState.map[x][y].sprite = offscreenSprite(sprites[sandSpriteX][sandSpriteY], SPRITE_SIZE)
          break
        case TERRAIN_TYPES.WATER.type:
          const { spriteX: waterSpriteX, spriteY: waterSpriteY } = getWaterSpriteCoordinates(x, y, gameState.map, MAP_WIDTH, MAP_HEIGHT)
          gameState.map[x][y].sprite = offscreenSprite(sprites[waterSpriteX][waterSpriteY], SPRITE_SIZE)
          break
        default:
          gameState.map[x][y].back = offscreenSprite(grassSprite, SPRITE_SIZE)
          break
      }
    }
  }
}

// Update the sprite on the map at specified coords
const updateSprite = async (x, y) => {
  const terrainType = TERRAIN_TYPES[gameState.map[x][y].type]
  let spriteX, spriteY
  switch (gameState.map[x][y].type) {
    case TERRAIN_TYPES.DEPLETED_TREE.type:
      spriteX = terrainType.spriteRange.x[0]
      spriteY = terrainType.spriteRange.y[0]
      gameState.map[x][y].sprite = offscreenSprite(sprites[spriteX][spriteY], getTileSize())
      break
    case TERRAIN_TYPES.GRASS.type:
    case TERRAIN_TYPES.TREE.type:
    case TERRAIN_TYPES.ROCK.type:
    case TERRAIN_TYPES.SAND.type:
    case TERRAIN_TYPES.WATER.type:
    default:
      break
  }

  drawBack()
} 

// Main game loop
const gameLoop = async () => {
  const now = performance.now()
  const delay = now - elapsed | 0
  elapsed = now

  if(gameState.gameStatus === 'paused') {
    requestAnimationFrame(gameLoop)
    return
  }

  if(['menu', 'initialize', 'gameOver', 'win'].includes(gameState.gameStatus)) {
    return // Stop the game loop
  }

  // Handle keyboard movement
  gameState.UI?.mouse?.applyKeyboardMovement(delay)
  // Handle drag momentum
  gameState.UI?.mouse?.applyDragMomentum(delay)

  // Handle mouse interaction
  handleMouseInteraction(gameState.map, gameState.humanPlayer)

  // Background rendering
  if(isDrawBackRequested() && now - elapsedBack > 40 || now - elapsedBack > 400) {
    elapsedBack = now
    drawBackground(gameState.map)
  }
  
  // Track FPS
  if(gameState.debug) {
    fps.push(delay)
    fps.shift()
  }
  
  
  // Update players and units
  const timingStart = performance.now()
  if(gameState.humanPlayer) await gameState.humanPlayer.update(delay, gameState.map)
  const timing = performance.now() - timingStart

  // Check for game over condition
  if (gameState.humanPlayer.getTents().length === 0) {
    showModal('Game Over', 'Your main building has been destroyed !', 'gameOver', 'menu', () => {})
    return // Stop the game loop
  }
  
  // Update AI players
  await Promise.all(gameState.aiPlayers.map(async ai => {
    await ai.update(delay, gameState.map)
  }))

  // Check for win condition
  if (!gameState.aiPlayers.some(ai => ai.getTents().length)) {
    showModal('You Win !', 'You destroyed your opponent\'s main building ! Congrats !', 'win', 'menu', () => {})
    return // Stop the game loop
  }

  // Update particles
  updateAllParticles(delay)
  
  // Update fog of war
  if (gameState.settings.fogOfWar) {
    updateVisibility(delay)
  }
  
  // Render game
  drawMain(gameState.humanPlayer, gameState.aiPlayers)
  
  // Render fog of war
  if (gameState.settings.fogOfWar) {
    renderFog(delay)
  }

  // Render UI
  updateUI(fps)
  
  
  requestAnimationFrame(gameLoop)

  // Update map in worker periodically
  if (now - lastMapUpdateTime > 2500) {
    updateMapInWorker()
    lastMapUpdateTime = now
  }

  if(gameState.debug && Math.random() > 0.9975) console.log(`Mean Game Loop Time: ${fps.reduce((a, b) => a + b, 0) / fps.length} ms`)


  if(gameState.debug) {
    delays.push(timing)
    delays.shift()
    if(Math.random() > 0.993) console.log(`Human Player Updating took: ${delays.reduce((a, b) => a + b, 0) / delays.length} ms`)
  }
}

