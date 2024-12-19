export { getTile, getTileSize, MAP_HEIGHT, MAP_WIDTH, MAX_WEIGHT }

'use strict'

import { SPRITE_SIZE } from 'sprites'


//const MAP_WIDTH = (globalThis.innerWidth > globalThis.innerHeight ? globalThis.innerWidth / SPRITE_SIZE * 1.25 : globalThis.innerHeight /1.5 / SPRITE_SIZE) / 2 | 0
const MAP_WIDTH = globalThis.innerWidth > globalThis.innerHeight ? 48 : 24
const MAP_HEIGHT = MAP_WIDTH * globalThis.innerHeight / globalThis.innerWidth | 0
const MAX_WEIGHT = 99999999


/**
 * Returns the tile at the specified coordinates.
 */
const getTile = (x, y) => map[x]?.[y]

/**
 * Returns the size of a tile in pixels.
 */
const getTileSize = () => SPRITE_SIZE

