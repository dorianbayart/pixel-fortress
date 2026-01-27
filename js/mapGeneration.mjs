/*
 * Pixel Fortress - A 2D real-time strategy game
 * Copyright (C) 2026 Dorian Bayart
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Map Generation Module
 *
 * Pure map generation logic without rendering dependencies.
 * This module handles terrain generation, pathfinding validation,
 * and tent placement logic.
 */

export {
  generateMap,
  testTentPositionPair,
  findValidTentPositions,
  carveClearing,
  carvePathBetweenPositions,
  checkNearbyTerrain,
  placeTents,
  getSandSpriteCoordinates,
  getWaterSpriteCoordinates
}

'use strict'

import { Building } from 'building'
import CONSTANTS from 'constants'
import { getMapDimensions } from 'dimensions'
import { clearPathCache, searchPath, updateMapInWorker } from 'pathfinding'
import gameState from 'state'
import { PerlinNoise } from 'utils'

// Terrain type definitions (imported from centralized constants)
const TERRAIN_TYPES = CONSTANTS.TERRAIN.TYPES

/**
 * Generate the game map using Perlin noise
 * Creates terrain with water, rocks, trees, grass, sand, and gold
 */
const generateMap = async () => {
  // Clean the pathfinding algorithm
  clearPathCache()

  // Get map dimensions
  const { width: MAP_WIDTH, height: MAP_HEIGHT, maxWeight: MAX_WEIGHT } = getMapDimensions()

  // Create the map structure
  gameState.map = new Array(MAP_WIDTH).fill(null).map(() => new Array(MAP_HEIGHT).fill(null))
  gameState.mapSeed  = gameState.mapSeed ?? Math.floor(Math.random() * (CONSTANTS.SEED.MAX + 1))

  const noise = new PerlinNoise(gameState.mapSeed)

  const NOISE_SCALE = CONSTANTS.TERRAIN.NOISE_SCALE
  const TERRAIN_THRESHOLD = CONSTANTS.TERRAIN.THRESHOLD

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
            resource: Math.floor(Math.random() * 15) + 25 // 25-40 resources
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
 * Test if two tent positions have a valid path between them
 * @param {number} x1 - First position X
 * @param {number} y1 - First position Y
 * @param {number} x2 - Second position X
 * @param {number} y2 - Second position Y
 * @returns {Promise<{valid: boolean, path: Array, weight: number, pathLength: number}>}
 */
const testTentPositionPair = async (x1, y1, x2, y2) => {
  const { width: MAP_WIDTH, height: MAP_HEIGHT } = getMapDimensions()

  // Search for path (test natural terrain without modifications)
  const path = await searchPath(x1, y1, x2, y2)
  const pathLength = path?.length || 0
  const weight = path?.reduce((p, c) => p + c.weight, 0) || Infinity
  const maxWeight = 3 * (MAP_WIDTH + MAP_HEIGHT)

  return {
    valid: pathLength > 0 && weight < maxWeight,
    path,
    weight,
    pathLength
  }
}

/**
 * Find valid tent positions by trying multiple candidate locations
 * Tests all combinations and returns the one with the longest valid path
 * @returns {Promise<{humanX: number, humanY: number, aiX: number, aiY: number, pathLength: number} | null>}
 */
const findValidTentPositions = async () => {
  const { width: MAP_WIDTH, height: MAP_HEIGHT } = getMapDimensions()

  // Fixed Y positions using the original ratios
  const humanY = Math.floor(MAP_HEIGHT * 19 / 20)
  const aiY = Math.floor(MAP_HEIGHT / 20)

  // X positions to try (center, left quarter, right quarter, far left, far right)
  const xPositions = [
    Math.floor(MAP_WIDTH / 2),           // Center
    Math.floor(MAP_WIDTH / 4),           // Left quarter
    Math.floor(MAP_WIDTH * 3 / 4),       // Right quarter
    Math.floor(MAP_WIDTH / 5),           // Far left
    Math.floor(MAP_WIDTH * 4 / 5),       // Far right
  ]

  // Generate all combinations of positions
  const candidates = []
  for (const humanX of xPositions) {
    for (const aiX of xPositions) {
      candidates.push({ humanX, humanY, aiX, aiY })
    }
  }

  console.log(`findValidTentPositions: Testing ${candidates.length} candidate position combinations...`)

  // Update pathfinding worker once before testing
  updateMapInWorker()

  let bestCandidate = null
  let longestPathLength = 0

  // Test all candidates and keep track of the best one (longest path)
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i]
    const { humanX, humanY, aiX, aiY } = candidate
    console.log(`[${i + 1}/${candidates.length}] Testing: Human(${humanX}, ${humanY}) vs AI(${aiX}, ${aiY})`)

    const result = await testTentPositionPair(humanX, humanY, aiX, aiY)

    if (result.valid) {
      console.log(`  ✓ Valid path! Length: ${result.pathLength}, Weight: ${result.weight}`)

      // Keep the candidate with the longest path
      if (result.pathLength > longestPathLength) {
        longestPathLength = result.pathLength
        bestCandidate = {
          humanX,
          humanY,
          aiX,
          aiY,
          pathLength: result.pathLength,
          pathWeight: result.weight
        }
        console.log(`  → NEW BEST! This is now the longest path found`)
      } else {
        console.log(`  → Not better than current best (${longestPathLength})`)
      }
    } else {
      console.log(`  ✗ Invalid - no path or path too long`)
    }
  }

  if (bestCandidate) {
    console.log(`\n✓✓✓ BEST POSITIONS SELECTED ✓✓✓`)
    console.log(`  Human: (${bestCandidate.humanX}, ${bestCandidate.humanY})`)
    console.log(`  AI: (${bestCandidate.aiX}, ${bestCandidate.aiY})`)
    console.log(`  Path Length: ${bestCandidate.pathLength}`)
    console.log(`  Path Weight: ${bestCandidate.pathWeight}`)
    return bestCandidate
  }

  console.log('No naturally valid tent positions found in any combination')
  return null
}

