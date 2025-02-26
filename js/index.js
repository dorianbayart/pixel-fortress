'use strict'

import { handleWindowResize, initializeGame } from 'init'

// Initialize on load
window.addEventListener('load', initializeGame)

// Set up window event handlers
window.onrotate = window.onresize = handleWindowResize