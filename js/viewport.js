export { setupViewportHandling, viewportChange }

'use strict'

import { updateDimensions } from 'dimensions'
import { drawBack } from 'globals'
import { resizeCanvases, updateZoom } from 'renderer'
import gameState from 'state'

let handleViewportChangeTimeout

/**
 * Set up viewport event handling for responsive canvas
 */
function setupViewportHandling() {
  // Use the visualViewport API when available (better for mobile)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', viewportChange)
    window.visualViewport.addEventListener('scroll', viewportChange)
  }
  
  // Also listen for regular window events
  window.addEventListener('resize', viewportChange)
  window.addEventListener('orientationchange', viewportChange)

  viewportChange()
}

const handleViewportChange = async () => {
    // Update dimensions
    await updateDimensions()

    resizeCanvases()

    if(gameState.UI?.mouse) {
        await gameState.UI.mouse.applyBoundaryConstraints()
        updateZoom()
    }

    
    // Request redraw of background
    drawBack()

    // Ensure focus returns to window (fixes key events on some platforms)
    window.focus()
}

/**
 * Handle viewport change events
 */
const viewportChange = () => {
    if(handleViewportChangeTimeout) clearTimeout(handleViewportChangeTimeout)

    handleViewportChangeTimeout = setTimeout(handleViewportChange, 20)
}
