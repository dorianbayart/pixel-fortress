export {
  app,
  containers, drawBackground, drawMain, initCanvases, loadTextureFromCanvas, resizeCanvases, updateZoom
}

'use strict'

import { DEBUG, backDrawn } from 'globals'
import { MAP_HEIGHT, MAP_WIDTH } from 'maps'
import * as PIXI from 'pixijs'
import { SPRITE_SIZE, UNIT_SPRITE_SIZE } from 'sprites'
import gameState from 'state'
import { getCachedSprite, textureCache } from 'utils'

// Pixi.js Application
let app = null

// Containers for organizing display objects
const containers = {
  background: null,
  terrain: null,
  units: null,
  ui: null,
  debug: null
}

const unitSpriteMap = new Map()
const backgroundSpriteMap = new Map()
const terrainSpriteMap = new Map()

// Variables for resizing and scaling
let canvasWidth = 0
let canvasHeight = 0
let dpr = 1
const desiredAspectRatio = MAP_WIDTH / MAP_HEIGHT

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
  texture.source.resolution = dpr
  texture.source.scaleMode = PIXI.SCALE_MODES.NEAREST
  
  // Store in cache
  textureCache.set(key, texture)
  
  // Clean up the URL when the texture is loaded
  texture.on('update', () => {
    URL.revokeObjectURL(url)
  });
  
  return texture
}

/**
 * Initialize Pixi.js application and containers
 */
async function initCanvases() {
  // Get DPR before initialization
  dpr = window.devicePixelRatio || 1

  // Create Pixi Application
  app = new PIXI.Application()
  await app.init({
      width: MAP_WIDTH * SPRITE_SIZE,
      height: MAP_HEIGHT * SPRITE_SIZE,
      // backgroundColor: 0x228b22, // Forestgreen background
      backgroundAlpha: 0,
      resolution: dpr,
      autoDensity: true, // This adjusts the CSS size automatically
      antialias: false,
      canvas: document.getElementById('canvas'),
      // resizeTo: window
    })

  // Enable crisp pixel art rendering
  // PIXI.settings.SCALE_MODE = 'nearest'
  
  // Add the view to the document
  document.getElementById('canvas').replaceWith(app.canvas)
  app.canvas.id = 'canvas'
  app.canvas.style.cursor = 'none'
  
  // Set up containers for organizing content
  containers.background = new PIXI.Container()
  containers.terrain = new PIXI.Container()
  containers.units = new PIXI.Container()
  containers.ui = new PIXI.Container()
  containers.debug = new PIXI.Container()
  
  // Add containers to stage in the correct order
  app.stage.addChild(containers.background)
  app.stage.addChild(containers.terrain)
  app.stage.addChild(containers.debug)
  app.stage.addChild(containers.units)
  app.stage.addChild(containers.ui)
  
  console.log(app)
}

/**
 * Resize the Pixi.js canvas to fit the window
 */
function resizeCanvases() {
  // Device Pixel Ratio (DPR)
  dpr = globalThis.devicePixelRatio || 1

  // Calculate new dimensions while maintaining aspect ratio
  const screenWidth = globalThis.innerWidth || 800
  const screenHeight = globalThis.innerHeight || 800
  const screenAspectRatio = screenWidth / screenHeight

  if (screenAspectRatio > desiredAspectRatio) {
    // Screen is wider than our aspect ratio, set height to match screen and calculate width
    canvasHeight = screenHeight
    canvasWidth = canvasHeight * desiredAspectRatio
  } else {
    // Screen is taller than our aspect ratio, set width to match screen and calculate height
    canvasWidth = screenWidth
    canvasHeight = canvasWidth / desiredAspectRatio
  }

  
  app.renderer.resolution = dpr
  
  // Resize the renderer
  app.renderer.resize(MAP_WIDTH * SPRITE_SIZE, MAP_HEIGHT * SPRITE_SIZE)

  // Update the canvas style
  app.canvas.style.width = `${canvasWidth}px`
  app.canvas.style.height = `${canvasHeight}px`
}

/**
 * Update the viewport data based on current camera position and zoom
 * @param {Object} viewTransform - Camera transform information 
 */
function updateViewport(viewTransform) {
  const scale = viewTransform.scale
  
  // Calculate visible area in world coordinates
  viewport.x = Math.floor(viewTransform.x / SPRITE_SIZE)
  viewport.y = Math.floor(viewTransform.y / SPRITE_SIZE)
  viewport.width = Math.ceil(app.renderer.width / (SPRITE_SIZE * scale))
  viewport.height = Math.ceil(app.renderer.height / (SPRITE_SIZE * scale))
  
  // Add buffer area
  viewport.startX = Math.max(0, viewport.x - viewport.buffer)
  viewport.startY = Math.max(0, viewport.y - viewport.buffer)
  viewport.endX = Math.min(MAP_WIDTH, viewport.x + viewport.width + viewport.buffer)
  viewport.endY = Math.min(MAP_HEIGHT, viewport.y + viewport.height + viewport.buffer)
}

