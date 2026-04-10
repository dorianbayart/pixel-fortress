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
 * Main test entry point
 * Add/remove test imports here to control which tests run
 */

console.log('Running Pixel Fortress test suite...\n')

// Active tests
import './utils.test.mjs'
import './seed.test.mjs'

// Disabled tests
// import './map-generation.test.mjs'      // Requires Node.js loader for import maps
// import './playerColorFilter.test.mjs'   // Requires Node.js loader for import maps (imports pixijs)

console.log('\n✓ All tests completed successfully')