/**
 * Carve a small clearing at a position
 * @param {number} centerX - Center X
 * @param {number} centerY - Center Y
 * @param {number} radius - Radius of clearing
 */
const carveClearing = (centerX, centerY, radius = 2) => {
  const { width: MAP_WIDTH, height: MAP_HEIGHT } = getMapDimensions()

  for (let offsetX = -radius; offsetX <= radius; offsetX++) {
    for (let offsetY = -radius; offsetY <= radius; offsetY++) {
      const carveX = centerX + offsetX
      const carveY = centerY + offsetY

      // Check bounds
      if (carveX < 0 || carveX >= MAP_WIDTH || carveY < 0 || carveY >= MAP_HEIGHT) {
        continue
      }

      const tile = gameState.map[carveX][carveY]

      // Only carve through obstacles
      if (tile.type === TERRAIN_TYPES.WATER.type ||
          tile.type === TERRAIN_TYPES.ROCK.type ||
          tile.type === TERRAIN_TYPES.TREE.type) {

        const isNearWater = checkNearbyTerrain(carveX, carveY, TERRAIN_TYPES.WATER.type)

        gameState.map[carveX][carveY] = {
          uid: carveY * MAP_WIDTH + carveX,
          type: isNearWater ? TERRAIN_TYPES.SAND.type : TERRAIN_TYPES.GRASS.type,
          weight: isNearWater ? TERRAIN_TYPES.SAND.weight : TERRAIN_TYPES.GRASS.weight
        }
      }
    }
  }
}

/**
 * Carve a path between two positions by converting obstacles to passable terrain
 * Creates a natural-looking path that follows a line between start and end
 * @param {number} x1 - Start X
 * @param {number} y1 - Start Y
 * @param {number} x2 - End X
 * @param {number} y2 - End Y
 */
const carvePathBetweenPositions = (x1, y1, x2, y2) => {
  const { width: MAP_WIDTH, height: MAP_HEIGHT } = getMapDimensions()

  console.log(`Carving path from (${x1}, ${y1}) to (${x2}, ${y2})`)

  // First, carve clearings at start and end positions (for tent placement)
  carveClearing(x1, y1, 2)
  carveClearing(x2, y2, 2)

  // Calculate distance and steps
  const dx = x2 - x1
  const dy = y2 - y1
  const distance = Math.sqrt(dx * dx + dy * dy)
  const steps = Math.ceil(distance)

  // Interpolate points along the line
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const x = Math.round(x1 + dx * t)
    const y = Math.round(y1 + dy * t)

    // Carve a 3-wide path (center + 1 on each side)
    for (let offsetX = -1; offsetX <= 1; offsetX++) {
      for (let offsetY = -1; offsetY <= 1; offsetY++) {
        const carveX = x + offsetX
        const carveY = y + offsetY

        // Check bounds
        if (carveX < 0 || carveX >= MAP_WIDTH || carveY < 0 || carveY >= MAP_HEIGHT) {
          continue
        }

        const tile = gameState.map[carveX][carveY]

        // Only carve through obstacles (water, rocks, heavy trees)
        // Don't modify grass or sand
        if (tile.type === TERRAIN_TYPES.WATER.type ||
            tile.type === TERRAIN_TYPES.ROCK.type ||
            tile.type === TERRAIN_TYPES.TREE.type) {

          // Convert to passable terrain
          // Use sand near water edges for natural look, otherwise grass
          const isNearWater = checkNearbyTerrain(carveX, carveY, TERRAIN_TYPES.WATER.type)

          gameState.map[carveX][carveY] = {
            uid: carveY * MAP_WIDTH + carveX,
            type: isNearWater ? TERRAIN_TYPES.SAND.type : TERRAIN_TYPES.GRASS.type,
            weight: isNearWater ? TERRAIN_TYPES.SAND.weight : TERRAIN_TYPES.GRASS.weight
          }
        }
      }
    }
  }

  console.log('Path carved successfully')
}

