export {
  app,
  backgroundSpriteMap,
  containers,
  createProgressIndicator,
  drawBackground,
  drawMain,
  indicatorMap,
  initCanvases,
  removeProgressIndicator,
  resizeCanvases,
  unitSpriteMap,
  updateProgressIndicator,
  updateZoom,
  worldObjectSpriteMap,
  drawMinimap,
  createHealthBar,
  updateHealthBar,
  removeHealthBar,
  recreateRenderer,
}

'use strict'

import CONSTANTS from 'constants'
import { getCanvasDimensions, getMapDimensions, getTileSize } from 'dimensions'
import { isPositionExplored, isPositionVisible, initFogOfWar, resetFogTexture } from 'fogOfWar'
import { getCurrentWaterFrame } from 'game'
import { DEBUG, backDrawn } from 'globals'
import { handleWindowResize } from 'init'
import { initMinimap, updateMinimap, resizeMinimap } from 'minimap'
import { ParticleEffect, createParticleEmitter, initParticleSystem } from 'particles'
import * as PIXI from 'pixijs'
import { UNIT_SPRITE_SIZE, sprites, updateAllTexturesScaleMode } from 'sprites'
import gameState from 'state'
import { recreateUIElements } from 'ui'

const TERRAIN_TYPES = CONSTANTS.TERRAIN.TYPES

// Pixi.js Application
let app = null

// Containers for organizing display objects
const containers = {
  background: null,
  world: null, // For all depth-sorted game objects (units, buildings, trees, etc.)
  units: null,
  particles: null,
  indicators: null,
  ui: null,
  debug: null
}

const indicatorMap = new Map()
const healthBarMap = new Map()
const unitSpriteMap = new Map()
const backgroundSpriteMap = new Map()
const worldObjectSpriteMap = new Map()

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

// Last viewport state for dirty tracking (optimization)
let lastViewportCheck = {
  x: 0,
  y: 0,
  width: 0,
  height: 0
}



/**
 * Initialize Pixi.js application and containers
 */
