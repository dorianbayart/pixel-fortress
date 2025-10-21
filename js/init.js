export { handleWindowResize, initializeGame }

'use strict'

import { musicManager } from 'audio'
import { getTileSize, initMapDimensions } from 'dimensions'
import { initFogOfWar } from 'fogOfWar'
import { gameLoop, initGame } from 'game'
import { initHomeMenu } from 'menu'
import { app, initCanvases, resizeCanvases } from 'renderer'
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

  // Initialize music manager
  musicManager()
  
  // Initialize mouse handling
  const mouseModule = await import('mouse')
  
  // Load the custom font
  const fontPromise = loadGameFont()

  // Listen for state changes
  gameState.events.on('game-status-changed', async (status) => {

    
    if (status === 'initialize') {
      // Small delay before reinitialization
      setTimeout(async () => {
        
        // Load game sprites
        const assetsPromise = loadSprites()
        
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

        // Wait for essential assets to load
        await Promise.all([assetsPromise, fontPromise])

        // Start game
        startGame()
      }, 40)
    } else if (status === 'playing') {

      // Add the playing-mode class to the body
      document.body.classList.add('playing-mode')

      
    } else if (status === 'menu') {
      if(app?.canvas) app.canvas.style.opacity = 0.2

      // Remove the playing-mode class when returning to menu
      document.body.classList.remove('playing-mode')

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
    
    // Initialize fog of war
    if (gameState.settings.fogOfWar) {
      await initFogOfWar()
    }
    
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
  try {
    const font = await document.fonts.values().next().value.loaded
    console.log('Font loaded!')
    
    return font.family === 'Jacquarda-Bastarda-9'
  } catch (err) {
    console.error('Error loading font:', err)
    return false
  }
}
