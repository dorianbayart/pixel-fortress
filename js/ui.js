export {
  handleMouseInteraction, initUI, mouse, setupEventListeners, showDebugMessage, updateUI
}
  
'use strict'
  
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
let resourceTexts = {}

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
      await createTopBar()
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