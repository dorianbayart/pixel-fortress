'use strict'

import { gameLoop } from 'game'
import { initializeGame } from 'init'

// Attach event listener to start button
document.getElementById('generated').addEventListener('click', () => {
  document.getElementById('homeMenu').style.opacity = 0
  setTimeout(() => {
    document.getElementById('homeMenu').style.display = 'none'
    gameLoop()
  }, 750)
})

// Initialize on load
window.onload = initializeGame