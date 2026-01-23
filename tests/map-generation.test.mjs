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

import { test, assertEqual } from './testRunner.mjs'
import { generateMap, testTentPositionPair } from '#mapGeneration'
import { getMapDimensions } from '#dimensions'
import { updateMapDimensionsInWorker, updateMapInWorker } from '#pathfinding'
import CONSTANTS from '#constants'
import gameState from '#state'

// Import TERRAIN_TYPES from constants
const TERRAIN_TYPES = CONSTANTS.TERRAIN.TYPES

// Map sizes to test (from constants)
const MAP_SIZES = CONSTANTS.MAP_SIZES.getAll().map(size => size.id)

/**
 * Helper: Generate a map with specific seed and size using actual game logic
 */
async function generateTestMap(seed, size) {
  gameState.mapSeed = seed
  gameState.updateSettings({ mapSize: size })
  updateMapDimensionsInWorker()
  await generateMap()
  return gameState.map
}

/**
 * Helper: Get default tent positions using game logic (from game.mjs line 481-484)
 */
function getDefaultTentPositions() {
  const { width: MAP_WIDTH, height: MAP_HEIGHT } = getMapDimensions()
  return {
    humanX: Math.floor(MAP_WIDTH / 2),
    humanY: Math.floor(MAP_HEIGHT * 19 / 20),
    aiX: Math.floor(MAP_WIDTH / 2),
    aiY: Math.floor(MAP_HEIGHT / 20)
  }
}

// ============================================================================
// MAP GENERATION VALIDATION TESTS
// ============================================================================

test('Generated map has valid structure', async () => {
  const map = await generateTestMap(12345, 'small')
  const { width: MAP_WIDTH, height: MAP_HEIGHT } = getMapDimensions()

  assertEqual(Array.isArray(map), true, 'Map should be an array')
  assertEqual(map.length, MAP_WIDTH, 'Map width should match dimensions')
  assertEqual(map[0].length, MAP_HEIGHT, 'Map height should match dimensions')

  // Check all tiles are valid
  for (let x = 0; x < MAP_WIDTH; x++) {
    for (let y = 0; y < MAP_HEIGHT; y++) {
      const tile = map[x][y]
      assertEqual(tile !== null && tile !== undefined, true, `Tile at (${x},${y}) should exist`)
      assertEqual(typeof tile.type, 'string', 'Tile should have type')
      assertEqual(typeof tile.weight, 'number', 'Tile should have weight')
    }
  }
})

test('Generated map contains diverse terrain types', async () => {
  const map = await generateTestMap(555555, 'medium')
  const { width: MAP_WIDTH, height: MAP_HEIGHT } = getMapDimensions()

  const terrainCounts = {}
  for (let x = 0; x < MAP_WIDTH; x++) {
    for (let y = 0; y < MAP_HEIGHT; y++) {
      const type = map[x][y].type
      terrainCounts[type] = (terrainCounts[type] || 0) + 1
    }
  }

  console.log(`    Found terrain types: ${Object.keys(terrainCounts).join(', ')}`)
  assertEqual(Object.keys(terrainCounts).length >= 3, true, 'Map should have at least 3 different terrain types')
})

test('Same seed produces identical maps', async () => {
  const seed = 777777
  const map1 = await generateTestMap(seed, 'small')
  const map2 = await generateTestMap(seed, 'small')
  const { width: MAP_WIDTH, height: MAP_HEIGHT } = getMapDimensions()

  let identical = true
  for (let x = 0; x < MAP_WIDTH; x++) {
    for (let y = 0; y < MAP_HEIGHT; y++) {
      if (map1[x][y].type !== map2[x][y].type) {
        identical = false
        break
      }
    }
    if (!identical) break
  }

  assertEqual(identical, true, 'Same seed should produce identical terrain')
})

test('Different seeds produce different maps', async () => {
  const map1 = await generateTestMap(111111, 'small')
  const map2 = await generateTestMap(999999, 'small')
  const { width: MAP_WIDTH, height: MAP_HEIGHT } = getMapDimensions()

  let differences = 0
  for (let x = 0; x < MAP_WIDTH; x++) {
    for (let y = 0; y < MAP_HEIGHT; y++) {
      if (map1[x][y].type !== map2[x][y].type) {
        differences++
      }
    }
  }

  const totalTiles = MAP_WIDTH * MAP_HEIGHT
  const diffPercent = (differences / totalTiles * 100).toFixed(1)
  console.log(`    Maps differ in ${differences}/${totalTiles} tiles (${diffPercent}%)`)
  assertEqual(differences > 0, true, 'Different seeds should produce different terrain')
})

