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
}

'use strict'

import { getCanvasDimensions, getMapDimensions, getTileSize } from 'dimensions'
import { isPositionExplored, isPositionVisible } from 'fogOfWar'
import { TERRAIN_TYPES } from 'game'
import { DEBUG, backDrawn } from 'globals'
import { ParticleEffect, createParticleEmitter, initParticleSystem } from 'particles'
import * as PIXI from 'pixijs'
import { UNIT_SPRITE_SIZE, sprites } from 'sprites'
import gameState from 'state'

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
      roundPixels: true,
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
  
  console.log("Canvas initialized:", app.canvas.width, "x", app.canvas.height, app)

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
        indicator = createProgressIndicator(entity, isUnit ? 10 : 14, entity.indicatorColor)
      }
      indicator.visible = true
      updateProgressIndicator(entity, entity.progress || 0)
    } else if (indicatorMap.has(entity.uid)) {
      // Remove indicator if it's no longer needed
      removeProgressIndicator(entity.uid)
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
      const isWorldObject = ['TREE', 'DEPLETED_TREE', 'ROCK', 'GOLD', 'BUILDING'].includes(tileType)

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
        if (tileType === 'BUILDING') {
          worldObject = gameState.map[x][y].building // Get the actual building object
        }
        
        if (!worldObject) continue // Should not happen for buildings, but good for safety

        visibleWorldObjectSprites.add(worldObject.uid)
        let worldSprite = worldObjectSpriteMap.get(worldObject.uid)

        if (!worldSprite || worldSprite.texture !== worldObject.sprite) {
            if (worldSprite) {
                containers.world.removeChild(worldSprite)
            }
            worldSprite = new PIXI.Sprite(worldObject.sprite)
            worldSprite.x = x * SPRITE_SIZE
            worldSprite.y = y * SPRITE_SIZE
            worldSprite.zIndex = worldSprite.y + worldSprite.height // Set zIndex based on visual bottom
            worldObjectSpriteMap.set(worldObject.uid, worldSprite)
            containers.world.addChild(worldSprite)
        }
        worldSprite.visible = true
      } else {
        // This is flat ground - add it to the non-sorted background container
        visibleBackgroundSprites.add(tileKey)
        let backSprite = backgroundSpriteMap.get(tileKey)

        if (!backSprite || backSprite.texture !== map[x][y].sprite) {
            if (backSprite) {
                containers.background.removeChild(backSprite)
            }
            backSprite = new PIXI.Sprite(map[x][y].sprite)
            backSprite.x = x * SPRITE_SIZE
            backSprite.y = y * SPRITE_SIZE
            backgroundSpriteMap.set(tileKey, backSprite)
            containers.background.addChild(backSprite)
        }
        backSprite.visible = true
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

  // Debug: draw unit paths
  if (DEBUG()) {
    if(Math.random() > 0.5) {
      const debugBatch = new PIXI.Container()
      
      if (gameState.humanPlayer) {
        gameState.humanPlayer.getUnits().forEach((unit) => {
          for (var i = 1; i < (unit.path || []).length; i++) {
            const pathSprite = new PIXI.Sprite(sprites[`tile_${spriteCoords_Path.x}_${spriteCoords_Path.y}`])
            pathSprite.x = unit.path[i].x * SPRITE_SIZE
            pathSprite.y = unit.path[i].y * SPRITE_SIZE
            debugBatch.addChild(pathSprite)
          }
        })
      }
      
      containers.debug.removeChildren()
      containers.debug.addChild(debugBatch)
    }
  } else if (containers.debug.children?.length) {
    containers.debug.removeChildren()
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
async function removeProgressIndicator(entityUid) {
  const indicator = indicatorMap.get(entityUid)
  if (indicator) {
    containers.indicators.removeChild(indicator)
    indicatorMap.delete(entityUid)
  }
}
