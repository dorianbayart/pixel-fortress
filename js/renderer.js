export {
  app, containers, createProgressIndicator, drawBackground, drawMain, indicatorMap, initCanvases, loadTextureFromCanvas, removeProgressIndicator, resizeCanvases, updateProgressIndicator, updateZoom
}

'use strict'

import { getCanvasDimensions, getMapDimensions, getTileSize } from 'dimensions'
import { isPositionExplored, isPositionVisible } from 'fogOfWar'
import { TERRAIN_TYPES } from 'game'
import { DEBUG, backDrawn } from 'globals'
import { ParticleEffect, createParticleEmitter, initParticleSystem } from 'particles'
import * as PIXI from 'pixijs'
import { UNIT_SPRITE_SIZE, offscreenSprite, sprites } from 'sprites'
import gameState from 'state'
import { SCALE_MODE, getCachedSprite, textureCache } from 'utils'

// Pixi.js Application
let app = null

// Containers for organizing display objects
const containers = {
  background: null,
  terrain: null,
  units: null,
  particles: null,
  indicators: null,
  ui: null,
  debug: null
}

const indicatorMap = new Map()
const unitSpriteMap = new Map()
const backgroundSpriteMap = new Map()
const terrainSpriteMap = new Map()

// Sprite coordinates for special tiles
let spriteCoords_Start = { x: 21, y: 5 }
let spriteCoords_End = { x: 22, y: 4 }
let spriteCoords_Path = { x: 22, y: 5 }
let spriteCoords_Mouse = { x: 21, y: 4 }

// Performance tracking
let drawMainTimings = new Array(50).fill(10)

// Viewport tracking for culling
let viewport = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  // Buffer size in tiles to render outside visible area (prevents pop-in during scrolling)
  buffer: 2
}

/**
 * Convert an OffscreenCanvas to a PIXI.Texture
 * This allows dynamically generated canvas content to be used in the PIXI rendering pipeline.
 * The function handles conversion to a blob, creating a URL, and proper cleanup.
 * 
 * @param {OffscreenCanvas} canvas - Canvas to convert
 * @param {string} key - Cache key
 * @returns {PIXI.Texture} The created texture
 */
function loadTextureFromCanvas(canvas, key) {
  if (textureCache.has(key)) {
    return textureCache.get(key)
  }
  
  // Create a Blob from the canvas
  const blob = canvas.convertToBlob ? canvas.convertToBlob() : new Promise(resolve => canvas.toBlob(resolve))
  
  // Create a URL from the Blob
  const url = URL.createObjectURL(blob)
  
  // Load the texture from the URL
  const texture = PIXI.Texture.from(url)
  texture.source.resolution = getCanvasDimensions().dpr
  texture.source.scaleMode = SCALE_MODE
  
  // Store in cache
  textureCache.set(key, texture)
  
  // Clean up the URL when the texture is loaded
  texture.on('update', () => {
    URL.revokeObjectURL(url)
  })
  
  return texture
}

/**
 * Initialize Pixi.js application and containers
 */