/**
 * Draw all game units
 * @param {Object} player - Human player
 * @param {Array} AIs - AI players
 */
function drawMain(player, AIs) {
  if(gameState.debug) var start = performance.now()

  // Get current viewport from the mouse
  const viewTransform = gameState.UI?.mouse?.getViewTransform()
  if (viewTransform) {
    updateViewport(viewTransform)
  }

  const currentUnits = [...player.getUnits(), ...AIs.flatMap(ai => ai.getUnits())]
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

    // If no sprite exists or texture changed, create a new one
    if (!sprite || sprite.textureKey !== unit.sprite.uid) {
      // Remove old sprite if exists
      if (sprite) {
          containers.units.removeChild(sprite)
      }
      
      // Create new sprite
      const texture = PIXI.Texture.from(unit.sprite)
      sprite = getCachedSprite(texture, unit.sprite.uid)
      sprite.textureKey = unit.sprite.uid
      unitSpriteMap.set(unit.uid, sprite)
      containers.units.addChild(sprite)
    }

    // Update sprite position and make it visible
    sprite.visible = true
    sprite.x = Math.round(unit.x - UNIT_SPRITE_SIZE/4)
    sprite.y = Math.round(unit.y - UNIT_SPRITE_SIZE/4 - 2)
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
    const endX = viewport.endX || MAP_WIDTH
    const endY = viewport.endY || MAP_HEIGHT
  
    // Draw all map tiles
    for (let x = startX; x < endX; x++) {
      for (let y = startY; y < endY; y++) {
        const tileKey = map[x][y].uid

        // Draw background (grass under objects)
        if (map[x][y].back) {
          const backKey = tileKey * 10 | 0
          visibleBackgroundSprites.add(backKey)

          // Get existing sprite or create a new one
          let backSprite = backgroundSpriteMap.get(backKey)

          if (!backSprite || backSprite.textureKey !== map[x][y].back.uid) {
            // Remove old sprite if texture changed
            if (backSprite) {
                containers.background.removeChild(backSprite)
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
        
        // Make sprite visible
        terrainSprite.visible = true
      }
    }

    // Define extended viewport for memory management
    const extendedBuffer = viewport.buffer * 3
    const farStartX = Math.max(0, viewport.x - extendedBuffer)
    const farStartY = Math.max(0, viewport.y - extendedBuffer)
    const farEndX = Math.min(MAP_WIDTH, viewport.x + viewport.width + extendedBuffer)
    const farEndY = Math.min(MAP_HEIGHT, viewport.y + viewport.height + extendedBuffer)

    // Hide or remove background sprites outside viewport
    for (const [key, sprite] of backgroundSpriteMap.entries()) {
        if (!visibleBackgroundSprites.has(key)) {
            // Extract coordinates from key (format: (y * MAP_WIDTH + x) * 10)
            const y = Math.floor(key / 10 / MAP_WIDTH)
            const x = (key / 10) % MAP_WIDTH
            
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
            const y = Math.floor(key / MAP_WIDTH)
            const x = key % MAP_WIDTH
            
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
    if (DEBUG() && Math.random() > 0.8) {
      // const debugBatch = new PIXI.Container()
      
      // if (gameState.humanPlayer) {
      //   gameState.humanPlayer.getUnits().forEach((unit) => {
      //     for (var i = 1; i < (unit.path || []).length; i++) {
      //       const pathTexture = PIXI.Texture.from(offscreenSprite(sprites[spriteCoords_Path.x][spriteCoords_Path.y], SPRITE_SIZE))
      //       pathTexture.source.scaleMode = PIXI.SCALE_MODES.NEAREST
      //       const pathSprite = new PIXI.Sprite(pathTexture)
      //       pathSprite.x = unit.path[i].x * SPRITE_SIZE
      //       pathSprite.y = unit.path[i].y * SPRITE_SIZE
      //       debugBatch.addChild(pathSprite)
      //     }
      //   })
      // }
      
      // containers.debug.addChild(debugBatch)

      // console.log(`Viewport tiles: ${(endX-startX)*(endY-startY)} of ${MAP_WIDTH*MAP_HEIGHT}`)
      // console.log(`Background sprites: ${backgroundSpriteMap.size}, Terrain sprites: ${terrainSpriteMap.size}`)
      console.log(`Background rendering: ${performance.now() - start}ms`)
    }
    
    backDrawn()
}

/**
 * Update zoom level
 * @param {Object} mouse - Mouse state
 */
function updateZoom(mouse) {
    // Get current view transform
    const viewTransform = mouse.getViewTransform()
    
    // Apply transformations to all containers that should be affected by zoom/pan
    const containersToTransform = [
      containers.background,
      containers.terrain,
      containers.units,
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