export { getTile, loadPredefinedMap, exportMapToJSON, loadMapsManifest, getPredefinedMaps }

'use strict'

import CONSTANTS from 'constants'
import { getMapDimensions } from 'dimensions'
import gameState from 'state'

/**
 * Returns the tile at the specified coordinates.
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {Object} Tile object
 */
const getTile = (x, y) => gameState.map[x]?.[y]

// Cache for the maps manifest
let mapsManifestCache = null

/**
 * Load the maps manifest from seeds.json
 * @returns {Promise<Object>} Manifest object with predefined_maps array
 */
const loadMapsManifest = async () => {
  // Return cached version if available
  if (mapsManifestCache) {
    return mapsManifestCache
  }

  try {
    const response = await fetch('./maps/seeds.json')
    if (!response.ok) {
      throw new Error(`Failed to load maps manifest: ${response.status}`)
    }

    const manifest = await response.json()
    mapsManifestCache = manifest

    console.log(`✓ Loaded maps manifest: ${manifest.predefined_maps?.length || 0} predefined maps`)

    return manifest
  } catch (error) {
    console.error('Error loading maps manifest:', error)
    return { predefined_maps: [] }
  }
}

/**
 * Get the list of predefined maps from the manifest
 * @returns {Promise<Array>} Array of predefined map objects
 */
const getPredefinedMaps = async () => {
  const manifest = await loadMapsManifest()
  return manifest.predefined_maps || []
}

/**
 * Load a predefined map instead of generating one
 * @param {string|number} mapId - Identifier for the map to load
 * @returns {Promise<boolean>} Success status
 */
const loadPredefinedMap = async (mapId) => {
    // Placeholder for future implementation
    try {
      // Example: This could later fetch a map definition from maps/seeds.json
      const predefinedSeed = parseInt(mapId, 10)
      if (!isNaN(predefinedSeed)) {
        // If mapId is a number/string representing a seed, use it
        gameState.mapSeed = predefinedSeed
        return true
      }
      return false
    } catch (error) {
      console.error('Error loading predefined map:', error)
      return false
    }
  }

/**
 * Load a custom map from JSON file
 * @param {string} mapId - Map identifier (e.g., "custom_4698963")
 * @returns {Promise<Object|null>} Map data object or null if failed
 */
const loadCustomMap = async (mapId) => {
  try {
    // Construct file path based on map ID
    const filePath = `./maps/${mapId}.json`

    // Fetch the map JSON file
    const response = await fetch(filePath)
    if (!response.ok) {
      throw new Error(`Failed to load map: ${response.status} ${response.statusText}`)
    }

    const mapData = await response.json()

    // Validate map data structure
    if (!mapData.terrain || !mapData.mapSize || !mapData.startingPositions) {
      throw new Error('Invalid map data structure')
    }

    return mapData
  } catch (error) {
    console.error('Error loading custom map:', error)
    return null
  }
}

/**
 * Apply custom map data to game state
 * @param {Object} mapData - Map data from JSON
 * @returns {Promise<boolean>} Success status
 */
const applyCustomMap = async (mapData) => {
  try {
    const { width: MAP_WIDTH, height: MAP_HEIGHT } = mapData.mapSize
    const TERRAIN_TYPES = CONSTANTS.TERRAIN.TYPES

    // Initialize the map array
    gameState.map = new Array(MAP_WIDTH)

    // Populate map from terrain data
    for (let x = 0; x < MAP_WIDTH; x++) {
      gameState.map[x] = new Array(MAP_HEIGHT)

      for (let y = 0; y < MAP_HEIGHT; y++) {
        const terrainType = mapData.terrain[x][y]
        const terrainDef = TERRAIN_TYPES[terrainType]

        if (!terrainDef) {
          console.warn(`Unknown terrain type at [${x},${y}]: ${terrainType}`)
          // Fallback to grass
          gameState.map[x][y] = {
            uid: y * MAP_WIDTH + x,
            type: TERRAIN_TYPES.GRASS.type,
            weight: TERRAIN_TYPES.GRASS.weight,
            sprite: null,
            back: null
          }
        } else {
          // Create tile with uid (same calculation as generateMap)
          gameState.map[x][y] = {
            uid: y * MAP_WIDTH + x,
            type: terrainDef.type,
            weight: terrainDef.weight,
            sprite: null,
            back: null
          }

          // Add resource value for trees
          if (terrainDef.type === TERRAIN_TYPES.TREE.type) {
            gameState.map[x][y].resource = Math.floor(Math.random() * 100) + 150 // 150-250 resources
          }
        }
      }
    }

    // Store map metadata
    gameState.mapSeed = mapData.seed || null
    gameState.customMapId = mapData.id
    gameState.customMapData = {
      name: mapData.name,
      description: mapData.description,
      startingPositions: mapData.startingPositions
    }

    // Update settings to match map size
    const sizeId = mapData.size || 'medium'
    gameState.updateSettings({ mapSize: sizeId })

    console.log(`✓ Applied custom map to game state (${MAP_WIDTH}x${MAP_HEIGHT})`)

    return true
  } catch (error) {
    console.error('Error applying custom map:', error)
    return false
  }
}

