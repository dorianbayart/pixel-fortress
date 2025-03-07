export { loadAndSplitImage, loadSprites, offscreenSprite, sprites, unitsSprites, unitsSpritesDescription, UNIT_SPRITE_SIZE }

'use strict'

import { arrayToHash } from 'utils'
import { getTileSize } from 'dimensions'

const SPRITE_SIZE = getTileSize(), UNIT_SPRITE_SIZE = getTileSize() * 2

let sprites, unitsSprites, unitsSpritesDescription

const loadSprites = async () => {
  sprites = await loadAndSplitImage(
    './assets/punyworld-overworld-tileset.png',
    SPRITE_SIZE
  )
  unitsSpritesDescription = await (
    await fetch('./assets/unitsSpritesDescription.json')
  ).json()

  unitsSprites = {}
  let spritesToLoad = Object.keys(unitsSpritesDescription)
  for (let sprite of spritesToLoad) {
    unitsSprites[sprite] = await loadAndSplitImage(
      unitsSpritesDescription[sprite]['relativeToRoot'],
      UNIT_SPRITE_SIZE
    )
  }
}

const loadAndSplitImage = (url, spriteSize) => {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'

    image.onload = () => {
      const canvas = new OffscreenCanvas(image.width, image.height)
      const ctx = canvas.getContext('2d', { willReadFrequently: false })
      ctx.drawImage(image, 0, 0)

      const spriteSheet = ctx.getImageData(0, 0, image.width, image.height)
      const sprites = Array.from(
        { length: Math.round(image.width / spriteSize) },
        (_, i) =>
          Array.from(
            { length: Math.round(image.height / spriteSize) },
            (_, j) => 0
          )
      )

      // Split the image into smaller subimages of spriteSizexspriteSize pixels
      for (let x = 0; x < image.width / spriteSize; x++) {
        for (let y = 0; y < image.height / spriteSize; y++) {
          sprites[x][y] = ctx.getImageData(
            x * spriteSize,
            y * spriteSize,
            spriteSize,
            spriteSize
          )
        }
      }

      resolve(
        sprites /*.filter(sprite => sprite.data.reduce((r, c) => r + c))*/
      )
    }

    image.onerror = reject
    image.src = url
  })
}

const offscreenSprites = new Map()
const offscreenSprite = (sprite, spriteSize, id) => {
  const hash = id ?? arrayToHash(sprite.data)

  if (!offscreenSprites.has(hash)) {
    const canvas = new OffscreenCanvas(spriteSize, spriteSize)
    const ctx = canvas.getContext('2d')
    ctx.putImageData(sprite, 0, 0)
    canvas.uid = hash
    offscreenSprites.set(hash, canvas)
  }

  return offscreenSprites.get(hash)
}