async function initCanvases() {
  // Get canvas dimensions from centralized system
  const { width, height, dpr } = getCanvasDimensions()

  // Create Pixi Application
  if(!app) {
    app = new PIXI.Application()
    await app.init({
      width: width,
      height: height,
      // backgroundColor: 0x228b22, // Forestgreen background
      backgroundAlpha: 0,
      resolution: dpr,
      autoDensity: true, // This adjusts the CSS size automatically
      antialias: false,
      canvas: document.getElementById('canvas'),
    })
    
    // Add the view to the document
    document.getElementById('canvas').replaceWith(app.canvas)
    app.canvas.id = 'canvas'
    app.canvas.style.cursor = 'none'
    
  
    app.canvas.addEventListener('mouseenter', () => {
      if(gameState.gameStatus === 'paused') gameState.gameStatus = 'playing'
    })
  
    app.canvas.addEventListener('mouseleave', () => {
      if(gameState.gameStatus === 'playing') gameState.gameStatus = 'paused'
    })
  } else {
    // Clear all containers to remove game elements from canvas
    for (const container of Object.values(containers)) {
      if (container) {
        for (const subcontainer of Object.values(container)) {
          if (subcontainer) {
            console.log(subcontainer)
            // Remove all children but keep the container itself
            if(subcontainer.removeChildren && subcontainer.children) subcontainer.removeChildren()
            //if(subcontainer.destroy) subcontainer.destroy()
          }
        }
        // Remove all children but keep the container itself
        if(container.removeChildren && container.children) container.removeChildren()
        if(container.destroy) container.destroy()
      }
    }

    // Clear the renderer to reset the canvas
    app.renderer.clear()

    app.renderer.resolution = dpr
    app.renderer.antialias = false
  }

  app.canvas.style.opacity = 1
  
  // Set up containers for organizing content
  containers.background = new PIXI.Container()
  containers.terrain = new PIXI.Container()
  containers.units = new PIXI.Container()
  containers.particles = new PIXI.Container()
  containers.indicators = new PIXI.Container()
  containers.ui = new PIXI.Container()
  containers.debug = new PIXI.Container()
  
  // Add containers to stage in the correct order
  app.stage.addChild(containers.background)
  app.stage.addChild(containers.terrain)
  app.stage.addChild(containers.debug)
  app.stage.addChild(containers.units)
  app.stage.addChild(containers.particles)
  app.stage.addChild(containers.indicators)
  app.stage.addChild(containers.ui)

  // Initialize particle system
  initParticleSystem()
  
  console.log("Canvas initialized:", app.canvas.width, "x", app.canvas.height, app)

  // Reset cached sprite maps
  backgroundSpriteMap.clear()
  terrainSpriteMap.clear()
  unitSpriteMap.clear()
}

/**
 * Resize the Pixi.js canvas to fit the window
 */
function resizeCanvases() {
  // Get updated dimensions
  const { width, height, dpr } = getCanvasDimensions()

  if(!app?.renderer) return

  // Set renderer resolution based on device pixel ratio
  app.renderer.resolution = dpr
  
  // Resize the renderer
  app.renderer.resize(width, height)

  // Force update for mouse controller
  if (gameState.UI?.mouse) {
    gameState.UI.mouse._rectUpdateNeeded = true
  }
}

/**
 * Update the viewport data based on current camera position and zoom
 * This determines which portions of the map need to be rendered
 * and calculates the visibility boundaries with buffer for smooth scrolling
 * 
 * @param {Object} viewTransform - Camera transform information containing:
 *   @param {number} viewTransform.scale - Current zoom level
 *   @param {number} viewTransform.x - X offset of the viewport
 *   @param {number} viewTransform.y - Y offset of the viewport
 */
function updateViewport(viewTransform) {
  const { width, height } = getMapDimensions()
  const SPRITE_SIZE = getTileSize()
  const scale = viewTransform.scale
  
  // Calculate visible area in world coordinates
  viewport.x = Math.max(0, viewTransform.x / SPRITE_SIZE | 0)
  viewport.y = Math.max(0, viewTransform.y / SPRITE_SIZE | 0)
  
  // Calculate visible viewport size in tiles
  viewport.width = Math.ceil(app.renderer.width / (SPRITE_SIZE * scale))
  viewport.height = Math.ceil(app.renderer.height / (SPRITE_SIZE * scale))
  
  // Add buffer area for smoother scrolling
  // Increase buffer for larger maps to reduce re-rendering frequency
  viewport.buffer = Math.max(4, Math.ceil(Math.min(viewport.width, viewport.height) * 0.1))

  // Calculate boundaries with buffer
  viewport.startX = Math.max(0, viewport.x - viewport.buffer)
  viewport.startY = Math.max(0, viewport.y - viewport.buffer)
  viewport.endX = Math.min(width, viewport.x + viewport.width + viewport.buffer)
  viewport.endY = Math.min(height, viewport.y + viewport.height + viewport.buffer)
}

