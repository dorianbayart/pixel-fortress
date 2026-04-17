export { initMinimap, updateMinimap, resizeMinimap }

'use strict'

import CONSTANTS from 'constants'
import { getCanvasDimensions, getMapDimensions, getTileSize } from 'dimensions'
import { isPositionExplored, isPositionVisible } from 'fogOfWar'
import gameState from 'state'

const MINIMAP_SIZE = CONSTANTS.MINIMAP.SIZE
const MINIMAP_CONTENT_ALPHA = CONSTANTS.MINIMAP.CONTENT_ALPHA
const MINIMAP_UPDATE_INTERVAL = CONSTANTS.MINIMAP.UPDATE_INTERVAL
const COLORS = CONSTANTS.MINIMAP.COLORS
const TERRAIN_TYPES = CONSTANTS.TERRAIN.TYPES

let mainCanvas = null
let ctx = null
let offscreenCanvas = null
let offCtx = null
let lastContentUpdate = 0
let _minimapToggleHandler = null
let _minimapContainerHandler = null

function hexToRgba(hex, alpha = 1) {
  const r = (hex >> 16) & 0xff
  const g = (hex >> 8) & 0xff
  const b = hex & 0xff
  return `rgba(${r},${g},${b},${alpha})`
}

/**
 * Initialize the minimap using a dedicated HTML canvas element.
 * No parameters — the canvas is found by ID in the DOM.
 */
function initMinimap() {
  mainCanvas = document.getElementById('minimap-canvas')
  if (!mainCanvas) return

  const dpr = window.devicePixelRatio || 1
  mainCanvas.width = MINIMAP_SIZE * dpr
  mainCanvas.height = MINIMAP_SIZE * dpr
  ctx = mainCanvas.getContext('2d')
  ctx.scale(dpr, dpr)

  offscreenCanvas = document.createElement('canvas')
  offscreenCanvas.width = MINIMAP_SIZE * dpr
  offscreenCanvas.height = MINIMAP_SIZE * dpr
  offCtx = offscreenCanvas.getContext('2d')
  offCtx.scale(dpr, dpr)

  lastContentUpdate = 0

  // Toggle button (all devices) — stopPropagation prevents double-firing with container handler
  const toggleBtn = document.getElementById('minimap-toggle')
  if (toggleBtn) {
    if (_minimapToggleHandler) toggleBtn.removeEventListener('click', _minimapToggleHandler)
    _minimapToggleHandler = (e) => {
      e.stopPropagation()
      document.body.classList.toggle('minimap-minimized')
    }
    toggleBtn.addEventListener('click', _minimapToggleHandler)
  }

  // Mobile only: click anywhere on the minimap container to minimize/expand
  const container = document.getElementById('minimap-container')
  if (container) {
    if (_minimapContainerHandler) container.removeEventListener('click', _minimapContainerHandler)
    _minimapContainerHandler = () => {
      if (window.matchMedia('(max-width: 600px), (max-height: 600px)').matches) {
        document.body.classList.toggle('minimap-minimized')
      }
    }
    container.addEventListener('click', _minimapContainerHandler)
  }

  // Default to minimized on mobile
  if (window.matchMedia('(max-width: 600px), (max-height: 600px)').matches) {
    document.body.classList.add('minimap-minimized')
  }

  console.log('Minimap initialized')
}

/**
 * Update the minimap display — called every frame.
 * Content (terrain/buildings/units) is throttled; viewport rect updates every frame.
 * @param {number} timestamp - Current timestamp in milliseconds
 */
function updateMinimap(timestamp = performance.now()) {
  if (!ctx || !gameState.map) return

  if (timestamp - lastContentUpdate >= MINIMAP_UPDATE_INTERVAL) {
    updateMinimapContent()
    lastContentUpdate = timestamp
  }

  renderMinimap()
}

/**
 * Draw terrain, buildings and units onto the offscreen canvas.
 * Throttled to MINIMAP_UPDATE_INTERVAL.
 */
