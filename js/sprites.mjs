export { UNIT_SPRITE_SIZE, loadAndSplitImage, loadSprites, sprites, unitsSprites, unitsSpritesDescription, unitsMaskTextures, buildingMaskSprites, updateAllTexturesScaleMode }

'use strict'

import * as PIXI from 'pixijs'
import { getTileSize } from 'dimensions'

const SPRITE_SIZE = getTileSize(), UNIT_SPRITE_SIZE = getTileSize() * 2

/** Exposed variables that stores the sprites and their descriptor */
let sprites, unitsSprites, unitsSpritesDescription

/** Mask textures keyed by sprite name — only present for player-coloured units */
let unitsMaskTextures = {}

/** Mask sub-textures for building tiles, keyed as 'tile_X_Y' — same key space as `sprites` */
let buildingMaskSprites = {}

/** Store base textures for dynamic scale mode updates */
const baseTextures = []

/**
 * Get the appropriate scale mode based on antialiasing setting
 * @returns {string} PIXI scale mode
 */
function getScaleMode() {
  // Always use NEAREST to prevent texture bleeding and blur
  // Antialiasing comes from 2x supersampling + WebGL MSAA, not texture filtering
  return PIXI.SCALE_MODES.NEAREST
}

/**
 * Update scale mode for all loaded textures
 * This allows dynamic switching without reloading sprites
 */
