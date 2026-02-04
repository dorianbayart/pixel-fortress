'use strict'

export default {
    // ===== UI CONSTANTS =====
    UI: {
        TOP_BAR_HEIGHT: 32,
        BOTTOM_BAR_HEIGHT: 80,
        FONTS: {
            PRIMARY: "system-ui, 'Open Sans', Arial, sans-serif",
            MONOSPACE: "monospace, 'Courier New', Courier",
            DESIGN: "Jacquarda-Bastarda-9"
        }
    },

    // ===== DIMENSIONS =====
    DIMENSIONS: {
        SPRITE_SIZE: 16, // Base sprite size in pixels
        UNIT_SPRITE_SIZE: 32, // Unit sprite size (2x base sprite size)
        MAX_WEIGHT: 0x7FFFFFFF // Very large but safe value for pathfinding
    },

    // ===== ZOOM CONFIGURATION =====
    ZOOM: {
        // Game zoom (for overall game view)
        GAME: {
            FACTOR: 1.1,
            MAX: 1.4,
            MIN: 1,
            current: 1
        },
        // Mouse/Camera zoom (for viewport control)
        CAMERA: {
            TILES: 16,
            FACTOR: 0.05,
            MAX: 6,
            MIN: 1,
            initial: null
        }
    },

    // ===== MAP SEED =====
    SEED: {
        MIN: 0,
        MAX: 999999999 // 999,999,999 (1 billion - 1)
    },

    // ===== MAP SIZES =====
    MAP_SIZES: {
        SMALL: {
            id: 'small',
            label: 'Small',
            width: 40,
            height: 80
        },
        MEDIUM: {
            id: 'medium',
            label: 'Medium',
            width: 60,
            height: 120
        },
        LARGE: {
            id: 'large',
            label: 'Large',
            width: 80,
            height: 160
        },
        HUGE: {
            id: 'huge',
            label: 'Huge',
            width: 100,
            height: 200
        },
        // Helper to get sizes as an array
        getAll() {
            return [this.SMALL, this.MEDIUM, this.LARGE, this.HUGE]
        },
        // Helper to get size by id
        getById(id) {
            const normalized = id?.toLowerCase()
            if (normalized === 'small') return this.SMALL
            if (normalized === 'large') return this.LARGE
            if (normalized === 'huge') return this.HUGE
            return this.MEDIUM // default to medium
        }
    },

    // ===== TERRAIN & MAP GENERATION =====
    TERRAIN: {
        // Terrain type definitions with sprite ranges and weights
        TYPES: {
            WATER: { type: 'WATER', weight: 0x7FFFFFFF / 4 | 0, spriteRange: { x: [0, 0], y: [17, 17] } },
            ROCK: { type: 'ROCK', weight: 0x7FFFFFFF, spriteRange: { x: [0], y: [26] } },
            GOLD: { type: 'GOLD', weight: 0x7FFFFFFF, spriteRange: { x: [1], y: [26] } },
            TREE: { type: 'TREE', weight: 1024, spriteRange: { x: [2, 3], y: [26, 27] } },
            DEPLETED_TREE: { type: 'DEPLETED_TREE', weight: 3, spriteRange: { x: [1], y: [27] } },
            GRASS: { type: 'GRASS', weight: 2, spriteRange: { x: [0, 2], y: [0, 2] } },
            SAND: { type: 'SAND', weight: 1, spriteRange: { x: [3, 3], y: [3, 3] } },
            BUILDING: { type: 'BUILDING', weight: 0x7FFFFFFF * 0.99999 | 0 }
        },
        NOISE_SCALE: 0.08, // Controls terrain smoothness
        THRESHOLD: {
            WATER: 0.33,
            ROCK: 0.34,
            TREE_NEXT_TO_WATER: 0.35,
            GRASS_NEXT_TO_WATER: 0.45,
            SAND: 0.5,
            GRASS: 0.56,
            GOLD: 0.8,
            TREE: 1,
        }
    },

    // ===== MINIMAP =====
    MINIMAP: {
        SIZE: 220, // Size in pixels
        PADDING: 1, // Distance from bottom-right corner
        CONTENT_ALPHA: 0.7, // Global alpha for all minimap content
        UPDATE_INTERVAL: 40, // Update minimap every 40ms (25fps)
        COLORS: {
            WATER: 0x66bce4,      // Blue
            GRASS: 0x27ae60,      // Green
            SAND: 0xf39c12,       // Orange/tan
            TREE: 0x1e8449,       // Dark green
            DEPLETED_TREE: 0x7d6608, // Brown
            ROCK: 0x7f8c8d,       // Gray
            GOLD: 0xf1c40f,       // Gold
            UNEXPLORED: 0x1a1a1a, // Very dark gray
            HUMAN_UNIT: 0x00ffff, // Cyan
            AI_UNIT: 0xff0000,    // Red
            HUMAN_BUILDING: 0x00ffff, // Blue
            AI_BUILDING: 0xff0000  // Red
        }
    },

    // ===== FOG OF WAR =====
    FOG_OF_WAR: {
        UPDATE_INTERVAL: 400, // ms between fog updates
        COLOR: 0x000000, // Black fog
        ALPHA_EXPLORED: 0.7 // Alpha for explored but not visible areas
    },

    // ===== UNITS =====
    UNITS: {
        TENT_REEVALUATION_COOLDOWN: 5000 // 5 seconds
    },

    // ===== BUILDINGS =====
    BUILDINGS: {
        TREE_PROCESSING_BATCH_SIZE: 8, // Process 8 trees at once
        TREE_PROCESSING_DELAY: 80 // 80ms delay between batches
    },

    // ===== PATHFINDING =====
    PATHFINDING: {
        NUM_WORKERS: Math.max(1, Math.min(navigator.hardwareConcurrency - 1 || 2, 5)), // Dynamic: 1-5 workers based on CPU cores
        MAX_CONCURRENT_PER_WORKER: 4 // Max concurrent pathfinding requests per worker
    },

    // ===== AUDIO =====
    AUDIO: {
        NOT_ALLOWED_ERROR: 'NotAllowedError'
    },

    // ===== GAME SPEED =====
    GAME_SPEED_MULTIPLIERS: {
        NORMAL: 1,
        ACCELERATED: 1.33,
        VERY_FAST: 2
    },

    // ===== BITMAP RENDERING =====
    BITMAP_RENDERING: {
        ENABLED: true,
        FOG_REBUILD_THRESHOLD_TILES: 2,      // Not used in new fog system
        FOG_UPDATE_INTERVAL_MS: 500,         // Update fog bitmap contents every 400ms
        TILE_BITMAP_SIZE: 2048,              // For tiled fallback
        GOLD_TINT: 0xFFEA7D
    },

    // ===== MATH CONSTANTS =====
    MATH: {
        PI: Math.PI
    },

    // ===== DEV MODE =====
    DEV_MODE: {
        // Check if running in dev mode (localhost:8000)
        // TODO: Add Debug mode as condition
        isEnabled() {
            return typeof window !== 'undefined' &&
                   window.location.hostname === 'localhost' &&
                   window.location.port === '8000'
        },
        STARTING_RESOURCES: 200
    }
}