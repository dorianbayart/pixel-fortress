/*
 * Pixel Fortress - A 2D real-time strategy game
 * Copyright (C) 2026 Dorian Bayart
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

export { gameLoop, initGame, updateSprite, getCurrentWaterFrame, regenerateGoldTextures }

'use strict'

import * as PIXI from 'pixijs'
import { Building } from 'building'
import CONSTANTS from 'constants'
import { getMapDimensions, getTileSize, initMapDimensions, setMapDimensions } from 'dimensions'
import { renderFog, updateVisibility } from 'fogOfWar'
import { drawBack, isDrawBackRequested } from 'globals'
import {
  generateMap,
  placeTents,
  getSandSpriteCoordinates,
  getWaterSpriteCoordinates
} from 'mapGeneration'
import { loadCustomMap, applyCustomMap } from 'maps'
import { updateAllParticles } from 'particles'
import { updateProjectiles, resetProjectiles } from 'projectile'
import { updateMapDimensionsInWorker, updateMapInWorker } from 'pathfinding'
import { Player, PlayerType } from 'players'
import { drawBackground, drawMain, drawMinimap, app } from 'renderer'
import { sprites } from 'sprites'
import gameState from 'state'
import { generateTerrainBitmaps, clearTerrainBitmaps, regenerateTerrainRegion } from 'terrainBitmaps'
import { handleMouseInteraction, updateUI, showModal } from 'ui'
import { t } from 'i18n'

// Re-export constants for backward compatibility
const TERRAIN_TYPES = CONSTANTS.TERRAIN.TYPES

// Game timing variables
let elapsed = -5000
let elapsedBack = -5000
let delays = new Uint8Array(60).fill(255) // For game logic (capped)
let fpsDelays = new Float32Array(60).fill(16.67) // For FPS display (uncapped)
let fpsDelaysSum = 60 * 16.67 // Running sum of fpsDelays — avoids reduce() every frame
let waterAnimationTimer = 0 // Global timer for water animation (cycles through 4 frames, uses real time)
let delaysIndex = 0
let fpsDelaysIndex = 0
let nextFrameTime = 0 // For FPS limiting - when the next frame should be rendered

// Initialize the game
const initGame = async () => {
  resetProjectiles()

  // Create players
  new Player(PlayerType.HUMAN)
  new Player(PlayerType.AI, gameState.settings.difficulty)

  updateMapDimensionsInWorker()

  // Check if user wants to load a custom map
  const customMapId = gameState.customMapId

  if (customMapId) {
    // Load custom map from JSON file
    console.log(`Loading custom map: ${customMapId}`)

    const mapData = await loadCustomMap(customMapId)
    if (!mapData) {
      console.error(`Failed to load custom map: ${customMapId}`)
      // Fall back to random generation
      gameState.customMapId = null
    } else {
      // Apply the custom map data
      const success = await applyCustomMap(mapData)
      if (!success) {
        console.error(`Failed to apply custom map: ${customMapId}`)
        return false
      }

      // Set dimensions directly from the loaded map (not from constants)
      setMapDimensions(mapData.mapSize.width, mapData.mapSize.height)

      // Update map dimensions for the loaded map
      updateMapDimensionsInWorker()

      // Place tents at predefined positions
      const startingPositions = mapData.startingPositions
      if (startingPositions && startingPositions.length > 0) {
        // Place human tent
        const humanPos = startingPositions.find(pos => pos.player === 'human')
        if (humanPos && gameState.humanPlayer) {
          gameState.humanPlayer.addBuilding(humanPos.x, humanPos.y, Building.TYPES.TENT)
        }

        // Place AI tents
        gameState.aiPlayers.forEach((ai, index) => {
          const aiPos = startingPositions.find(pos => pos.player === `ai_${index + 1}`)
          if (aiPos) {
            ai.addBuilding(aiPos.x, aiPos.y, Building.TYPES.TENT)
          }
        })
      }

      updateMapInWorker()
      await assignSpritesOnMap()

      // Generate terrain bitmaps
      if (CONSTANTS.BITMAP_RENDERING.ENABLED) {
        console.log('Generating terrain bitmaps...')
        const { app: pixiApp, containers: pixiContainers } = await import('renderer')
        await generateTerrainBitmaps(gameState.map, pixiApp, pixiContainers)
      }

      console.log(`✓ Custom map loaded successfully: ${mapData.name}`)
      return true
    }
  }

  // Standard map generation (random or seed-based)
  const isRandomMode = gameState.mapSeed === null
  const userSpecifiedSeed = gameState.mapSeed

  console.log(isRandomMode ? 'Generating random map...' : `Generating map with seed ${userSpecifiedSeed}...`)

  if (isRandomMode) {
    // Random mode: Keep trying different seeds until we find a naturally valid one
    let attempts = 0
    let maxAttempts = 150
    let foundValidMap = false

    while (!foundValidMap && attempts < maxAttempts) {
      attempts++

      // Generate a new random seed for each attempt
      gameState.mapSeed = Math.floor(Math.random() * (CONSTANTS.SEED.MAX + 1))

      console.log(`Attempt ${attempts}: Trying seed ${gameState.mapSeed}`)
      await generateMap()

      const result = await placeTents(false) // false = no carving allowed

      if (result) {
        foundValidMap = true
        console.log(`✓ Found naturally valid map after ${attempts} attempts with seed ${gameState.mapSeed}`)
      } else {
        console.log(`  Seed ${gameState.mapSeed} has no natural path, trying another...`)
      }
    }

    if (!foundValidMap) {
      console.error(`Failed to find naturally valid map after ${maxAttempts} attempts`)
      return false
    }

  } else {
    // User specified a seed: Use smart placement + carving if needed
    console.log(`Using user-specified seed: ${userSpecifiedSeed}`)
    await generateMap()

    const result = await placeTents(true) // true = allow carving if needed

    if (!result) {
      console.error('Map generation failed unexpectedly!')
      return false
    }

    console.log(`✓ Map generated successfully with seed ${userSpecifiedSeed}`)
  }

  updateMapInWorker() // Initial map update
  await assignSpritesOnMap()

  // Generate terrain bitmaps
  if (CONSTANTS.BITMAP_RENDERING.ENABLED) {
    console.log('Generating terrain bitmaps...')
    const { app: pixiApp, containers: pixiContainers } = await import('renderer')
    await generateTerrainBitmaps(gameState.map, pixiApp, pixiContainers)
  }

  elapsedBack = elapsed = nextFrameTime = performance.now()

  return true
}

let lastMapUpdateTime = 0

// Get all 4 animation frames for a water sprite
const getWaterAnimationFrames = (spriteX, spriteY) => {
  const frames = []

  // For X between 0-3: Y animation frames are at +4 intervals
  // For X between 4-11: Y animation frames are at +3 intervals
  const yIncrement = spriteX >= 0 && spriteX <= 3 ? 4 : 3

  for (let i = 0; i < 4; i++) {
    const frameY = spriteY + (i * yIncrement)
    const frameName = `tile_${spriteX}_${frameY}`
    if (sprites[frameName]) {
      frames.push(sprites[frameName])
    }
  }

  // Fallback to first frame if not all frames are available
  return frames.length === 4 ? frames : [sprites[`tile_${spriteX}_${spriteY}`]]
}

// Get current water animation frame index (0-3)
const getCurrentWaterFrame = () => {
  // Each frame lasts 300ms, 4 frames total
  return Math.floor(waterAnimationTimer / 300) % 4
}

// Assign sprites to map tiles
const assignSpritesOnMap = async () => {

  const { width: MAP_WIDTH, height: MAP_HEIGHT, maxWeight: MAX_WEIGHT } = getMapDimensions()
  const SPRITE_SIZE = getTileSize()

  for (let x = 0; x < MAP_WIDTH; x++) {
    for (let y = 0; y < MAP_HEIGHT; y++) {
      const terrainType = TERRAIN_TYPES[gameState.map[x][y].type]
  const grassSpriteX = Math.floor(Math.random() * (TERRAIN_TYPES.GRASS.spriteRange.x[1] - TERRAIN_TYPES.GRASS.spriteRange.x[0] + 1)) + TERRAIN_TYPES.GRASS.spriteRange.x[0]
  const grassSpriteY = Math.floor(Math.random() * (TERRAIN_TYPES.GRASS.spriteRange.y[1] - TERRAIN_TYPES.GRASS.spriteRange.y[0] + 1)) + TERRAIN_TYPES.GRASS.spriteRange.y[0]
      let spriteX, spriteY
      switch (gameState.map[x][y].type) {
        case TERRAIN_TYPES.GRASS.type:
          gameState.map[x][y].back = sprites[`tile_${grassSpriteX}_${grassSpriteY}`]
          break
        case TERRAIN_TYPES.TREE.type:
          spriteX = Math.floor(Math.random() * 
              (terrainType.spriteRange.x[1] - terrainType.spriteRange.x[0] + 1)) + 
              terrainType.spriteRange.x[0]
          spriteY = Math.floor(Math.random() * 
              (terrainType.spriteRange.y[1] - terrainType.spriteRange.y[0] + 1)) + 
              terrainType.spriteRange.y[0]
          gameState.map[x][y].sprite = sprites[`tile_${spriteX}_${spriteY}`]
          gameState.map[x][y].back = sprites[`tile_${grassSpriteX}_${grassSpriteY}`]
          break
        case TERRAIN_TYPES.ROCK.type:
          spriteX = terrainType.spriteRange.x[0]
          spriteY = terrainType.spriteRange.y[0]
          gameState.map[x][y].sprite = sprites[`tile_${spriteX}_${spriteY}`]
          gameState.map[x][y].back = sprites[`tile_${grassSpriteX}_${grassSpriteY}`]
          break
        case TERRAIN_TYPES.GOLD.type:
          spriteX = terrainType.spriteRange.x[0]
          spriteY = terrainType.spriteRange.y[0]
          const baseGoldTexture = sprites[`tile_${spriteX}_${spriteY}`]
          const goldSprite = new PIXI.Sprite(baseGoldTexture)
          goldSprite.tint = 0xFFEA7D
          const goldRenderTexture = PIXI.RenderTexture.create({ width: SPRITE_SIZE, height: SPRITE_SIZE, scaleMode: PIXI.SCALE_MODES.NEAREST })
          app.renderer.render(goldSprite, { renderTexture: goldRenderTexture })
          gameState.map[x][y].sprite = goldRenderTexture
          gameState.map[x][y].back = sprites[`tile_${grassSpriteX}_${grassSpriteY}`]
          break

        case TERRAIN_TYPES.SAND.type:
          const { spriteX: sandSpriteX, spriteY: sandSpriteY } = getSandSpriteCoordinates(x, y, gameState.map, MAP_WIDTH, MAP_HEIGHT)
          gameState.map[x][y].back = sprites[`tile_${sandSpriteX}_${sandSpriteY}`]
          break
        case TERRAIN_TYPES.WATER.type:
          const { spriteX: waterSpriteX, spriteY: waterSpriteY } = getWaterSpriteCoordinates(x, y, gameState.map, MAP_WIDTH, MAP_HEIGHT)
          const waterFrames = getWaterAnimationFrames(waterSpriteX, waterSpriteY)
          gameState.map[x][y].waterFrames = waterFrames
          gameState.map[x][y].sprite = waterFrames[0] // Start with first frame
          break
        default:
          gameState.map[x][y].back = sprites[`tile_${grassSpriteX}_${grassSpriteY}`]
          break
      }
    }
  }
}

/**
 * Regenerate gold textures after renderer recreation
 * Gold tiles use RenderTextures that become invalid when renderer is recreated
 */