function updateAllTexturesScaleMode() {
  const scaleMode = getScaleMode()
  console.log('Updating all textures to scale mode:', scaleMode === PIXI.SCALE_MODES.LINEAR ? 'LINEAR (smooth)' : 'NEAREST (pixelated)')

  // Update all stored base textures
  baseTextures.forEach(baseTexture => {
    if (baseTexture && baseTexture.source) {
      baseTexture.source.scaleMode = scaleMode
      baseTexture.source.update()
    }
  })

  // Update terrain and building sprites
  if (sprites) {
    for (const spriteName in sprites) {
      if (sprites[spriteName] && sprites[spriteName].source) {
        sprites[spriteName].source.scaleMode = scaleMode
        sprites[spriteName].source.update()
      }
    }
  }

  // Update unit sprites
  if (unitsSprites) {
    for (const unitName in unitsSprites) {
      if (unitsSprites[unitName]) {
        for (const animationType in unitsSprites[unitName]) {
          if (unitsSprites[unitName][animationType]) {
            for (const frameKey in unitsSprites[unitName][animationType]) {
              if (unitsSprites[unitName][animationType][frameKey]) {
                for (const direction in unitsSprites[unitName][animationType][frameKey]) {
                  const texture = unitsSprites[unitName][animationType][frameKey][direction]
                  if (texture && texture.source) {
                    texture.source.scaleMode = scaleMode
                    texture.source.update()
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  // Note: UI textures (icons, cursor) are loaded separately and not tracked here
  // They will use the correct scale mode when initially loaded via getScaleMode()
}


/**
 * Sprite loader
 * 1. Store the terrain and building sprites in 'sprites'
 * 2. Load the units sprites descriptor file
 * 3. Build and store the unit sprites in 'unitSprites' object
 * 
 * @returns {Promise<void>}
 */
const loadSprites = async () => {
  sprites = unitsSprites = unitsSpritesDescription = null
  unitsMaskTextures = {}
  buildingMaskSprites = {}
  baseTextures.length = 0  // Clear previous base textures

  const baseTexture = await PIXI.Assets.load('./assets/punyworld-overworld-tileset.png')
  baseTexture.source.scaleMode = getScaleMode()
  baseTextures.push(baseTexture)  // Store for later updates

  const frames = {}
  const cols = baseTexture.width / SPRITE_SIZE
  const rows = baseTexture.height / SPRITE_SIZE

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const frameName = `tile_${x}_${y}`
      frames[frameName] = {
        frame: { x: x * SPRITE_SIZE, y: y * SPRITE_SIZE, w: SPRITE_SIZE, h: SPRITE_SIZE },
        sourceSize: { w: SPRITE_SIZE, h: SPRITE_SIZE },
        spriteSourceSize: { x: 0, y: 0, w: SPRITE_SIZE, h: SPRITE_SIZE }
      }
    }
  }

  const spritesheet = new PIXI.Spritesheet(baseTexture, {
    frames: frames,
    meta: {
      scale: "1"
    }
  })

  await spritesheet.parse()
  sprites = spritesheet.textures

  // Load building tileset mask — same dimensions as the main tileset
  const maskBaseTexture = await PIXI.Assets.load('./assets/punyworld-overworld-tileset-Mask.png')
  maskBaseTexture.source.scaleMode = getScaleMode()
  baseTextures.push(maskBaseTexture)

  const maskFrames = {}
  const maskCols = maskBaseTexture.width / SPRITE_SIZE
  const maskRows = maskBaseTexture.height / SPRITE_SIZE
  for (let y = 0; y < maskRows; y++) {
    for (let x = 0; x < maskCols; x++) {
      const frameName = `tile_${x}_${y}`
      maskFrames[frameName] = {
        frame: { x: x * SPRITE_SIZE, y: y * SPRITE_SIZE, w: SPRITE_SIZE, h: SPRITE_SIZE },
        sourceSize: { w: SPRITE_SIZE, h: SPRITE_SIZE },
        spriteSourceSize: { x: 0, y: 0, w: SPRITE_SIZE, h: SPRITE_SIZE }
      }
    }
  }

  const maskSpritesheet = new PIXI.Spritesheet(maskBaseTexture, {
    frames: maskFrames,
    meta: { scale: "1" }
  })
  await maskSpritesheet.parse()
  buildingMaskSprites = maskSpritesheet.textures
  unitsSpritesDescription = await (
    await fetch('./assets/unitsSpritesDescription.json')
  ).json()

  unitsSprites = {}
  for (const spriteName in unitsSpritesDescription) {
    if (unitsSpritesDescription.hasOwnProperty(spriteName)) {
      const unitDesc = unitsSpritesDescription[spriteName]
      const baseTexture = await PIXI.Assets.load(unitDesc.relativeToRoot)
      baseTexture.source.scaleMode = getScaleMode()
      baseTextures.push(baseTexture)  // Store for later updates

      if (unitDesc.mask) {
        const maskTexture = await PIXI.Assets.load(unitDesc.mask)
        maskTexture.source.scaleMode = getScaleMode()
        baseTextures.push(maskTexture)
        unitsMaskTextures[spriteName] = maskTexture
      }

      const unitFrames = {}
      for (const animationType in unitDesc) {
        if (['static', 'walk', 'attack', 'lumberjack'].includes(animationType) && unitDesc.hasOwnProperty(animationType)) {
          for (const frameKey in unitDesc[animationType]) {
            if (unitDesc[animationType].hasOwnProperty(frameKey)) {
              for (const direction in unitDesc[animationType][frameKey]) {
                if (unitDesc[animationType][frameKey].hasOwnProperty(direction)) {
                  let { x, y } = unitDesc[animationType][frameKey][direction]
                  x *= UNIT_SPRITE_SIZE
                  y *= UNIT_SPRITE_SIZE
                  const w = UNIT_SPRITE_SIZE, h = UNIT_SPRITE_SIZE
                  const frameName = `${animationType}_${frameKey}_${direction}`
                  unitFrames[frameName] = {
                    frame: { x, y, w, h },
                    sourceSize: { w, h },
                    spriteSourceSize: { x: 0, y: 0, w, h }
                  }
                }
              }
            }
          }
        }
      }

      const unitSpritesheet = new PIXI.Spritesheet(baseTexture, {
        frames: unitFrames,
        meta: {
          scale: "1"
        }
      })

      await unitSpritesheet.parse()
      
      unitsSprites[spriteName] = {}
      for (const animationType in unitDesc) {
        if (['static', 'walk', 'attack', 'lumberjack'].includes(animationType) && unitDesc.hasOwnProperty(animationType)) {
          unitsSprites[spriteName][animationType] = {}
          for (const frameKey in unitDesc[animationType]) {
            if (unitDesc[animationType].hasOwnProperty(frameKey)) {
              unitsSprites[spriteName][animationType][frameKey] = {}
              for (const direction in unitDesc[animationType][frameKey]) {
                if (unitDesc[animationType][frameKey].hasOwnProperty(direction)) {
                  const frameName = `${animationType}_${frameKey}_${direction}`
                  unitsSprites[spriteName][animationType][frameKey][direction] = unitSpritesheet.textures[frameName]
                  // console.log(unitsSprites[spriteName][animationType][frameKey][direction])
                }
              }
            }
          }
        }
      }
    }
  }

}

const loadAndSplitImage = async (url, spriteSize) => {
  const baseTexture = await PIXI.Assets.load(url)
  baseTexture.source.scaleMode = getScaleMode()
  baseTextures.push(baseTexture)  // Store for later updates

  const textures = []
  const cols = baseTexture.width / spriteSize
  const rows = baseTexture.height / spriteSize

  for (let y = 0; y < rows; y++) {
    const rowTextures = []
    for (let x = 0; x < cols; x++) {
      const frame = new PIXI.Rectangle(x * spriteSize, y * spriteSize, spriteSize, spriteSize)
      const texture = new PIXI.Texture(baseTexture.source, frame)
      rowTextures.push(texture)
    }
    textures.push(rowTextures)
  }
  return textures
}




/*

WATER
'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAAAsTAAALEwEAmpwYAAABPUlEQVR4nO2aXWrDMBCElfSMhfFpfI8oJ8h1pCNYOUXIFhecGFFq0uDakr6BefKD2WV+FmznAABgA+gUbzqF+0RndnAtQePgPtrEvrejawliAaEtBSjz/Hz4b86f1ZgJ+mnoX1idIsQCAgoQFohkgAjB2EYLaKn3l1j6XaC/DF2TIsQCAgoQFohkgAjB2EYL6N3eL/0u0BpDl6QIsYCAAoQFIhkgQjC20QJau/f3fhdoi6H3pAixgIACtAPpYwFPBhgh6HfQAsMwWErpwa61DEgp2XXG7swCDAV4LGBkgCcEjRbwDdRgN/L8ZH4X5OxqW4Ay5nfBdeU7gQX0KOD4rxZwZodx6xOXMiHnu5L/vFw+5u93W0N8GQp8GVLNt/+rmZDzVYvkHs/pSoP4Wzzwt7iK9vjKGVG8xwFwReILfZTVaBwwJ1IAAAAASUVORK5CYII='

GOLD
'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAAAsTAAALEwEAmpwYAAABGElEQVR4nO2YSw7CMAxEbZB6bW5QrkQ5EawnJYgF4ivKp7iBvCfNOtEwdsOYAQAAAAAABKDO+7T2/Kxytpn9E8IAJwGpphHQi7/4tTbLpt+0ze6onM2tJgO2y+ZCefFjiRAGOAlIjICzAxJL0Ov4CujDpXdX3Unnb4Ii3wX6hgG/lAhhgJOA9CCyY6v4EdhiQFN5Ato/M0CvNzrzwyXflVben78DbhRdoOgpA2y0CxXXISr4QhjQTZwABXd6xXWICm50iqvQhAFOAhIj4OyAxBL0Or4CCu70Rj9r4LzBd4GCG517f2i+ed5gIoQBTgLSgwiNresRmLxCU3CnhwFd6QlogxNQWoeYs/knnd6Qpj4PAAAAAMDqZA9HoTdJBiFe5gAAAABJRU5ErkJggg=='

STONE
'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAAAsTAAALEwEAmpwYAAABE0lEQVR4nO2aQQ7CIBRE4bK60di7yedE0lvYMS40LtS2sZYCb5I5AK8zDIs6hxBCG5MkH830sIUwuJYkAIgExJorIMn3KemT0+XyPPw7Fw9EIwDuBoCRABVbAU2IeNUVEABEAvqWKqAFvjgAEgkQFUgN3wHxy4HHnB2IACAS0LdUAa28+wAwEiAqYNwB4hI0VkDMoGV4B2hju7/6LAoAIgF9xgpYCPkrEJftqLrjfpYBYCRAVMCmQQjn8//fBXHlO2CuAfBPiQRoixUYHj4ddtfmEuDWlAAgEhB/fA4XXYG5lSh+98cEAJEAX/XuL/C7e12dHxMARAJ81bs/Qb7q3Z8gAHSNJ8C97vTS3tzuI4RcqboBIUJ6/bDLdUQAAAAASUVORK5CYII='

MONEY
'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAAAsTAAALEwEAmpwYAAAB30lEQVR4nO1ZS07DMBSMWKRcoLlLORBl0dByglwgTTiMbS7UsikLZ0/yUCpamleB5fzq4HnSbGO/8cz4kyBAoVCoG5bOw7LIQ2oLSoK7YMqlQUAIBRQ+WUCzFadDSvSxbY0in02LEM0JODaStUbxCgIICsgdtoA2ej7rCMczQffs+cllggYBIRRQwAIhMqDwNgSzsPLaAul8UabzBZ2gs1l1nOQ3uh+F78/fqrGNfsaqkQTOERDSkHcBEBBBATSqBZSUn1KI6jcoIagB2USRNz1sC77iVxYbOgRl3aSU1BaaXV5sAQIiKIBGtYBint/vdvS+37dGIxOEoDR6aDRkAm948F1AMs93ab7Gm1KNTAABERRATllA9ex5YyawcwN/4xt9G5Q9e942E0znBBAQQQH0ry2QGnaFwUNQggABBSifLbCJl+UmXtIJUojjJE/oo+FLvDw/nceqYbsN9n72X68erwgY8i5wORYIiB1QwCZeVl4rQElZXk6Qe5Rngi349/iTmSkEx3j0LP9aIa4IW/DvgQDpmAIkOwh5p4A12wb5BLmHbWEiJEmS2/7bWxsI6NI8CIihAHLeAraW6BqCzjXMCwSsoIDSawuYFGGLyTXMCwSsoIDSawugUKhgyvUF3HSIaJOolsAAAAAASUVORK5CYII='

POPULATION
'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAMAAADXqc3KAAAAIVBMVEUAAAARheITjusWjuoYdtMWl/MYddIWl/IWl/MXmPMYdtIKYPjAAAAACXRSTlMAEy9vgKDT3fC7bjIjAAAAa0lEQVR42sWRwQrAMAhD1W5t9f8/eJWMUAbCdto7BR85BOVvNBYdefhCkVuAzA6mJBE0029MRDqFipMskG6FiLMS43OjFcLEyWPH2O8coitvgpUjo/HOjiToNKSDw1UnCnCx4UQhyAtRvvUCrWoMLyELvEUAAAAASUVORK5CYII='

*/