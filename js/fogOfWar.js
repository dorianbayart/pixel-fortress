// js/fogOfWar.js
export { updateVisibility, initFogOfWar, renderFog, isPositionVisible, isPositionExplored }

'use strict'

import { getMapDimensions, getTileSize } from 'dimensions'
import * as PIXI from 'pixijs'
import { app, containers } from 'renderer'
import gameState from 'state'

// Fog of war constants
const FOG_UPDATE_INTERVAL = 400 // ms between fog updates
const FOG_COLOR = 0x000000 // Black fog
const FOG_ALPHA_EXPLORED = 0.7 // Alpha for explored but not visible areas

// Internal state
let fogContainer = null
let fogGrid = null
let exploredGrid = null
let lastFogUpdate = 0
let fogTime = 0
let fogGraphics = null

/**
 * Initialize the fog of war system
 */
function initFogOfWar() {
  const { width, height } = getMapDimensions()
  
  // Create fog grids
  fogGrid = Array(width).fill().map(() => Array(height).fill(1)) // 1 = fully fogged
  exploredGrid = Array(width).fill().map(() => Array(height).fill(false)) // false = not explored
  
  // Create fog container
  if (fogContainer) {
    containers.ui.removeChild(fogContainer)
  }
  
  fogContainer = new PIXI.Container()
  fogContainer.sortableChildren = true
  
  // Create fog graphics object
  fogGraphics = new PIXI.Graphics()
  fogContainer.addChild(fogGraphics)
  
  // Add container to stage (between terrain and UI)
  containers.ui.addChild(fogContainer)
  
  // Initialize visibility around starting position
  updateStartingVisibility()
  
  // Make immediate first update
  updateVisibility(0, true)
  
  return true
}

/**
 * Update the visibility grid based on unit and building positions
 * @param {number} delay - Time since last update
 * @param {boolean} force - Force update regardless of interval
 */
function updateVisibility(delay, force = false) {
  fogTime += delay
  lastFogUpdate += delay
  
  // Only update at set intervals to save performance
  if (!force && lastFogUpdate < FOG_UPDATE_INTERVAL) {
    return
  }
  
  lastFogUpdate = 0
  
  // Reset fog to fully dark
  const { width, height } = getMapDimensions()
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      fogGrid[x][y] = 1 // 1 = fully fogged
    }
  }
  
  // Reveal areas around player's units
  const revealFromEntities = (entities) => {
    entities.forEach(entity => {
      if (!entity) return

      const tileX = entity.currentNode?.x ? Math.round(entity.x / getTileSize()) : entity.x
      const tileY = entity.currentNode?.y ? Math.round(entity.y / getTileSize()) : entity.y
      const visibilityRange = entity.visibilityRange / getTileSize()
      
      // Reveal circular area around entity
      const rangeSquared = visibilityRange * visibilityRange
      
      for (let dx = -Math.ceil(visibilityRange); dx <= Math.ceil(visibilityRange); dx++) {
        for (let dy = -Math.ceil(visibilityRange); dy <= Math.ceil(visibilityRange); dy++) {
          const distanceSquared = dx * dx + dy * dy
          
          if (distanceSquared <= rangeSquared) {
            const x = tileX + dx
            const y = tileY + dy
            
            // Check if within map bounds
            if (x >= 0 && x < width && y >= 0 && y < height) {
              // Calculate fog factor based on distance (closer = clearer)
              const distanceFactor = Math.min(1, 1 - Math.log(0.4 + (Math.sqrt(distanceSquared) / visibilityRange)))
              
              // Brighter at center, darker at edges
              fogGrid[x][y] = Math.min(fogGrid[x][y], 1 - distanceFactor)
              
              // Mark as explored
              exploredGrid[x][y] = true
            }
          }
        }
      }
    })
  }
  
  // Update from player's units and buildings
  if (gameState.humanPlayer) {
    revealFromEntities(gameState.humanPlayer.getUnits())
    revealFromEntities(gameState.humanPlayer.getBuildings())
  }
  
  // Mark that we need to render the fog
  renderFog(0)
}

/**
 * Set initial visibility for player's starting area
 */
