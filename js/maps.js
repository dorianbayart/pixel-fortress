export { getTile }

'use strict'

import { getCanvasDimensions } from 'dimensions'
import gameState from 'state'

//const MAP_WIDTH = (globalThis.innerWidth > globalThis.innerHeight ? globalThis.innerWidth / SPRITE_SIZE * 1.25 : globalThis.innerHeight /1.5 / SPRITE_SIZE) / 2 | 0
// const MAP_WIDTH = window.innerWidth > window.innerHeight ? 48 : 24
// const MAP_HEIGHT = MAP_WIDTH * window.innerHeight / window.innerWidth | 0
// const MAP_WIDTH = (window.visualViewport?.width ?? window.innerWidth) * (window.devicePixelRatio || 1) / SPRITE_SIZE | 0
// const MAP_HEIGHT = (window.visualViewport?.height ?? window.innerHeight) * (window.devicePixelRatio || 1) / SPRITE_SIZE | 0
// const MAX_WEIGHT = 99999999

// Get map dimensions from centralized system
const { width: MAP_WIDTH, height: MAP_HEIGHT, maxWeight: MAX_WEIGHT } = getCanvasDimensions()

/**
 * Returns the tile at the specified coordinates.
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {Object} Tile object
 */
const getTile = (x, y) => gameState.map[x]?.[y]
