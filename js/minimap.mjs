export { initMinimap, updateMinimap, resizeMinimap }

'use strict'

import * as PIXI from 'pixijs'
import CONSTANTS from 'constants'
import { getCanvasDimensions, getMapDimensions, getTileSize } from 'dimensions'
import { isPositionExplored, isPositionVisible } from 'fogOfWar'
import { TERRAIN_TYPES } from 'game'
import gameState from 'state'

// Minimap configuration
const MINIMAP_SIZE = 220 // Size in pixels
const MINIMAP_PADDING = 1 // Distance from bottom-right corner
const MINIMAP_CONTENT_ALPHA = 0.7 // Global alpha for all minimap content
const MINIMAP_UPDATE_INTERVAL = 40 // Update minimap every 40ms (25fps) for smooth viewport tracking

// Color scheme for the minimap
const COLORS = {
  WATER: 0x66bce4,      // Blue
  GRASS: 0x27ae60,      // Green
  SAND: 0xf39c12,       // Orange/tan
  TREE: 0x1e8449,       // Dark green
  DEPLETED_TREE: 0x7d6608, // Brown
  ROCK: 0x7f8c8d,       // Gray
  GOLD: 0xf1c40f,       // Gold
  UNEXPLORED: 0x1a1a1a, // Very dark gray
  HUMAN_UNIT: 0x00ffff, // Cyan
  AI_UNIT: 0xff0000,    // Red
  HUMAN_BUILDING: 0x00ffff, // Blue
  AI_BUILDING: 0xff0000  // Red
}

let minimapContainer = null
let minimapGraphics = null
let minimapBackground = null
let lastMinimapUpdate = 0

/**
 * Initialize the minimap
 * @param {PIXI.Container} uiContainer - The UI container to add minimap to
 */
function initMinimap(uiContainer) {
  // Create container for the minimap
  minimapContainer = new PIXI.Container()

  // Position in bottom-right corner, above the bottom bar
  const { width: canvasWidth, height: canvasHeight } = getCanvasDimensions()
  minimapContainer.x = canvasWidth - MINIMAP_SIZE - MINIMAP_PADDING
  minimapContainer.y = canvasHeight - MINIMAP_SIZE - MINIMAP_PADDING - CONSTANTS.UI.BOTTOM_BAR_HEIGHT

  // Set z-index to ensure minimap renders on top of fog of war
  minimapContainer.zIndex = 1000

  // Create background for the minimap (matching bottom bar style)
  minimapBackground = new PIXI.Graphics()
    .rect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE)
    .fill({ color: 0x114611, alpha: 0.85 }) // Dark green matching bottom bar
    .stroke({ width: 2, color: 0xFFD700, alpha: 0.5 }) // Gold border matching bottom bar

  minimapContainer.addChild(minimapBackground)

  // Create graphics object for drawing the minimap
  minimapGraphics = new PIXI.Graphics()
  minimapContainer.addChild(minimapGraphics)

  // Add to UI container
  uiContainer.addChild(minimapContainer)

  // Ensure UI container has sortable children enabled
  if (!uiContainer.sortableChildren) {
    uiContainer.sortableChildren = true
  }

  console.log('Minimap initialized')
}

/**
 * Update the minimap display
 * @param {number} timestamp - Current timestamp in milliseconds
 */
