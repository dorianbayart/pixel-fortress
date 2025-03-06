export { getTile, loadPredefinedMap }

'use strict'

import { getCanvasDimensions } from 'dimensions'
import gameState from 'state'

// Get map dimensions from centralized system
const { width: MAP_WIDTH, height: MAP_HEIGHT, maxWeight: MAX_WEIGHT } = getCanvasDimensions()

/**
 * Returns the tile at the specified coordinates.
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {Object} Tile object
 */
const getTile = (x, y) => gameState.map[x]?.[y]

/**
 * Load a predefined map instead of generating one
 * @param {string|number} mapId - Identifier for the map to load
 * @returns {Promise<boolean>} Success status
 */
const loadPredefinedMap = async (mapId) => {
    // Placeholder for future implementation
    try {
      // Example: This could later fetch a map definition from maps/seeds.json
      const predefinedSeed = parseInt(mapId, 10)
      if (!isNaN(predefinedSeed)) {
        // If mapId is a number/string representing a seed, use it
        gameState.mapSeed = predefinedSeed
        return true
      }
      return false
    } catch (error) {
      console.error('Error loading predefined map:', error)
      return false
    }
  }