/**
 * Check if there's a specific terrain type nearby
 * @param {number} x - Center X
 * @param {number} y - Center Y
 * @param {string} terrainType - Terrain type to look for
 * @returns {boolean}
 */
const checkNearbyTerrain = (x, y, terrainType) => {
  const { width: MAP_WIDTH, height: MAP_HEIGHT } = getMapDimensions()

  for (let dx = -2; dx <= 2; dx++) {
    for (let dy = -2; dy <= 2; dy++) {
      const checkX = x + dx
      const checkY = y + dy

      if (checkX >= 0 && checkX < MAP_WIDTH && checkY >= 0 && checkY < MAP_HEIGHT) {
        if (gameState.map[checkX][checkY].type === terrainType) {
          return true
        }
      }
    }
  }

  return false
}

/**
 * Place starting tents for human and AI players
 * Tries to find naturally connected positions, falls back to path carving if allowed.
 *
 * @param {boolean} allowCarving - Whether to allow path carving if no natural positions found
 * @returns {boolean} True if tents were successfully placed with a valid path between them
 */
const placeTents = async (allowCarving = true) => {
  const { width: MAP_WIDTH, height: MAP_HEIGHT } = getMapDimensions()

  // Step 1: Try to find naturally valid positions
  const positions = await findValidTentPositions()

  if (positions) {
    // Success! Place tents at the naturally valid positions
    console.log(`✓ Placing tents at best positions (path length: ${positions.pathLength})`)
    console.log(`  Human tent at: (${positions.humanX}, ${positions.humanY})`)
    console.log(`  AI tent at: (${positions.aiX}, ${positions.aiY})`)

    gameState.humanPlayer.addBuilding(positions.humanX, positions.humanY, Building.TYPES.TENT)
    gameState.aiPlayers[0].addBuilding(positions.aiX, positions.aiY, Building.TYPES.TENT)

    return true
  }

  // Step 2: No natural positions found
  if (!allowCarving) {
    // Random mode: Don't carve, just return false to try another seed
    console.log('✗ No naturally valid positions found (carving not allowed)')
    return false
  }

  // User specified seed: Carve a path to make it playable
  console.log('⚠ No naturally valid positions found. Carving path between default positions...')

  const humanX = Math.floor(MAP_WIDTH / 2)
  const humanY = Math.floor(MAP_HEIGHT * 19 / 20)
  const aiX = Math.floor(MAP_WIDTH / 2)
  const aiY = Math.floor(MAP_HEIGHT / 20)

  // Carve a path between them (this will create passable terrain)
  carvePathBetweenPositions(humanX, humanY, aiX, aiY)

  // Update pathfinding and verify
  updateMapInWorker()
  const path = await searchPath(humanX, humanY, aiX, aiY)

  if (path?.length > 0) {
    console.log(`✓ Path carved successfully! Length: ${path.length}`)
    console.log(`  Human tent at: (${humanX}, ${humanY})`)
    console.log(`  AI tent at: (${aiX}, ${aiY})`)

    // Place tents
    gameState.humanPlayer.addBuilding(humanX, humanY, Building.TYPES.TENT)
    gameState.aiPlayers[0].addBuilding(aiX, aiY, Building.TYPES.TENT)

    return true
  }

  console.error('✗ Path carving failed - this should not happen!')
  return false
}

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
  // Base sprite for sand (isolated)
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
  // 9. Isolated tile (no sand neighbors)

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
  // Base sprite for water (isolated)
  let spriteX = 0
  let spriteY = 13

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

  // 1. Fully connected (all 8 neighbors)
  if (N && S && E && W && NE && NW && SE && SW) {
    spriteX = 8; spriteY = 11
  }
  // 2. Inner corners (cardinal neighbors present, but a diagonal is missing)
  else if (N && S && E && W && NW && SW && SE && !NE) {
    spriteX = 11; spriteY = 10
  }
  else if (N && S && E && W && NE && SE && SW && !NW) {
    spriteX = 10; spriteY = 10
  }
  else if (N && S && E && W && NE && NW && SW && !SE) {
    spriteX = 11; spriteY = 11
  }
  else if (N && S && E && W && NE && NW && SE && !SW) {
    spriteX = 10; spriteY = 11
  }
  // Missing 2 diagonals only
  else if (N && S && E && W && NE && SW && !NW && !SE) {
    spriteX = 11; spriteY = 12
  }
  else if (N && S && E && W && NW && SE && !NE && !SW) {
    spriteX = 10; spriteY = 12
  }
  else if (N && S && E && W && NE && NW && !SW && !SE) {
    spriteX = 5; spriteY = 12
  }
  else if (N && S && E && W && NW && SW && !NE && !SE) {
    spriteX = 6; spriteY = 11
  }
  else if (N && S && E && W && SE && SW && !NW && !NE) {
    spriteX = 5; spriteY = 10
  }
  else if (N && S && E && W && NE && SE && !NW && !SW) {
    spriteX = 4; spriteY = 11
  }
  // Missing 3 diagonals
  else if (N && S && E && W && !NW && !SW && SE && !NE) {
    spriteX = 4; spriteY = 10
  }
  else if (N && S && E && W && !NW && SW && !SE && !NE) {
    spriteX = 6; spriteY = 10
  }
  else if (N && S && E && W && !NW && !SW && !SE && NE) {
    spriteX = 4; spriteY = 12
  }
  else if (N && S && E && W && NW && !SW && !SE && !NE) {
    spriteX = 6; spriteY = 12
  }
  // 3. Outer corners (L-shape with diagonal)
  else if (N && E && NE && !S && !W) {
    spriteX = 7; spriteY = 12
  }
  else if (N && W && NW && !S && !E) {
    spriteX = 9; spriteY = 12
  }
  else if (S && E && SE && !N && !W) {
    spriteX = 7; spriteY = 10
  }
  else if (S && W && SW && !N && !E) {
    spriteX = 9; spriteY = 10
  }
  // 4. All 4 cardinal neighbors
  else if (N && S && E && W) {
    spriteX = 2; spriteY = 11
  }
  // 5. T-intersections (3 cardinal neighbors)
  else if (N && S && E && NE && SE && !W) {
    spriteX = 7; spriteY = 11
  }
  else if (E && S && W && SE && SW && !N) {
    spriteX = 8; spriteY = 10
  }
  else if (N && S && W && NW && SW && !E) {
    spriteX = 9; spriteY = 11
  }
  else if (N && E && W && NE && NW && !S) {
    spriteX = 8; spriteY = 12
  }
  else if (N && S && E && !W) {
    spriteX = 1; spriteY = 11
  }
  else if (E && S && W && !N) {
    spriteX = 2; spriteY = 10
  }
  else if (N && S && W && !E) {
    spriteX = 3; spriteY = 11
  }
  else if (N && E && W && !S) {
    spriteX = 2; spriteY = 12
  }
  // 6. Corners (2 cardinal neighbors)
  else if (S && E && !N && !W) {
    spriteX = 1; spriteY = 10
  }
  else if (S && W && !N && !E) {
    spriteX = 3; spriteY = 10
  }
  else if (N && E && !S && !W) {
    spriteX = 1; spriteY = 12
  }
  else if (N && W && !S && !E) {
    spriteX = 3; spriteY = 12
  }
  // 7. Side connections
  else if (W && E && !N && !S) {
    spriteX = 2; spriteY = 13
  }
  else if (N && S && !W && !E) {
    spriteX = 0; spriteY = 11
  }
  // 8. Edges (single connections)
  else if (N && !S && !E && !W) {
    spriteX = 0; spriteY = 12
  }
  else if (S && !N && !E && !W) {
    spriteX = 0; spriteY = 10
  }
  else if (E && !N && !S && !W) {
    spriteX = 1; spriteY = 13
  }
  else if (W && !N && !S && !E) {
    spriteX = 3; spriteY = 13
  }
  // 9. Isolated tile (no water neighbors)

  return { spriteX, spriteY }
}
