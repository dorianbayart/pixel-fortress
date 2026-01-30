export {
  handleMouseInteraction, initUI, mouse, setupEventListeners, setupGameMenuEventListeners, showDebugMessage, showModal, updateUI, recreateUIElements
}
  
'use strict'

import { playClickSound, playCloseSound, playConfirmSound } from 'audio'
import { Building, WorkerBuilding } from 'building'
import CONSTANTS from 'constants'
import { getCanvasDimensions, getMapDimensions, getTileSize } from 'dimensions'
import { DEBUG, drawBack, toggleDebug } from 'globals'
import { downloadMapJSON } from 'maps'
import { ParticleEffect, createParticleEmitter } from 'particles'
import * as PIXI from 'pixijs'
import { sprites } from 'sprites'
import { app, containers, indicatorMap, updateZoom, unitSpriteMap, backgroundSpriteMap, worldObjectSpriteMap } from 'renderer'
import gameState from 'state'
import { getPathfindingStats } from 'pathfinding'

const UI_FONTS = CONSTANTS.UI.FONTS

// Helper function to create text with dynamic padding based on text length
function createText(text, style, customPadding = null) {
  // Calculate dynamic padding based on text length and font size
  const textLength = text.toString().length
  const fontSize = style.fontSize || 14
  const calculatedPadding = customPadding || Math.max(20, textLength * fontSize * 0.5)

  // Clone the style and set dynamic padding
  const dynamicStyle = style.clone()
  dynamicStyle.padding = calculatedPadding

  const textObj = new PIXI.Text({
    text: text,
    style: dynamicStyle,
    resolution: 2
  })
  return textObj
}

// Shared TextStyle instances for better performance (PixiJS 8.13.0+)
// Text objects that share the same TextStyle instance will share textures
const TEXT_STYLES = {
  resource: new PIXI.TextStyle({
    fontFamily: UI_FONTS.PRIMARY,
    fontSize: 14,
    fill: 0xFFD700,
    padding: 8,  // Increased padding to prevent clipping
    strokeThickness: 1,
    stroke: 0x000000,
    wordWrap: false
  }),
  buildingName: new PIXI.TextStyle({
    fontFamily: UI_FONTS.PRIMARY,
    fontSize: 20,  // Corrected to match actual usage
    fill: 0xFFD700,
    fontWeight: 'bold',
    padding: 10  // Increased for bold text which needs more space
  }),
  buildingDescription: new PIXI.TextStyle({
    fontFamily: UI_FONTS.PRIMARY,
    fontSize: 14,
    fill: 0xFFFFFF,
    padding: 8
  }),
  buildingDetails: new PIXI.TextStyle({
    fontFamily: UI_FONTS.PRIMARY,
    fontSize: 12,  // Corrected to match actual usage
    fill: 0xCCCCCC,
    fontStyle: 'italic',
    padding: 8  // Italic text may extend beyond normal bounds
  }),
  buildingInfo: new PIXI.TextStyle({
    fontFamily: UI_FONTS.PRIMARY,
    fontSize: 14,
    fill: 0x00FF00,
    padding: 8
  }),
  buildingInfoBlue: new PIXI.TextStyle({
    fontFamily: UI_FONTS.PRIMARY,
    fontSize: 14,
    fill: 0xADD8E6,
    padding: 8
  }),
  marketLabel: new PIXI.TextStyle({
    fontFamily: UI_FONTS.PRIMARY,
    fontSize: 14,
    fill: 0xFFD700,
    padding: 8
  }),
  marketInfo: new PIXI.TextStyle({
    fontFamily: UI_FONTS.PRIMARY,
    fontSize: 14,
    fill: 0xFFFFFF,
    padding: 8
  }),
  upgradeButton: new PIXI.TextStyle({
    fontFamily: UI_FONTS.PRIMARY,
    fontSize: 16,
    fill: 0xFFFFFF,
    padding: 10  // Larger text needs more padding
  }),
  upgradeBenefits: new PIXI.TextStyle({
    fontFamily: UI_FONTS.PRIMARY,
    fontSize: 12,
    fill: 0xFFFFFF,
    padding: 8
  }),
  slotName: new PIXI.TextStyle({
    fontFamily: UI_FONTS.PRIMARY,
    fontSize: 11,
    fill: 0xFFD700,
    padding: 8,
    align: 'center'
  }),
  tooltipTitle: new PIXI.TextStyle({
    fontFamily: UI_FONTS.PRIMARY,
    fontSize: 16,
    fill: 0xFFD700,
    fontWeight: 'bold',
    padding: 10,
    wordWrap: false
  }),
  tooltipDescription: new PIXI.TextStyle({
    fontFamily: UI_FONTS.PRIMARY,
    fontSize: 12,
    fill: 0xFFFFFF,
    padding: 8,
    wordWrap: false
  }),
  tooltipDetails: new PIXI.TextStyle({
    fontFamily: UI_FONTS.PRIMARY,
    fontSize: 11,
    fill: 0xCCCCCC,
    fontStyle: 'italic',
    padding: 8,
    wordWrap: false
  })
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
  if(!mouse) {
    // Subscribe to state changes
    gameState.events.on('debug-changed', (value) => {
      statsText.visible = value
    })
    
    gameState.events.on('game-status-changed', async (status) => {
      if (status === 'playing') {
        playConfirmSound()

        document.getElementById('homeMenu').style.opacity = 0
        setTimeout(() => {
          document.getElementById('homeMenu').style.display = 'none'
        }, 600)

        // Create the top resource bar
        createTopBar()

        // Create the bottom building bar
        createBottomBar()
      } else if (status === 'paused') {
        playCloseSound()

        // Remove preview sprite if it exists
        if (buildingPreviewSprite && buildingPreviewSprite.parent) {
          buildingPreviewSprite.parent.removeChild(buildingPreviewSprite)
          buildingPreviewSprite = null
        }
        selectedBuildingType = null
        selectedBuildingIndex = -1
      } else if (status === 'menu') {
        playClickSound()

        // Remove preview sprite if it exists
        if (buildingPreviewSprite?.parent) {
          buildingPreviewSprite.parent.removeChild(buildingPreviewSprite)
          buildingPreviewSprite = null
        }
        selectedBuildingType = null
        selectedBuildingIndex = -1

        // Show home menu
        document.getElementById('homeMenu').style.display = 'flex'
        setTimeout(() => {
          document.getElementById('homeMenu').style.opacity = 1
        }, 20)
      }
    })
  } else if (gameState.status === 'playing') {
    // Create the top resource bar
    createTopBar()

    // Create the bottom building bar
    createBottomBar()
  }
  

  mouse = mouseInstance
  gameState.UI = { mouse: mouse }

  // Create cursor sprite
  if (mouse?.sprite) {
    cursorSprite = new PIXI.Sprite(mouse.sprite)
    cursorSprite.pivot.set(4.5, 4.5) // Center the cursor
    containers.ui.addChild(cursorSprite)

    // Start dedicated cursor update loop
    updateCursor()
  }
  
  // Create debug stats text
  statsText = new PIXI.Text({
    text: '',
    style: {
      fontFamily: UI_FONTS.MONOSPACE,
      fontSize: 14 * (window.devicePixelRatio || 1),
    },
    resolution: window.devicePixelRatio || 1,
    fill: 0xffffff,
    stroke: 0x000000,
    strokeThickness: 2
  })
  statsText.position.set(10, 38)
  statsText.scale.set(1 / (window.devicePixelRatio || 1))
  statsText.visible = DEBUG()
  containers.ui.addChild(statsText)
}

