export { setupViewportHandling }

'use strict'

/**
 * Update CSS variables to match actual viewport dimensions
 * This solves the mobile browser address bar issue
 */
function updateViewportVariables() {
    // Get the actual viewport height and width
    const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight
    const vw = window.visualViewport ? window.visualViewport.width : window.innerWidth

    // Set the CSS variables
    document.documentElement.style.setProperty('--app-height', `${vh}px`)
    document.documentElement.style.setProperty('--app-width', `${vw}px`)
}

// Function to add to your initialization code
function setupViewportHandling() {
    // Initial update
    updateViewportVariables()

    // Update on resize and orientation change
    window.addEventListener('resize', updateViewportVariables)
    window.addEventListener('orientationchange', () => {
        // Small delay to ensure values update after orientation completes
        setTimeout(updateViewportVariables, 100)
    })

    // Use visualViewport API if available (better for mobile)
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', updateViewportVariables)
        window.visualViewport.addEventListener('scroll', updateViewportVariables)
    }
}
