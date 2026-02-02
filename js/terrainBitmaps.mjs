/* Pixel Fortress - Terrain Bitmap Rendering System
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
import { getMapDimensions, getTileSize } from 'dimensions'
import gameState from 'state'

const TERRAIN_TYPES = CONSTANTS.TERRAIN.TYPES
const GOLD_TINT = 0xFFEA7D

// 4 terrain bitmaps (one per water animation frame)
let terrainBitmaps = []

// Single sprite displays the entire terrain bitmap
let terrainBitmapSprite = null

let currentDisplayFrame = 0

/**
 * Generate terrain bitmaps for the entire map
 * Creates 4 bitmaps (one per water animation frame) that pre-render all static terrain
 *
 * @param {Array} map - The game map array
 * @param {PIXI.Application} app - The PixiJS application
 * @param {Object} containers - The rendering containers
 * @returns {Promise<boolean>} True if successful, false if fallback needed
 */
async function generateTerrainBitmaps(map, app, containers) {
  if (!map || !app?.renderer) {
    console.error('Cannot generate terrain bitmaps: map or renderer not available')
    return false
  }

  const gl = app.renderer.gl
  if (!gl) {
    console.error('WebGL context not available - cannot generate terrain bitmaps')
    return false
  }

  const { width: MAP_WIDTH, height: MAP_HEIGHT } = getMapDimensions()
  const TILE_SIZE = getTileSize()

  const bitmapWidth = MAP_WIDTH * TILE_SIZE
  const bitmapHeight = MAP_HEIGHT * TILE_SIZE

  console.log(`Generating terrain bitmaps: ${bitmapWidth}x${bitmapHeight} (${MAP_WIDTH}x${MAP_HEIGHT} tiles)`)

  const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE)
  console.log(`  Max texture size: ${maxTextureSize}x${maxTextureSize}`)

  if (bitmapWidth > maxTextureSize || bitmapHeight > maxTextureSize) {
    console.error(`Map size ${bitmapWidth}x${bitmapHeight} exceeds max texture size ${maxTextureSize}`)
    return false
  }

  if (performance.memory) {
    const usedMB = (performance.memory.usedJSHeapSize / (1024 * 1024)).toFixed(0)
    const limitMB = (performance.memory.jsHeapSizeLimit / (1024 * 1024)).toFixed(0)
    const percent = ((performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100).toFixed(1)
    console.log(`  Memory: ${usedMB}MB / ${limitMB}MB (${percent}%)`)
  }

  clearTerrainBitmaps()

  for (let waterFrame = 0; waterFrame < 4; waterFrame++) {
    const tempContainer = new PIXI.Container()

    for (let x = 0; x < MAP_WIDTH; x++) {
      for (let y = 0; y < MAP_HEIGHT; y++) {
        const tile = map[x][y]
        const tileType = tile.type

        // Render grass/sand background first
        if (tile.back) {
          const backSprite = new PIXI.Sprite(tile.back)
          backSprite.x = x * TILE_SIZE
          backSprite.y = y * TILE_SIZE
          tempContainer.addChild(backSprite)
        }

        // Skip living trees - they render in world objects layer for depth sorting
        if (tileType === TERRAIN_TYPES.TREE.type && tile.resource > 0) {
          continue
        }

        let texture = null
        if (tileType === TERRAIN_TYPES.WATER.type && tile.waterFrames) {
          texture = tile.waterFrames[waterFrame]
        } else if (tile.sprite) {
          texture = tile.sprite  // Gold, rocks, depleted trees
        }

        if (texture) {
          const sprite = new PIXI.Sprite(texture)
          sprite.x = x * TILE_SIZE
          sprite.y = y * TILE_SIZE

          if (tileType === TERRAIN_TYPES.GOLD.type) {
            sprite.tint = GOLD_TINT
          }

          tempContainer.addChild(sprite)
        }
      }
    }

    // "Bake" container into static bitmap
    const canvas = app.renderer.extract.canvas(tempContainer)

    // Use regular Texture (not RenderTexture) to avoid renderer lifecycle issues
    const texture = PIXI.Texture.from(canvas, {
      scaleMode: PIXI.SCALE_MODES.NEAREST
    })

    if (texture.baseTexture) {
      texture.baseTexture.resolution = app.renderer.resolution
      texture.baseTexture.destroyable = false
    }

    tempContainer.destroy({ children: true, texture: false, baseTexture: false })
    terrainBitmaps.push(texture)

    // Force NEAREST scale mode on the bitmap texture                                                                                                                                                                                       
    if (texture.source) {
      texture.source.scaleMode = PIXI.SCALE_MODES.NEAREST
    }
  }

  if (terrainBitmaps.length > 0) {
    terrainBitmapSprite = new PIXI.Sprite(terrainBitmaps[0])
    terrainBitmapSprite.x = 0
    terrainBitmapSprite.y = 0

    // Compensate for high DPI renderer extraction
    const renderResolution = app.renderer.resolution
    terrainBitmapSprite.scale.set(1 / renderResolution, 1 / renderResolution)

    terrainBitmapSprite.destroyable = false
    containers.background.addChild(terrainBitmapSprite)
    currentDisplayFrame = 0
  }

  const memoryPerBitmap = (bitmapWidth * bitmapHeight * 4) / (1024 * 1024)
  const totalMemory = memoryPerBitmap * 4
  console.log(`✓ Terrain bitmaps generated: 4 bitmaps of ${bitmapWidth}x${bitmapHeight}`)
  console.log(`  Estimated memory usage: ${totalMemory.toFixed(1)} MB`)

  return true
}


