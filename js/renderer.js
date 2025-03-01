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
 * Draw all game units
 * @param {Object} player - Human player
 * @param {Array} AIs - AI players
 */
function drawMain(player, AIs) {
  if(gameState.debug) var start = performance.now()

    const currentUnits = [...player.getUnits(), ...AIs.flatMap(ai => ai.getUnits())]
    const currentUnitIds = new Set()

    currentUnits.forEach(unit => {
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

      // Update sprite position
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

      if(Math.random() > 0.994) console.log('Drawing units: ' + (drawMainTimings.reduce((res, curr) => res + curr, 0) / drawMainTimings.length).toFixed(2) + ' ms')
    }
}

/**
 * Draw the background terrain
 * @param {Array} map - Game map
 */
function drawBackground(map) {
    const start = performance.now()

    // Clear the containers
    containers.background.removeChildren()
    containers.terrain.removeChildren()
    containers.debug.removeChildren()

    // Create a sprite batch for better performance
    const backgroundBatch = new PIXI.Container()
    const terrainBatch = new PIXI.Container()
  
    // Draw all map tiles
    for (let x = 0; x < MAP_WIDTH; x++) {
      for (let y = 0; y < MAP_HEIGHT; y++) {
        // Draw background (grass under objects)
        if (map[x][y].back) {
            const backTexture = PIXI.Texture.from(map[x][y].back)
            const backSprite = getCachedSprite(backTexture, map[x][y].back.uid)
            backSprite.x = x * SPRITE_SIZE
            backSprite.y = y * SPRITE_SIZE
            backgroundBatch.addChild(backSprite)
        }
        
        // Draw terrain features
        const terrainTexture = PIXI.Texture.from(map[x][y].sprite)
        const terrainSprite = getCachedSprite(terrainTexture, map[x][y].sprite.uid)
        terrainSprite.x = x * SPRITE_SIZE
        terrainSprite.y = y * SPRITE_SIZE
        terrainBatch.addChild(terrainSprite)
      }
    }

    // Add batches to containers
    containers.background.addChild(backgroundBatch)
    containers.terrain.addChild(terrainBatch)

    // Debug: draw unit paths
    if (DEBUG()) {
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
    const viewTransform = mouse.getViewTransform();
    
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
      container.scale.set(viewTransform.scale, viewTransform.scale);
      
      // Invert the translation caused by scale
      const offsetX = -viewTransform.x * viewTransform.scale;
      const offsetY = -viewTransform.y * viewTransform.scale;
      
      // Apply translation
      container.position.set(offsetX, offsetY);
    });
    
    // UI container shouldn't be affected by zoom/pan (for cursor and HUD)
    // We could leave it as is, but if we want to scale UI elements differently:
    containers.ui.scale.set(1, 1);
    containers.ui.position.set(0, 0);
  }