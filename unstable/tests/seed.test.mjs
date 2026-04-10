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

import { test, assertEqual, assertNotEqual } from './testRunner.mjs'
import { PerlinNoise } from '../js/utils.mjs'
import CONSTANTS from '../js/constants.mjs'

// Constants for seed range (imported from centralized constants)
const MIN_SEED = CONSTANTS.SEED.MIN
const MAX_SEED = CONSTANTS.SEED.MAX

// Test seed range constants
test('Seed range constants are correct', () => {
  assertEqual(MIN_SEED, 0, 'Minimum seed should be 0')
  assertEqual(MAX_SEED, 999999999, 'Maximum seed should be 999,999,999 (1 billion - 1)')
})

// Test random seed generation logic
test('Random seed generation produces values in valid range', () => {
  // Simulate the random seed generation logic from game.mjs
  for (let i = 0; i < 100; i++) {
    const randomSeed = Math.floor(Math.random() * (MAX_SEED + 1))

    assertEqual(randomSeed >= MIN_SEED, true, `Random seed ${randomSeed} should be >= ${MIN_SEED}`)
    assertEqual(randomSeed <= MAX_SEED, true, `Random seed ${randomSeed} should be <= ${MAX_SEED}`)
    assertEqual(Number.isInteger(randomSeed), true, `Random seed ${randomSeed} should be an integer`)
  }
})

// Test PerlinNoise with edge case seeds
test('PerlinNoise handles minimum seed (0)', () => {
  const noise = new PerlinNoise(0)
  assertEqual(noise.seed, 0, 'Seed should be 0')

  const value = noise.noise(0.5, 0.5)
  assertEqual(typeof value, 'number', 'Should return a number')
  assertEqual(isNaN(value), false, 'Should not return NaN')
  assertEqual(isFinite(value), true, 'Should return a finite number')
})

test('PerlinNoise handles maximum seed (999,999,999)', () => {
  const noise = new PerlinNoise(MAX_SEED)
  assertEqual(noise.seed, MAX_SEED, 'Seed should be 999,999,999')

  const value = noise.noise(0.5, 0.5)
  assertEqual(typeof value, 'number', 'Should return a number')
  assertEqual(isNaN(value), false, 'Should not return NaN')
  assertEqual(isFinite(value), true, 'Should return a finite number')
})

test('PerlinNoise handles mid-range seed (500,000,000)', () => {
  const midSeed = 500000000
  const noise = new PerlinNoise(midSeed)
  assertEqual(noise.seed, midSeed, 'Seed should be 500,000,000')

  const value = noise.noise(0.5, 0.5)
  assertEqual(typeof value, 'number', 'Should return a number')
  assertEqual(isNaN(value), false, 'Should not return NaN')
  assertEqual(isFinite(value), true, 'Should return a finite number')
})

// Test deterministic behavior with large seeds
test('Same large seed produces same PerlinNoise results', () => {
  const largeSeed = 987654321
  const noise1 = new PerlinNoise(largeSeed)
  const noise2 = new PerlinNoise(largeSeed)

  const value1 = noise1.noise(1.5, 2.5)
  const value2 = noise2.noise(1.5, 2.5)

  assertEqual(value1, value2, 'Same seed should produce identical noise values')
})

test('Different large seeds produce different PerlinNoise results', () => {
  const seed1 = 111111111
  const seed2 = 999999999
  const noise1 = new PerlinNoise(seed1)
  const noise2 = new PerlinNoise(seed2)

  const value1 = noise1.noise(1.5, 2.5)
  const value2 = noise2.noise(1.5, 2.5)

  assertNotEqual(value1, value2, 'Different seeds should produce different noise values')
})

// Test that noise values are in expected range
test('PerlinNoise produces values in expected range', () => {
  const seeds = [0, 123456789, MAX_SEED]

  seeds.forEach(seed => {
    const noise = new PerlinNoise(seed)

    // Test multiple points
    for (let x = 0; x < 10; x += 0.5) {
      for (let y = 0; y < 10; y += 0.5) {
        const value = noise.noise(x, y)

        // Perlin noise typically returns values between -1 and 1
        assertEqual(value >= -2, true, `Noise value ${value} should be >= -2 for seed ${seed}`)
        assertEqual(value <= 2, true, `Noise value ${value} should be <= 2 for seed ${seed}`)
        assertEqual(isFinite(value), true, `Noise value should be finite for seed ${seed}`)
      }
    }
  })
})

// Test seed validation logic (as would be used in UI)
test('Seed validation rejects invalid values', () => {
  const invalidSeeds = [-1, -100, MAX_SEED + 1, MAX_SEED * 2, NaN, Infinity, -Infinity]

  invalidSeeds.forEach(seed => {
    const isValid = seed >= MIN_SEED && seed <= MAX_SEED && Number.isInteger(seed) && Number.isFinite(seed)
    assertEqual(isValid, false, `Seed ${seed} should be invalid`)
  })
})

test('Seed validation accepts valid values', () => {
  const validSeeds = [0, 1, 100, 123456789, 999999999]

  validSeeds.forEach(seed => {
    const isValid = seed >= MIN_SEED && seed <= MAX_SEED && Number.isInteger(seed) && Number.isFinite(seed)
    assertEqual(isValid, true, `Seed ${seed} should be valid`)
  })
})

// Test that we have sufficient entropy for "billions of maps"
test('Seed range supports billions of unique maps', () => {
  const seedCount = MAX_SEED - MIN_SEED + 1
  const mapSizes = CONSTANTS.MAP_SIZES.getAll().length
  const totalUniqueMaps = seedCount * mapSizes

  assertEqual(seedCount, MAX_SEED + 1, `Should have ${MAX_SEED + 1} unique seeds`)
  assertEqual(totalUniqueMaps, (MAX_SEED + 1) * mapSizes, `Should support ${(MAX_SEED + 1) * mapSizes} unique maps (seed × size)`)
  assertEqual(totalUniqueMaps > MAX_SEED, true, `Total maps should exceed ${MAX_SEED}`)
})

console.log('\n✓ All seed tests completed')