function updateMinimapContent() {
  const { width: mapWidth, height: mapHeight } = getMapDimensions()
  const tileSize = getTileSize()

  const minDimension = Math.min(mapWidth, mapHeight)
  const pixelSize = MINIMAP_SIZE / minDimension

  const viewTransform = gameState.UI?.mouse?.getViewTransform()
  const { width: canvasWidth, height: canvasHeight } = getCanvasDimensions()

  const scale = viewTransform?.scale || 1
  const viewWidthInTiles = canvasWidth / (tileSize * scale)
  const viewHeightInTiles = canvasHeight / (tileSize * scale)
  const viewCenterX = (viewTransform?.x || 0) / tileSize + viewWidthInTiles / 2
  const viewCenterY = (viewTransform?.y || 0) / tileSize + viewHeightInTiles / 2

  const minimapTilesWidth = MINIMAP_SIZE / pixelSize
  const minimapTilesHeight = MINIMAP_SIZE / pixelSize

  let startX = Math.floor(viewCenterX - minimapTilesWidth / 2)
  let startY = Math.floor(viewCenterY - minimapTilesHeight / 2)
  startX = Math.max(0, Math.min(startX, mapWidth - minimapTilesWidth))
  startY = Math.max(0, Math.min(startY, mapHeight - minimapTilesHeight))

  const endX = Math.min(mapWidth, startX + minimapTilesWidth)
  const endY = Math.min(mapHeight, startY + minimapTilesHeight)

  offCtx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE)
  offCtx.globalAlpha = MINIMAP_CONTENT_ALPHA

  // Draw terrain
  for (let x = Math.floor(startX); x < Math.ceil(endX); x++) {
    for (let y = Math.floor(startY); y < Math.ceil(endY); y++) {
      if (x < 0 || x >= mapWidth || y < 0 || y >= mapHeight) continue

      const tile = gameState.map[x][y]

      if (gameState.settings.fogOfWar && !isPositionExplored(x, y)) {
        offCtx.fillStyle = hexToRgba(COLORS.UNEXPLORED)
        offCtx.fillRect((x - startX) * pixelSize, (y - startY) * pixelSize, pixelSize, pixelSize)
        continue
      }

      let color = COLORS.GRASS
      switch (tile.type) {
        case TERRAIN_TYPES.WATER.type:         color = COLORS.WATER; break
        case TERRAIN_TYPES.GRASS.type:         color = COLORS.GRASS; break
        case TERRAIN_TYPES.SAND.type:          color = COLORS.SAND; break
        case TERRAIN_TYPES.TREE.type:          color = COLORS.TREE; break
        case TERRAIN_TYPES.DEPLETED_TREE.type: color = COLORS.DEPLETED_TREE; break
        case TERRAIN_TYPES.ROCK.type:          color = COLORS.ROCK; break
        case TERRAIN_TYPES.GOLD.type:          color = COLORS.GOLD; break
      }
      offCtx.fillStyle = hexToRgba(color)
      offCtx.fillRect((x - startX) * pixelSize, (y - startY) * pixelSize, pixelSize, pixelSize)
    }
  }

  // Draw buildings
  if (gameState.humanPlayer) {
    offCtx.fillStyle = hexToRgba(gameState.humanPlayer.color)
    gameState.humanPlayer.getBuildings().forEach(building => {
      if (building.x >= startX && building.x < endX && building.y >= startY && building.y < endY) {
        offCtx.fillRect((building.x - startX) * pixelSize, (building.y - startY) * pixelSize, pixelSize, pixelSize)
      }
    })
  }

  if (gameState.aiPlayers) {
    gameState.aiPlayers.forEach(ai => {
      offCtx.fillStyle = hexToRgba(ai.color)
      ai.getBuildings().forEach(building => {
        if (building.x >= startX && building.x < endX && building.y >= startY && building.y < endY) {
          if (!gameState.settings.fogOfWar || isPositionVisible(building.x, building.y)) {
            offCtx.fillRect((building.x - startX) * pixelSize, (building.y - startY) * pixelSize, pixelSize, pixelSize)
          }
        }
      })
    })
  }

  // Draw units
  if (gameState.humanPlayer) {
    offCtx.fillStyle = hexToRgba(gameState.humanPlayer.color)
    gameState.humanPlayer.getUnits().forEach(unit => {
      const tileX = Math.floor(unit.x / tileSize)
      const tileY = Math.floor(unit.y / tileSize)
      if (tileX >= startX && tileX < endX && tileY >= startY && tileY < endY) {
        offCtx.fillRect((tileX - startX) * pixelSize, (tileY - startY) * pixelSize, pixelSize, pixelSize)
      }
    })
  }

  if (gameState.aiPlayers) {
    gameState.aiPlayers.forEach(ai => {
      offCtx.fillStyle = hexToRgba(ai.color)
      ai.getUnits().forEach(unit => {
        const tileX = Math.floor(unit.x / tileSize)
        const tileY = Math.floor(unit.y / tileSize)
        if (tileX >= startX && tileX < endX && tileY >= startY && tileY < endY) {
          if (!gameState.settings.fogOfWar || isPositionVisible(tileX, tileY)) {
            offCtx.fillRect((tileX - startX) * pixelSize, (tileY - startY) * pixelSize, pixelSize, pixelSize)
          }
        }
      })
    })
  }
}

