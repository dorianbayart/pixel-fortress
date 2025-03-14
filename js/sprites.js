export { loadAndSplitImage, loadSprites, offscreenSprite, sprites, unitsSprites, unitsSpritesDescription, UNIT_SPRITE_SIZE }

'use strict'

import { arrayToHash } from 'utils'
import { getTileSize } from 'dimensions'

const SPRITE_SIZE = getTileSize(), UNIT_SPRITE_SIZE = getTileSize() * 2

/** The Offsreen sprite cache */
const offscreenSprites = new Map()

/** Exposed variables that stores the sprites and their descriptor */
let sprites, unitsSprites, unitsSpritesDescription

/**
 * Sprite loader
 * 1. Store the terrain and building sprites in 'sprites'
 * 2. Load the units sprites descriptor file
 * 3. Build and store the unit sprites in 'unitSprites' object
 * 
 * @returns {Promise<void>}
 */
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
        sprites
      )
    }

    image.onerror = reject
    image.src = url
  })
}

/**
 * 
 * @param {ImageData} sprite 
 * @param {number} spriteSize 
 * @param {string|number} id 
 * @returns 
 */
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