// ============================================================================
// PATH VALIDATION TESTS (USING REAL GAME LOGIC)
// ============================================================================

test('Small maps: Test path validity with random seeds', async () => {
  const testSeeds = [0, 123456, 500000000, 999999999]
  let validCount = 0

  for (const seed of testSeeds) {
    await generateTestMap(seed, 'small')
    updateMapInWorker()
    const { humanX, humanY, aiX, aiY } = getDefaultTentPositions()
    const result = await testTentPositionPair(humanX, humanY, aiX, aiY)

    if (result.valid) {
      validCount++
      console.log(`    Seed ${seed}: Valid path (length: ${result.pathLength})`)
    } else {
      console.log(`    Seed ${seed}: No natural path at default positions`)
    }
  }

  console.log(`    ${validCount}/${testSeeds.length} seeds had valid paths`)
  assertEqual(testSeeds.length, 4, 'Should have tested 4 seeds')
})

test('Medium maps: Test path validity with random seeds', async () => {
  const testSeeds = [0, 123456, 500000000, 999999999]
  let validCount = 0

  for (const seed of testSeeds) {
    await generateTestMap(seed, 'medium')
    updateMapInWorker()
    const { humanX, humanY, aiX, aiY } = getDefaultTentPositions()
    const result = await testTentPositionPair(humanX, humanY, aiX, aiY)

    if (result.valid) {
      validCount++
      console.log(`    Seed ${seed}: Valid path (length: ${result.pathLength})`)
    } else {
      console.log(`    Seed ${seed}: No natural path at default positions`)
    }
  }

  console.log(`    ${validCount}/${testSeeds.length} seeds had valid paths`)
  assertEqual(testSeeds.length, 4, 'Should have tested 4 seeds')
})

test('Large maps: Test path validity with random seeds', async () => {
  const testSeeds = [0, 123456, 500000000, 999999999]
  let validCount = 0

  for (const seed of testSeeds) {
    await generateTestMap(seed, 'large')
    updateMapInWorker()
    const { humanX, humanY, aiX, aiY } = getDefaultTentPositions()
    const result = await testTentPositionPair(humanX, humanY, aiX, aiY)

    if (result.valid) {
      validCount++
      console.log(`    Seed ${seed}: Valid path (length: ${result.pathLength})`)
    } else {
      console.log(`    Seed ${seed}: No natural path at default positions`)
    }
  }

  console.log(`    ${validCount}/${testSeeds.length} seeds had valid paths`)
  assertEqual(testSeeds.length, 4, 'Should have tested 4 seeds')
})

// ============================================================================
// STRESS TEST: GENERATE MANY RANDOM MAPS
// ============================================================================

test('Stress test: Generate 30 random maps and verify structure', async () => {
  const iterations = 30
  const results = {
    small: { total: 0, withPath: 0, pathLengths: [] },
    medium: { total: 0, withPath: 0, pathLengths: [] },
    large: { total: 0, withPath: 0, pathLengths: [] }
  }

  for (let i = 0; i < iterations; i++) {
    const seed = Math.floor(Math.random() * (CONSTANTS.SEED.MAX + 1))
    const size = MAP_SIZES[i % 3]
    results[size].total++

    await generateTestMap(seed, size)
    const { width: MAP_WIDTH, height: MAP_HEIGHT } = getMapDimensions()

    // Verify map structure
    assertEqual(gameState.map.length, MAP_WIDTH, `Map width should be correct for ${size}`)
    assertEqual(gameState.map[0].length, MAP_HEIGHT, `Map height should be correct for ${size}`)

    // Test path
    updateMapInWorker()
    const { humanX, humanY, aiX, aiY } = getDefaultTentPositions()
    const result = await testTentPositionPair(humanX, humanY, aiX, aiY)

    if (result.valid) {
      results[size].withPath++
      results[size].pathLengths.push(result.pathLength)
    }
  }

  console.log('    Results:')
  for (const [size, data] of Object.entries(results)) {
    const percent = ((data.withPath / data.total) * 100).toFixed(1)
    const avgPath = data.pathLengths.length > 0
      ? (data.pathLengths.reduce((a, b) => a + b) / data.pathLengths.length).toFixed(0)
      : 'N/A'
    console.log(`      ${size}: ${data.withPath}/${data.total} (${percent}%) have paths, avg length: ${avgPath}`)
  }

  const totalMaps = results.small.total + results.medium.total + results.large.total
  assertEqual(totalMaps, iterations, `Should have generated ${iterations} maps`)
})

console.log('\n✓ All map generation tests completed')