/**
 * Recreate UI elements after renderer recreation
 * Call this after containers have been recreated
 */
function recreateUIElements() {
  // Recreate debug stats text
  statsText = new PIXI.Text({
    text: '',
    style: {
      fontFamily: UI_FONTS.MONOSPACE,
      fontSize: 14 * (window.devicePixelRatio || 1),
    },
    resolution: window.devicePixelRatio || 1,
    fill: 0xffffff,
    stroke: 0x000000,
    strokeThickness: 2
  })
  statsText.position.set(10, 38)
  statsText.scale.set(1 / (window.devicePixelRatio || 1))
  statsText.visible = DEBUG()
  containers.ui.addChild(statsText)

  // Recreate cursor sprite if mouse exists
  if (mouse?.sprite) {
    cursorSprite = new PIXI.Sprite(mouse.sprite)
    cursorSprite.pivot.set(4.5, 4.5)
    containers.ui.addChild(cursorSprite)
  }

  // Recreate top and bottom bars if game is playing
  if (gameState.gameStatus === 'playing') {
    createTopBar()
    createBottomBar()
  }
}

/**
 * Setup all event listeners for UI interaction
 */
function setupEventListeners() {

  // Keyboard shortcuts
  window.addEventListener('keypress', (event) => {
    // Don't prevent default if user is typing in an input field
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
      return
    }

    event.preventDefault()
    switch(event.key) {
      case 'd':
        toggleDebug()
        break
      case 'h':
        gameState.showHealthBars = !gameState.showHealthBars
        showDebugMessage(`Health bars ${gameState.showHealthBars ? 'enabled' : 'disabled'}`)
        break
      case 'u':
        if (gameState.selectedBuilding && gameState.humanPlayer.canAffordUpgrade(gameState.selectedBuilding)) {
          gameState.selectedBuilding.handleBuildingUpgrade()
          // Simulate a click event for visual feedback (sparkles)
          addButtonSparkles({ clientX: app.renderer.width / 2, clientY: app.renderer.height - CONSTANTS.UI.BOTTOM_BAR_HEIGHT / 2 })
        }
        break
    }
  })

  setupGameMenuEventListeners()
}

/**
 * Setup event listeners for the in-game menu
 */
function setupGameMenuEventListeners() {
  const gameMenuSection = document.getElementById('gameMenuSection')
  const closeButton = gameMenuSection.querySelector('.close')
  const resumeGameButton = document.getElementById('resumeGame')
  const openOptionsButton = document.getElementById('openOptionsFromGame')
  const resetMapButton = document.getElementById('resetMap')
  const quitToHomeButton = document.getElementById('quitToHome')
  const exportMapButton = document.getElementById('exportMapButton')

  // Resume game button
  resumeGameButton.addEventListener('click', closeGameMenu)

  // Close button
  closeButton.addEventListener('click', closeGameMenu)

  // Options button - close game menu and open options
  openOptionsButton.addEventListener('click', () => {
    playClickSound()
    closeGameMenu()
    // Small delay to let the game menu close animation finish
    setTimeout(() => {
      openOptionsModal()
    }, 100)
  })

  // Reset map button
  resetMapButton.addEventListener('click', resetCurrentMap)

  // Quit to home button
  quitToHomeButton.addEventListener('click', quitToHome)

  // Export map button
  exportMapButton.addEventListener('click', handleExportMap)

  // Close the modal if the user clicks outside of it
  window.addEventListener('click', (event) => {
    if (event.target === gameMenuSection) {
      closeGameMenu('game')
    }
  })

  // Escape key toggles the menu
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (gameMenuSection.classList.contains('show')) {
        closeGameMenu('game')
      } else if (gameState.gameStatus === 'playing') {
        openGameMenu()
      }
    }
  })
}

/**
 * Open the Options modal from in-game
 */