function updateStartingVisibility() {
  const { width, height } = getMapDimensions()
  
  // Find player's starting building (usually a tent)
  if (gameState.humanPlayer) {
    const startingBuildings = gameState.humanPlayer.getBuildings()
    
    if (startingBuildings.length > 0) {
      const startBuilding = startingBuildings[0]
      const tileX = Math.floor(startBuilding.x)
      const tileY = Math.floor(startBuilding.y)
      const initialRange = 12 // Initial visibility range in tiles
      
      // Reveal a large area around starting position
      for (let dx = -initialRange; dx <= initialRange; dx++) {
        for (let dy = -initialRange; dy <= initialRange; dy++) {
          const distSq = dx*dx + dy*dy
          if (distSq > initialRange*initialRange) continue
          
          const x = tileX + dx
          const y = tileY + dy
          
          // Check if within map bounds
          if (x >= 0 && x < width && y >= 0 && y < height) {
            // Mark as explored
            exploredGrid[x][y] = true
          }
        }
      }
    }
  }
}

/**
 * Render the fog of war
 * @param {number} delay - Time since last frame
 */
function renderFog(delay) {
  if (!fogGraphics || !fogContainer) return
  
  // Update fog animation
  fogTime += delay
  
  // Clear previous drawing
  fogGraphics.clear()
  
  const { width, height } = getMapDimensions()
  const tileSize = getTileSize()
  
  // Reposition fog (in case of camera movement)
  const viewTransform = gameState.UI?.mouse?.getViewTransform()
  if (viewTransform) {
    fogContainer.scale.set(viewTransform.scale, viewTransform.scale)
    fogContainer.position.set(
      -viewTransform.x * viewTransform.scale,
      -viewTransform.y * viewTransform.scale
    )
  }
  
  // Get the visible viewport for culling
  const viewport = {
    x: Math.max(0, Math.floor(viewTransform?.x / tileSize) || 0),
    y: Math.max(0, Math.floor(viewTransform?.y / tileSize) || 0),
    width: Math.ceil(app.renderer.width / (tileSize * (viewTransform?.scale || 1))),
    height: Math.ceil(app.renderer.height / (tileSize * (viewTransform?.scale || 1)))
  }
  
  // Add buffer to prevent edge artifacts while scrolling
  const buffer = 2
  const startX = Math.max(0, viewport.x - buffer)
  const startY = Math.max(0, viewport.y - buffer)
  const endX = Math.min(width, viewport.x + viewport.width + buffer)
  const endY = Math.min(height, viewport.y + viewport.height + buffer)
  
  // Draw fog for visible viewport only
  for (let x = startX; x < endX; x++) {
    for (let y = startY; y < endY; y++) {
      // Skip if coordinates are invalid
      if (x < 0 || x >= width || y < 0 || y >= height) continue
      
      const isExplored = exploredGrid[x][y]

      // Skip completely unexplored areas (no need to draw fog since we're not rendering these tiles)
      if (!isExplored) continue

      const fogValue = fogGrid[x][y]
      
      // If explored but not visible, draw partial fog
      if (fogValue > 0.9) {
        fogGraphics.beginFill(FOG_COLOR, FOG_ALPHA_EXPLORED)
        fogGraphics.drawRect(x * tileSize, y * tileSize, tileSize, tileSize)
        fogGraphics.endFill()
      }
      // If currently visible but partially fogged, draw gradient fog
      else if (fogValue > 0.1) {
        fogGraphics.beginFill(FOG_COLOR, fogValue * FOG_ALPHA_EXPLORED)
        fogGraphics.drawRect(x * tileSize, y * tileSize, tileSize, tileSize)
        fogGraphics.endFill()
      }
      // Completely visible tiles don't need fog
    }
  }
}

/**
 * Check if a position is visible
 * @param {number} x - X coordinate in tiles
 * @param {number} y - Y coordinate in tiles
 * @returns {boolean} True if visible
 */
function isPositionVisible(x, y) {
  // Always return true if fog of war is disabled
  if (!fogGrid) return true
  
  // Check if coordinates are valid
  if (x < 0 || x >= fogGrid.length || y < 0 || y >= fogGrid[0].length) {
    return false
  }
  
  // Return true if fog value is less than 0.9 (10% or more visible)
  return fogGrid[x][y] < 0.9
}

/**
 * Check if a position has been explored
 * @param {number} x - X coordinate in tiles
 * @param {number} y - Y coordinate in tiles
 * @returns {boolean} True if explored
 */
function isPositionExplored(x, y) {
  // Always return true if fog of war is disabled
  if (!exploredGrid) return true
  
  // Check if coordinates are valid
  if (x < 0 || x >= exploredGrid.length || y < 0 || y >= exploredGrid[0].length) {
    return false
  }
  
  // Return true if the position has been explored
  return exploredGrid[x][y]
}