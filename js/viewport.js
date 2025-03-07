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

  // Initial call to ensure correct dimensions
  setTimeout(handleViewportChange, 100)
}

/**
 * Handle viewport change events
 */
function handleViewportChange() {
  // Update dimensions
  updateDimensions()
  
  // Request redraw of background
  drawBack()

  // Apply safe area insets for notched devices
  applySafeAreaInsets()
  
  // Ensure focus returns to window (fixes key events on some platforms)
  window.focus()
}

/**
 * Apply safe area insets for notched devices
 */
function applySafeAreaInsets() {
    // Get the safe area insets
    const safeAreaTop = getComputedStyle(document.documentElement).getPropertyValue('--sat') || 'env(safe-area-inset-top, 0px)'
    const safeAreaRight = getComputedStyle(document.documentElement).getPropertyValue('--sar') || 'env(safe-area-inset-right, 0px)'
    const safeAreaBottom = getComputedStyle(document.documentElement).getPropertyValue('--sab') || 'env(safe-area-inset-bottom, 0px)'
    const safeAreaLeft = getComputedStyle(document.documentElement).getPropertyValue('--sal') || 'env(safe-area-inset-left, 0px)'
    
    // Calculate the actual viewport height considering safe areas
    let viewportHeight = window.visualViewport?.height ?? window.innerHeight
    
    // Adjust viewport dimensions to account for safe areas
    //document.documentElement.style.setProperty('--app-height', `calc(${viewportHeight}px - ${safeAreaTop} - ${safeAreaBottom})`)
    
    // Set canvas position to respect safe area
    const canvas = document.getElementById('canvas')
    if (canvas) {
      //canvas.style.top = safeAreaTop
      //canvas.style.height = `calc(${viewportHeight}px - ${safeAreaTop} - ${safeAreaBottom})`
    }
  }