function openOptionsModal() {
  const optionsSection = document.getElementById('optionsSection')
  const debugToggle = document.getElementById('debugToggle')
  const healthBarsToggle = document.getElementById('healthBarsToggle')
  const antialiasingToggle = document.getElementById('antialiasingToggle')
  const antialiasingStatus = document.getElementById('antialiasingStatus')
  const sfxVolumeSlider = document.getElementById('sfxVolumeSlider')
  const musicVolumeSlider = document.getElementById('musicVolumeSlider')

  // Set current values based on game settings
  debugToggle.checked = gameState.settings?.debugMode === true
  healthBarsToggle.checked = gameState.settings?.showHealthBars === true
  antialiasingToggle.checked = gameState.settings?.antialiasing ?? false
  sfxVolumeSlider.value = gameState.settings?.sfxVolume ?? 0.8
  musicVolumeSlider.value = gameState.settings?.musicVolume ?? 0.5

  // Update antialiasing status text
  if (antialiasingToggle.checked) {
    antialiasingStatus.textContent = '(2x resolution)'
  } else {
    antialiasingStatus.textContent = ''
  }

  // Show the modal
  optionsSection.style.display = 'block'
  setTimeout(() => {
    optionsSection.classList.add('show')
  }, 20)
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
      if (isValidPlacement && player.canAffordBuilding(selectedBuildingType)) {
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
    updateBottomBarPosition()

    statsText.style.fontSize = 14 * (window.devicePixelRatio || 1)
    statsText.resolution = window.devicePixelRatio || 1
    statsText.scale.set(1 / (window.devicePixelRatio || 1))

    // Remove preview sprite if it exists
    if (buildingPreviewSprite && buildingPreviewSprite.parent) {
      buildingPreviewSprite.parent.removeChild(buildingPreviewSprite)
      buildingPreviewSprite = null
    }
    // Recreate the preview sprite
    updateBuildingPreview()

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
  if ((DEBUG() && now - elapsedUI > 500)) {
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
  const unitsCount = gameState.humanPlayer?.getUnits().length
  const aiUnitsCount = gameState.aiPlayers?.reduce((sum, ai) => sum + ai.getUnits().length, 0)
  const viewTransform = mouse.getViewTransform()

  const { width: MAP_WIDTH, height: MAP_HEIGHT } = getMapDimensions()
  const SPRITE_SIZE = getTileSize()

  const pathfindingStats = getPathfindingStats()
  
  statsText.text = [
    `FPS: ${fps.toFixed(2)} | DPR: ${getCanvasDimensions().dpr}:${globalThis.devicePixelRatio || 1}`,
    `Loop Time: ${(1000 / fps).toFixed(3)} ms`,
    `Game Status: ${gameState.gameStatus}`,
    `Units: ${unitsCount} human, ${aiUnitsCount} AI`,
    `Mouse: ${mouse.x}x${mouse.y} (${mouse.worldX.toFixed(0)}, ${mouse.worldY.toFixed(0)})${mouse.isDragging ? ' | clic' : ''}`,
    `Zoom: ${viewTransform.scale?.toFixed(2)}x`,
    `World: ${MAP_WIDTH}x${MAP_HEIGHT} (${MAP_WIDTH*SPRITE_SIZE}x${MAP_HEIGHT*SPRITE_SIZE})`,

    `Particles: ${containers.particles.children?.length}`,
    `Pathfinding (/s): ${pathfindingStats.map((count, i) => `W${i}: ${count}`).join(', ')}`,
    `Indicator Map Size: ${indicatorMap.size}`,
    `Unit Sprite Map Size: ${unitSpriteMap.size}`,
    `Background Sprite Map Size: ${backgroundSpriteMap.size}`,
    `World Object Sprite Map Size: ${worldObjectSpriteMap.size}`,

    
    `Renderer: ${app.renderer.width}x${app.renderer.height}`,
    `Screen: ${screen.width}x${screen.height} | Avail.: ${screen.availWidth}x${screen.availHeight}`,
    // `Window: ${window.innerWidth}x${window.innerHeight}`,
    // `CSS: ${document.documentElement.clientWidth}x${document.documentElement.clientHeight}`,
    // `Canvas: ${app.canvas.style.width} x ${app.canvas.style.height}`
  ].join('\n')
}

function updateResourceDisplay(resources) {
  for (const [resource, value] of Object.entries(resources)) {
    if (resourceTexts[resource]) {
      resourceTexts[resource].text = value.toString()
    }
  }
}

async function createTopBar() {
  if (topBarContainer) {
    topBarContainer.removeChildren()
    topBarContainer.destroy()
  }
  
  const { width } = getCanvasDimensions()
  const barHeight = 32 // Fixed height for the top bar
  
  // Create the container
  topBarContainer = new PIXI.Container()
  
  // Create background
  const background = new PIXI.Graphics()
    .rect(0, 0, width, barHeight)
    .fill({ color: 0x114611, alpha: 0.85 }) // Dark green with transparency
    .stroke({ width: 2, color: 0xFFD700, alpha: 0.5}) // Gold border
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
    const text = createText(resource.initial.toString(), TEXT_STYLES.resource)
    text.position.set(24, 2) // Position after the icon
    resourceContainer.addChild(text)
    
    // Store reference for updates
    resourceTexts[resource.name] = text
    
    topBarContainer.addChild(resourceContainer)
  })

  // Add menu button to the right side of the top bar
  const menuButton = new PIXI.Container()
  menuButton.position.set(width - 44, 4) // Position on the right side

  // Create button background
  const menuButtonBg = new PIXI.Graphics()
    .roundRect(0, 0, 36, 26, 4)
    .fill({ color: 0x114611, alpha: 0.7 })
    .stroke({ width: 1, color: 0xFFD700, alpha: 0.8 })
  menuButton.addChild(menuButtonBg)

  // Create hamburger menu icon (three lines)
  const menuIcon = new PIXI.Graphics()
    .rect(8, 7, 20, 2)  // Top line
    .rect(8, 13, 20, 2) // Middle line
    .rect(8, 19, 20, 2) // Bottom line
    .fill({ color: 0xFFD700 })
  menuButton.addChild(menuIcon)

  // Make button interactive
  menuButtonBg.eventMode = 'static'
  menuButtonBg.cursor = 'pointer'
  menuButtonBg.on('pointerup', (e) => {
    e.stopPropagation()
    openGameMenu()
  })

  topBarContainer.addChild(menuButton)
  
  // Add to UI container
  containers.ui.addChild(topBarContainer)
  
  // Subscribe to resource changes from human player
  if (gameState.humanPlayer) {
    if(!gameState.humanPlayer.events?.listeners['resources-changed']?.includes(
      () => { updateResourceDisplay(gameState.humanPlayer.getResources()) })
    )
    gameState.humanPlayer.events.on('resources-changed', () => {
      updateResourceDisplay(gameState.humanPlayer.getResources())
    })
  }
  
  // Handle window resize to update positioning
  if(!gameState.events?.listeners['draw-back-requested-changed']?.includes(updateTopBarPosition))
  gameState.events.on('draw-back-requested-changed', updateTopBarPosition)
}


