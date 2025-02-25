export { handleWindowResize, initializeGame }

'use strict'

import { gameLoop, initGame } from 'game'
import { DEBUG, drawBack } from 'globals'
import { initCanvases, resizeCanvases } from 'renderer'
import { SPRITE_SIZE, loadSprites, sprites } from 'sprites'
import { initUI, mouse, setupEventListeners } from 'ui'

// Initialize the game
async function initializeGame() {
  // Initialize canvases
  initCanvases()
  
  // Perform initial resize
  await handleWindowResize()

  // Load the custom font
  await loadGameFont()

  // Load game sprites
  await loadSprites()

  // Initialize mouse handling
  const mouseModule = await import('mouse')
  const mouseInstance = new mouseModule.Mouse()
  await mouseInstance.initMouse(document.getElementById('uiCanvas'), SPRITE_SIZE)

  // Initialize UI with mouse instance
  await initUI(mouseInstance)
  
  // Initialize game state
  await initGame(sprites, mouseInstance)
  
  // Button to show game should be handled by setupEventListeners
  // The game will start when "Random Map" is clicked
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

// Set up window event handlers
window.onload = initializeGame
window.onrotate = window.onresize = handleWindowResize