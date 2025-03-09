export {
  handleMouseInteraction, initUI, mouse, setupEventListeners, showDebugMessage, updateUI
}
  
'use strict'
  
import { Building } from 'building'
import { getCanvasDimensions, getMapDimensions, getTileSize } from 'dimensions'
import { DEBUG, drawBack, toggleDebug } from 'globals'
import * as PIXI from 'pixijs'
import { app, containers, updateZoom } from 'renderer'
import gameState from 'state'
import { getCachedSprite } from 'utils'
  
// Mouse object (will be initialized in initUI)
let mouse = null
let elapsedUI = -5000
let cursorUpdateRafId = null

// UI elements
let cursorSprite = null
let statsText = null
let topBarContainer = null
let bottomBarContainer = null
let resourceTexts = {}
let buildingSlots = []
let selectedBuildingIndex = -1

/**
 * Initialize UI components
 * @param {Object} mouseInstance - Mouse controller instance
 */
async function initUI(mouseInstance) {
  mouse = mouseInstance
  gameState.UI = { mouse: mouse }

  setupEventListeners()
  
  // Create cursor sprite
  if (mouse.sprite) {
    const cursorTexture = await createTextureFromOffscreenCanvas(mouse.sprite)
    cursorSprite = getCachedSprite(cursorTexture, 'cursor')
    cursorSprite.pivot.set(4.5, 4.5) // Center the cursor
    containers.ui.addChild(cursorSprite)

    // Start dedicated cursor update loop
    updateCursor()
  }
  
  // Create debug stats text
  statsText = new PIXI.Text({
    text: '',
    fontFamily: 'monospace',
    fontSize: 14,
    resolution: window.devicePixelRatio || 1,
    fill: 0xffffff,
    stroke: 0x000000,
    strokeThickness: 2
  })
  statsText.position.set(10, 10)
  statsText.visible = DEBUG()
  containers.ui.addChild(statsText)
  
  // Subscribe to state changes
  gameState.events.on('debug-changed', (value) => {
    statsText.visible = value
    if (!value) {
      document.getElementById('stats').innerHTML = null
    }
    drawBack()
  })
  
  gameState.events.on('game-status-changed', async (status) => {
    if (status === 'playing') {
      document.getElementById('homeMenu').style.opacity = 0
      setTimeout(() => {
        document.getElementById('homeMenu').style.display = 'none'
      }, 750)

      // Create the top resource bar
      createTopBar()

      // Create the bottom building bar
      createBottomBar()
    }
  })
}

/**
 * Create a PIXI texture from an OffscreenCanvas
 * @param {OffscreenCanvas} canvas - The offscreen canvas
 * @returns {Promise<PIXI.Texture>} The created texture
 */
async function createTextureFromOffscreenCanvas(canvas) {
  // For newer browsers that support convertToBlob
  if (canvas.convertToBlob) {
    const blob = await canvas.convertToBlob()
    const url = URL.createObjectURL(blob)
    const texture = await PIXI.Assets.load({
      src: url,
      // format: 'png',
      loadParser: 'loadTextures',
    })

    texture.source.scaleMode = PIXI.SCALE_MODES.NEAREST

    // Clean up the URL when the texture is loaded
    texture.source.once('loaded', () => {
      URL.revokeObjectURL(url)
    })
    
    return texture
  } 
  // Fallback for browsers without convertToBlob
  else {
    return new Promise((resolve) => {
      canvas.toBlob(async (blob) => {
        const url = URL.createObjectURL(blob)
        const texture = await PIXI.Assets.load({
          src: url,
          // format: 'png',
          loadParser: 'loadTextures',
        })
        
        texture.source.scaleMode = PIXI.SCALE_MODES.NEAREST

        texture.source.once('loaded', () => {
          URL.revokeObjectURL(url)
        })
        
        resolve(texture)
      })
    })
  }
}

/**
 * Setup all event listeners for UI interaction
 */
function setupEventListeners() {
  // Debug button toggle
  document.getElementById('debugButton').addEventListener('click', () => {
    toggleDebug()
  })

  // Start game on "Random Map" click
  document.getElementById('generated').addEventListener('click', () => {
    gameState.gameStatus = 'initialize'
  })

  // Keyboard shortcuts
  window.addEventListener('keypress', (event) => {
    event.preventDefault()
    switch(event.key) {
      case 'd':
        toggleDebug()
        break
    }
  })
}