function updateTopBarPosition() {
  if (!topBarContainer) return
  
  const { width } = getCanvasDimensions()
  const barHeight = 32
  
  // Update background
  topBarContainer.getChildAt(0)
    .clear()
    .rect(0, 0, width, barHeight)
    .fill({ color: 0x114611, alpha: 0.85 })
    .stroke({ width: 2, color: 0xFFD700, alpha: 0.5 })
  
  // Update resource positions
  const resources = Object.keys(resourceTexts)
  const spacing = width / resources.length
  
  resources.forEach((resource, index) => {
    const container = resourceTexts[resource].parent
    container.position.set(Math.floor(index * spacing + 10), 6)
  })
}


async function createBottomBar() {
  if (bottomBarContainer) {
    bottomBarContainer.removeChildren()
    bottomBarContainer.destroy()
  }
  
  const { width } = getCanvasDimensions()
  const barHeight = CONSTANTS.UI.BOTTOM_BAR_HEIGHT
  
  // Create the container
  bottomBarContainer = new PIXI.Container()
  
  // Create background
  const background = new PIXI.Graphics()
    .rect(0, 0, width, barHeight)
    .fill({ color: 0x114611, alpha: 0.85 }) // Dark green with transparency
    .stroke({ width: 2, color: 0xFFD700, alpha: 0.5 }) // Gold border
  bottomBarContainer.addChild(background)

  // Position at bottom of screen
  bottomBarContainer.position.set(0, app.renderer.height - barHeight)

  // Update hit area to match new dimensions
  bottomBarContainer.hitArea = new PIXI.Rectangle(0, 0, width, barHeight)

  // Add event listeners to prevent touch events from reaching the canvas
  bottomBarContainer.on('pointerdown', (e) => {
    e.stopPropagation()
  })

  bottomBarContainer.on('pointermove', (e) => {
    e.stopPropagation()
  })

  bottomBarContainer.on('pointerup', (e) => {
    e.stopPropagation()
  })
  
  // Add to UI container
  containers.ui.addChild(bottomBarContainer)
  
  // Subscribe to resource changes from human player
  if (gameState.humanPlayer) {
    if(gameState.humanPlayer.events?.listeners['resources-changed'].includes(updateBottomBarPosition)) {
      updateBottomBarPosition()
    } else {
      gameState.humanPlayer.events.on('resources-changed', updateBottomBarPosition)
    }
  }

  const selectedBuildingChangedEvent = async (building) => {
    if (building) {
      displayBuildingInfo(building)
    } else {
      hideBuildingInfo()
    }
  }

  if(gameState.events?.listeners['selected-building-changed']?.includes(selectedBuildingChangedEvent)) {
    selectedBuildingChangedEvent()
  } else {
    gameState.events.on('selected-building-changed', selectedBuildingChangedEvent)
  }
}

function updateBottomBarPosition() {
  if (!bottomBarContainer) return
  
  const { width } = getCanvasDimensions()
  const barHeight = CONSTANTS.UI.BOTTOM_BAR_HEIGHT
  
  // Update position to stay at bottom
  bottomBarContainer.position.set(0, app.renderer.height - barHeight)
  
  // Update hit area to match new dimensions
  bottomBarContainer.hitArea = new PIXI.Rectangle(0, 0, width, barHeight)

  // Update background
  bottomBarContainer.getChildAt(0)
    .clear()
    .rect(0, 0, width, barHeight)
    .fill({ color: 0x114611, alpha: 0.85 })
    .stroke({ width: 2, color: 0xFFD700, alpha: 0.5 })

  // Recreate building slots to adjust for new width
  if (!gameState.selectedBuilding) {
    createBuildingSlots()
  } else {
    displayBuildingInfo(gameState.selectedBuilding)
  }
}

/**
 * Display information about the selected building in the bottom bar.
 * @param {Building} building - The selected building instance.
 */