/**
 * Draw all game units
 * @param {Object} player - Human player
 * @param {Array} AIs - AI players
 */
function drawMain(player, AIs) {
  const SPRITE_SIZE = getTileSize()
  if(gameState.debug) var start = performance.now()

  if(gameState.gameStatus !== 'playing') return

  // Get current viewport from the mouse
  const viewTransform = gameState.UI?.mouse?.getViewTransform()
  if (viewTransform) {
    updateViewport(viewTransform)
  }

  const currentUnits = [...player.getUnits()]

  // Only add AI units if they're visible
  AIs.flatMap(ai => ai.getUnits()).forEach(unit => {
    const unitTileX = Math.floor(unit.x / SPRITE_SIZE)
    const unitTileY = Math.floor(unit.y / SPRITE_SIZE)

    if (viewTransform && (
      unitTileX >= viewport.startX || 
      unitTileX <= viewport.endX || 
      unitTileY >= viewport.startY || 
      unitTileY <= viewport.endY
    )) {
      // Check if unit is visible through fog of war
      if (!gameState.settings.fogOfWar || isPositionVisible(unitTileX, unitTileY)) {
        currentUnits.push(unit)
      }
    }
  })

  const currentUnitIds = new Set()

  currentUnits.forEach(unit => {
    // Skip units outside the viewport (with buffer)
    const unitTileX = Math.floor(unit.x / SPRITE_SIZE)
    const unitTileY = Math.floor(unit.y / SPRITE_SIZE)

    if (viewTransform && (
      unitTileX < viewport.startX || 
      unitTileX > viewport.endX || 
      unitTileY < viewport.startY || 
      unitTileY > viewport.endY
    )) {
      // Store the ID so we keep track of it even when not rendered
      currentUnitIds.add(unit.uid)

      // If the unit has a sprite already in the container, hide it
      let sprite = unitSpriteMap.get(unit.uid)
      if (sprite) {
        sprite.visible = false
      }
      return
    }

    currentUnitIds.add(unit.uid)

    // Get existing sprite or create a new one
    let sprite = unitSpriteMap.get(unit.uid)

    // Check if sprite is still valid (textures may be GC'd on mobile)
    if (sprite && !isSpriteValid(sprite)) {
      // Sprite is no longer valid, remove it
      containers.units.removeChild(sprite)
      unitSpriteMap.delete(unit.uid)
      sprite = null
    }

    // If no sprite exists or texture changed, create a new one
    if (!sprite || sprite.textureKey !== unit.sprite.uid) {
      // Remove old sprite if exists
      if (sprite) {
        containers.units.removeChild(sprite)
        unitSpriteMap.delete(unit.uid)
        sprite = null
      }
      
      // Create new sprite
      const texture = PIXI.Texture.from(unit.sprite)
      sprite = getCachedSprite(texture, unit.sprite.uid)
      sprite.textureKey = unit.sprite.uid
      unitSpriteMap.set(unit.uid, sprite)
      containers.units.addChild(sprite)
    }

    // Update sprite position and make it visible
    sprite.visible = unit.visible !== false
    sprite.x = unit.x - UNIT_SPRITE_SIZE/4
    sprite.y = unit.y - UNIT_SPRITE_SIZE/4 - 2

    // Handle progress indicators for units
    if (unit.showProgressIndicator) {
      let indicator = indicatorMap.get(unit.uid)
      if (!indicator && unit.owner === gameState.humanPlayer) {
        indicator = createProgressIndicator(unit, 10, unit.indicatorColor)
      }
      
      updateProgressIndicator(unit, unit.progress || 0)
    } else if (indicatorMap.has(unit.uid)) {
      removeProgressIndicator(unit.uid)
    }
  })

  // Remove sprites for units that no longer exist
  for (const [unitId, sprite] of unitSpriteMap.entries()) {
    if (!currentUnitIds.has(unitId)) {
        containers.units.removeChild(sprite)
        unitSpriteMap.delete(unitId)
    }
  }
  
  if(gameState.debug) {
    // Track performance
    drawMainTimings.push((performance.now() - start))
    drawMainTimings.shift()

    if(Math.random() > 0.9975) console.log('Drawing units: ' + (drawMainTimings.reduce((res, curr) => res + curr, 0) / drawMainTimings.length).toFixed(2) + ' ms')
  }
}

