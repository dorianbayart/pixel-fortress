'use strict'

import { initializeGame } from 'init'
import gameState from 'state'

// Attach event listener to start button
document.getElementById('generated').addEventListener('click', () => {
  gameState.gameStatus = 'playing'
})

// Initialize on load
window.onload = initializeGame