/**
 * Update terrain bitmap display with current water animation frame
 * Very fast - just swaps texture reference
 *
 * @param {number} waterFrame - Current water animation frame (0-3)
 * @param {Object} containers - The rendering containers
 */
function updateTerrainBitmapDisplay(waterFrame, containers) {
  if (!terrainBitmapSprite || terrainBitmaps.length !== 4) {
    return
  }

  // Re-add sprite if it was removed (defensive)
  if (terrainBitmapSprite.parent !== containers?.background) {
    if (containers?.background) {
      containers.background.addChild(terrainBitmapSprite)
      console.warn('Terrain bitmap sprite was detached - re-added to container')
    }
  }

  if (waterFrame !== currentDisplayFrame) {
    terrainBitmapSprite.texture = terrainBitmaps[waterFrame]
    currentDisplayFrame = waterFrame
  }
}

/**
 * Regenerate a small region of all terrain bitmaps
 * Used when terrain changes (e.g., tree becomes depleted)
 *
 * @param {number} x - Starting X tile coordinate
 * @param {number} y - Starting Y tile coordinate
 * @param {number} width - Width in tiles
 * @param {number} height - Height in tiles
 * @param {PIXI.Application} app - The PixiJS application
 */
function regenerateTerrainRegion(x, y, width, height, app) {
  if (terrainBitmaps.length !== 4 || !app?.renderer) return

  const { width: MAP_WIDTH, height: MAP_HEIGHT } = getMapDimensions()
  const TILE_SIZE = getTileSize()

  const startX = Math.max(0, x)
  const startY = Math.max(0, y)
  const endX = Math.min(MAP_WIDTH, x + width)
  const endY = Math.min(MAP_HEIGHT, y + height)

  for (let waterFrame = 0; waterFrame < 4; waterFrame++) {
    const regionContainer = new PIXI.Container()

    for (let rx = startX; rx < endX; rx++) {
      for (let ry = startY; ry < endY; ry++) {
        const tile = gameState.map[rx][ry]
        const tileType = tile.type

        // Render grass/sand background first
        if (tile.back) {
          const backSprite = new PIXI.Sprite(tile.back)
          backSprite.x = (rx - startX) * TILE_SIZE
          backSprite.y = (ry - startY) * TILE_SIZE
          regionContainer.addChild(backSprite)
        }

        // Skip living trees - they render in world objects layer
        if (tileType === TERRAIN_TYPES.TREE.type && tile.resource > 0) {
          continue
        }

        let texture = null
        if (tileType === TERRAIN_TYPES.WATER.type && tile.waterFrames) {
          texture = tile.waterFrames[waterFrame]
        } else if (tile.sprite) {
          texture = tile.sprite
        }

        if (texture) {
          const sprite = new PIXI.Sprite(texture)
          sprite.x = (rx - startX) * TILE_SIZE
          sprite.y = (ry - startY) * TILE_SIZE

          if (tileType === TERRAIN_TYPES.GOLD.type) {
            sprite.tint = GOLD_TINT
          }

          regionContainer.addChild(sprite)
        }
      }
    }

    regionContainer.x = startX * TILE_SIZE
    regionContainer.y = startY * TILE_SIZE

    // Update region only, don't clear entire bitmap
    app.renderer.render(regionContainer, {
      renderTexture: terrainBitmaps[waterFrame],
      clear: false
    })

    regionContainer.destroy({ children: true, texture: false, baseTexture: false })
  }
}

/**
 * Clear all terrain bitmaps and sprites
 */
function clearTerrainBitmaps() {
  if (terrainBitmapSprite) {
    if (terrainBitmapSprite.parent) {
      terrainBitmapSprite.parent.removeChild(terrainBitmapSprite)
    }
    terrainBitmapSprite.destroy()
    terrainBitmapSprite = null
  }

  terrainBitmaps.forEach((bitmap) => {
    if (bitmap) {
      bitmap.destroy(true)
    }
  })

  terrainBitmaps = []
  currentDisplayFrame = 0
}

/**
 * Check if terrain bitmap system is enabled and ready
 * @returns {boolean}
 */
function isTerrainBitmapEnabled() {
  return terrainBitmaps.length === 4 && terrainBitmapSprite !== null
}

export {
  generateTerrainBitmaps,
  updateTerrainBitmapDisplay,
  regenerateTerrainRegion,
  clearTerrainBitmaps,
  isTerrainBitmapEnabled
}
