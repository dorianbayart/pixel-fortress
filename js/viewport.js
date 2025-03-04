export { setupViewportHandling }

'use strict'

/**
 * Update CSS variables to match actual viewport dimensions
 * This solves the mobile browser address bar issue
 */
function updateViewportVariables() {
    // Get the actual viewport height and width
    const vh = Math.min(window.visualViewport?.height ?? window.innerHeight, window.screen.height)
    const vw = window.visualViewport?.width ?? window.innerWidth

    // Get the height of the address bar and add it to the viewport height
    const addressBarHeight = document.documentElement.clientHeight - vh
    vh += addressBarHeight

    // Set the CSS variables
    document.documentElement.style.setProperty('--app-height', `${vh | 0}px`)
    document.documentElement.style.setProperty('--app-width', `${vw | 0}px`)
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
