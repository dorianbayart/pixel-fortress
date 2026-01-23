export { renderMapPreview, generateMapPreviewFromSeed, renderCustomMapPreview }

'use strict'

import CONSTANTS from 'constants'
import { loadCustomMap } from 'maps'

// Terrain colors (matching minimap colors)
const TERRAIN_COLORS = CONSTANTS.MINIMAP.COLORS

/**
 * Render a map preview to a canvas element
 * @param {HTMLCanvasElement} canvas - Canvas element to render to
 * @param {Array<Array<string>>} terrain - 2D array of terrain types
 * @param {Object} mapSize - Map dimensions {width, height}
 * @param {number} maxSize - Maximum canvas size in pixels (default 256)
 */
function renderMapPreview(canvas, terrain, mapSize, maxSize = 256) {
  if (!canvas || !terrain || !mapSize) {
    console.error('Invalid parameters for renderMapPreview')
    return
  }

  const { width: mapWidth, height: mapHeight } = mapSize
  const ctx = canvas.getContext('2d')

  // Calculate scale to fit within maxSize while respecting aspect ratio
  const aspectRatio = mapWidth / mapHeight
  let canvasWidth, canvasHeight

  if (aspectRatio > 1) {
    // Wider than tall
    canvasWidth = Math.min(maxSize, mapWidth)
    canvasHeight = canvasWidth / aspectRatio
  } else {
    // Taller than wide
    canvasHeight = Math.min(maxSize, mapHeight)
    canvasWidth = canvasHeight * aspectRatio
  }

  // Set canvas dimensions
  canvas.width = canvasWidth
  canvas.height = canvasHeight

  // Calculate pixel size for each tile
  const pixelWidth = canvasWidth / mapWidth
  const pixelHeight = canvasHeight / mapHeight

  // Clear canvas
  ctx.clearRect(0, 0, canvasWidth, canvasHeight)

  // Draw terrain
  for (let x = 0; x < mapWidth; x++) {
    for (let y = 0; y < mapHeight; y++) {
      const terrainType = terrain[x]?.[y]
      if (!terrainType) continue

      // Get color for this terrain type
      let color = TERRAIN_COLORS.GRASS // default

      switch (terrainType) {
        case CONSTANTS.TERRAIN.TYPES.WATER.type:
          color = TERRAIN_COLORS.WATER
          break
        case CONSTANTS.TERRAIN.TYPES.GRASS.type:
          color = TERRAIN_COLORS.GRASS
          break
        case CONSTANTS.TERRAIN.TYPES.SAND.type:
          color = TERRAIN_COLORS.SAND
          break
        case CONSTANTS.TERRAIN.TYPES.TREE.type:
          color = TERRAIN_COLORS.TREE
          break
        case CONSTANTS.TERRAIN.TYPES.DEPLETED_TREE.type:
          color = TERRAIN_COLORS.DEPLETED_TREE
          break
        case CONSTANTS.TERRAIN.TYPES.ROCK.type:
          color = TERRAIN_COLORS.ROCK
          break
        case CONSTANTS.TERRAIN.TYPES.GOLD.type:
          color = TERRAIN_COLORS.GOLD
          break
      }

      // Convert hex color to CSS
      const cssColor = '#' + color.toString(16).padStart(6, '0')

      // Draw the pixel
      ctx.fillStyle = cssColor
      ctx.fillRect(
        Math.floor(x * pixelWidth),
        Math.floor(y * pixelHeight),
        Math.ceil(pixelWidth) + 1, // +1 to avoid gaps
        Math.ceil(pixelHeight) + 1
      )
    }
  }
}

/**
 * Render preview for a custom map by loading its data
 * @param {HTMLCanvasElement} canvas - Canvas element to render to
 * @param {string} mapId - Custom map ID
 * @param {number} maxSize - Maximum canvas size in pixels
 * @returns {Promise<boolean>} Success status
 */
async function renderCustomMapPreview(canvas, mapId, maxSize = 256) {
  try {
    const mapData = await loadCustomMap(mapId)
    if (!mapData) {
      console.error('Failed to load custom map for preview:', mapId)
      return false
    }

    renderMapPreview(canvas, mapData.terrain, mapData.mapSize, maxSize)
    return true
  } catch (error) {
    console.error('Error rendering custom map preview:', error)
    return false
  }
}

/**
 * Generate a map preview from a seed (requires map generation)
 * @param {HTMLCanvasElement} canvas - Canvas element to render to
 * @param {number} seed - Map seed
 * @param {string} size - Map size (small, medium, large, huge)
 * @param {number} maxSize - Maximum canvas size in pixels
 * @returns {Promise<boolean>} Success status
 */
async function generateMapPreviewFromSeed(canvas, seed, size = 'medium', maxSize = 256) {
  try {
    // Import map generation functions dynamically to avoid circular dependencies
    const { generateMap } = await import('./mapGeneration.mjs')
    const { getMapDimensions, initMapDimensions } = await import('./dimensions.mjs')
    const gameState = (await import('./state.mjs')).default

    // Store current game state (may be null/undefined on first run)
    const originalMap = gameState.map
    const originalMapSeed = gameState.mapSeed
    const originalSettings = { ...gameState.settings }
    const originalGameStatus = gameState.gameStatus

    // Temporarily update settings for map generation
    gameState.updateSettings({ mapSize: size })
    gameState.mapSeed = seed

    initMapDimensions()

    // Generate the map
    await generateMap()

    // Get map dimensions for this size
    const { width: mapWidth, height: mapHeight } = getMapDimensions()

    // Build terrain array from generated map
    const terrain = []
    for (let x = 0; x < mapWidth; x++) {
      const column = []
      for (let y = 0; y < mapHeight; y++) {
        const tile = gameState.map[x][y]
        if (!tile) {
          column.push('GRASS') // fallback
        } else {
          column.push(tile.type)
        }
      }
      terrain.push(column)
    }

    // Restore original game state
    gameState.map = originalMap
    gameState.mapSeed = originalMapSeed
    gameState.updateSettings(originalSettings)
    gameState.gameStatus = originalGameStatus

    // Render the preview
    renderMapPreview(canvas, terrain, { width: mapWidth, height: mapHeight }, maxSize)

    return true
  } catch (error) {
    console.error(`[Preview] ✗ Error generating map preview from seed ${seed}:`, error)
    console.error('[Preview] Error stack:', error.stack)

    // Draw error on canvas
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#2a0000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#dc143c'
    ctx.font = '10px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('Error', canvas.width / 2, canvas.height / 2 - 5)
    ctx.font = '8px monospace'
    ctx.fillText('(see console)', canvas.width / 2, canvas.height / 2 + 8)

    return false
  }
}
