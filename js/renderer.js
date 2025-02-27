export {
    app,
    containers, drawBackground, drawMain, initCanvases, loadTextureFromCanvas, resizeCanvases, updateZoom
}

'use strict'

import { DEBUG, backDrawn } from 'globals'
import { MAP_HEIGHT, MAP_WIDTH } from 'maps'
import * as PIXI from 'pixijs'
import { SPRITE_SIZE, UNIT_SPRITE_SIZE, offscreenSprite, sprites } from 'sprites'
import gameState from 'state'

// Pixi.js Application
let app = null

// Texture cache for converted canvas elements
const textureCache = new Map()

// Containers for organizing display objects
const containers = {
  background: null,
  terrain: null,
  units: null,
  ui: null,
  debug: null
}

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
    // Create Pixi Application
    app = new PIXI.Application()
    await app.init({
        width: MAP_WIDTH * SPRITE_SIZE,
        height: MAP_HEIGHT * SPRITE_SIZE,
        // backgroundColor: 0x228b22, // Forestgreen background
        backgroundAlpha: 0,
        resolution: dpr,
        antialias: false,
        canvas: document.getElementById('canvas'),
        // resizeTo: window
      })
    
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
    
    // Set pixel scaling for crisp pixels
    //PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST
    console.log(app)
  }

/**
 * Resize the Pixi.js canvas to fit the window
 */
function resizeCanvases() {
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
  
    // Device Pixel Ratio (DPR)
    dpr = globalThis.devicePixelRatio || 1
    
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
    const start = performance.now()
    
    // Clear the units container
    containers.units.removeChildren()
    
    // Draw AI units
    AIs.flatMap(ai => ai.getUnits()).forEach((unit) => {
        const texture = PIXI.Texture.from(unit.sprite)
        const sprite = new PIXI.Sprite(texture)
        sprite.x = Math.round(unit.x - UNIT_SPRITE_SIZE/4)
        sprite.y = Math.round(unit.y - UNIT_SPRITE_SIZE/4 - 2)
        containers.units.addChild(sprite)
    })
    
    // Draw player units
    player.getUnits().forEach((unit) => {
        const texture = PIXI.Texture.from(unit.sprite)
        const sprite = new PIXI.Sprite(texture)
        sprite.x = Math.round(unit.x - UNIT_SPRITE_SIZE/4)
        sprite.y = Math.round(unit.y - UNIT_SPRITE_SIZE/4 - 2)
        containers.units.addChild(sprite)
    })
  
    // Track performance
    drawMainTimings.push((performance.now() - start) | 0)
    drawMainTimings.shift()
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
            const backSprite = new PIXI.Sprite(backTexture)
            backSprite.x = x * SPRITE_SIZE
            backSprite.y = y * SPRITE_SIZE
            backgroundBatch.addChild(backSprite)
        }
        
        // Draw terrain features
        const terrainTexture = PIXI.Texture.from(map[x][y].sprite)
        const terrainSprite = new PIXI.Sprite(terrainTexture)
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
        const debugBatch = new PIXI.Container()
      
      if (gameState.humanPlayer) {
        gameState.humanPlayer.getUnits().forEach((unit) => {
          for (var i = 1; i < (unit.path || []).length; i++) {
            const pathTexture = PIXI.Texture.from(offscreenSprite(sprites[spriteCoords_Path.x][spriteCoords_Path.y], SPRITE_SIZE))
            const pathSprite = new PIXI.Sprite(pathTexture)
            pathSprite.x = unit.path[i].x * SPRITE_SIZE
            pathSprite.y = unit.path[i].y * SPRITE_SIZE
            debugBatch.addChild(pathSprite)
          }
        })
      }
      
      containers.debug.addChild(debugBatch)

      // console.log(`Background rendering: ${performance.now() - start}ms`)
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
    // containers.ui.scale.set(1, 1);
    // containers.ui.position.set(0, 0);
  }