export { canvases, drawBackground, drawMain, initCanvases, resizeCanvases, updateZoom }
  
'use strict'
  
import { DEBUG, backDrawn } from 'globals'
import { MAP_HEIGHT, MAP_WIDTH } from 'maps'
import { SPRITE_SIZE, UNIT_SPRITE_SIZE, offscreenSprite, sprites } from 'sprites'
import gameState from 'state'
  
// Canvas elements and contexts
const canvases = {
    backCanvas: null,
    backCtx: null,
    mainCanvas: null,
    mainCtx: null,
    uiCanvas: null,
    uiCtx: null,
    offCanvas1: null,
    offCtx1: null,
    offCanvas2: null,
    offCtx2: null
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
  
  // Initialize canvas elements
  function initCanvases() {
    canvases.backCanvas = document.getElementById('backCanvas')
    canvases.backCtx = canvases.backCanvas.getContext('2d')
    canvases.mainCanvas = document.getElementById('mainCanvas')
    canvases.mainCtx = canvases.mainCanvas.getContext('2d')
    canvases.uiCanvas = document.getElementById('uiCanvas')
    canvases.uiCtx = canvases.uiCanvas.getContext('2d')
    
    canvases.offCanvas1 = document.createElement('canvas')
    canvases.offCtx1 = canvases.offCanvas1.getContext('2d')
    canvases.offCanvas2 = document.createElement('canvas')
    canvases.offCtx2 = canvases.offCanvas2.getContext('2d')
    
    // Disable smoothing on all contexts
    canvases.mainCtx.imageSmoothingEnabled = false
    canvases.backCtx.imageSmoothingEnabled = false
    canvases.uiCtx.imageSmoothingEnabled = false
    canvases.offCtx1.imageSmoothingEnabled = false
    canvases.offCtx2.imageSmoothingEnabled = false
  }
  
  // Resize canvases on window resize
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
    
    // Set canvas dimensions
    canvases.mainCanvas.width = canvases.backCanvas.width = canvases.uiCanvas.width = 
      canvases.offCanvas1.width = canvases.offCanvas2.width = MAP_WIDTH * SPRITE_SIZE
    
    canvases.mainCanvas.height = canvases.backCanvas.height = canvases.uiCanvas.height = 
      canvases.offCanvas1.height = canvases.offCanvas2.height = MAP_HEIGHT * SPRITE_SIZE
  
    // Set CSS dimensions
    canvases.mainCanvas.style.width = canvases.backCanvas.style.width = canvases.uiCanvas.style.width = `${canvasWidth}px`
    canvases.mainCanvas.style.height = canvases.backCanvas.style.height = canvases.uiCanvas.style.height = `${canvasHeight}px`
  }
  
  // Draw all game elements
  function drawMain(player, AIs) {
    const start = performance.now()
    
    canvases.offCtx1.clearRect(0, 0, canvases.mainCanvas.width, canvases.mainCanvas.height)
    
    // Draw AI units
    AIs.flatMap(ai => ai.getUnits()).forEach((unit) => {
      canvases.offCtx1.drawImage(
        unit.sprite, 
        Math.round(unit.x - UNIT_SPRITE_SIZE/4), 
        Math.round(unit.y - UNIT_SPRITE_SIZE/4 - 2)
      )
    })
    
    // Draw player units
    player.getUnits().forEach((unit) => {
      canvases.offCtx1.drawImage(
        unit.sprite, 
        Math.round(unit.x - UNIT_SPRITE_SIZE/4), 
        Math.round(unit.y - UNIT_SPRITE_SIZE/4 - 2)
      )
    })
    
    // Copy from offscreen canvas to main canvas
    canvases.mainCtx.clearRect(0, 0, canvases.mainCanvas.width, canvases.mainCanvas.height)
    canvases.mainCtx.drawImage(canvases.offCanvas1, 0, 0, canvases.mainCanvas.width, canvases.mainCanvas.height)
  
    // Track performance
    drawMainTimings.push((performance.now() - start) | 0)
    drawMainTimings.shift()
  }
  
  // Draw the background terrain
  function drawBackground(map) {
    canvases.offCtx1.clearRect(0, 0, canvases.mainCanvas.width, canvases.mainCanvas.height)
    canvases.offCtx2.clearRect(0, 0, canvases.mainCanvas.width, canvases.mainCanvas.height)
  
    // Draw all map tiles
    for (let x = 0; x < MAP_WIDTH; x++) {
      for (let y = 0; y < MAP_HEIGHT; y++) {
        if(map[x][y].back) {
          canvases.offCtx2.drawImage(map[x][y].back, x * SPRITE_SIZE, y * SPRITE_SIZE)
        }
        canvases.offCtx1.drawImage(map[x][y].sprite, x * SPRITE_SIZE, y * SPRITE_SIZE)
      }
    }
  
    // Copy from offscreen canvases to background canvas
    canvases.backCtx.clearRect(0, 0, canvases.mainCanvas.width, canvases.mainCanvas.height)
    canvases.backCtx.drawImage(canvases.offCanvas2, 0, 0, canvases.mainCanvas.width, canvases.mainCanvas.height)
    canvases.backCtx.drawImage(canvases.offCanvas1, 0, 0, canvases.mainCanvas.width, canvases.mainCanvas.height)
  
    // Debug: draw unit paths
    if (DEBUG()) {
      canvases.offCtx1.clearRect(0, 0, canvases.mainCanvas.width, canvases.mainCanvas.height)
      
      if (gameState.humanPlayer) {
        gameState.humanPlayer.getUnits().forEach((unit) => {
          for (var i = 1; i < (unit.path || []).length; i++) {
            canvases.offCtx1.drawImage(
              offscreenSprite(sprites[spriteCoords_Path.x][spriteCoords_Path.y], SPRITE_SIZE), 
              unit.path[i].x * SPRITE_SIZE, 
              unit.path[i].y * SPRITE_SIZE
            )
          }
        })
      }
      
      canvases.backCtx.drawImage(canvases.offCanvas1, 0, 0, canvases.mainCanvas.width, canvases.mainCanvas.height)
    }
  
    backDrawn()
  }
  
  // Update zoom level and transform
  function updateZoom(mouse) {
    if (mouse.scaleFactor === 1) {
      // Reset all transforms
      canvases.mainCtx.resetTransform()
      canvases.backCtx.resetTransform()
      canvases.uiCtx.resetTransform()
      canvases.offCtx1.resetTransform()
      canvases.offCtx2.resetTransform()
    } else {
      // Apply transforms with current scale and offset
      canvases.mainCtx.setTransform(mouse.scaleFactor, 0, 0, mouse.scaleFactor, mouse.offsetX, mouse.offsetY)
      canvases.backCtx.setTransform(mouse.scaleFactor, 0, 0, mouse.scaleFactor, mouse.offsetX, mouse.offsetY)
      canvases.uiCtx.setTransform(mouse.scaleFactor, 0, 0, mouse.scaleFactor, mouse.offsetX, mouse.offsetY)
      canvases.offCtx1.setTransform(mouse.scaleFactor, 0, 0, mouse.scaleFactor, mouse.offsetX, mouse.offsetY)
      canvases.offCtx2.setTransform(mouse.scaleFactor, 0, 0, mouse.scaleFactor, mouse.offsetX, mouse.offsetY)
    }
  }