export { PerlinNoise, arrayToHash, distance, getCachedSprite, textureCache, throttle }

'use strict'

import { Sprite } from 'pixijs'

const SCALE_MODE = 'nearest'

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


const distance = (a, b) => {
  return Math.sqrt(Math.pow(b.x-a.x, 2) + Math.pow(b.y-a.y, 2))
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

const textureCache = new Map()
const spriteCache = new Map()

/**
 * Get or create a cached sprite for a texture
 * @param {PIXI.Texture|OffscreenCanvas} source - Texture or canvas to use
 * @param {string} key - Cache key
 * @returns {PIXI.Sprite} Cached or new sprite
 */
function getCachedSprite(source, key) {
    // Check if the sprite is already cached
    if (key && spriteCache.has(key)) {
        return spriteCache.get(key)
    }

    // If it's an OffscreenCanvas, convert it to a texture first
    let texture;
    if (source instanceof OffscreenCanvas) {
        texture = loadTextureFromCanvas(source, key)
    } else {
        texture = source
    }

    texture.source.scaleMode = SCALE_MODE

    // Create a new sprite
    const sprite = new Sprite(texture)
    sprite.sourceKey = texture.uid // Store the key for future reference

    // Cache the sprite
    spriteCache.set(sprite.sourceKey, sprite)


    // if(Math.random() > 0.9975) {
    //     console.log(`Sprite cache size: ${spriteCache.size}`)
    // }

    return sprite
}

class PerlinNoise {
    constructor(seed = 0) {
        this.seed = seed
        this.p = new Array(512)
        this.permutation = new Array(256)
        const seededRandom = (seed) => {
            const x = Math.sin(seed) * 10000;
            return x - Math.floor(x);
        }
        const shuffledArray = Array.from({length: 256}, (_, i) => i)
        for (let i = shuffledArray.length - 1; i > 0; i--) {
            const j = Math.floor(seededRandom(this.seed + i) * (i + 1));
            [shuffledArray[i], shuffledArray[j]] = [shuffledArray[j], shuffledArray[i]]
        }
        this.permutation = shuffledArray
        
        // Duplicate the permutation to avoid overflow
        for(let i = 0; i < 512; i++) {
            this.p[i] = this.permutation[i % 256]
        }

        console.log('Map Seed: ' + this.seed)
    }

    noise(x, y, z = 0) {
        const X = Math.floor(x) & 255
        const Y = Math.floor(y) & 255
        const Z = Math.floor(z) & 255

        x -= Math.floor(x)
        y -= Math.floor(y)
        z -= Math.floor(z)

        const u = this.fade(x)
        const v = this.fade(y)
        const w = this.fade(z)

        const A = this.p[X  ]+Y, AA = this.p[A]+Z, AB = this.p[A+1]+Z
        const B = this.p[X+1]+Y, BA = this.p[B]+Z, BB = this.p[B+1]+Z

        return this.lerp(w, this.lerp(v, 
            this.lerp(u, this.grad(this.p[AA  ], x  , y  , z  ),
                      this.grad(this.p[BA  ], x-1, y  , z  )),
            this.lerp(u, this.grad(this.p[AB  ], x  , y-1, z  ),
                      this.grad(this.p[BB  ], x-1, y-1, z  ))),
            this.lerp(v, 
            this.lerp(u, this.grad(this.p[AA+1], x  , y  , z-1),
                      this.grad(this.p[BA+1], x-1, y  , z-1)),
            this.lerp(u, this.grad(this.p[AB+1], x  , y-1, z-1),
                      this.grad(this.p[BB+1], x-1, y-1, z-1))))
    }

    fade(t) { return t * t * t * (t * (t * 6 - 15) + 10) }
    lerp(t, a, b) { return a + t * (b - a) }
    grad(hash, x, y, z) {
        const h = hash & 15
        const u = h < 8 ? x : y
        const v = h < 4 ? y : h === 12 || h === 14 ? x : z
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v)
    }
}