/**
 * Handle mouse interactions with the game
 * @param {Array} map - Game map
 * @param {Object} player - Player object
 */
function handleMouseInteraction(map, player) {
  // Handle mouse click to create units
  if (mouse?.clicked) {
    const { maxWeight: MAX_WEIGHT } = getMapDimensions()
    mouse.clicked = false
    if (map[mouse.x] && map[mouse.x][mouse.y]?.weight < MAX_WEIGHT) {
      player.addWorker(mouse.x, mouse.y, map)
    }
  }

  // Handle zoom changes
  if (mouse?.zoomChanged) {
    updateZoom()
    drawBack()
    mouse.zoomChanged = false
  }
}

function updateCursor() {
  // Only update if cursor sprite and mouse exist
  if (cursorSprite && mouse) {
    cursorSprite.position.set(mouse.xPixels, mouse.yPixels);
  }
  
  // Continue the cursor update loop
  cursorUpdateRafId = requestAnimationFrame(updateCursor);
}

/**
 * Update UI elements
 * @param {Array} fps - FPS history array
 */
function updateUI(fps) {
  const now = performance.now()

  // Only update UI when necessary
  if ((DEBUG() && now - elapsedUI > 200)) {
    drawUI(fps)
    elapsedUI = now
  }
}

/**
 * Draw UI elements
 * @param {Array} fps - FPS history array
 */
function drawUI(fps) {
  // Update debug stats text
  if (DEBUG()) {
    const currentFps = (1000 * fps.length / fps.reduce((res, curr) => res + curr, 0)).toFixed(1)
    const unitsCount = gameState.humanPlayer.getUnits().length
    const aiUnitsCount = gameState.aiPlayers.reduce((sum, ai) => sum + ai.getUnits().length, 0)
    const viewTransform = mouse.getViewTransform()

    const { width: MAP_WIDTH, height: MAP_HEIGHT } = getMapDimensions()
    const SPRITE_SIZE = getTileSize()
    
    statsText.text = [
      `FPS: ${currentFps} | DPR: ${globalThis.devicePixelRatio || 1}`,
      `Game Status: ${gameState.gameStatus}`,
      `Units: ${unitsCount} human, ${aiUnitsCount} AI`,
      `Mouse: ${mouse.x}x${mouse.y} (${mouse.worldX.toFixed(0)}, ${mouse.worldY.toFixed(0)})${mouse.isDragging ? ' | clic' : ''}`,
      `Zoom: ${viewTransform.scale.toFixed(2)}x`,
      `World: ${MAP_WIDTH}x${MAP_HEIGHT} (${MAP_WIDTH*SPRITE_SIZE}x${MAP_HEIGHT*SPRITE_SIZE})`,
      
      `Renderer: ${app.renderer.width}x${app.renderer.height}`,
      `Screen: ${screen.width}x${screen.height} | Available: ${screen.availWidth}x${screen.availHeight}`,
      `Window: ${window.innerWidth}x${window.innerHeight}`,
      `CSS: ${document.documentElement.clientWidth}x${document.documentElement.clientHeight}`,
      `Canvas: ${app.canvas.style.width}x${app.canvas.style.height}`
    ].join('\n')
  }
}

function updateResourceDisplay(resources) {
  for (const [resource, value] of Object.entries(resources)) {
    if (resourceTexts[resource]) {
      resourceTexts[resource].text = value.toString()
    }
  }
}