async function displayBuildingInfo(building) {
  if (!bottomBarContainer) return

  // Clear existing content
  bottomBarContainer.removeChildren()

  // Re-add background
  const { width } = getCanvasDimensions()
  const barHeight = CONSTANTS.UI.BOTTOM_BAR_HEIGHT
  const background = new PIXI.Graphics()
    .rect(0, 0, width, barHeight)
    .fill({ color: 0x114611, alpha: 0.85 })
    .stroke({ width: 2, color: 0xFFD700, alpha: 0.5 })
  bottomBarContainer.addChild(background)

  const padding = 10
  let currentX = padding
  let fontSize = 12

  // Building Icon
  let iconSprite
  if (building.type.sprite) {
    iconSprite = new PIXI.Sprite(await PIXI.Assets.load({ src: building.type.sprite }))
    iconSprite.width = 48
    iconSprite.height = 48
    iconSprite.position.set(currentX, padding)
    bottomBarContainer.addChild(iconSprite)
    currentX += iconSprite.width + padding
  } else if (building.type.icon) {
    const iconText = new PIXI.Text({
      text: building.type.icon,
      style: {
        fontSize: 36,
        fill: 0xFFFFFF
      }
    })
    iconText.position.set(currentX, padding)
    bottomBarContainer.addChild(iconText)
    currentX += iconText.width + padding
  }

  // Building Name and Level
  fontSize = 20
  const nameText = createText(`${building.type.name} (Level ${building.level})`, TEXT_STYLES.buildingName)
  nameText.position.set(currentX, padding)
  bottomBarContainer.addChild(nameText)

  // Building Description
  fontSize = 14
  const descText = createText(building.type.description, TEXT_STYLES.buildingDescription)
  descText.position.set(currentX, padding + nameText.height + 5)
  bottomBarContainer.addChild(descText)

  // Building Details (if present)
  let detailsText = null
  if (building.type.details) {
    fontSize = 12
    detailsText = createText(building.type.details, TEXT_STYLES.buildingDetails)
    detailsText.position.set(currentX, padding + nameText.height + descText.height + 8)
    bottomBarContainer.addChild(detailsText)
  }

  const maxTextWidth = Math.max(
    nameText.width,
    descText.width,
    detailsText ? detailsText.width : 0
  )
  currentX += maxTextWidth * 1.4

  // Life/MaxLife
  fontSize = 14
  const lifeLabel = `Life: ${building.life.toFixed(0)}/${building.maxLife}`
  const lifeText = createText(lifeLabel, TEXT_STYLES.buildingInfo)
  lifeText.position.set(currentX, padding)
  bottomBarContainer.addChild(lifeText)

  // Production Info (if applicable)
  let productionText = null
  fontSize = 14
  if (building.productionCooldown > 1000 && building.productionTimer !== undefined) {
    const productionLabel = `Producing: ${(building.productionTimer / 1000).toFixed(1)}s / ${(building.productionCooldown / 1000).toFixed(1)}s`
    productionText = createText(productionLabel, TEXT_STYLES.buildingInfoBlue)
    productionText.position.set(currentX + lifeText.width + 40, padding)
    bottomBarContainer.addChild(productionText)
  }

  let workersText = null
  fontSize = 14
  if (building.maxWorkers > 0 && building instanceof WorkerBuilding) {
    const workersLabel = `Workers: ${building.assignedWorkers?.length ?? 0} / ${building.maxWorkers}`
    workersText = createText(workersLabel, TEXT_STYLES.buildingInfoBlue)
    workersText.position.set(currentX + lifeText.width + 40, padding)
    bottomBarContainer.addChild(workersText)
  }

  // Market specific UI for selling resources
  if (building.type === Building.TYPES.MARKET) {
    const sellResources = [
      { name: 'wood', icon: '🪵' },
      { name: 'water', icon: '💧' },
      { name: 'stone', icon: '🪨' },
      { name: 'gold', icon: '🪙' }
    ]
    
    const sellLabel = createText('Sell:', TEXT_STYLES.marketLabel)
    sellLabel.position.set(currentX, padding + lifeText.height + 10)
    bottomBarContainer.addChild(sellLabel)

    let sellButtonX = currentX + sellLabel.width + 20
    const sellButtonY = sellLabel.y - 4

    sellResources.forEach(resource => {
      const button = new PIXI.Container()
      button.position.set(sellButtonX, sellButtonY)

      const buttonBg = new PIXI.Graphics()
        .roundRect(0, 0, 40, 24, 4)
        .fill({ color: building.sellingResource === resource.name ? 0x006400 : 0x333333, alpha: 0.7 })
        .stroke({ width: 1, color: 0xFFD700, alpha: 0.8 })
      button.addChild(buttonBg)

      const icon = new PIXI.Text({
        text: resource.icon,
        style: { fontSize: 16 }
      })
      icon.position.set(10, 2)
      button.addChild(icon)

      buttonBg.eventMode = 'static'
      buttonBg.cursor = 'pointer'
      buttonBg.on('pointerup', (e) => {
        e.stopPropagation()
        building.setSellingResource(resource.name)
        displayBuildingInfo(building) // Refresh UI to show new selection
      })

      bottomBarContainer.addChild(button)
      sellButtonX += 50 // Spacing between buttons
    })
    
    const currentSellingInfo = createText(`Selling ${building.sellingResource} for ${building.sellingPrice} money.`, TEXT_STYLES.marketInfo)
    currentSellingInfo.position.set(currentX, sellLabel.y + sellLabel.height + 10)
    bottomBarContainer.addChild(currentSellingInfo)
  }

  currentX = width / 2

  // Upgrade Information and Button
  const upgradeCosts = building.getUpgradeCosts()
  const upgradeBenefits = building.getUpgradeBenefits()
  
  if (upgradeCosts && upgradeBenefits) {
    const canAffordUpgrade = gameState.humanPlayer.canAffordUpgrade(building)

    // Upgrade Button
    const upgradeButton = new PIXI.Container()
    upgradeButton.position.set(currentX, padding)

    

    const upgradeButtonIcon = new PIXI.Sprite(await PIXI.Assets.load('assets/ui/upgrade_google23eb.png'))
    upgradeButtonIcon.width = 48
    upgradeButtonIcon.height = 48
    upgradeButtonIcon.anchor.set(0.5)
    upgradeButtonIcon.position.set(30, 20 + padding)
    
    const upgradeUText = new PIXI.Text({
      text: 'U',
      style: {
        fontFamily: UI_FONTS.PRIMARY,
        fontSize: 16,
        fill: 0xFFD700, // Gold color for 'U'
        fontWeight: 'bold',
        padding: 4
      }
    })
    upgradeUText.anchor.set(0.5)
    upgradeUText.position.set(65, 30) // Simplified positioning

    const pgradeText = createText('pgrade', TEXT_STYLES.upgradeButton)
    pgradeText.anchor.set(0, 0.5)  // Anchor to left-center
    pgradeText.position.set(upgradeUText.x + upgradeUText.width / 2 + 2, 30) // Position next to 'U' with small gap
    

    const upgradeButtonBg = new PIXI.Graphics()
      .roundRect(0, 0, 3 * padding + upgradeButtonIcon.width + upgradeUText.width * 1.25 + pgradeText.width, 60, 4)
      .fill({ color: canAffordUpgrade ? 0x006400 : 0x333333, alpha: 0.7 }) // Dark green if affordable, grey otherwise
      .stroke({ width: 1, color: 0xFFD700, alpha: 0.8 })
    

    upgradeButtonBg.eventMode = canAffordUpgrade ? 'static' : 'none'
    upgradeButtonBg.cursor = canAffordUpgrade ? 'pointer' : 'not-allowed'
    upgradeButtonBg.on('pointerup', (e) => {
      e.stopPropagation()
      building.handleBuildingUpgrade()
    })

    currentX += upgradeButtonBg.width + 2 * padding

    // Upgrade Benefits Display
    let benefitsText = []
    if (upgradeBenefits.life) benefitsText.push(`Life +${upgradeBenefits.life}`)
    if (upgradeBenefits.productionSpeed) benefitsText.push(`Prod. Speed -${upgradeBenefits.productionSpeed}%`)
    if (upgradeBenefits.maxWorkers) benefitsText.push(`Max Workers +${upgradeBenefits.maxWorkers}`)

    const benefitsLabel = `Next Level: ${benefitsText.join(', ')}`
    const upgradeBenefitsDisplay = createText(benefitsLabel, TEXT_STYLES.upgradeBenefits)
    upgradeBenefitsDisplay.position.set(currentX, padding + 10)
    


    upgradeButton.addChild(upgradeButtonBg)
    upgradeButton.addChild(upgradeButtonIcon)
    upgradeButton.addChild(upgradeUText)
    upgradeButton.addChild(pgradeText)
    bottomBarContainer.addChild(upgradeButton)
    bottomBarContainer.addChild(upgradeBenefitsDisplay)

    // Upgrade Costs Display
    const resourceIcons = {
      wood: "🪵",
      water: "💧",
      gold: "🪙",
      money: "💰",
      stone: "🪨"
    }
    let costDisplayX = currentX
    let costDisplayY = padding + 10 + upgradeBenefitsDisplay.height + 5

    for (const [resource, amount] of Object.entries(upgradeCosts)) {
      const costContainer = new PIXI.Container()
      costContainer.position.set(costDisplayX, costDisplayY)

      const icon = new PIXI.Text({
        text: resourceIcons[resource] || "❓",
        style: { fontSize: 16 }
      })
      costContainer.addChild(icon)

      const amountText = new PIXI.Text({
        text: `${amount.toString()}`,
        style: {
          fontFamily: UI_FONTS.PRIMARY,
          fontSize: 12,
          fill: 0xFFFFFF
        }
      })
      amountText.position.set(20, 4)
      costContainer.addChild(amountText)

      bottomBarContainer.addChild(costContainer)
      costDisplayX += 55
    }
  }
}

