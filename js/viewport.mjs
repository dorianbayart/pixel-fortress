export { setupViewportHandling, viewportChange }

'use strict'

import { updateDimensions } from 'dimensions'
import { drawBack } from 'globals'
import { indicatorMap, resizeCanvases, updateProgressIndicator, updateZoom } from 'renderer'
import gameState from 'state'

let handleViewportChangeTimeout

/**
 * Set up viewport event handling for responsive canvas
 */
function setupViewportHandling() {
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

    // Update indicators positions if needed
    if (indicatorMap?.size > 0) {
        // Force indicator positions to update
        indicatorMap.forEach((indicator, uid) => {
            const entity = [...(gameState.humanPlayer?.getUnits() || []), 
                            ...(gameState.humanPlayer?.getBuildings() || [])]
                            .find(e => e.uid === uid)
            
            if (entity && entity.showProgressIndicator) {
                updateProgressIndicator(entity, entity.progress || 0)
            }
        })
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

    handleViewportChangeTimeout = setTimeout(handleViewportChange, 40)
}