async function createTopBar() {
  if (topBarContainer) return;
  
  const { width } = getCanvasDimensions()
  const barHeight = 32 // Fixed height for the top bar
  
  // Create the container
  topBarContainer = new PIXI.Container()
  
  // Create background
  const background = new PIXI.Graphics()
  background.beginFill(0x114611, 0.85) // Dark green with transparency
  background.lineStyle(2, 0xFFD700, 0.5) // Gold border
  background.drawRect(0, 0, width, barHeight)
  background.endFill()
  topBarContainer.addChild(background)

  // Get resources from the human player
  const playerResources = gameState.humanPlayer?.getResources()
  
  // Resources to display
  const resources = [
    { name: 'wood', icon: '🪵', initial: playerResources?.wood || 0 },
    { name: 'water', icon: '💧', initial: playerResources?.water || 0 },
    { name: 'gold', icon: '🪙', initial: playerResources?.gold || 0 },
    { name: 'rock', icon: '🪨', initial: playerResources?.rock || 0 },
    { name: 'money', icon: '💰', initial: playerResources?.money || 0 },
    { name: 'population', icon: '👥', initial: playerResources?.population || 0 }
  ]
  
  const spacing = width / resources.length
  
  // Create each resource display
  resources.forEach((resource, index) => {
    const resourceContainer = new PIXI.Container()
    resourceContainer.position.set(Math.floor(index * spacing + 10), 6)
    
    // Icon text (emoji)
    const icon = new PIXI.Text({
      text: resource.icon,
      style: {
        fontSize: 16,
        fill: 0xFFD700 // Gold color
      }
    })
    resourceContainer.addChild(icon)
    
    // Resource value
    const text = new PIXI.Text({
      text: resource.initial.toString(),
      style: {
        fontFamily: 'var(--font-base)',
        fontSize: 14,
        fill: 0xFFD700
      }
    })
    text.position.set(24, 2) // Position after the icon
    resourceContainer.addChild(text)
    
    // Store reference for updates
    resourceTexts[resource.name] = text
    
    topBarContainer.addChild(resourceContainer)
  })
  
  // Add to UI container
  containers.ui.addChild(topBarContainer)
  
  // Subscribe to resource changes from human player
  if (gameState.humanPlayer) {
    gameState.humanPlayer.events.on('resources-changed', updateResourceDisplay)
  }

  // Subscribe to player changes
  gameState.events.on('human-player-changed', (player) => {
    if (player) {
      player.events.on('resources-changed', updateResourceDisplay)
      // Initial update with new player's resources
      updateResourceDisplay(player.getResources())
    }
  })
  
  // Handle window resize to update positioning
  gameState.events.on('draw-back-requested-changed', () => {
    if (gameState.isDrawBackRequested) {
      updateTopBarPosition()
    }
  })
}


function updateTopBarPosition() {
  if (!topBarContainer) return
  
  const { width } = getCanvasDimensions()
  const barHeight = 32
  
  // Update background
  const background = topBarContainer.getChildAt(0)
  background.clear()
  background.beginFill(0x114611, 0.85)
  background.lineStyle(2, 0xFFD700, 0.5)
  background.drawRect(0, 0, width, barHeight)
  background.endFill()
  
  // Update resource positions
  const resources = Object.keys(resourceTexts)
  const spacing = width / resources.length
  
  resources.forEach((resource, index) => {
    const container = resourceTexts[resource].parent
    container.position.set(Math.floor(index * spacing + 10), 6)
  })
}


async function createBottomBar() {
  if (bottomBarContainer) return
  
  const { width } = getCanvasDimensions()
  const barHeight = 64 // Taller than top bar to accommodate building icons
  
  // Create the container
  bottomBarContainer = new PIXI.Container()
  
  // Create background
  const background = new PIXI.Graphics()
  background.beginFill(0x114611, 0.85) // Dark green with transparency
  background.lineStyle(2, 0xFFD700, 0.5) // Gold border
  background.drawRect(0, 0, width, barHeight)
  background.endFill()
  bottomBarContainer.addChild(background)

  // Position at bottom of screen
  bottomBarContainer.position.set(0, app.renderer.height - barHeight)

  // Add slots for buildings
  await createBuildingSlots()
  
  // Add to UI container
  containers.ui.addChild(bottomBarContainer)
  
  // Subscribe to relevant events
  gameState.events.on('draw-back-requested-changed', () => {
    if (gameState.isDrawBackRequested) {
      updateBottomBarPosition()
    }
  })
}