const regenerateGoldTextures = async () => {
  const { width: MAP_WIDTH, height: MAP_HEIGHT } = getMapDimensions()
  const SPRITE_SIZE = getTileSize()
  const { app } = await import('renderer')

  console.log('Regenerating gold textures...')

  for (let x = 0; x < MAP_WIDTH; x++) {
    for (let y = 0; y < MAP_HEIGHT; y++) {
      const tile = gameState.map[x][y]

      if (tile.type === TERRAIN_TYPES.GOLD.type) {
        const terrainType = TERRAIN_TYPES[tile.type]
        const spriteX = terrainType.spriteRange.x[0]
        const spriteY = terrainType.spriteRange.y[0]

        if (tile.sprite && tile.sprite.destroy) {
          tile.sprite.destroy(true)
        }

        // Recreate gold texture with current renderer
        const baseGoldTexture = sprites[`tile_${spriteX}_${spriteY}`]
        const goldSprite = new PIXI.Sprite(baseGoldTexture)
        goldSprite.tint = 0xFFEA7D
        const goldRenderTexture = PIXI.RenderTexture.create({
          width: SPRITE_SIZE,
          height: SPRITE_SIZE,
          scaleMode: PIXI.SCALE_MODES.NEAREST
        })
        app.renderer.render(goldSprite, { renderTexture: goldRenderTexture })
        tile.sprite = goldRenderTexture

        goldSprite.destroy()
      }
    }
  }

  console.log('✓ Gold textures regenerated')
}