/**
 * Draw the background terrain
 * @param {Array} map - Game map
 */
function drawBackground(map) {
  if(!map || !gameState.map) return

  const { width, height } = getMapDimensions()
  const SPRITE_SIZE = getTileSize()
  const start = performance.now()

  // Sets to track sprites that should be visible this frame
  const visibleBackgroundSprites = new Set()
  const visibleTerrainSprites = new Set()

  // Get current viewport from the mouse
  const viewTransform = gameState.UI?.mouse?.getViewTransform()
  if (viewTransform) {
    updateViewport(viewTransform)
  }

  // Draw only visible map tiles plus buffer area
  const startX = viewport.startX || 0
  const startY = viewport.startY || 0
  const endX = viewport.endX || width
  const endY = viewport.endY || height

  // Draw all map tiles
  for (let x = startX; x < endX; x++) {
    for (let y = startY; y < endY; y++) {
      // Skip rendering if using fog of war and tile hasn't been explored
      if (gameState.settings.fogOfWar && !isPositionExplored(x, y)) {
        continue
      }

      const tileKey = map[x][y].uid

      // Draw background (grass under objects)
      if (map[x][y].back) {
        const backKey = tileKey * 10 | 0
        visibleBackgroundSprites.add(backKey)

        // Get existing sprite or create a new one
        let backSprite = backgroundSpriteMap.get(backKey)

        // Check if sprite is still valid (textures may be GC'd on mobile)
        if (backSprite && !isSpriteValid(backSprite)) {
          // Sprite is no longer valid, remove it
          containers.background.removeChild(backSprite)
          backgroundSpriteMap.delete(backKey)
          backSprite = null
        }

        if (!backSprite || backSprite.textureKey !== map[x][y].back.uid) {
          // Remove old sprite if texture changed
          if (backSprite) {
              containers.background.removeChild(backSprite)
              backgroundSpriteMap.delete(backKey)
              backSprite = null
          }
          
          // Create new sprite
          const backTexture = PIXI.Texture.from(map[x][y].back)
          backSprite = getCachedSprite(backTexture, map[x][y].back.uid)
          backSprite.textureKey = map[x][y].back.uid
          backSprite.x = x * SPRITE_SIZE
          backSprite.y = y * SPRITE_SIZE
          backgroundSpriteMap.set(backKey, backSprite)
          containers.background.addChild(backSprite)
        }

        // Make sprite visible
        backSprite.visible = true
      }

      // Handle terrain sprites (main tile visuals)
      visibleTerrainSprites.add(tileKey)

      // Get existing sprite or create a new one
      let terrainSprite = terrainSpriteMap.get(tileKey)

      // Check if sprite is still valid (textures may be GC'd on mobile)
      if (terrainSprite && !isSpriteValid(terrainSprite)) {
        // Sprite is no longer valid, remove it
        containers.terrain.removeChild(terrainSprite)
        terrainSpriteMap.delete(tileKey)
        terrainSprite = null
      }
        
      if (!terrainSprite || terrainSprite.textureKey !== map[x][y].sprite.uid) {
          // Remove old sprite if texture changed
          if (terrainSprite) {
              containers.terrain.removeChild(terrainSprite)
          }
          
          // Create new sprite
          const terrainTexture = PIXI.Texture.from(map[x][y].sprite)
          terrainSprite = getCachedSprite(terrainTexture, map[x][y].sprite.uid)
          terrainSprite.textureKey = map[x][y].sprite.uid
          terrainSprite.x = x * SPRITE_SIZE
          terrainSprite.y = y * SPRITE_SIZE
          terrainSpriteMap.set(tileKey, terrainSprite)
          containers.terrain.addChild(terrainSprite)
      }
      


      // Add special effect on Gold tiles
      if (gameState.map[x]?.[y]?.type === TERRAIN_TYPES.GOLD.type && Math.random() > 0.925) {
        // Create sparkle effect
        createParticleEmitter(ParticleEffect.GOLD_SPARKLE, {
          x: x * getTileSize() + getTileSize()/2,
          y: y * getTileSize() + getTileSize()/2,
          duration: 1000
        })
      }

      // Make sprite visible
      terrainSprite.visible = true
    }
  }

  // Define extended viewport for memory management
  const extendedBuffer = viewport.buffer * 3
  const farStartX = Math.max(0, viewport.x - extendedBuffer)
  const farStartY = Math.max(0, viewport.y - extendedBuffer)
  const farEndX = Math.min(width, viewport.x + viewport.width + extendedBuffer)
  const farEndY = Math.min(height, viewport.y + viewport.height + extendedBuffer)

  // Hide or remove background sprites outside viewport
  for (const [key, sprite] of backgroundSpriteMap.entries()) {
      if (!visibleBackgroundSprites.has(key)) {
          // Extract coordinates from key (format: (y * MAP_WIDTH + x) * 10)
          const y = Math.floor(key / 10 / width)
          const x = (key / 10) % width
          
          // If sprite is far from viewport, remove it to save memory
          if (x < farStartX || x >= farEndX || y < farStartY || y >= farEndY) {
              containers.background.removeChild(sprite)
              backgroundSpriteMap.delete(key)
          } else {
              // Just hide sprites near viewport (for quick reuse when scrolling)
              sprite.visible = false
          }
      }
  }
  
  // Hide or remove terrain sprites outside viewport
  for (const [key, sprite] of terrainSpriteMap.entries()) {
      if (!visibleTerrainSprites.has(key)) {
          // Extract coordinates from key (format: y * MAP_WIDTH + x)
          const y = Math.floor(key / width)
          const x = key % width
          
          // If sprite is far from viewport, remove it to save memory
          if (x < farStartX || x >= farEndX || y < farStartY || y >= farEndY) {
              containers.terrain.removeChild(sprite)
              terrainSpriteMap.delete(key)
          } else {
              // Just hide sprites near viewport (for quick reuse when scrolling)
              sprite.visible = false
          }
      }
  }

  // Debug: draw unit paths
  if (DEBUG()) {
    if(Math.random() > 0.5) {
      const debugBatch = new PIXI.Container()
      
      if (gameState.humanPlayer) {
        gameState.humanPlayer.getUnits().forEach((unit) => {
          for (var i = 1; i < (unit.path || []).length; i++) {
            const pathTexture = PIXI.Texture.from(offscreenSprite(sprites[spriteCoords_Path.x][spriteCoords_Path.y], SPRITE_SIZE))
            pathTexture.source.scaleMode = SCALE_MODE
            const pathSprite = new PIXI.Sprite(pathTexture)
            pathSprite.x = unit.path[i].x * SPRITE_SIZE
            pathSprite.y = unit.path[i].y * SPRITE_SIZE
            debugBatch.addChild(pathSprite)
          }
        })
      }
      
      containers.debug.removeChildren()
      containers.debug.addChild(debugBatch)

      // console.log(`Viewport tiles: ${(endX-startX)*(endY-startY)} of ${MAP_WIDTH*MAP_HEIGHT}`)
      // console.log(`Background sprites: ${backgroundSpriteMap.size}, Terrain sprites: ${terrainSpriteMap.size}`)
      // console.log(`Background rendering: ${performance.now() - start}ms`)
    }
  } else if (containers.debug.children?.length) {
    containers.debug.removeChildren()
  }
  
  backDrawn()
}

