// js/fogOfWar.js
export {
  initFogOfWar,
  isPositionExplored,
  isPositionVisible,
  renderFog,
  updateVisibility,
  updatePlayerVisibility,
  getTeamId
}

'use strict'

import CONSTANTS from 'constants'
import { getMapDimensions, getTileSize } from 'dimensions'
import { drawBack } from 'globals'
import * as PIXI from 'pixijs'
import { app, containers } from 'renderer'
import gameState from 'state'

// Fog of war constants (from centralized constants)
const FOG_UPDATE_INTERVAL = CONSTANTS.FOG_OF_WAR.UPDATE_INTERVAL
const FOG_COLOR = CONSTANTS.FOG_OF_WAR.COLOR
const FOG_ALPHA_EXPLORED = CONSTANTS.FOG_OF_WAR.ALPHA_EXPLORED

// Internal state
let fogContainer = null
let fogGridsByTeam = new Map() // Map<teamId, 2D array> - fog grid per team
let exploredGridsByTeam = new Map() // Map<teamId, 2D array> - explored grid per team
let lastFogUpdate = 0
let fogTime = 0
let fogSpriteMap = new Map() // Map<tileKey, PIXI.Sprite> - cached fog sprites per tile
let fogTexture = null // Cached texture for fog tiles

/**
 * Get the team ID for a player
 * For now, each player is their own team (player === team)
 * In the future, this will support multiple players on the same team
 * @param {Player} player - The player object
 * @returns {string} - The team ID
 */
function getTeamId(player) {
  // For now, each player is their own team
  // Use player type + index to create unique team IDs
  if (player === gameState.humanPlayer) {
    return 'human'
  }
  // For AI players, find their index
  const aiIndex = gameState.aiPlayers.indexOf(player)
  return `ai-${aiIndex}`
}

/**
 * Initialize fog grids for a specific team
 * @param {string} teamId - The team ID
 * @returns {object} - Object containing fogGrid and exploredGrid
 */
function initTeamGrids(teamId) {
  const { width, height } = getMapDimensions()

  const fogGrid = Array(width).fill().map(() => Array(height).fill(1)) // 1 = fully fogged
  const exploredGrid = Array(width).fill().map(() => Array(height).fill(false)) // false = not explored

  fogGridsByTeam.set(teamId, fogGrid)
  exploredGridsByTeam.set(teamId, exploredGrid)

  return { fogGrid, exploredGrid }
}

/**
 * Get fog grids for a specific team (creates if not exists)
 * @param {string} teamId - The team ID
 * @returns {object} - Object containing fogGrid and exploredGrid
 */
function getTeamGrids(teamId) {
  if (!fogGridsByTeam.has(teamId)) {
    return initTeamGrids(teamId)
  }
  return {
    fogGrid: fogGridsByTeam.get(teamId),
    exploredGrid: exploredGridsByTeam.get(teamId)
  }
}

/**
 * Initialize the fog of war system
 */
function initFogOfWar() {
  // Clear existing grids
  fogGridsByTeam.clear()
  exploredGridsByTeam.clear()

  // Initialize fog grids for all players
  // Human player
  if (gameState.humanPlayer) {
    initTeamGrids('human')
  }

  // AI players
  gameState.aiPlayers.forEach((aiPlayer, index) => {
    initTeamGrids(`ai-${index}`)
  })

  // Cleanup fog container
  if (fogContainer) {
    containers.ui?.removeChild(fogContainer)
    fogContainer.destroy({ children: true })
  }
  // Create fog container
  fogContainer = new PIXI.Container()
  fogContainer.sortableChildren = true

  // Clear fog sprite map (we'll recreate sprites as needed)
  fogSpriteMap.clear()

  // Create fog texture if not exists (reusable texture for all fog tiles)
  if (!fogTexture) {
    const tileSize = getTileSize()
    const graphics = new PIXI.Graphics()
      .rect(0, 0, tileSize, tileSize)
      .fill({ color: FOG_COLOR })
    fogTexture = app.renderer.generateTexture(graphics)
    graphics.destroy()
  }

  // Add container to stage (between terrain and UI)
  containers.ui.addChild(fogContainer)

  // Initialize visibility around starting position
  updateStartingVisibility()

  // Make immediate first update
  updateVisibility(0, true)

  return true
}

/**
 * Update visibility for a specific player
 * @param {Player} player - The player to update visibility for
 */
function updatePlayerVisibility(player) {
  const { width, height } = getMapDimensions()
  const teamId = getTeamId(player)
  const { fogGrid, exploredGrid } = getTeamGrids(teamId)

  // Reset fog to fully dark
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
              // Defensive check: Ensure fogGrid[x] is an array
              if (!Array.isArray(fogGrid[x])) {
                fogGrid[x] = Array(height).fill(1) // Re-initialize this column
                exploredGrid[x] = Array(height).fill(false) // Re-initialize corresponding explored column
              }

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
  revealFromEntities(player.getUnits())
  revealFromEntities(player.getBuildings())
}

/**
 * Update the visibility grid based on unit and building positions for all players
 * @param {number} delay - Time since last update
 * @param {boolean} force - Force update regardless of interval
 */