/**
 * Blit the offscreen canvas and draw the viewport indicator — called every frame.
 */
function renderMinimap() {
  ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE)
  ctx.globalAlpha = 1
  ctx.drawImage(offscreenCanvas, 0, 0, MINIMAP_SIZE, MINIMAP_SIZE)
  drawViewportIndicator()
}

/**
 * Draw the white viewport rectangle on the main canvas — runs every frame.
 * Recomputes start/pixel values from current viewTransform so it tracks smoothly.
 */
function drawViewportIndicator() {
  if (!gameState.map) return

  const { width: mapWidth, height: mapHeight } = getMapDimensions()
  const tileSize = getTileSize()
  const viewTransform = gameState.UI?.mouse?.getViewTransform()
  const { width: canvasWidth, height: canvasHeight } = getCanvasDimensions()

  const scale = viewTransform?.scale || 1
  const viewWidthInTiles = canvasWidth / (tileSize * scale)
  const viewHeightInTiles = canvasHeight / (tileSize * scale)
  const viewCenterX = (viewTransform?.x || 0) / tileSize + viewWidthInTiles / 2
  const viewCenterY = (viewTransform?.y || 0) / tileSize + viewHeightInTiles / 2

  const minDimension = Math.min(mapWidth, mapHeight)
  const pixelSize = MINIMAP_SIZE / minDimension
  const minimapTilesWidth = MINIMAP_SIZE / pixelSize

  let startX = Math.floor(viewCenterX - minimapTilesWidth / 2)
  let startY = Math.floor(viewCenterY - minimapTilesWidth / 2)
  startX = Math.max(0, Math.min(startX, mapWidth - minimapTilesWidth))
  startY = Math.max(0, Math.min(startY, mapHeight - minimapTilesWidth))

  const vpX = ((viewTransform?.x || 0) / tileSize - startX) * pixelSize
  const vpY = ((viewTransform?.y || 0) / tileSize - startY) * pixelSize
  const vpW = viewWidthInTiles * pixelSize
  const vpH = viewHeightInTiles * pixelSize

  ctx.globalAlpha = 0.8
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 1.5
  ctx.strokeRect(vpX, vpY, vpW, vpH)
  ctx.globalAlpha = 1
}

/**
 * Resize the minimap on window resize — recreates canvases at new DPR.
 */
function resizeMinimap() {
  initMinimap()
}