/**
 * Update zoom level
 */
function updateZoom() {
  // Get current view transform
  const viewTransform = gameState.UI?.mouse?.getViewTransform()
  
  // Apply transformations to all containers that should be affected by zoom/pan
  const containersToTransform = [
    containers.background,
    containers.terrain,
    containers.units,
    containers.indicators,
    containers.debug
  ];
  
  // Apply scale to each container
  containersToTransform.forEach(container => {
    // Reset transformations
    //container.setTransform(0, 0, 1, 1, 0, 0, 0, 0, 0);
    
    // Apply new scale and position
    container.scale.set(viewTransform.scale, viewTransform.scale)
    
    // Invert the translation caused by scale
    const offsetX = -viewTransform.x * viewTransform.scale
    const offsetY = -viewTransform.y * viewTransform.scale
    
    // Apply translation
    container.position.set(offsetX, offsetY)
  })

  // Update the viewport for culling calculations
  updateViewport(viewTransform)
  
  // UI container shouldn't be affected by zoom/pan (for cursor and HUD)
  // We could leave it as is, but if we want to scale UI elements differently:
  containers.ui.scale.set(1, 1)
  containers.ui.position.set(0, 0)
}

/**
 * Create a progress indicator for an entity
 * @param {Object} entity - Unit or building to create indicator for
 * @param {number} width - Width of the indicator
 * @param {number} color - Color of the progress bar
 * @returns {PIXI.Container} The created indicator container
 */
