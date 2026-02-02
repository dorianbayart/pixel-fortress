/* Pixel Fortress - Fog of War Bitmap Rendering System
 * Copyright (C) 2024-2025 Dorian Bayart
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

'use strict'

import * as PIXI from 'pixijs'
import CONSTANTS from 'constants'
import { getTileSize } from 'dimensions'

const FOG_REBUILD_THRESHOLD_TILES = CONSTANTS.BITMAP_RENDERING.FOG_REBUILD_THRESHOLD_TILES  // 2 tiles
const FOG_UPDATE_INTERVAL_MS = CONSTANTS.BITMAP_RENDERING.FOG_UPDATE_INTERVAL_MS            // 66ms (~15 FPS)
const FOG_COLOR = CONSTANTS.FOG_OF_WAR.COLOR
const FOG_ALPHA_EXPLORED = CONSTANTS.FOG_OF_WAR.ALPHA_EXPLORED

// Persistent fog bitmap and sprite
let fogBitmap = null
let fogSprite = null
let lastUpdateTime = 0

// Single-tile fog texture
let fogTexture = null

// Cached dimensions for resize detection
let lastBitmapWidth = 0
let lastBitmapHeight = 0

/**
 * Initialize fog texture
 * @param {PIXI.Application} app - The PixiJS application
 */
function initFogTexture(app) {
  if (fogTexture || !app?.renderer) return

  const TILE_SIZE = getTileSize()

  const graphics = new PIXI.Graphics()
    .rect(0, 0, TILE_SIZE, TILE_SIZE)
    .fill({ color: FOG_COLOR })

  fogTexture = app.renderer.generateTexture(graphics, {
    scaleMode: PIXI.SCALE_MODES.NEAREST,
    resolution: 1
  })

  graphics.destroy()
}

/**
 * Check if fog bitmap should be updated
 * Bitmap displays every frame but only updates periodically
 * @returns {boolean}
 */
function shouldUpdateFogBitmap() {
  return performance.now() - lastUpdateTime >= FOG_UPDATE_INTERVAL_MS
}

/**
 * Update and display fog bitmap
 * Displays every frame (cheap), updates contents periodically (expensive)
 *
 * @param {Object} viewport - Current viewport bounds
 * @param {Array} fogGrid - Fog values grid
 * @param {Array} exploredGrid - Explored tiles grid
 * @param {Object} fogContainer - Container to add fog sprite to
 * @param {PIXI.Application} app - The PixiJS application
 */
function updateAndDisplayFog(viewport, fogGrid, exploredGrid, fogContainer, app) {
  if (!app?.renderer || !fogGrid || !exploredGrid || !fogContainer) return

  if (!fogTexture) {
    initFogTexture(app)
  }

  const TILE_SIZE = getTileSize()

  // Cover entire map like terrain bitmap
  const startX = 0
  const startY = 0
  const endX = fogGrid.length
  const endY = fogGrid[0].length

  const bitmapWidth = endX * TILE_SIZE
  const bitmapHeight = endY * TILE_SIZE

  const needsResize = !fogBitmap ||
                      bitmapWidth !== lastBitmapWidth ||
                      bitmapHeight !== lastBitmapHeight

  if (needsResize) {
    if (fogBitmap) {
      fogBitmap.destroy(true)
    }

    fogBitmap = PIXI.RenderTexture.create({
      width: bitmapWidth,
      height: bitmapHeight,
      scaleMode: PIXI.SCALE_MODES.NEAREST
    })

    lastBitmapWidth = bitmapWidth
    lastBitmapHeight = bitmapHeight
    lastUpdateTime = 0
  }

  // Update bitmap contents periodically
  const shouldUpdate = shouldUpdateFogBitmap() || needsResize

  if (shouldUpdate) {
    updateFogBitmapContents(startX, startY, endX, endY, fogGrid, exploredGrid, app)
    lastUpdateTime = performance.now()
  }

  // Display: create or update sprite
  if (!fogSprite) {
    fogSprite = new PIXI.Sprite(fogBitmap)
    fogSprite.x = 0
    fogSprite.y = 0
    fogContainer.addChild(fogSprite)
  } else if (fogSprite.texture !== fogBitmap) {
    fogSprite.texture = fogBitmap
  }

  fogSprite.visible = true
}

/**
 * Update fog bitmap contents with current fog values
 * Expensive operation - runs periodically
 *
 * @param {number} startX - Start X tile coordinate
 * @param {number} startY - Start Y tile coordinate
 * @param {number} endX - End X tile coordinate
 * @param {number} endY - End Y tile coordinate
 * @param {Array} fogGrid - Fog values grid
 * @param {Array} exploredGrid - Explored tiles grid
 * @param {PIXI.Application} app - The PixiJS application
 */
function updateFogBitmapContents(startX, startY, endX, endY, fogGrid, exploredGrid, app) {
  const TILE_SIZE = getTileSize()
  const tempContainer = new PIXI.Container()
  for (let x = startX; x < endX; x++) {
    for (let y = startY; y < endY; y++) {
      if (x < 0 || x >= fogGrid.length || y < 0 || y >= fogGrid[0].length) continue

      const isExplored = exploredGrid[x][y]
      const fogValue = fogGrid[x][y]

      let fogAlpha

      if (!isExplored) {
        fogAlpha = 0.95
      } else if (fogValue <= 0.1) {
        continue
      } else {
        if (fogValue > 0.9) {
          fogAlpha = FOG_ALPHA_EXPLORED
        } else {
          fogAlpha = fogValue * FOG_ALPHA_EXPLORED
        }
      }

      const sprite = new PIXI.Sprite(fogTexture)
      sprite.x = x * TILE_SIZE
      sprite.y = y * TILE_SIZE
      sprite.alpha = fogAlpha

      tempContainer.addChild(sprite)
    }
  }

  app.renderer.render(tempContainer, { renderTexture: fogBitmap, clear: true })
  tempContainer.destroy({ children: true, texture: false, baseTexture: false })
}


/**
 * Clear fog bitmap and sprite
 */
function clearFogBitmap() {
  if (fogSprite) {
    if (fogSprite.parent) {
      fogSprite.parent.removeChild(fogSprite)
    }
    fogSprite.destroy()
    fogSprite = null
  }

  if (fogBitmap) {
    fogBitmap.destroy(true)
    fogBitmap = null
  }

  if (fogTexture) {
    fogTexture.destroy(true)
    fogTexture = null
  }
}

/**
 * Check if fog bitmap is enabled
 * @returns {boolean}
 */
function isFogBitmapEnabled() {
  return fogSprite !== null && fogBitmap !== null
}

/**
 * Get fog sprite for external manipulation (e.g., visibility)
 * @returns {PIXI.Sprite}
 */
function getFogSprite() {
  return fogSprite
}

export {
  updateAndDisplayFog,  // Call every frame
  clearFogBitmap,
  isFogBitmapEnabled,
  getFogSprite,
  initFogTexture
}