function updateMinimap(timestamp = performance.now()) {
  if (!minimapGraphics || !gameState.map) return

  // Throttle updates to once per second
  if (timestamp - lastMinimapUpdate < MINIMAP_UPDATE_INTERVAL) {
    return
  }
  lastMinimapUpdate = timestamp

  const { width: mapWidth, height: mapHeight } = getMapDimensions()
  const tileSize = getTileSize()

  // Calculate scale to fill the minimap completely (using smaller dimension)
  // This ensures no empty space - the minimap is always full
  const minDimension = Math.min(mapWidth, mapHeight)
  const pixelSize = MINIMAP_SIZE / minDimension

  // Get current viewport position to center the minimap view
  const viewTransform = gameState.UI?.mouse?.getViewTransform()
  const { width: canvasWidth, height: canvasHeight } = getCanvasDimensions()

  // Calculate how many tiles are visible in the current viewport
  const viewWidthInTiles = (canvasWidth / (tileSize * (viewTransform?.scale || 1)))
  const viewHeightInTiles = (canvasHeight / (tileSize * (viewTransform?.scale || 1)))

  // Get center of current viewport in tile coordinates
  const viewCenterX = (viewTransform?.x || 0) / tileSize + viewWidthInTiles / 2
  const viewCenterY = (viewTransform?.y || 0) / tileSize + viewHeightInTiles / 2

  // Calculate how many tiles fit in the minimap at this scale
  const minimapTilesWidth = MINIMAP_SIZE / pixelSize
  const minimapTilesHeight = MINIMAP_SIZE / pixelSize

  // Center the minimap view on the player's viewport
  let startX = Math.floor(viewCenterX - minimapTilesWidth / 2)
  let startY = Math.floor(viewCenterY - minimapTilesHeight / 2)

  // Clamp to map bounds
  startX = Math.max(0, Math.min(startX, mapWidth - minimapTilesWidth))
  startY = Math.max(0, Math.min(startY, mapHeight - minimapTilesHeight))

  const endX = Math.min(mapWidth, startX + minimapTilesWidth)
  const endY = Math.min(mapHeight, startY + minimapTilesHeight)

  // Clear previous frame
  minimapGraphics.clear()

  // Draw terrain (only the visible portion)
  for (let x = Math.floor(startX); x < Math.ceil(endX); x++) {
    for (let y = Math.floor(startY); y < Math.ceil(endY); y++) {
      // Skip if out of bounds
      if (x < 0 || x >= mapWidth || y < 0 || y >= mapHeight) continue

      const tile = gameState.map[x][y]

      // Skip unexplored tiles if fog of war is enabled
      if (gameState.settings.fogOfWar && !isPositionExplored(x, y)) {
        minimapGraphics
          .rect((x - startX) * pixelSize, (y - startY) * pixelSize, pixelSize, pixelSize)
          .fill({ color: COLORS.UNEXPLORED, alpha: MINIMAP_CONTENT_ALPHA })
        continue
      }

      // Determine color based on terrain type
      let color = COLORS.GRASS

      switch (tile.type) {
        case TERRAIN_TYPES.WATER.type:
          color = COLORS.WATER
          break
        case TERRAIN_TYPES.GRASS.type:
          color = COLORS.GRASS
          break
        case TERRAIN_TYPES.SAND.type:
          color = COLORS.SAND
          break
        case TERRAIN_TYPES.TREE.type:
          color = COLORS.TREE
          break
        case TERRAIN_TYPES.DEPLETED_TREE.type:
          color = COLORS.DEPLETED_TREE
          break
        case TERRAIN_TYPES.ROCK.type:
          color = COLORS.ROCK
          break
        case TERRAIN_TYPES.GOLD.type:
          color = COLORS.GOLD
          break
      }

      // Draw the pixel with transparency
      minimapGraphics
        .rect((x - startX) * pixelSize, (y - startY) * pixelSize, pixelSize, pixelSize)
        .fill({ color, alpha: MINIMAP_CONTENT_ALPHA })
    }
  }

  // Draw buildings (only within visible minimap bounds)
  if (gameState.humanPlayer) {
    gameState.humanPlayer.getBuildings().forEach(building => {
      // Check if building is within minimap view bounds
      if (building.x >= startX && building.x < endX && building.y >= startY && building.y < endY) {
        minimapGraphics
          .rect((building.x - startX) * pixelSize, (building.y - startY) * pixelSize, pixelSize, pixelSize)
          .fill({ color: COLORS.HUMAN_BUILDING, alpha: MINIMAP_CONTENT_ALPHA })
      }
    })
  }

  if (gameState.aiPlayers) {
    gameState.aiPlayers.forEach(ai => {
      ai.getBuildings().forEach(building => {
        // Check if building is within minimap view bounds
        if (building.x >= startX && building.x < endX && building.y >= startY && building.y < endY) {
          // Only show AI buildings if they are visible (not in fog of war)
          if (!gameState.settings.fogOfWar || isPositionVisible(building.x, building.y)) {
            minimapGraphics
              .rect((building.x - startX) * pixelSize, (building.y - startY) * pixelSize, pixelSize, pixelSize)
              .fill({ color: COLORS.AI_BUILDING, alpha: MINIMAP_CONTENT_ALPHA })
          }
        }
      })
    })
  }

  // Draw units (only within visible minimap bounds)
  if (gameState.humanPlayer) {
    gameState.humanPlayer.getUnits().forEach(unit => {
      const tileX = Math.floor(unit.x / tileSize)
      const tileY = Math.floor(unit.y / tileSize)
      // Check if unit is within minimap view bounds
      if (tileX >= startX && tileX < endX && tileY >= startY && tileY < endY) {
        minimapGraphics
          .rect((tileX - startX) * pixelSize, (tileY - startY) * pixelSize, pixelSize, pixelSize)
          .fill({ color: COLORS.HUMAN_UNIT, alpha: MINIMAP_CONTENT_ALPHA })
      }
    })
  }

  if (gameState.aiPlayers) {
    gameState.aiPlayers.forEach(ai => {
      ai.getUnits().forEach(unit => {
        const tileX = Math.floor(unit.x / tileSize)
        const tileY = Math.floor(unit.y / tileSize)
        // Check if unit is within minimap view bounds
        if (tileX >= startX && tileX < endX && tileY >= startY && tileY < endY) {
          // Only show AI units if they are visible (not in fog of war)
          if (!gameState.settings.fogOfWar || isPositionVisible(tileX, tileY)) {
            minimapGraphics
              .rect((tileX - startX) * pixelSize, (tileY - startY) * pixelSize, pixelSize, pixelSize)
              .fill({ color: COLORS.AI_UNIT, alpha: MINIMAP_CONTENT_ALPHA })
          }
        }
      })
    })
  }

  // Draw viewport indicator showing current screen view
  const vpStartX = ((viewTransform?.x || 0) / tileSize - startX) * pixelSize
  const vpStartY = ((viewTransform?.y || 0) / tileSize - startY) * pixelSize
  const vpWidth = viewWidthInTiles * pixelSize
  const vpHeight = viewHeightInTiles * pixelSize

  // Draw viewport rectangle
  minimapGraphics
    .rect(vpStartX, vpStartY, vpWidth, vpHeight)
    .stroke({ width: 2, color: 0xFFFFFF, alpha: 0.8 })
}

/**
 * Resize the minimap when window is resized
 */
function resizeMinimap() {
  if (!minimapContainer) return

  const { width: canvasWidth, height: canvasHeight } = getCanvasDimensions()
  minimapContainer.x = canvasWidth - MINIMAP_SIZE - MINIMAP_PADDING
  minimapContainer.y = canvasHeight - MINIMAP_SIZE - MINIMAP_PADDING - CONSTANTS.UI.BOTTOM_BAR_HEIGHT
}