async function createBuildingSlots() {
  const { width } = getCanvasDimensions()
  const slotSize = 48 // Size of building icon slots
  const padding = 8
  const maxSlots = Math.floor(width / (slotSize + padding))
  
  // Clear existing slots
  buildingSlots.forEach(slot => {
    if (slot.parent) slot.parent.removeChild(slot)
  })
  buildingSlots = []
  
  // Create slots based on available buildings
  const buildings = [
    Building.TYPES.LUMBERJACK,
    Building.TYPES.TENT,
    Building.TYPES.GOLD_MINE,
    Building.TYPES.QUARRY,
    Building.TYPES.WELL,
    Building.TYPES.BARRACKS,
    Building.TYPES.ARMORY,
    Building.TYPES.CITADEL
  ]
  
  const numSlots = Math.min(buildings.length, maxSlots)
  const startX = (width - (numSlots * (slotSize + padding) - padding)) / 2
  
  for (let i = 0; i < numSlots; i++) {
    const slot = new PIXI.Container()
    slot.position.set(startX + i * (slotSize + padding), 8)
    
    // Slot background
    const slotBg = new PIXI.Graphics()
    slotBg.beginFill(0x333333, 0.7)
    slotBg.lineStyle(1, 0xFFD700, 0.8)
    slotBg.drawRect(0, 0, slotSize, slotSize)
    slotBg.endFill()
    slot.addChild(slotBg)
    
    // Building icon
    const icon = new PIXI.Text({
      text: buildings[i].icon,
      style: {
        fontSize: 24,
        fill: 0xFFFFFF
      }
    })
    icon.position.set(slotSize / 2 - 12, 4)
    slot.addChild(icon)
    
    // Building name
    const name = new PIXI.Text({
      text: buildings[i].name,
      style: {
        fontFamily: 'var(--font-base)',
        fontSize: 10,
        fill: 0xFFD700
      }
    })
    name.position.set(4, slotSize - 14)
    slot.addChild(name)
    
    // Make slot interactive
    slotBg.eventMode = 'static'
    slotBg.cursor = 'pointer'
    
    // Store the building data with the slot
    slot.buildingData = buildings[i]
    
    // Add click event
    slotBg.on('pointerdown', () => handleBuildingSelect(i))
    
    // Check if player can afford this building and adjust appearance
    const canAfford = Building.checkCanAffordBuilding(buildings[i])
    if (!canAfford) {
      slotBg.alpha = 0.5;
      icon.alpha = 0.5;
      name.alpha = 0.5;
    }

    bottomBarContainer.addChild(slot)
    buildingSlots.push(slot)
  }
}

function handleBuildingSelect(index) {
  // Deselect previous selection
  if (selectedBuildingIndex >= 0 && selectedBuildingIndex < buildingSlots.length) {
    const prevSlot = buildingSlots[selectedBuildingIndex]
    const prevBg = prevSlot.getChildAt(0)
    prevBg.clear()
    prevBg.beginFill(0x333333, 0.7)
    prevBg.lineStyle(1, 0xFFD700, 0.8)
    prevBg.drawRect(0, 0, 48, 48)
    prevBg.endFill()
  }
  
  // If clicking same building, deselect it
  if (selectedBuildingIndex === index) {
    selectedBuildingIndex = -1
    return
  }
  
  // Select new building
  selectedBuildingIndex = index
  const slot = buildingSlots[index]
  const bg = slot.getChildAt(0)
  
  // Highlight selected building
  bg.clear()
  bg.beginFill(0x555555, 0.9)
  bg.lineStyle(2, 0xFFFFFF, 1)
  bg.drawRect(0, 0, 48, 48)
  bg.endFill()

  // Format cost display
  const costs = slot.buildingData.costs
  const costText = Object.entries(costs)
    .map(([resource, amount]) => `${resource}: ${amount}`)
    .join(', ')
  
  // Display building info
  const canAfford = Building.checkCanAffordBuilding(slot.buildingData)
  if(!canAfford) handleBuildingSelect(index)
  

  const statusMessage = canAfford ? 
    `Selected ${slot.buildingData.name} for placement` : 
    `Cannot afford ${slot.buildingData.name} (Needs ${costText})`
  showDebugMessage(statusMessage)
}

function updateBottomBarPosition() {
  if (!bottomBarContainer) return
  
  const { width } = getCanvasDimensions()
  const barHeight = 64
  
  // Update position to stay at bottom
  bottomBarContainer.position.set(0, app.renderer.height - barHeight)
  
  // Update background
  const background = bottomBarContainer.getChildAt(0)
  background.clear()
  background.beginFill(0x114611, 0.85)
  background.lineStyle(2, 0xFFD700, 0.5)
  background.drawRect(0, 0, width, barHeight)
  background.endFill()
  
  // Recreate building slots to adjust for new width
  createBuildingSlots()
}


const showDebugMessage = async (message) => {
  const debugElement = document.createElement('div')
  debugElement.style.position = 'absolute'
  debugElement.style.bottom = '40px'
  debugElement.style.right = '40px'
  debugElement.style.backgroundColor = 'rgba(0,0,0,0.7)'
  debugElement.style.color = 'white'
  debugElement.style.padding = '5px'
  debugElement.style.zIndex = '1000'
  debugElement.textContent = message
  document.body.appendChild(debugElement)
  
  setTimeout(() => {
      document.body.removeChild(debugElement)
  }, 3000)
}