export { handleWindowResize, initializeGame }

'use strict'

import { getTileSize, initMapDimensions } from 'dimensions'
import { gameLoop, initGame } from 'game'
import { initHomeMenu } from 'menu'
import { app, containers, initCanvases, resizeCanvases } from 'renderer'
import { loadSprites } from 'sprites'
import gameState from 'state'
import { initUI, showDebugMessage } from 'ui'
import { viewportChange } from 'viewport'

/**
 * Initialize the game
 * Sets up the core game components in the proper sequence:
 * 
 * This function is called when the page loads.
 */
async function initializeGame() {
  // Set initial game state
  gameState.gameStatus = 'menu'

  // Initialize home menu
  initHomeMenu()
  
  // Initialize mouse handling
  const mouseModule = await import('mouse')
  
  // Load the custom font
  loadGameFont()

  // Listen for state changes
  gameState.events.on('game-status-changed', async (status) => {

    
    if (status === 'initialize') {
      // Small delay before reinitialization
      setTimeout(async () => {
        // Clear game stateif any
        gameState.map = null
        gameState.clearHumanPlayer()
        gameState.clearAiPlayers()
        
        // Initialize canvases
        await initCanvases()

        // Initialize map
        await initMapDimensions()

        // Initialize UI with mouse instance
        const mouseInstance = new mouseModule.Mouse()
        mouseInstance.initMouse(document.getElementById('canvas'), getTileSize())
        await initUI(mouseInstance)

        // Load game sprites
        await loadSprites()

        // Start game
        startGame()
      }, 40)
    } else if (status === 'playing') {
      
    } else if (status === 'menu') {
      if(app?.canvas) app.canvas.style.opacity = 0.2

      // Clear game state
      gameState.map = null
      gameState.clearHumanPlayer()
      gameState.clearAiPlayers()
    }

  })

}

// Start the game
async function startGame() {
  // Initialize game state
  const ready = await initGame()

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
