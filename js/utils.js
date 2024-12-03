export { arrayToHash, loadAndSplitImage, offscreenSprite, throttle }

'use strict'

const throttle = (func, wait = 100) => {
    let timeout
    return (...args) => {
        if (!timeout) {
            timeout = setTimeout(() => {
                timeout = null
                func.apply(this, args)
            }, wait)
        }
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
      const sprites = Array.from({ length: Math.round(image.width/spriteSize) }, (_, i) => Array.from({ length: Math.round(image.height/spriteSize) }, (_, j) => 0))

      // Split the image into smaller subimages of spriteSizexspriteSize pixels
      for (let x = 0; x < image.width / spriteSize; x++) {
        for (let y = 0; y < image.height / spriteSize; y++) {
          sprites[x][y] = ctx.getImageData(x * spriteSize, y * spriteSize, spriteSize, spriteSize)
        }
      }

      resolve(sprites/*.filter(sprite => sprite.data.reduce((r, c) => r + c))*/)
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
    offscreenSprites.set(hash, canvas)
  }

  return offscreenSprites.get(hash)
}

// Calculate a very simplified hash from an array of string or integers
const arrayToHash = (array) => {
    return array.slice(0, array.length / 2 | 0).join('')

    // Not used
    // let hash = 0;
    // if (array.length === 0) return hash
    //
    // return array.join('').split('').reduce((hash, char) => {
    //     return char.charCodeAt(0) + (hash << 6) + (hash << 16) - hash
    // }, 0)
}