/**
 * Hide building information and show building slots.
 */
function hideBuildingInfo() {
  if (!bottomBarContainer) return

  // Clear existing content
  bottomBarContainer.removeChildren()

  // Re-add background
  const { width } = getCanvasDimensions()
  const barHeight = CONSTANTS.UI.BOTTOM_BAR_HEIGHT
  const background = new PIXI.Graphics()
    .rect(0, 0, width, barHeight)
    .fill({ color: 0x114611, alpha: 0.85 })
    .stroke({ width: 2, color: 0xFFD700, alpha: 0.5 })
  bottomBarContainer.addChild(background)

  // Recreate building slots
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
    Building.TYPES.TENT,
    Building.TYPES.LUMBERJACK,
    Building.TYPES.QUARRY,
    Building.TYPES.WELL,
    Building.TYPES.GOLD_MINE,
    Building.TYPES.MARKET,
    Building.TYPES.BARRACKS,
    Building.TYPES.ARMORY,
    Building.TYPES.CITADEL
  ]
  
  const numSlots = Math.min(buildings.length, maxSlots)
  const startX = (width - (numSlots * (slotSize + padding) - padding)) / 2
  
  for (let i = 0; i < numSlots; i++) {
    // Check if player can afford this building and adjust appearance
    const canAfford = gameState.humanPlayer.canAffordBuilding(buildings[i])

    const slot = new PIXI.Container()
    slot.position.set(startX + i * (slotSize + padding), 12)
    slot.alpha = canAfford ? 1 : 0.2
    
    // Store position for tooltip
    buildings[i].slotPosition = { x: slot.position.x, y: slot.position.y }

    // Slot background
    const slotBg = new PIXI.Graphics()
      .rect(0, 0, slotSize, slotSize)
      .fill({ color: 0x333333, alpha: 0.7 })
      .stroke({ width: 1, color: 0xFFD700, alpha: 0.8})
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
    const name = createText(buildings[i].name, TEXT_STYLES.slotName)
    name.anchor.set(0.5, 0)  // Center horizontally
    name.position.set(slotSize / 2, slotSize - 18)  // Removed +7 offset for proper centering
    slot.addChild(name)

    // Make slot interactive
    slot.eventMode = 'static'
    slot.cursor = canAfford ? 'pointer' : 'not-allowed'

    // Store the building data with the slot
    slot.buildingData = buildings[i]
    
    // Add click event
    slot.on('pointerup', (e) => {
      e.stopPropagation()
      handleBuildingSelect(i)
      addButtonSparkles(e)
    })

    slot.on('pointerdown', (e) => {
      e.stopPropagation()  // Prevent event bubbling
    })
    
    slot.on('touchend', (e) => {
      e.stopPropagation()  // Prevent event bubbling
      //handleBuildingSelect(i)
    })

    // Add hover events for tooltip
    slot.on('pointerover', (e) => {
      e.stopPropagation()
      updateTooltip(buildings[i])
    })
    slot.on('pointerout', (e) => {
      e.stopPropagation()
      hideTooltip()
    })

    bottomBarContainer.addChild(slot)
    buildingSlots.push(slot)
  }

  createBuildingTooltip()
}

function handleBuildingSelect(index) {
  // Deselect previous selection
  if (selectedBuildingIndex >= 0 && selectedBuildingIndex < buildingSlots.length) {
    buildingSlots[selectedBuildingIndex].getChildAt(0)
      .clear()
      .rect(0, 0, 64, 64)
      .fill({ color: 0x333333, alpha: 0.7 })
      .stroke({ width: 1, color: 0xFFD700, alpha: 0.8 })
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

  // Highlight selected building
  const slot = buildingSlots[index]
  slot.getChildAt(0)
    .clear()
    .rect(0, 0, 64, 64)
    .fill({ color: 0x555555, alpha: 0.9 })
    .stroke({ width: 2, color: 0xFFFFFF, alpha: 1 })
  
  // Store the selected building type
  selectedBuildingType = slot.buildingData

  // Format cost display
  const costs = gameState.humanPlayer.getBuildingCost(selectedBuildingType)
  const costText = Object.entries(costs)
    .map(([resource, amount]) => `${resource}: ${amount}`)
    .join(', ')
  
  // Display building info
  const canAfford = gameState.humanPlayer.canAffordBuilding(selectedBuildingType)
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
  
  // For quarry, check if it's placed on ROCK tile
  if (selectedBuildingType === Building.TYPES.QUARRY) {
    return gameState.map[x][y].type === 'ROCK';
  }

  // For gold mine, check if it's placed on GOLD tile
  if (selectedBuildingType === Building.TYPES.GOLD_MINE) {
    return gameState.map[x][y].type === 'GOLD';
  }

  // For well, check if it's placed next to WATER tile
  if (selectedBuildingType === Building.TYPES.WELL) {
    // Check orthogonal and diagonal neighbors for water
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue // Skip the center tile
        
        const nx = x + dx
        const ny = y + dy
        
        // Check bounds
        if (nx >= 0 && nx < getMapDimensions().width && 
            ny >= 0 && ny < getMapDimensions().height) {
          // Check if this neighbor is water
          if (gameState.map[nx][ny].type === 'WATER') {
            // Target tile must be grass or sand
            return ['GRASS', 'SAND'].includes(gameState.map[x][y].type)
          }
        }
      }
    }
    return false // No adjacent water found
  }

  // For other buildings, only allow building on grass or sand tiles
  return ['GRASS', 'SAND'].includes(gameState.map[x][y].type)
}


