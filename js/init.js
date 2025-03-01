export { handleWindowResize, initializeGame }

'use strict'

import { gameLoop, initGame } from 'game'
import { drawBack } from 'globals'
import { initHomeMenu } from 'menu'
import { initCanvases, resizeCanvases } from 'renderer'
import { SPRITE_SIZE, loadSprites, sprites } from 'sprites'
import gameState from 'state'
import { initUI, showDebugMessage } from 'ui'

// Initialize the game
async function initializeGame() {
    // Set initial game state
    gameState.gameStatus = 'menu'

    // Initialize home menu
    await initHomeMenu()
    
    // Initialize canvases
    await initCanvases()
    
    // Perform initial resize
    await handleWindowResize()
  
    // Load the custom font
    await loadGameFont()
  
    // Load game sprites
    await loadSprites()
  
    // Initialize mouse handling
    const mouseModule = await import('mouse')
    const mouseInstance = new mouseModule.Mouse()
    await mouseInstance.initMouse(document.getElementById('canvas'), SPRITE_SIZE)
  
    // Initialize UI with mouse instance
    await initUI(mouseInstance)
    
    // Listen for state changes
    gameState.events.on('game-status-changed', (status) => {
      if (status === 'initialize') {
        startGame(sprites)
      } else if (status === 'playing') {
        showDebugMessage('New map generated !')
      } else if (status === 'menu') {
        // TODO: Reset UI to default state
      }
    })
  }
  
  // Start the game
  async function startGame(sprites) {
    // Initialize game state
    const ready = await initGame(sprites)

    if(ready) {
      // Set game state to playing
      gameState.gameStatus = 'playing'
      
      // Start game loop
      gameLoop()
      
      // Show debug button
      document.getElementById('debugButton').style.display = 'block'
    } else {
      showDebugMessage('Cannot generate a valid map ... :(')
      // Set game state to menu
      gameState.gameStatus = 'menu'
    }
  }
  
  // Handle window resize
  async function handleWindowResize() {
    // Resize all canvases
    resizeCanvases()
  
    // Redraw the background
    drawBack()
  
    // Ensure focus returns to window (fixes key events on some platforms)
    window.focus()
    
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
