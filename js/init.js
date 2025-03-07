export { handleWindowResize, initializeGame }

'use strict'

import { getTileSize, initMapDimensions } from 'dimensions'
import { gameLoop, initGame } from 'game'
import { initHomeMenu } from 'menu'
import { app, initCanvases, resizeCanvases } from 'renderer'
import { loadSprites, sprites } from 'sprites'
import gameState from 'state'
import { initUI, showDebugMessage } from 'ui'
import { viewportChange } from 'viewport'

// Initialize the game
async function initializeGame() {
  // Set initial game state
  gameState.gameStatus = 'menu'

  // Initialize home menu
  await initHomeMenu()
  
  // Initialize canvases
  await initCanvases()
  
  // Initialize mouse handling
  const mouseModule = await import('mouse')
  const mouseInstance = new mouseModule.Mouse()
  await mouseInstance.initMouse(document.getElementById('canvas'), getTileSize())

  // Initialize UI with mouse instance
  await initUI(mouseInstance)
  
  // Perform initial resize
  await handleWindowResize()

  // Listen for state changes
  gameState.events.on('game-status-changed', (status) => {
    if (status === 'initialize') {
      initMapDimensions()
      startGame(sprites)
    } else if (status === 'playing') {
      
    } else if (status === 'menu') {
      // TODO: Reset UI to default state
    }
  })

  // Load game sprites
  loadSprites()

  // Load the custom font
  loadGameFont()

}

// Start the game
async function startGame(sprites) {
  // Initialize game state
  const ready = await initGame(sprites)

  if(ready) {
    // Perform initial resize
    await handleWindowResize()
    
    // Set initial camera position
    gameState.UI.mouse.setInitialCameraPosition()
    
    showDebugMessage('New map generated !')

    // Set game state to playing
    gameState.gameStatus = 'playing'
    
    // Start game loop
    gameLoop()
    
    // Show debug button
    document.getElementById('debugButton').style.display = 'block'

    app.canvas.addEventListener('mouseenter', () => {
      gameState.gameStatus = 'playing'
    })

    app.canvas.addEventListener('mouseleave', () => {
      gameState.gameStatus = 'paused'
    })
  } else {
    showDebugMessage('Cannot generate a valid map ... :(')
    // Set game state to menu
    gameState.gameStatus = 'menu'
  }
}

// Handle window resize
async function handleWindowResize() {
  // Update Mouse properties
  if (gameState.UI?.mouse) {
    gameState.UI.mouse._rectUpdateNeeded = true
  }

  viewportChange()
  
  // Resize all canvases
  resizeCanvases()
  
  return true
}

// Load the custom font
async function loadGameFont() {
  const font = new FontFace('Jacquarda-Bastarda-9', `url('assets/fonts/Jacquarda-Bastarda-9.woff2')`)
  console.log('Loading font: ' + font.family)
  
  try {
    const fontLoaded = await font.load()
    console.log('Font loaded!')
    document.fonts.add(font)
    
    // Make font-loaded elements visible
    document.querySelectorAll('.font-to-load').forEach((element) => element.classList.remove('font-to-load'))
    
    return true
  } catch (err) {
    console.error('Error loading font:', err)
    
    // Make elements visible anyway in case of font error
    document.querySelectorAll('.font-to-load').forEach((element) => element.classList.remove('font-to-load'))
    
    return false
  }
}
