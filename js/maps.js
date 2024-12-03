export { getTile, getTileSize }

'use strict'





/**
 * Returns the tile at the specified coordinates.
 */
const getTile = (x, y) => map[x]?.[y]

/**
 * Returns the size of a tile in pixels.
 */
const getTileSize = () => SPRITE_SIZE