async function initCanvases() {
  // Get canvas dimensions from centralized system
  const { width, height, dpr } = getCanvasDimensions()

  // Create Pixi Application
  if(!app) {
    const useAntialiasing = gameState.settings?.antialiasing ?? false
    // Use supersampling when antialiasing is enabled: render at 2x resolution
    const renderResolution = useAntialiasing ? dpr * 2 : dpr

    app = new PIXI.Application()
    await app.init({
      width: width,
      height: height,
      // backgroundColor: 0x228b22, // Forestgreen background
      backgroundAlpha: 0,
      resolution: renderResolution,  // Higher resolution for antialiasing
      autoDensity: true, // This adjusts the CSS size automatically
      antialias: useAntialiasing,  // WebGL multisampling antialiasing
      canvas: document.getElementById('canvas'),
      roundPixels: true,  // Always keep true to prevent gaps between tiles
      preference: 'webgl',  // Force WebGL for best performance
      // Garbage collection configuration (PixiJS 8.15.0+)
      gc: {
        gcActive: true,
        gcMaxUnusedTime: 3600,  // Keep unused resources longer (default: 60 seconds)
        gcFrequency: 600        // Run GC less frequently (default: 60 frames)
      }
    })

    // Log renderer information
    const rendererType = app.renderer.type || 'unknown'
    console.log('Renderer initialized. Type:', rendererType)
    console.log('Resolution:', renderResolution, 'Antialias:', useAntialiasing)
    
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
  containers.world = new PIXI.Container() // All units, buildings, and trees will go here
  containers.particles = new PIXI.Container()
  containers.indicators = new PIXI.Container()
  containers.ui = new PIXI.Container()
  containers.debug = new PIXI.Container()

  // Enable sorting on the world container
  containers.world.sortableChildren = true
  
  // Add containers to stage in the correct order
  app.stage.addChild(containers.background)
  app.stage.addChild(containers.debug) // Debug paths should be above background but below world objects
  app.stage.addChild(containers.world)
  app.stage.addChild(containers.particles)
  app.stage.addChild(containers.indicators)
  app.stage.addChild(containers.ui)

  // Initialize particle system
  initParticleSystem()

  // Initialize minimap
  initMinimap(containers.ui)
  
  console.log("Canvas initialized:", app.canvas.width, "x", app.canvas.height, app)

  // Apply initial canvas rendering mode
  updateCanvasRendering(gameState.settings?.antialiasing ?? false)

  // Listen for antialiasing setting changes
  gameState.events.on('settings-changed', async ({ newSettings, oldSettings }) => {
    if (newSettings.antialiasing !== undefined && newSettings.antialiasing !== oldSettings?.antialiasing) {
      // Recreate the entire renderer with new settings
      await recreateRenderer()

      // Trigger a full redraw
      if (gameState.gameStatus === 'playing') {
        // Force redraw on next frame
        console.log('Antialiasing toggled - renderer recreated')
      }
    }
  })

  // Reset cached sprite maps
  backgroundSpriteMap.clear()
  worldObjectSpriteMap.clear()
  // Clean up unit sprites properly
  for (const [unitId, sprite] of unitSpriteMap.entries()) {
    if (containers.units && sprite.parent === containers.units) {
      containers.units.removeChild(sprite)
    }
    if (sprite.destroy) {
      sprite.destroy()
    }
  }
  unitSpriteMap.clear()
  // Clean up health bars
  healthBarMap.clear()
  // Clean up indicators
  indicatorMap.clear()
  // Reset viewport check state
  lastViewportCheck.x = 0
  lastViewportCheck.y = 0
  lastViewportCheck.width = 0
  lastViewportCheck.height = 0
}

/**
 * Update canvas CSS rendering mode based on antialiasing setting
 */
function updateCanvasRendering(antialiasing) {
  const canvas = document.getElementById('canvas')
  if (!canvas) return

  if (antialiasing) {
    canvas.style.imageRendering = 'auto'  // Standard smooth rendering
  } else {
    canvas.style.imageRendering = 'pixelated'  // Sharp, pixelated rendering
  }

  console.log('Canvas CSS rendering updated:', antialiasing ? 'smooth' : 'pixelated')
}

/**
 * Recreate the entire renderer with new antialiasing settings
 * This allows dynamic quality changes without page refresh
 */
async function recreateRenderer() {
  console.log('Recreating renderer with new settings...')

  // Store game status and pause during recreation
  const previousStatus = gameState.gameStatus
  if (previousStatus === 'playing') {
    gameState.gameStatus = 'paused'
  }

  const useAntialiasing = gameState.settings?.antialiasing ?? false
  const { width, height, dpr } = getCanvasDimensions()

  // Use supersampling when antialiasing is enabled
  const renderResolution = useAntialiasing ? dpr * 2 : dpr

  // Store reference to canvas parent and position before destroying
  const oldCanvas = document.getElementById('canvas')
  const canvasParent = oldCanvas ? oldCanvas.parentNode : document.body

  // CRITICAL: Store current camera position and zoom before destroying
  const savedViewTransform = gameState.UI?.mouse?.getViewTransform()
  console.log('Saved view transform:', savedViewTransform)

  // Destroy old renderer and containers
  if (app) {
    // Remove all children from stage first
    if (app.stage) {
      app.stage.removeChildren()
    }

    // Clear sprite maps
    backgroundSpriteMap.clear()
    worldObjectSpriteMap.clear()
    unitSpriteMap.clear()
    healthBarMap.clear()
    indicatorMap.clear()

    // Destroy containers individually
    for (const key in containers) {
      if (containers[key] && containers[key].destroy) {
        try {
          containers[key].destroy({ children: true, texture: false, baseTexture: false })
        } catch (e) {
          console.warn('Error destroying container:', key, e)
        }
      }
      containers[key] = null
    }

    // Destroy the application properly
    try {
      await app.destroy(true, { children: true, texture: false, baseTexture: false })
    } catch (e) {
      console.warn('Error destroying app:', e)
    }
    app = null
  }

  // Remove old canvas from DOM if it still exists
  if (oldCanvas && oldCanvas.parentNode) {
    oldCanvas.parentNode.removeChild(oldCanvas)
  }

  // Create new application with updated settings
  app = new PIXI.Application()
  await app.init({
    width: width,
    height: height,
    backgroundAlpha: 0,
    resolution: renderResolution,
    autoDensity: true,
    antialias: useAntialiasing,
    roundPixels: true,  // Always keep true to prevent gaps between tiles
    preference: 'webgl',  // Force WebGL for best performance
    // Garbage collection configuration (PixiJS 8.15.0+)
    gc: {
      gcActive: true,
      gcMaxUnusedTime: 3600,  // Keep unused resources longer (default: 60 seconds)
      gcFrequency: 600        // Run GC less frequently (default: 60 frames)
    }
  })

  // Log renderer information
  const rendererType = app.renderer.type || 'unknown'
  console.log('Renderer recreated. Type:', rendererType)
  console.log('Resolution:', renderResolution, 'Antialias:', useAntialiasing)

  // Set canvas properties
  app.canvas.id = 'canvas'
  app.canvas.style.cursor = 'none'
  app.canvas.style.opacity = 1

  // Insert new canvas as FIRST child of body (important for z-index and event handling)
  if (canvasParent === document.body) {
    document.body.insertBefore(app.canvas, document.body.firstChild)
  } else {
    canvasParent.appendChild(app.canvas)
  }

  // Re-add event listeners
  app.canvas.addEventListener('mouseenter', () => {
    if(gameState.gameStatus === 'paused') gameState.gameStatus = 'playing'
  })

  app.canvas.addEventListener('mouseleave', () => {
    if(gameState.gameStatus === 'playing') gameState.gameStatus = 'paused'
  })

  // Recreate containers
  containers.background = new PIXI.Container()
  containers.world = new PIXI.Container()
  containers.particles = new PIXI.Container()
  containers.indicators = new PIXI.Container()
  containers.ui = new PIXI.Container()
  containers.debug = new PIXI.Container()

  containers.world.sortableChildren = true

  app.stage.addChild(containers.background)
  app.stage.addChild(containers.debug)
  app.stage.addChild(containers.world)
  app.stage.addChild(containers.particles)
  app.stage.addChild(containers.indicators)
  app.stage.addChild(containers.ui)

  // Reinitialize systems
  initParticleSystem()
  initMinimap(containers.ui)
  resetFogTexture()  // Reset fog texture before reinitializing

  // Update CSS rendering
  updateCanvasRendering(useAntialiasing)

  // Update texture scale modes
  updateAllTexturesScaleMode()

  // Clear all cached sprites to force regeneration with new renderer
  backgroundSpriteMap.clear()
  worldObjectSpriteMap.clear()
  unitSpriteMap.clear()

  console.log('Renderer recreated successfully with antialiasing:', useAntialiasing)
  console.log('Resolution:', renderResolution, 'DPR:', dpr)

  // Reinitialize mouse with new canvas - CRITICAL for event listeners
  if (gameState.UI?.mouse) {
    await gameState.UI.mouse.initMouse(app.canvas)

    // Restore camera position and zoom
    if (savedViewTransform) {
      gameState.UI.mouse.viewTransform.x = savedViewTransform.x
      gameState.UI.mouse.viewTransform.y = savedViewTransform.y
      gameState.UI.mouse.viewTransform.scale = savedViewTransform.scale
    }
  }

  // Initialize fog of war AFTER mouse and view transform are restored
  // This ensures the fog container is positioned correctly from the start
  // Only initialize if fog of war is enabled in settings
  if (gameState.settings?.fogOfWar) {
    initFogOfWar()
  }

  // Emit event to notify that renderer was recreated (UI will be recreated via event listener)
  recreateUIElements()

  // Restore game status LAST - this ensures game loop runs immediately
  if (previousStatus === 'playing') {
    gameState.gameStatus = 'playing'
  }

  // Trigger window resize handler to force viewport update and render
  handleWindowResize()
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

  // Resize minimap
  resizeMinimap()

  // Force update for mouse controller
  if (gameState.UI?.mouse) {
    gameState.UI.mouse._rectUpdateNeeded = true
  }
}

/**
 * Check if viewport has changed significantly enough to warrant sprite cleanup
 * Only run expensive sprite map iteration when viewport moves significantly
 *
 * @returns {boolean} - True if viewport changed significantly
 */
function hasViewportChangedSignificantly() {
  // Threshold in tiles - only check if viewport moved 5+ tiles or resized
  const MOVEMENT_THRESHOLD = 5

  const moved = Math.abs(viewport.x - lastViewportCheck.x) > MOVEMENT_THRESHOLD ||
                Math.abs(viewport.y - lastViewportCheck.y) > MOVEMENT_THRESHOLD

  const resized = viewport.width !== lastViewportCheck.width ||
                  viewport.height !== lastViewportCheck.height

  return moved || resized
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
  // Clamp buffer to prevent rendering too many tiles when zoomed out
  viewport.buffer = 4

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

  // Combine all visible entities (units and buildings)
  const allEntities = [...player.getUnits(), ...player.getBuildings()]

  // Add AI entities if they are visible
  const aiEntities = [...AIs.flatMap(ai => ai.getUnits()), ...AIs.flatMap(ai => ai.getBuildings())]
  aiEntities.forEach(entity => {
    const entityX = entity.currentNode ? entity.x : entity.x * SPRITE_SIZE
    const entityY = entity.currentNode ? entity.y : entity.y * SPRITE_SIZE
    const tileX = Math.floor(entityX / SPRITE_SIZE)
    const tileY = Math.floor(entityY / SPRITE_SIZE)

    if (viewTransform && (
      tileX >= viewport.startX && 
      tileX <= viewport.endX && 
      tileY >= viewport.startY && 
      tileY <= viewport.endY
    )) {
      if (!gameState.settings.fogOfWar || isPositionVisible(tileX, tileY)) {
        allEntities.push(entity)
      }
    }
  })

  const currentEntityIds = new Set()

  allEntities.forEach(entity => {
    const isUnit = !!entity.currentNode
    const entityX = isUnit ? entity.x : entity.x * SPRITE_SIZE
    const entityY = isUnit ? entity.y : entity.y * SPRITE_SIZE
    const tileX = Math.floor(entityX / SPRITE_SIZE)
    const tileY = Math.floor(entityY / SPRITE_SIZE)

    // Culling check
    if (viewTransform && (
      tileX < viewport.startX || 
      tileX > viewport.endX || 
      tileY < viewport.startY || 
      tileY > viewport.endY
    )) {
      currentEntityIds.add(entity.uid)
      let sprite = unitSpriteMap.get(entity.uid)
      if (sprite) {
        sprite.visible = false
      }
      // Also hide indicator if it exists
      let indicator = indicatorMap.get(entity.uid)
      if (indicator) {
        indicator.visible = false
      }
      return
    }

    currentEntityIds.add(entity.uid)

    // --- Sprite Handling (for units only) ---
    if (isUnit) {
      let sprite = unitSpriteMap.get(entity.uid)

      if (sprite && !sprite.texture) {
        containers.world.removeChild(sprite) // Remove from world container
        unitSpriteMap.delete(entity.uid)
        sprite = null
      }

      if (!sprite || sprite.texture !== entity.sprite) {
        if (sprite) {
          containers.world.removeChild(sprite) // Remove from world container
        }
        sprite = new PIXI.Sprite(entity.sprite)
        unitSpriteMap.set(entity.uid, sprite)
        containers.world.addChild(sprite) // Add directly to world container
      }

      sprite.visible = entity.visible !== false
      sprite.x = entity.x - UNIT_SPRITE_SIZE/4
      sprite.y = entity.y - UNIT_SPRITE_SIZE/4 - 2
      sprite.zIndex = entity.y + UNIT_SPRITE_SIZE/2 // Set zIndex for sorting based on the visual bottom of the unit sprite
    }

    // --- Progress Indicator Handling (for both units and buildings) ---
    if (entity.showProgressIndicator) {
      let indicator = indicatorMap.get(entity.uid)
      if (!indicator) {
        // Create indicator if it doesn't exist
        indicator = createProgressIndicator(entity, 10, entity.indicatorColor)
      }
      indicator.visible = true
      updateProgressIndicator(entity, entity.progress || 0)
    } else if (indicatorMap.has(entity.uid)) {
      // Remove indicator if it's no longer needed
      removeProgressIndicator(entity.uid)
    }

    // --- Health Bar Handling (for both units and buildings) ---
    // Only show health bars when enabled, entity has health properties, and is damaged (life < maxLife)
    if (gameState.settings.showHealthBars && entity.life !== undefined && entity.maxLife !== undefined && entity.life < entity.maxLife && entity.visible) {
      let healthBar = healthBarMap.get(entity.uid)
      if (!healthBar) {
        // Create health bar if it doesn't exist
        healthBar = createHealthBar(entity, 10)
      }
      healthBar.visible = true
      updateHealthBar(entity)
    } else if (healthBarMap.has(entity.uid)) {
      // Remove health bar if it's no longer needed
      removeHealthBar(entity.uid)
    }
  })

  // Remove sprites for units that no longer exist
  for (const [unitId, sprite] of unitSpriteMap.entries()) {
    if (!currentEntityIds.has(unitId)) {
        containers.world.removeChild(sprite)
        unitSpriteMap.delete(unitId)
    }
  }
  
  // Remove indicators for entities that no longer exist
  for (const entityId of indicatorMap.keys()) {
    if (!currentEntityIds.has(entityId)) {
      removeProgressIndicator(entityId)
    }
  }

  // Remove health bars for entities that no longer exist
  for (const entityId of healthBarMap.keys()) {
    if (!currentEntityIds.has(entityId)) {
      removeHealthBar(entityId)
    }
  }
  
  if(gameState.debug) {
    // Track performance
    drawMainTimings.push((performance.now() - start))
    drawMainTimings.shift()

    if(Math.random() > 0.9975) console.log('Drawing entities: ' + (drawMainTimings.reduce((res, curr) => res + curr, 0) / drawMainTimings.length).toFixed(2) + ' ms')
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
  const visibleWorldObjectSprites = new Set()

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
      const tileType = map[x][y].type
      const isWorldObject = ['TREE', 'DEPLETED_TREE', 'ROCK', 'GOLD'].includes(tileType)// || map[x][y].building

      // Draw background (grass under objects)
      if (map[x][y].back) {
        const backKey = tileKey + (width * height) | 0
        visibleBackgroundSprites.add(backKey)

        let backSprite = backgroundSpriteMap.get(backKey)

        if (!backSprite || backSprite.texture !== map[x][y].back) {
          if (backSprite) {
              containers.background.removeChild(backSprite)
          }
          backSprite = new PIXI.Sprite(map[x][y].back)
          backSprite.x = x * SPRITE_SIZE
          backSprite.y = y * SPRITE_SIZE
          backgroundSpriteMap.set(backKey, backSprite)
          containers.background.addChild(backSprite)
        }
        backSprite.visible = true
      }

      // Handle terrain sprites
      if (isWorldObject) {
        // This is a tree, rock, or building - add it to the sortable world container
        let worldObject = map[x][y]
        let actualObject = null

        if (worldObject.building) {
          actualObject = worldObject.building // Get the actual building object
        } else if (['TREE', 'DEPLETED_TREE', 'ROCK', 'GOLD'].includes(worldObject.type)) {
          actualObject = worldObject // It's a resource object directly on the tile
        }
        
        if (!actualObject) continue // Should not happen if isWorldObject is true, but good for safety

        visibleWorldObjectSprites.add(actualObject.uid)
        let worldSprite = worldObjectSpriteMap.get(actualObject.uid)

        if (!worldSprite || worldSprite.texture !== actualObject.sprite) {
            if (worldSprite) {
                containers.world.removeChild(worldSprite)
            }
            worldSprite = new PIXI.Sprite(actualObject.sprite)
            worldSprite.x = x * SPRITE_SIZE
            worldSprite.y = y * SPRITE_SIZE
            worldSprite.zIndex = worldSprite.y + worldSprite.height // Set zIndex based on visual bottom
            worldObjectSpriteMap.set(actualObject.uid, worldSprite)
            containers.world.addChild(worldSprite)
        }
        worldSprite.visible = true
      } else {
        // This is flat ground - add it to the non-sorted background container
        visibleBackgroundSprites.add(tileKey)
        let backSprite = backgroundSpriteMap.get(tileKey)

        // Get the appropriate sprite texture (animated water or static terrain)
        let spriteTexture = map[x][y].sprite
        if (map[x][y].waterFrames && map[x][y].waterFrames.length === 4) {
          // Use animated water frame
          const currentFrame = getCurrentWaterFrame()
          spriteTexture = map[x][y].waterFrames[currentFrame]
        }

        if (!backSprite || backSprite.texture !== spriteTexture) {
            if (backSprite) {
                containers.background.removeChild(backSprite)
            }
            backSprite = new PIXI.Sprite(spriteTexture)
            backSprite.x = x * SPRITE_SIZE
            backSprite.y = y * SPRITE_SIZE
            backgroundSpriteMap.set(tileKey, backSprite)
            containers.background.addChild(backSprite)
        }
        backSprite.visible = true

        if (map[x][y].building?.selected) {
            // If selected, ensure the indicator is present
            if (!backSprite.selectionIndicator) {
              const selectionSquare = new PIXI.Graphics()
                .rect(0, 0, SPRITE_SIZE, SPRITE_SIZE)
                .stroke({ width: 0.25, color: 0xFFFF00 }) // Yellow square, 2px thick

              backSprite.addChild(selectionSquare)
              backSprite.selectionIndicator = selectionSquare
            }
            // Make sure it's visible
            backSprite.selectionIndicator.visible = true
          } else {
            // If not selected, hide the indicator instead of destroying it
            if (backSprite.selectionIndicator) {
              backSprite.selectionIndicator.visible = false
            }
          }
      }

      // Add special effect on Gold tiles
      if (gameState.map[x]?.[y]?.type === TERRAIN_TYPES.GOLD.type && Math.random() > 0.945) {
        createParticleEmitter(ParticleEffect.GOLD_SPARKLE, {
          x: x * getTileSize() + getTileSize()/2,
          y: y * getTileSize() + getTileSize()/2,
          duration: 1000
        })
      }
    }
  }

  // Only run expensive sprite cleanup when viewport changes significantly (dirty tracking optimization)
  const shouldCleanup = hasViewportChangedSignificantly()

  if (shouldCleanup) {
    // Update last viewport check state
    lastViewportCheck.x = viewport.x
    lastViewportCheck.y = viewport.y
    lastViewportCheck.width = viewport.width
    lastViewportCheck.height = viewport.height

    // Define extended viewport for memory management
    const extendedBuffer = viewport.buffer * 3
    const farStartX = Math.max(0, viewport.x - extendedBuffer)
    const farStartY = Math.max(0, viewport.y - extendedBuffer)
    const farEndX = Math.min(width, viewport.x + viewport.width + extendedBuffer)
    const farEndY = Math.min(height, viewport.y + viewport.height + extendedBuffer)

    // Hide or remove background sprites outside viewport
    for (const [key, sprite] of backgroundSpriteMap.entries()) {
        if (!visibleBackgroundSprites.has(key)) {
            const y = Math.floor(key / 10 / width)
            const x = (key / 10) % width

            if (x < farStartX || x >= farEndX || y < farStartY || y >= farEndY) {
                containers.background.removeChild(sprite)
                backgroundSpriteMap.delete(key)
            } else {
                sprite.visible = false
            }
        }
    }

    // Hide or remove world object sprites outside viewport
    for (const [key, sprite] of worldObjectSpriteMap.entries()) {
        if (!visibleWorldObjectSprites.has(key)) {
            // Retrieve the building object using its UID (the key)
            const building = gameState.humanPlayer.getBuildings().find(b => b.uid === key) || gameState.aiPlayers.flatMap(ai => ai.getBuildings()).find(b => b.uid === key)

            if (building) {
                const x = building.x
                const y = building.y

                if (x < farStartX || x >= farEndX || y < farStartY || y >= farEndY) {
                    containers.world.removeChild(sprite)
                    worldObjectSpriteMap.delete(key)
                } else {
                    sprite.visible = false
                }
            } else {
                // If building object not found, remove the sprite (e.g., building was destroyed)
                containers.world.removeChild(sprite)
                worldObjectSpriteMap.delete(key)
            }
        }
    }
  } else {
    // Fast path: Just hide non-visible sprites without position calculations or removal
    for (const [key, sprite] of backgroundSpriteMap.entries()) {
        if (!visibleBackgroundSprites.has(key)) {
            sprite.visible = false
        }
    }

    for (const [key, sprite] of worldObjectSpriteMap.entries()) {
        if (!visibleWorldObjectSprites.has(key)) {
            sprite.visible = false
        }
    }
  }

  // Debug: draw unit paths
  if (DEBUG()) {
    if(Math.random() > 0.5) {
      // Reuse existing sprites instead of creating new ones
      let spriteIndex = 0

      if (gameState.humanPlayer) {
        gameState.humanPlayer.getUnits().forEach((unit) => {
          for (var i = 1; i < (unit.path || []).length; i++) {
            let pathSprite = containers.debug.children[spriteIndex]

            if (!pathSprite) {
              // Create new sprite only if needed
              pathSprite = new PIXI.Sprite(sprites[`tile_${spriteCoords_Path.x}_${spriteCoords_Path.y}`])
              containers.debug.addChild(pathSprite)
            }

            pathSprite.x = unit.path[i].x * SPRITE_SIZE
            pathSprite.y = unit.path[i].y * SPRITE_SIZE
            pathSprite.visible = true
            spriteIndex++
          }
        })
      }

      // Hide extra sprites instead of removing them
      for (let i = spriteIndex; i < containers.debug.children.length; i++) {
        containers.debug.children[i].visible = false
      }
    }
  } else if (containers.debug.children?.length) {
    // Hide all debug sprites when debug is off
    containers.debug.children.forEach(child => child.visible = false)
  }
  
  backDrawn()
}