function updateVisibility(delay, force = false) {
  lastFogUpdate += delay

  if (!fogContainer) return

  // Only update at set intervals to save performance
  if (!force && lastFogUpdate < FOG_UPDATE_INTERVAL) {
    return
  }

  lastFogUpdate = 0

  // Update visibility for human player
  if (gameState.humanPlayer) {
    updatePlayerVisibility(gameState.humanPlayer)
  }

  // Update visibility for all AI players
  gameState.aiPlayers.forEach(aiPlayer => {
    updatePlayerVisibility(aiPlayer)
  })

  // Mark that we need to render the fog (human player only)
  renderFog(delay)
}

/**
 * Set initial visibility for a player's starting area
 * @param {Player} player - The player to update
 */
function updatePlayerStartingVisibility(player) {
  const { width, height } = getMapDimensions()
  const teamId = getTeamId(player)
  const { exploredGrid } = getTeamGrids(teamId)

  const startingBuildings = player.getBuildings()

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

/**
 * Set initial visibility for all players' starting areas
 */
function updateStartingVisibility() {
  // Update human player
  if (gameState.humanPlayer) {
    updatePlayerStartingVisibility(gameState.humanPlayer)
  }

  // Update all AI players
  gameState.aiPlayers.forEach(aiPlayer => {
    updatePlayerStartingVisibility(aiPlayer)
  })
}

/**
 * Render the fog of war
 * @param {number} delay - Time since last frame
 */
function renderFog(delay) {
  if (!fogContainer || !fogTexture) return

  // Update fog animation
  fogTime += delay

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

  // Get human player's grids for rendering
  if (!gameState.humanPlayer) return
  const humanTeamId = getTeamId(gameState.humanPlayer)
  const { fogGrid, exploredGrid } = getTeamGrids(humanTeamId)

  // Track which fog sprites should be visible this frame
  const visibleFogTiles = new Set()

  // Update fog sprites for visible viewport only
  for (let x = startX; x < endX; x++) {
    for (let y = startY; y < endY; y++) {
      // Skip if coordinates are invalid
      if (x < 0 || x >= width || y < 0 || y >= height) continue

      const isExplored = exploredGrid[x][y]

      // Skip completely unexplored areas
      if (!isExplored) continue

      const fogValue = fogGrid[x][y]

      // Skip completely visible tiles (no fog needed)
      if (fogValue <= 0.1) continue

      // This tile needs fog - get or create sprite
      const tileKey = `${x}_${y}`
      visibleFogTiles.add(tileKey)

      let fogSprite = fogSpriteMap.get(tileKey)

      if (!fogSprite) {
        // Create new fog sprite
        fogSprite = new PIXI.Sprite(fogTexture)
        fogSprite.x = x * tileSize
        fogSprite.y = y * tileSize
        fogSpriteMap.set(tileKey, fogSprite)
        fogContainer.addChild(fogSprite)
      }

      // Update alpha based on fog value (no redraw, just property update)
      if (fogValue > 0.9) {
        // Explored but not visible
        fogSprite.alpha = FOG_ALPHA_EXPLORED
      } else {
        // Partially fogged (gradient)
        fogSprite.alpha = fogValue * FOG_ALPHA_EXPLORED
      }

      fogSprite.visible = true
    }
  }

  // Hide fog sprites that are no longer in viewport (with extended buffer)
  const extendedBuffer = buffer * 4
  const farStartX = Math.max(0, viewport.x - extendedBuffer)
  const farStartY = Math.max(0, viewport.y - extendedBuffer)
  const farEndX = Math.min(width, viewport.x + viewport.width + extendedBuffer)
  const farEndY = Math.min(height, viewport.y + viewport.height + extendedBuffer)

  for (const [tileKey, fogSprite] of fogSpriteMap.entries()) {
    if (!visibleFogTiles.has(tileKey)) {
      const [x, y] = tileKey.split('_').map(Number)

      // If far outside viewport, remove sprite to free memory
      if (x < farStartX || x >= farEndX || y < farStartY || y >= farEndY) {
        fogContainer.removeChild(fogSprite)
        fogSprite.destroy()
        fogSpriteMap.delete(tileKey)
      } else {
        // Just hide if within extended buffer
        fogSprite.visible = false
      }
    }
  }

  drawBack()
}

/**
 * Check if a position is visible
 * @param {number} x - X coordinate in tiles
 * @param {number} y - Y coordinate in tiles
 * @param {Player} player - Optional player to check visibility for (defaults to human player)
 * @returns {boolean} True if visible
 */
function isPositionVisible(x, y, player = null) {
  // Default to human player if no player specified
  const checkPlayer = player || gameState.humanPlayer
  if (!checkPlayer) return true

  const teamId = getTeamId(checkPlayer)
  const { fogGrid } = getTeamGrids(teamId)

  // Always return true if fog of war is disabled or no grid exists
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
 * @param {Player} player - Optional player to check exploration for (defaults to human player)
 * @returns {boolean} True if explored
 */
function isPositionExplored(x, y, player = null) {
  // Default to human player if no player specified
  const checkPlayer = player || gameState.humanPlayer
  if (!checkPlayer) return true

  const teamId = getTeamId(checkPlayer)
  const { exploredGrid } = getTeamGrids(teamId)

  // Always return true if fog of war is disabled or no grid exists
  if (!exploredGrid) return true

  // Check if coordinates are valid
  if (x < 0 || x >= exploredGrid.length || y < 0 || y >= exploredGrid[0].length) {
    return false
  }

  // Return true if the position has been explored
  return exploredGrid[x][y]
}