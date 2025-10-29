'use strict'

import { handleWindowResize, initializeGame } from 'init'
import { setupViewportHandling } from 'viewport'

// Initialize on load
window.addEventListener('load', initializeGame)

// Set up window event handlers
window.addEventListener('rotate', handleWindowResize)
window.addEventListener('resize', handleWindowResize)

if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', handleWindowResize)
    window.visualViewport.addEventListener('scroll', handleWindowResize)
  }

setupViewportHandling()