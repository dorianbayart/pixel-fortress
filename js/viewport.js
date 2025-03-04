export { setupViewportHandling }

'use strict'

import { updateDimensions } from 'dimensions'
import { drawBack } from 'globals'

/**
 * Set up viewport event handling for responsive canvas
 */
function setupViewportHandling() {
  // Use the visualViewport API when available (better for mobile)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', handleViewportChange)
    window.visualViewport.addEventListener('scroll', handleViewportChange)
  }
  
  // Also listen for regular window events
  window.addEventListener('resize', handleViewportChange)
  window.addEventListener('orientationchange', () => {
    // Small delay to ensure values update after orientation completes
    setTimeout(handleViewportChange, 100)
  })
}

/**
 * Handle viewport change events
 */
function handleViewportChange() {
  // Update dimensions
  updateDimensions()
  
  // Request redraw of background
  drawBack()
  
  // Ensure focus returns to window (fixes key events on some platforms)
  window.focus()
}