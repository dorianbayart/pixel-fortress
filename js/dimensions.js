export {
    getCanvasDimensions,
    getMapDimensions,
    getSafeViewportSize,
    getTileSize,
    initMapDimensions,
    updateDimensions
}
  
'use strict'

// Constants
const SPRITE_SIZE = 16 // Base sprite size in pixels
const MAX_WEIGHT = 99999999 // For pathfinding

// Map dimensions in tiles
let MAP_WIDTH = 0
let MAP_HEIGHT = 0

// Canvas dimensions in pixels
let canvasWidth = 0
let canvasHeight = 0

// Device pixel ratio
let dpr = 1

/**
 * Initialize map dimensions based on viewport size
 * Should only be called when creating a new map
 */
const initMapDimensions = () => {
    MAP_WIDTH = 60
    MAP_HEIGHT = 120

    // Log new map dimensions
    console.log(`Map initialized: ${MAP_WIDTH} x ${MAP_HEIGHT} tiles`)
}

/**
 * Update dimensions based on current window/viewport size
 * This should be called on resize events
 */
const updateDimensions = async () => {
    dpr = window.devicePixelRatio || 1

    // Get viewport size accounting for safe areas
    const viewportSize = getSafeViewportSize()

    // Store canvas dimensions in pixels
    canvasWidth = viewportSize.width * dpr
    canvasHeight = viewportSize.height * dpr

    // Set CSS variables for layout
    document.documentElement.style.setProperty('--app-width', `${viewportSize.width}px`)
    document.documentElement.style.setProperty('--app-height', `${viewportSize.height}px`)

    // Log new dimensions for debugging
    console.log(`Canvas: ${canvasWidth} x ${canvasHeight} pixels`)
    console.log(`Viewport: ${viewportSize.width} x ${viewportSize.height} pixels (DPR: ${dpr})`)
}

const getSafeViewportSize = () => {
    // Get the visual viewport dimensions if available, otherwise use window
    const baseWidth = window.visualViewport?.width ?? window.innerWidth
    const baseHeight = window.visualViewport?.height ?? window.innerHeight

    // Get safe area insets
    const safeAreaTop = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sat') || '0')
    const safeAreaRight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sar') || '0')
    const safeAreaBottom = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sab') || '0')
    const safeAreaLeft = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sal') || '0')

    return {
        width: baseWidth - safeAreaLeft - safeAreaRight | 0,
        height: baseHeight - safeAreaTop - safeAreaBottom | 0,
        safeArea: {
        top: safeAreaTop,
        right: safeAreaRight,
        bottom: safeAreaBottom,
        left: safeAreaLeft
        }
    }
}

/**
 * Get current map dimensions in tiles
 * @returns {Object} Object with width and height properties
 */
const getMapDimensions = () => {
    return {
        width: MAP_WIDTH,
        height: MAP_HEIGHT,
        maxWeight: MAX_WEIGHT
    }
}

/**
 * Get current canvas dimensions in pixels
 * @returns {Object} Object with width, height, and dpr properties
 */
const getCanvasDimensions = () => {
    return {
        width: canvasWidth,
        height: canvasHeight,
        dpr: dpr
    }
}

/**
 * Get the tile size in pixels
 * @returns {number} Tile size in pixels
 */
const getTileSize = () => {
    return SPRITE_SIZE
}