function createProgressIndicator(entity, width = 10, color = 0x00FF00) {
  const indicator = new PIXI.Container()
  
  // Create pixelated background (dark border)
  const background = new PIXI.Graphics()
    .rect(0, 0, width, 3)
    .fill({ color: 0x000000, alpha: 0.6 })
  
  // Create progress bar (initially empty)
  const progressBar = new PIXI.Graphics()
    .rect(1, 1, 0, 1) // 1px border around progress
    .fill({ color: color, alpha: 1 })
  
  indicator.addChild(background)
  indicator.addChild(progressBar)
  
  // Add to container and map
  containers.indicators.addChild(indicator)
  indicatorMap.set(entity.uid, indicator)
  
  return indicator
}

/**
 * Update a progress indicator's position and value
 * @param {Object} entity - Unit or building the indicator belongs to
 * @param {number} progress - Progress value (0-1)
 */
function updateProgressIndicator(entity, progress) {
  const indicator = indicatorMap.get(entity.uid)
  if (!indicator) return

  const SPRITE_SIZE = getTileSize()
  
  // Position above entity (different for units vs buildings)
  if (entity.currentNode) {
    // Unit
    indicator.x = entity.x + 3
    indicator.y = entity.y - 8
  } else {
    // Building
    indicator.x = entity.x * SPRITE_SIZE + SPRITE_SIZE/4 - 1
    indicator.y = entity.y * SPRITE_SIZE - 5
  }
  
  // Update progress bar width (max width is background width minus 2px for border)
  const background = indicator.getChildAt(0)
  indicator.getChildAt(1)
    .clear()
    .rect(1, 1, (background.width - 2) * Math.min(1, Math.max(0, progress)), 1)
    .fill({ color: entity.indicatorColor|| 0x00FF00, alpha: 1 })
}

/**
 * Remove a progress indicator
 * @param {number} entityUid - UID of entity to remove indicator for
 */
function removeProgressIndicator(entityUid) {
  const indicator = indicatorMap.get(entityUid)
  if (indicator) {
    containers.indicators.removeChild(indicator)
    indicatorMap.delete(entityUid)
  }
}

/**
 * Check if a sprite's texture is still valid
 * Mobile browsers may discard textures under memory pressure
 * @param {PIXI.Sprite} sprite - The sprite to check
 * @returns {boolean} True if the sprite is valid
 */
function isSpriteValid(sprite) {
  return sprite && 
         sprite.texture && 
         sprite.texture.valid && 
         sprite.texture.baseTexture && 
         sprite.texture.baseTexture.valid
}