/**
 * Update zoom level
 */
async function updateZoom() {
  // Get current view transform
  const viewTransform = gameState.UI?.mouse?.getViewTransform()

  // Apply transformations to all containers that should be affected by zoom/pan
  const containersToTransform = [
    containers.background,
    containers.world, // The new world container handles all sorted objects
    containers.indicators,
    containers.debug
  ];

  // Apply scale to each container
  containersToTransform.forEach(container => {
    if (!container) return;
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
  containers.ui.scale.set(1, 1)
  containers.ui.position.set(0, 0)
}

/**
 * Draw the minimap
 * @param {number} timestamp - Current timestamp for throttling updates
 */
function drawMinimap(timestamp) {
  updateMinimap(timestamp)
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

  // Create progress bar at full width - we'll scale it to show progress
  const progressBar = new PIXI.Graphics()
    .rect(0, 0, width - 2, 1) // Full width minus 2px for border
    .fill({ color: color, alpha: 1 })

  // Position the bar with 1px offset for border
  progressBar.x = 1
  progressBar.y = 1

  // Store the max width for scaling calculations
  progressBar._maxWidth = width - 2
  progressBar._lastColor = color

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
async function updateProgressIndicator(entity, progress) {
  const indicator = indicatorMap.get(entity.uid)
  if (!indicator) return

  const SPRITE_SIZE = getTileSize()

  // Position above entity (different for units vs buildings)
  if (entity.currentNode) {
    // Unit
    if (entity.assignedBuilding && !entity.visible) {
      // Unit is hidden in a building, position indicator on the building
      indicator.x = entity.assignedBuilding.x * SPRITE_SIZE + SPRITE_SIZE/4 - 1
      indicator.y = entity.assignedBuilding.y * SPRITE_SIZE - 5
    } else {
      // Unit is visible, position indicator on the unit
      indicator.x = entity.x + 3
      indicator.y = entity.y - 8
    }
  } else {
    // Building
    indicator.x = entity.x * SPRITE_SIZE + SPRITE_SIZE/4 - 1
    indicator.y = entity.y * SPRITE_SIZE - 5
  }

  // Update progress bar using scale instead of redrawing (avoids GC)
  const progressBar = indicator.getChildAt(1)
  const clampedProgress = Math.min(1, Math.max(0, progress))

  // Use scale.x to adjust width - much faster than clear/redraw
  progressBar.scale.x = clampedProgress

  // Only redraw if color changed (rare case)
  const newColor = entity.indicatorColor || 0x00FF00
  if (progressBar._lastColor !== newColor) {
    progressBar._lastColor = newColor
    progressBar.clear()
      .rect(0, 0, progressBar._maxWidth, 1)
      .fill({ color: newColor, alpha: 1 })
  }
}

/**
 * Remove a progress indicator
 * @param {number} entityUid - UID of entity to remove indicator for
 */
async function removeProgressIndicator(entityUid) {
  const indicator = indicatorMap.get(entityUid)
  if (indicator) {
    containers.indicators.removeChild(indicator)
    indicatorMap.delete(entityUid)
  }
}

/**
 * Create a health bar for an entity
 * @param {Object} entity - Unit or building to create health bar for
 * @param {number} width - Width of the health bar
 * @returns {PIXI.Container} The created health bar container
 */
function createHealthBar(entity, width = 10) {
  const healthBar = new PIXI.Container()

  // Create pixelated background (dark border)
  const background = new PIXI.Graphics()
    .rect(0, 0, width, 3)
    .fill({ color: 0x000000, alpha: 0.6 })

  // Create health bar at full width - we'll scale it to show health
  const bar = new PIXI.Graphics()
    .rect(0, 0, width - 2, 1)
    .fill({ color: 0x00FF00, alpha: 1 })

  // Position the bar with 1px offset for border
  bar.x = 1
  bar.y = 1

  // Store the max width and last color for optimization
  bar._maxWidth = width - 2
  bar._lastColor = 0x00FF00

  healthBar.addChild(background)
  healthBar.addChild(bar)

  // Add to container and map
  containers.indicators.addChild(healthBar)
  healthBarMap.set(entity.uid, healthBar)

  return healthBar
}

/**
 * Get color based on health percentage
 * @param {number} healthPercent - Health percentage (0-1)
 * @returns {number} Color hex value
 */
function getHealthBarColor(healthPercent) {
  if (healthPercent > 0.6) {
    return 0x00FF00 // Green
  } else if (healthPercent > 0.3) {
    return 0xFFFF00 // Yellow
  } else {
    return 0xFF0000 // Red
  }
}

/**
 * Update a health bar's position and value
 * @param {Object} entity - Unit or building the health bar belongs to
 */
async function updateHealthBar(entity) {
  const healthBar = healthBarMap.get(entity.uid)
  if (!healthBar) return

  const SPRITE_SIZE = getTileSize()

  // Calculate health percentage
  const healthPercent = Math.max(0, Math.min(1, entity.life / entity.maxLife))

  // Position above entity (different for units vs buildings)
  if (entity.currentNode) {
    // Unit
    healthBar.x = entity.x + 3
    healthBar.y = entity.y - 6
  } else {
    // Building
    healthBar.x = entity.x * SPRITE_SIZE + SPRITE_SIZE/4 - 1
    healthBar.y = entity.y * SPRITE_SIZE - 3
  }

  // Update health bar using scale and tint (avoids GC)
  const bar = healthBar.getChildAt(1)
  const color = getHealthBarColor(healthPercent)

  // Use scale.x to adjust width - much faster than clear/redraw
  bar.scale.x = healthPercent

  // Only redraw if color changed (health crossed a threshold)
  if (bar._lastColor !== color) {
    bar._lastColor = color
    bar.clear()
      .rect(0, 0, bar._maxWidth, 1)
      .fill({ color: color, alpha: 1 })
  }
}

/**
 * Remove a health bar
 * @param {number} entityUid - UID of entity to remove health bar for
 */
async function removeHealthBar(entityUid) {
  const healthBar = healthBarMap.get(entityUid)
  if (healthBar) {
    containers.indicators.removeChild(healthBar)
    healthBarMap.delete(entityUid)
  }
}