/**
 * 
 * Draw a building sprite preview following the mouse cursor.
 * 
 * @returns {Promise<void>} 
 */
async function updateBuildingPreview() {
  if (!selectedBuildingType || !mouse) return


  const viewTransform = gameState.UI?.mouse?.getViewTransform()

  // Create preview sprite if it doesn't exist
  if (!buildingPreviewSprite) {
    // Load the building sprite texture
    const spriteX = selectedBuildingType.sprite_coords.cyan.x
    const spriteY = selectedBuildingType.sprite_coords.cyan.y
    buildingPreviewSprite = new PIXI.Sprite(sprites[`tile_${spriteX}_${spriteY}`])
    buildingPreviewSprite.anchor.set(0.5, 0.5)
    containers.ui.addChild(buildingPreviewSprite)
  }

  // Check if the current position is valid
  isValidPlacement = isValidBuildingPosition(mouse.x, mouse.y)
  
  // Update preview position
  const tileSize = getTileSize()
  
  // Convert grid coordinates to world coordinates (center of the tile)
  const worldX = (mouse.x * tileSize) + (tileSize / 2)
  const worldY = (mouse.y * tileSize) + (tileSize / 2)
  
  // Convert world coordinates to screen coordinates (with zoom)
  const screenX = (worldX - viewTransform.x) * viewTransform.scale
  const screenY = (worldY - viewTransform.y) * viewTransform.scale
  
  // Update preview position to be at the center of the grid tile
  buildingPreviewSprite.x = screenX
  buildingPreviewSprite.y = screenY
  buildingPreviewSprite.scale.set(viewTransform.scale)

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
  
  // Background for the tooltip (will be resized dynamically)
  const background = new PIXI.Graphics()
    .roundRect(0, 0, 350, 140, 8)
    .fill({ color: 0x333333, alpha: 0.9 })
    .stroke({ width: 2, color: 0xFFD700, alpha: 0.8 })
  tooltipContainer.addChild(background)
  
  // Add placeholder text elements that will be updated on hover
  const titleText = createText("", TEXT_STYLES.tooltipTitle)
  titleText.position.set(10, 10)
  tooltipContainer.addChild(titleText)
  
  const iconContainer = new PIXI.Container()
  iconContainer.position.set(10, 35)
  tooltipContainer.addChild(iconContainer)
  
  const descText = createText("", TEXT_STYLES.tooltipDescription)
  descText.position.set(64, 48)
  tooltipContainer.addChild(descText)

  const detailsText = createText("", TEXT_STYLES.tooltipDetails)
  detailsText.position.set(64, 66)
  tooltipContainer.addChild(detailsText)

  const costTitle = createText("Costs:", new PIXI.TextStyle({
    fontFamily: UI_FONTS.PRIMARY,
    fontSize: 12,
    fill: 0xFFD700
  }))
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

  // Remove old text elements and recreate with new content for proper padding
  const oldTitle = tooltipContainer.getChildAt(1)
  const oldDesc = tooltipContainer.getChildAt(3)
  const oldDetails = tooltipContainer.getChildAt(4)

  tooltipContainer.removeChild(oldTitle)
  tooltipContainer.removeChild(oldDesc)
  tooltipContainer.removeChild(oldDetails)

  const titleText = createText(building.name, TEXT_STYLES.tooltipTitle)
  titleText.position.set(10, 10)
  tooltipContainer.addChildAt(titleText, 1)

  const descText = createText(building.description, TEXT_STYLES.tooltipDescription)
  descText.position.set(64, 48)
  tooltipContainer.addChildAt(descText, 3)

  const detailsText = createText(building.details || "", TEXT_STYLES.tooltipDetails)
  detailsText.position.set(64, 66)
  tooltipContainer.addChildAt(detailsText, 4)

  const iconContainer = tooltipContainer.getChildAt(2)
  const costContainer = tooltipContainer.getChildAt(6)

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

  const costs = gameState.humanPlayer.getBuildingCost(building)
  
  for (const [resource, amount] of Object.entries(costs)) {
    const container = new PIXI.Container()
    container.position.set(xOffset, 0)
    
    // Resource icon
    const icon = createText(resourceIcons[resource] || "❓", new PIXI.TextStyle({ fontSize: 16 }))
    container.addChild(icon)

    // Resource amount
    const amountText = createText(amount.toString(), new PIXI.TextStyle({
      fontFamily: UI_FONTS.PRIMARY,
      fontSize: 12,
      fill: 0xFFFFFF
    }))
    amountText.position.set(20, 4)
    container.addChild(amountText)
    
    costContainer.addChild(container)
    xOffset += 55
  }
  
  // Calculate dynamic tooltip width based on content
  // Use text length for more accurate width estimation
  const titleLength = building.name.length
  const descLength = building.description.length
  const detailsLength = (building.details || "").length

  const maxLength = Math.max(titleLength * 16, descLength * 12, detailsLength * 11)
  const tooltipWidth = Math.max(Math.min(maxLength * 0.6 + 100, 700), 300)

  // Resize background
  const background = tooltipContainer.getChildAt(0)
  background.clear()
    .roundRect(0, 0, tooltipWidth, 140, 8)
    .fill({ color: 0x333333, alpha: 0.9 })
    .stroke({ width: 2, color: 0xFFD700, alpha: 0.8 })

  // Position the tooltip
  const { width } = getCanvasDimensions()

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



/**
 * Add sparkle effect at button position
 * @param {Object} event - The click/touch event
 */
function addButtonSparkles(event) {
  // Get click coordinates
  const x = event.clientX || (event.touches ? event.touches[0].clientX : 0)
  const y = event.clientY || (event.touches ? event.touches[0].clientY : 0)
  
  // Create sparkle effect at the click position
  createParticleEmitter(ParticleEffect.UI_BUTTON_CLICK, {
    x: x,
    y: y,
    duration: 500
  })
}


/**
 * Open the game menu modal, pausing the game
 */
function openGameMenu() {
  // Pause the game
  //const previousStatus = gameState.gameStatus
  gameState.gameStatus = 'paused'

  // Store previous status to return to it when closing
  //gameState._previousStatus = previousStatus

  // Update map info display
  updateMapInfo()

  // Show the menu
  const gameMenuSection = document.getElementById('gameMenuSection')
  gameMenuSection.style.display = 'block'

  // Slight delay for fade-in effect
  setTimeout(() => {
    gameMenuSection.classList.add('show')
  }, 20)
}

/**
 * Update the map information display in the game menu
 */
function updateMapInfo() {
  const seedElement = document.getElementById('currentMapSeed')
  const sizeElement = document.getElementById('currentMapSize')

  // Check if this is a custom map
  if (gameState.customMapId) {
    // Display custom map ID
    seedElement.textContent = gameState.customMapId
    // Show custom map name if available
    if (gameState.customMapData?.name) {
      seedElement.title = gameState.customMapData.name
    }
  } else {
    // Display seed or "Random" if no seed
    if (gameState.mapSeed !== null && gameState.mapSeed !== undefined) {
      seedElement.textContent = gameState.mapSeed
    } else {
      seedElement.textContent = 'Random'
    }
  }

  // Display map size
  const mapSizeLabel = gameState.settings.mapSize || 'medium'
  sizeElement.textContent = mapSizeLabel.charAt(0).toUpperCase() + mapSizeLabel.slice(1)
}

/**
 * Close the game menu modal, resuming the game
 */
function closeGameMenu(destination) {
  const gameMenuSection = document.getElementById('gameMenuSection')
  gameMenuSection.classList.remove('show')

  playCloseSound()
  
  // Wait for transition to complete before hiding and resuming
  setTimeout(() => {
    gameMenuSection.style.display = 'none'
    
    // Resume game state (usually 'playing')
    if (destination === 'home' || destination === 'reset') {
      
    } else if (destination === 'game') {
      gameState.gameStatus = 'playing'
    }
  }, 250) // Same as transition time
}

/**
 * Reset the current map while keeping the same seed
 */
function resetCurrentMap() {
  // Store the current seed
  //const currentSeed = gameState.mapSeed
  
  // Close the menu first
  closeGameMenu('reset')
  
  // Set the saved seed and initialize new game
  //gameState.mapSeed = currentSeed
  console.log('Reset to Map Seed: ', gameState.mapSeed)
  gameState.gameStatus = 'initialize'
  
  showDebugMessage('Resetting map...')
}

/**
 * Quit to the home menu
 */
function quitToHome() {
  // Remove toolbars
  if (topBarContainer) {
    topBarContainer.removeChildren()
    topBarContainer.destroy()
  }
  if (tooltipContainer) {
    bottomBarContainer.removeChild(tooltipContainer)
  }
  if (bottomBarContainer) {
    bottomBarContainer.removeChildren()
    bottomBarContainer.destroy()
  }

  // Close the menu first
  closeGameMenu('home')

  // Set game status to menu
  gameState.gameStatus = 'menu'

  showDebugMessage('Returning to main menu...')
}

/**
 * Handle map export button click
 */
function handleExportMap() {
  playConfirmSound()

  try {
    // Get map name - use custom map name if available, otherwise use seed
    let mapName
    if (gameState.customMapData?.name) {
      mapName = `${gameState.customMapData.name} (Modified)`
    } else if (gameState.mapSeed !== null && gameState.mapSeed !== undefined) {
      mapName = `Map Seed ${gameState.mapSeed}`
    } else {
      mapName = 'Random Map'
    }

    const mapSize = gameState.settings.mapSize || 'medium'
    const description = gameState.customMapData?.description
      ? `Modified from: ${gameState.customMapData.description}`
      : `Exported ${mapSize} map from Pixel Fortress`

    // Download the map as JSON
    const filename = downloadMapJSON(mapName, description)

    showDebugMessage(`Map exported successfully: ${filename}`)
  } catch (error) {
    console.error('Error exporting map:', error)
    showDebugMessage('Error exporting map')
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

/**
 * Show a generic modal with a title, message, and a close button.
 * @param {string} title - The title of the modal.
 * @param {string} message - The message content of the modal.
 * @param {string} gameStatus - The game status during opened modal.
 * @param {string} destinationStatus - The after close new game status.
 * @param {Function} onCloseCallback - Callback function to execute when the modal is closed.
 */
function showModal(title, message, gameStatus, destinationStatus, onCloseCallback) {
  // Pause the game
  gameState.gameStatus = gameStatus

  const modalSection = document.getElementById('genericModalSection')
  const modalTitle = document.getElementById('genericModalTitle')
  const modalMessage = document.getElementById('genericModalMessage')
  const genericCloseButton = document.getElementById('genericModalCloseButton')
  const closeButton = document.getElementById('modalCloseButton')

  modalTitle.textContent = title
  modalMessage.textContent = message

  // Ensure previous listeners are removed to prevent multiple calls
  const newCloseHandler = (event) => {
    event.stopPropagation()
    closeModal(destinationStatus)
    if (onCloseCallback) {
      onCloseCallback()
    }
    genericCloseButton.removeEventListener('click', newCloseHandler)
    closeButton.removeEventListener('click', newCloseHandler)
  }
  genericCloseButton.addEventListener('click', newCloseHandler)
  closeButton.addEventListener('click', newCloseHandler)

  modalSection.style.display = 'block'
  setTimeout(() => {
    modalSection.classList.add('show')
  }, 20)
}

/**
 * Close the generic modal and resume the game.
 */
function closeModal(destination) {
  const modalSection = document.getElementById('genericModalSection')
  modalSection.classList.remove('show')

  setTimeout(() => {
    modalSection.style.display = 'none'
    gameState.gameStatus = destination ?? 'playing'

    if(gameState.gameStatus === 'menu') {
      quitToHome()
    }
  }, 500)
}