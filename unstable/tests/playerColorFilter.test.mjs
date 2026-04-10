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
 * Tests for playerColorFilter.mjs
 * NOTE: PlayerColorFilter class itself requires a WebGL context (PixiJS) and
 * cannot be tested in Node.js. Only the pure hexToHue helper is tested here.
 *
 * To run: requires Node.js loader for import maps (disabled in run-all.mjs)
 */

import { test, assertEqual } from './testRunner.mjs'
import { hexToHue } from '#playerColorFilter'

const approxEqual = (a, b, epsilon = 1) => Math.abs(a - b) < epsilon

// Pure red: hue = 0°
test('hexToHue returns 0 for pure red', () => {
  const hue = hexToHue(0xff0000)
  assertEqual(approxEqual(hue, 0, 1) || approxEqual(hue, 360, 1), true, `Expected ~0°, got ${hue}`)
})

// Pure green: hue = 120°
test('hexToHue returns 120 for pure green', () => {
  const hue = hexToHue(0x00ff00)
  assertEqual(approxEqual(hue, 120, 1), true, `Expected ~120°, got ${hue}`)
})

// Pure blue: hue = 240°
test('hexToHue returns 240 for pure blue', () => {
  const hue = hexToHue(0x0000ff)
  assertEqual(approxEqual(hue, 240, 1), true, `Expected ~240°, got ${hue}`)
})

// Cyan (0x00FFFF): hue = 180°
test('hexToHue returns 180 for cyan', () => {
  const hue = hexToHue(0x00ffff)
  assertEqual(approxEqual(hue, 180, 1), true, `Expected ~180°, got ${hue}`)
})

// Yellow (0xFFFF00): hue = 60°
test('hexToHue returns 60 for yellow', () => {
  const hue = hexToHue(0xffff00)
  assertEqual(approxEqual(hue, 60, 1), true, `Expected ~60°, got ${hue}`)
})

// Magenta (0xFF00FF): hue = 300°
test('hexToHue returns 300 for magenta', () => {
  const hue = hexToHue(0xff00ff)
  assertEqual(approxEqual(hue, 300, 1), true, `Expected ~300°, got ${hue}`)
})

// Pure white: all channels equal → delta = 0 → hue = 0 (achromatic)
test('hexToHue returns 0 for white (achromatic)', () => {
  const hue = hexToHue(0xffffff)
  assertEqual(hue, 0, 'White has no hue, should return 0')
})

// Player cyan default (0x00BFBF): should be near 180°
test('hexToHue returns ~180 for player cyan 0x00BFBF', () => {
  const hue = hexToHue(0x00bfbf)
  assertEqual(approxEqual(hue, 180, 2), true, `Expected ~180°, got ${hue}`)
})

// Player red default (0xCC2222): should be near 0° (red hue)
test('hexToHue returns ~0 for player red 0xCC2222', () => {
  const hue = hexToHue(0xcc2222)
  assertEqual(approxEqual(hue, 0, 5) || approxEqual(hue, 360, 5), true, `Expected ~0°, got ${hue}`)
})

// Result is always in [0, 360)
test('hexToHue result is always in [0, 360)', () => {
  const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffa500, 0x8822cc, 0x22aa22]
  colors.forEach(hex => {
    const hue = hexToHue(hex)
    assertEqual(hue >= 0 && hue < 360, true, `Hue ${hue} out of range for 0x${hex.toString(16)}`)
  })
})
