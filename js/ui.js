export {
  handleMouseInteraction, initUI, mouse, setupEventListeners, showDebugMessage, updateUI
}
  
'use strict'
  
import { Building } from 'building'
import { getCanvasDimensions, getMapDimensions, getTileSize } from 'dimensions'
import { DEBUG, drawBack, toggleDebug } from 'globals'
import * as PIXI from 'pixijs'
import { app, containers, updateZoom } from 'renderer'
import { offscreenSprite, sprites } from 'sprites'
import gameState from 'state'
import { getCachedSprite } from 'utils'

const UI_FONTS = {
  PRIMARY: "system-ui, 'Open Sans', Arial, sans-serif",
  MONOSPACE: "monospace, 'Courier New', Courier",
  DESIGN: "Jacquarda-Bastarda-9"
}

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
let tooltipContainer = null
let tooltipVisible = false

// building placement
let buildingPreviewSprite = null
let isValidPlacement = false
let selectedBuildingType = null

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
    fontFamily: UI_FONTS.MONOSPACE,
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
    } else if (status === 'menu' || status === 'paused') {
      // Remove preview sprite if it exists
      if (buildingPreviewSprite && buildingPreviewSprite.parent) {
        buildingPreviewSprite.parent.removeChild(buildingPreviewSprite)
        buildingPreviewSprite = null
      }
      selectedBuildingType = null
      selectedBuildingIndex = -1
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
  // Update building preview if a building type is selected
  if (selectedBuildingType) {
    updateBuildingPreview()
    
    // Handle mouse click to place building
    if (mouse?.clicked) {
      // Check if player can afford the building
      if (isValidPlacement && Building.checkCanAffordBuilding(selectedBuildingType)) {
        // Create the building
        player.addBuilding(mouse.x, mouse.y, selectedBuildingType)
        
        // Show message
        showDebugMessage(`${selectedBuildingType.name} placed!`)
        
        // Clear selection
        if (selectedBuildingIndex >= 0) {
          handleBuildingSelect(selectedBuildingIndex)
        }
        
        // Request background redraw
        drawBack()
      }

      // Reset mouse click
      mouse.clicked = false
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
    { name: 'stone', icon: '🪨', initial: playerResources?.stone || 0 },
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
        fontFamily: UI_FONTS.PRIMARY,
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
    gameState.humanPlayer.events.on('resources-changed', () => {
      updateResourceDisplay(gameState.humanPlayer.getResources())
    })
  }
  
  // Handle window resize to update positioning
  gameState.events.on('draw-back-requested-changed', () => {
    updateTopBarPosition()
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
  const barHeight = 80 // Taller than top bar to accommodate building icons
  
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

  // Create tooltip container (initially hidden)
  createBuildingTooltip()
  
  // Add to UI container
  containers.ui.addChild(bottomBarContainer)
  
  // Subscribe to resource changes from human player
  if (gameState.humanPlayer) {
    gameState.humanPlayer.events.on('resources-changed', () => {
      createBuildingSlots()
    })
  }

  // Subscribe to relevant events
  gameState.events.on('draw-back-requested-changed', () => {
    updateBottomBarPosition()
  })
}

function updateBottomBarPosition() {
  if (!bottomBarContainer) return
  
  const { width } = getCanvasDimensions()
  const barHeight = 80
  
  // Update position to stay at bottom
  bottomBarContainer.position.set(0, app.renderer.height - barHeight)
  
  // Update background
  const background = bottomBarContainer.getChildAt(0)
  background.clear()
  background.beginFill(0x114611, 0.85)
  background.lineStyle(2, 0xFFD700, 0.5)
  background.drawRect(0, 0, width, barHeight)
  background.endFill()
  
  // Hide tooltip when resizing
  hideTooltip()

  // Recreate building slots to adjust for new width
  createBuildingSlots()
}

async function createBuildingSlots() {
  const { width } = getCanvasDimensions()
  const slotSize = 64 // Size of building icon slots
  const padding = 10
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
    // Check if player can afford this building and adjust appearance
    const canAfford = Building.checkCanAffordBuilding(buildings[i])

    const slot = new PIXI.Container()
    slot.position.set(startX + i * (slotSize + padding), 12)
    slot.alpha = canAfford ? 1 : 0.5
    
    // Store position for tooltip
    buildings[i].slotPosition = { x: slot.position.x, y: slot.position.y }

    // Slot background
    const slotBg = new PIXI.Graphics()
    slotBg.beginFill(0x333333, 0.7)
    slotBg.lineStyle(1, 0xFFD700, 0.8)
    slotBg.drawRect(0, 0, slotSize, slotSize)
    slotBg.endFill()
    slot.addChild(slotBg)
    
    // Building icon
    let icon
    if(buildings[i].sprite) {
      icon = new PIXI.Sprite(await PIXI.Assets.load({ src: buildings[i].sprite }))
      icon.width = 36
      icon.height = 36
      icon.position.set(slotSize / 2 - 18, 6) // Center the icon in the slot
    } else {
      icon = new PIXI.Text({
        text: buildings[i].icon,
        style: {
          fontSize: 30,
          fill: 0xFFFFFF
        }
      })
      icon.position.set(slotSize / 2 - 15, 5)
    }
    slot.addChild(icon)
    
    // Building name
    const name = new PIXI.Text({
      text: buildings[i].name,
      style: {
        fontFamily: UI_FONTS.PRIMARY,
        fontSize: 11,
        fill: 0xFFD700,
        padding: 10,
        align: 'center',
      }
    })
    name.anchor.set(0.5, 0)
    name.position.set(slotSize / 2 + 7, slotSize - 18)
    slot.addChild(name)

    
    
    // Make slot interactive
    slotBg.eventMode = 'static'
    slotBg.cursor = 'pointer'
    
    // Store the building data with the slot
    slot.buildingData = buildings[i]
    
    // Add click event
    slotBg.on('pointerup', () => handleBuildingSelect(i))

    // Add hover events for tooltip
    slotBg.on('pointerover', () => updateTooltip(buildings[i]))
    slotBg.on('pointerout', () => hideTooltip())

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
    prevBg.drawRect(0, 0, 64, 64)
    prevBg.endFill()
  }
  
  // If clicking same building, deselect it
  if (selectedBuildingIndex === index) {
    selectedBuildingIndex = -1
    selectedBuildingType = null

    // Remove preview sprite if it exists
    if (buildingPreviewSprite && buildingPreviewSprite.parent) {
      buildingPreviewSprite.parent.removeChild(buildingPreviewSprite)
      buildingPreviewSprite = null
    }
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
  bg.drawRect(0, 0, 64, 64)
  bg.endFill()
  
  // Store the selected building type
  selectedBuildingType = slot.buildingData

  // Format cost display
  const costs = selectedBuildingType.costs
  const costText = Object.entries(costs)
    .map(([resource, amount]) => `${resource}: ${amount}`)
    .join(', ')
  
  // Display building info
  const canAfford = Building.checkCanAffordBuilding(selectedBuildingType)
  if(!canAfford) {
    // selectedBuildingType = null
    handleBuildingSelect(index)
  }
  

  const statusMessage = canAfford ? 
    `Selected ${slot.buildingData.name} for placement` : 
    `Cannot afford ${slot.buildingData.name} (Needs ${costText})`
  showDebugMessage(statusMessage)
}



function isValidBuildingPosition(x, y) {
  // Check if coordinates are in bounds
  if (!gameState.map[x] || !gameState.map[x][y]) return false
  
  // For now, only allow building on grass or sand tiles
  return ['GRASS', 'SAND'].includes(gameState.map[x][y].type)
}



async function updateBuildingPreview() {
  if (!selectedBuildingType || !mouse) return

  // Create preview sprite if it doesn't exist
  if (!buildingPreviewSprite) {
    // Load the building sprite texture
    selectedBuildingType.sprite_coords.cyan.x
    const sprite = offscreenSprite(sprites[selectedBuildingType.sprite_coords.cyan.x][selectedBuildingType.sprite_coords.cyan.y], getTileSize())
    const texture = PIXI.Texture.from(sprite)
    buildingPreviewSprite = getCachedSprite(texture, sprite.uid)
    buildingPreviewSprite.width = getTileSize() * getCanvasDimensions().dpr
    buildingPreviewSprite.height = getTileSize() * getCanvasDimensions().dpr
    buildingPreviewSprite.anchor.set(0.5, 0.5)
    containers.ui.addChild(buildingPreviewSprite)
  }

  // Check if the current position is valid
  isValidPlacement = isValidBuildingPosition(mouse.x, mouse.y)
  
  // Update preview position
  const tileSize = getTileSize()
  buildingPreviewSprite.x = mouse.xPixels
  buildingPreviewSprite.y = mouse.yPixels
  
  // Set tint color based on validity (green if valid, red if invalid)
  buildingPreviewSprite.tint = isValidPlacement ? 0x00FF00 : 0xFF0000
  
  // Set alpha for better visibility
  buildingPreviewSprite.alpha = 0.7
}




// Create a tooltip container for building information
function createBuildingTooltip() {
  if (tooltipContainer) {
    bottomBarContainer.removeChild(tooltipContainer)
  }
  
  tooltipContainer = new PIXI.Container()
  tooltipContainer.visible = false
  
  // Background for the tooltip
  const background = new PIXI.Graphics()
  background.beginFill(0x333333, 0.9)
  background.lineStyle(2, 0xFFD700, 0.8)
  background.drawRoundedRect(0, 0, 275, 140, 8)
  background.endFill()
  tooltipContainer.addChild(background)
  
  // Add placeholder text elements that will be updated on hover
  const titleText = new PIXI.Text({
    text: "",
    style: {
      fontFamily: UI_FONTS.PRIMARY,
      fontSize: 16,
      fill: 0xFFD700,
      fontWeight: 'bold',
      padding: 25
    }
  })
  titleText.position.set(10, 10)
  tooltipContainer.addChild(titleText)
  
  const iconContainer = new PIXI.Container()
  iconContainer.position.set(10, 35)
  tooltipContainer.addChild(iconContainer)
  
  const descText = new PIXI.Text({
    text: "",
    style: {
      fontFamily: UI_FONTS.PRIMARY,
      fontSize: 12,
      fill: 0xFFFFFF,
      padding: 40
    }
  })
  descText.position.set(64, 48)
  tooltipContainer.addChild(descText)
  
  const costTitle = new PIXI.Text({
    text: "Costs:",
    style: {
      fontFamily: UI_FONTS.PRIMARY,
      fontSize: 12,
      fill: 0xFFD700
    }
  })
  costTitle.position.set(10, 85)
  tooltipContainer.addChild(costTitle)
  
  const costContainer = new PIXI.Container()
  costContainer.position.set(10, 105)
  tooltipContainer.addChild(costContainer)
  
  bottomBarContainer.addChild(tooltipContainer)
}

// Update the tooltip with building information
async function updateTooltip(building) {
  if (!tooltipContainer) return
  
  const titleText = tooltipContainer.getChildAt(1)
  const iconContainer = tooltipContainer.getChildAt(2)
  const descText = tooltipContainer.getChildAt(3)
  const costContainer = tooltipContainer.getChildAt(5)
  
  // Update text content
  titleText.text = building.name
  descText.text = building.description
  
  // Clear previous cost items
  while (costContainer.children.length > 0) {
    costContainer.removeChildAt(0)
  }

  // Clear and update icon container
  while (iconContainer.children.length > 0) {
    iconContainer.removeChildAt(0)
  }
  const iconSprite = new PIXI.Sprite(await PIXI.Assets.load({ src: building.sprite }))
  iconSprite.width = 42
  iconSprite.height = 42
  iconContainer.addChild(iconSprite)
  
  // Add resource costs with icons
  let xOffset = 0;
  
  const resourceIcons = {
    wood: "🪵",
    water: "💧",
    gold: "🪙",
    money: "💰",
    stone: "🪨"
  }
  
  for (const [resource, amount] of Object.entries(building.costs)) {
    const container = new PIXI.Container()
    container.position.set(xOffset, 0)
    
    // Resource icon
    const icon = new PIXI.Text({
      text: resourceIcons[resource] || "❓",
      style: { fontSize: 16 }
    });
    container.addChild(icon)
    
    // Resource amount
    const amountText = new PIXI.Text({
      text: amount.toString(),
      style: {
        fontFamily: UI_FONTS.PRIMARY,
        fontSize: 12,
        fill: 0xFFFFFF
      }
    })
    amountText.position.set(20, 4)
    container.addChild(amountText)
    
    costContainer.addChild(container)
    xOffset += 55
  }
  
  // Position the tooltip
  const { width } = getCanvasDimensions();
  const tooltipWidth = 275
  
  // Calculate position to ensure tooltip stays within screen bounds
  let tooltipX = building.slotPosition.x + 56 / 2 - tooltipWidth / 2
  if (tooltipX + tooltipWidth > width) {
    tooltipX = width - tooltipWidth - 10
  }
  
  tooltipContainer.position.set(tooltipX, -150) // Position above the slot
  tooltipContainer.visible = true
  tooltipVisible = true
}

// Hide the tooltip
function hideTooltip() {
  if (tooltipContainer) {
    tooltipContainer.visible = false
    tooltipVisible = false
  }
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