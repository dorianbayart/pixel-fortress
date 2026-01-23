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

export { TERRAIN_TYPES, ZOOM, gameLoop, initGame, updateSprite }

'use strict'

import * as PIXI from 'pixijs'
import { getMapDimensions, getTileSize } from 'dimensions'
import { renderFog, updateVisibility } from 'fogOfWar'
import { drawBack, isDrawBackRequested } from 'globals'
import {
  TERRAIN_TYPES,
  generateMap,
  placeTents,
  getSandSpriteCoordinates,
  getWaterSpriteCoordinates
} from 'mapGeneration'
import { updateAllParticles } from 'particles'
import { updateMapDimensionsInWorker, updateMapInWorker } from 'pathfinding'
import { Player, PlayerType } from 'players'
import { drawBackground, drawMain, drawMinimap, app } from 'renderer'
import { sprites } from 'sprites'
import gameState from 'state'
import { handleMouseInteraction, updateUI, showModal } from 'ui'

// Zoom configuration
const ZOOM = {
  FACTOR: 1.1,
  MAX: 1.4,
  MIN: 1,
  current: 1
}

// Game timing variables
let elapsed = -5000
let elapsedBack = -5000
let delays = new Uint8Array(60).fill(255)
let delaysIndex = 0

// Initialize the game
const initGame = async () => {
  // Create players
  new Player(PlayerType.HUMAN)
  new Player(PlayerType.AI, gameState.settings.difficulty)

  updateMapDimensionsInWorker()

  // Check if user specified a seed or wants random
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
      gameState.mapSeed = Math.floor(Math.random() * 1000000000)

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

  elapsedBack = elapsed = performance.now()

  return true
}

let lastMapUpdateTime = 0

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
          gameState.map[x][y].sprite = sprites[`tile_${grassSpriteX}_${grassSpriteY}`]
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
          gameState.map[x][y].sprite = sprites[`tile_${sandSpriteX}_${sandSpriteY}`]
          break
        case TERRAIN_TYPES.WATER.type:
          const { spriteX: waterSpriteX, spriteY: waterSpriteY } = getWaterSpriteCoordinates(x, y, gameState.map, MAP_WIDTH, MAP_HEIGHT)
          gameState.map[x][y].sprite = sprites[`tile_${waterSpriteX}_${waterSpriteY}`]
          break
        default:
          gameState.map[x][y].back = sprites[`tile_${grassSpriteX}_${grassSpriteY}`]
          break
      }
    }
  }
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
  const delay = Math.min(now - elapsed, 20) | 0
  elapsed = now

  if(gameState.gameStatus === 'paused') {
    requestAnimationFrame(gameLoop)
    elapsed -= delay
    return
  }

  if(['menu', 'initialize', 'gameOver', 'win'].includes(gameState.gameStatus)) {
    return // Stop the game loop
  }

  // Handle keyboard movement
  gameState.UI?.mouse?.applyKeyboardMovement(delay)
  // Handle drag momentum
  gameState.UI?.mouse?.applyDragMomentum(delay)

  // Handle mouse interaction
  handleMouseInteraction(gameState.map, gameState.humanPlayer)

  // Background rendering
  if(isDrawBackRequested() && now - elapsedBack > 40 || now - elapsedBack > 400) {
    elapsedBack = now
    drawBackground(gameState.map)
  }
  
  // Update players and units
  if(gameState.humanPlayer) await gameState.humanPlayer.update(gameState.gameSpeedMultiplier * delay, gameState.map)

  // Check for game over condition
  if (gameState.humanPlayer.getTents().length === 0) {
    showModal('Game Over', 'Your main building has been destroyed !', 'gameOver', 'menu', () => {})
    return // Stop the game loop
  }
  
  // Update AI players
  await Promise.all(gameState.aiPlayers.map(async ai => {
    await ai.update(gameState.gameSpeedMultiplier * delay, gameState.map)
  }))

  // Check for win condition
  if (!gameState.aiPlayers.some(ai => ai.getTents().length)) {
    showModal('You Win !', 'You destroyed your opponent\'s main building ! Congrats !', 'win', 'menu', () => {})
    return // Stop the game loop
  }

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

  // Ask for next frame
  requestAnimationFrame(gameLoop)

  // Render UI
  updateUI(1000 * delays.length / delays.reduce((a, b) => a + b, 0))
  
  // Update map in worker periodically
  if (now - lastMapUpdateTime > 2500) {
    updateMapInWorker()
    lastMapUpdateTime = now
  }

  delays[delaysIndex++] = delay
  if(delaysIndex === delays.length) delaysIndex = 0
}