// Update the sprite on the map at specified coords
const updateSprite = async (x, y) => {
  const terrainType = TERRAIN_TYPES[gameState.map[x][y].type]
  let spriteX, spriteY
  switch (gameState.map[x][y].type) {
    case TERRAIN_TYPES.DEPLETED_TREE.type:
      spriteX = terrainType.spriteRange.x[0]
      spriteY = terrainType.spriteRange.y[0]
      gameState.map[x][y].sprite = sprites[`tile_${spriteX}_${spriteY}`]

      // Update terrain bitmap with depleted tree
      if (CONSTANTS.BITMAP_RENDERING.ENABLED) {
        const { app: pixiApp } = await import('renderer')
        regenerateTerrainRegion(x, y, 1, 1, pixiApp)
      }
      break
    case TERRAIN_TYPES.GRASS.type:
    case TERRAIN_TYPES.TREE.type:
    case TERRAIN_TYPES.ROCK.type:
    case TERRAIN_TYPES.SAND.type:
    case TERRAIN_TYPES.WATER.type:
    default:
      break
  }

  drawBack()
} 

// Main game loop
const gameLoop = async () => {
  const now = performance.now()
  const actualDelay = now - elapsed // Real delay for FPS calculation
  const delay = Math.min(actualDelay, 50) | 0 // Capped delay for game logic
  elapsed = now

  if(gameState.gameStatus === 'paused') {
    setTimeout(gameLoop, 125) // 8 FPS max in pause state
    elapsed -= delay
    return
  }

  if(['menu', 'initialize', 'gameOver', 'win'].includes(gameState.gameStatus)) {
    return // Stop the game loop
  }

  // Handle keyboard movement
  gameState.UI?.mouse?.applyKeyboardMovement(actualDelay)
  // Handle mouse drag (batched from pointermove events)
  gameState.UI?.mouse?.applyMouseDrag()
  // Handle drag momentum
  gameState.UI?.mouse?.applyDragMomentum(actualDelay)

  // Update water animation timer (300ms per frame, 4 frames total = 1200ms cycle)
  // Water animation uses real time (not game speed) for visual consistency
  waterAnimationTimer += delay
  if (waterAnimationTimer >= 1200) {
    waterAnimationTimer -= 1200
  }

  // Handle mouse interaction
  handleMouseInteraction(gameState.map, gameState.humanPlayer)

  // Background rendering
  if(isDrawBackRequested() && now - elapsedBack > 50 || now - elapsedBack > 400) {
    elapsedBack = now
    drawBackground(gameState.map)
  }
  
  // Update players and units
  if(gameState.humanPlayer) await gameState.humanPlayer.update(gameState.gameSpeedMultiplier * delay, gameState.map)

  // Check for game over condition
  if (gameState.humanPlayer.getTents().length === 0) {
    showModal(t('game.gameOver'), t('game.gameOverMsg'), 'gameOver', 'menu', () => {})
    return // Stop the game loop
  }
  
  // Update AI players
  await Promise.all(gameState.aiPlayers.map(async ai => {
    await ai.update(gameState.gameSpeedMultiplier * delay, gameState.map)
  }))

  // Check for win condition
  if (!gameState.aiPlayers.some(ai => ai.getTents().length)) {
    showModal(t('game.win'), t('game.winMsg'), 'win', 'menu', () => {})
    return // Stop the game loop
  }

  // Update projectiles (arrows in flight)
  updateProjectiles(gameState.gameSpeedMultiplier * delay)

  // Update particles
  updateAllParticles(delay)
  
  // Update fog of war
  if (gameState.settings.fogOfWar) {
    updateVisibility(delay)
  }
  
  // Render game
  drawMain(gameState.humanPlayer, gameState.aiPlayers)

  // Render minimap (throttled to once per second)
  drawMinimap(now)

  // Render fog of war
  if (gameState.settings.fogOfWar) {
    renderFog(delay)
  }

  // Track FPS (using actual uncapped delay) — incremental sum avoids reduce() every frame
  fpsDelaysSum -= fpsDelays[fpsDelaysIndex]
  fpsDelays[fpsDelaysIndex] = actualDelay
  fpsDelaysSum += actualDelay
  fpsDelaysIndex = (fpsDelaysIndex + 1) % fpsDelays.length

  const realFPS = fpsDelaysSum > 0 ? (1000 * fpsDelays.length / fpsDelaysSum) : 60

  // Render UI
  updateUI(realFPS)

  // Update map in worker periodically
  if (now - lastMapUpdateTime > 2500) {
    updateMapInWorker()
    lastMapUpdateTime = now
  }

  // Track capped delay for game logic stability
  delays[delaysIndex++] = delay
  if(delaysIndex === delays.length) delaysIndex = 0

  // Schedule next frame intelligently based on FPS cap
  const fpsCap = gameState.settings?.fpsCap || 0
  if (fpsCap > 0) {
    const targetInterval = 1000 / fpsCap

    // Initialize nextFrameTime on first frame
    if (nextFrameTime === 0) nextFrameTime = now

    // Always schedule at fixed interval from last target
    nextFrameTime += targetInterval

    // If we're behind, reset to catch up
    const timeNow = performance.now()
    if (nextFrameTime < timeNow) {
      nextFrameTime = timeNow + targetInterval
    }

    // Schedule next frame
    const schedulerDelay = Math.max(0, nextFrameTime - timeNow)
    setTimeout(gameLoop, schedulerDelay)
  } else {
    requestAnimationFrame(gameLoop)
  }
}