// Export new functions
export { applyCustomMap, loadCustomMap }

/**
 * Export the current game map to JSON format
 * @param {string} mapName - Optional name for the map
 * @param {string} description - Optional description for the map
 * @returns {Object} Map data in JSON format
 */
const exportMapToJSON = (mapName = 'Custom Map', description = 'Exported from Pixel Fortress') => {
  const { width: MAP_WIDTH, height: MAP_HEIGHT } = getMapDimensions()
  const TERRAIN_TYPES = CONSTANTS.TERRAIN.TYPES

  // Build 2D terrain array (excluding buildings - only export base terrain)
  const terrain = []
  for (let x = 0; x < MAP_WIDTH; x++) {
    const column = []
    for (let y = 0; y < MAP_HEIGHT; y++) {
      const tile = gameState.map[x][y]

      // If there's a building on this tile, export the underlying terrain
      // Buildings are placed on grass, so we default to GRASS
      if (tile.building) {
        // TODO: manage gold mines and quarrys
        column.push(TERRAIN_TYPES.GRASS.type)
      } else {
        column.push(tile.type)
      }
    }
    terrain.push(column)
  }

  // Find starting positions (tents)
  const startingPositions = []

  // Human player tent
  const humanTents = gameState.humanPlayer?.getTents() || []
  if (humanTents.length > 0) {
    const tent = humanTents[0]
    startingPositions.push({
      player: 'human',
      x: tent.x,
      y: tent.y
    })
  }

  // AI player tents
  gameState.aiPlayers?.forEach((ai, index) => {
    const aiTents = ai.getTents() || []
    if (aiTents.length > 0) {
      const tent = aiTents[0]
      startingPositions.push({
        player: `ai_${index + 1}`,
        x: tent.x,
        y: tent.y
      })
    }
  })

  // Get map size label
  const mapSizeLabel = CONSTANTS.MAP_SIZES.getById(gameState.settings.mapSize).label.toLowerCase()

  // Build the map JSON object
  const mapData = {
    id: `custom_${gameState.mapSeed || Date.now()}`,
    version: '1.0',
    name: mapName,
    description: description,
    category: 'custom',
    difficulty: gameState.settings.difficulty || 'medium',
    size: mapSizeLabel,
    mapSize: {
      width: MAP_WIDTH,
      height: MAP_HEIGHT
    },
    seed: gameState.mapSeed, // Include seed for reference
    terrain: terrain,
    startingPositions: startingPositions,
    exportDate: new Date().toISOString()
  }

  return mapData
}

/**
 * Download the exported map as a JSON file
 * @param {string} mapName - Optional name for the map (used in filename)
 * @param {string} description - Optional description for the map
 */
const downloadMapJSON = (mapName = 'Custom Map', description = 'Exported from Pixel Fortress') => {
  const mapData = exportMapToJSON(mapName, description)

  // Create a blob from the JSON data
  const jsonString = JSON.stringify(mapData, null, 2)
  const blob = new Blob([jsonString], { type: 'application/json' })

  // Create a download link
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url

  // Generate filename
  const sanitizedName = mapName.toLowerCase().replace(/[^a-z0-9]/g, '_')
  const filename = `${sanitizedName}_${gameState.mapSeed || Date.now()}.json`
  link.download = filename

  // Trigger download
  document.body.appendChild(link)
  link.click()

  // Cleanup
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  console.log(`Map exported: ${filename}`)

  return filename
}

// Export the download function as well
export { downloadMapJSON }