export { Mouse }

'use strict'

import { loadAndSplitImage, offscreenSprite } from 'sprites'
import { throttle } from 'utils'


const ZOOM = {
  FACTOR: 1.1,
  MAX: 1.4,
  MIN: 1,
  current: 1
}

class Mouse {
  constructor(xPixels = 0, yPixels = 0) {
    this.xPixels = xPixels
    this.yPixels = yPixels
    this.x = null
    this.y = null
    this.canvas = null
    this.isDragging = false
    this.isPinching = false
    this.needUpdate = false
    this.offsetX = 0
    this.offsetY = 0
    this.prevDistance = 0 // distance between fingers
    this.scaleFactor = 1
    this.sprite = null
    this.zoomChanged = false
  }

  needUpdate() {
    if (this.needUpdate) {
      this.needUpdate = false
      return true
    }
    return false
  }

  async initMouse(uiCanvas, spriteSize) {
    const SPRITE_SIZE = spriteSize
    const canvas = uiCanvas
    this.canvas = canvas
    const mouseSprite = (await loadAndSplitImage('assets/ui/crosshair.png', 9))[0][0]
    this.sprite = offscreenSprite(mouseSprite, 9)
  
    const storePosition = (e) => {
      const rect = canvas.getBoundingClientRect() // Get canvas position and size
      this.xPixels = (e.clientX - rect.left) * (canvas.width/parseInt(canvas.style.width.split('px')[0]) / this.scaleFactor) | 0
      this.yPixels = (e.clientY - rect.top) * (canvas.height/parseInt(canvas.style.height.split('px')[0]) / this.scaleFactor) | 0
      this.x = this.xPixels / SPRITE_SIZE / this.scaleFactor | 0
      this.y = this.yPixels / SPRITE_SIZE / this.scaleFactor | 0
      this.needUpdate = true      
    }
  
    const distanceBetweenTouches = (touch1, touch2) => {
      const dx = touch1.clientX - touch2.clientX
      const dy = touch1.clientY - touch2.clientY
      return Math.sqrt(dx * dx + dy * dy)
    }

    canvas.addEventListener('mousedown', (e) => {
        if (e.which === 1) { // left clic
            this.isDragging = true
            storePosition(e)
        }
    })

    canvas.addEventListener('mouseup', (e) => {
        if (e.which === 1) { // left clic
            this.isDragging = false
            this.clicked = true
            storePosition(e)
        }
    })

    canvas.addEventListener('wheel', (e) => {
        storePosition(e)
        const oldScale = this.scaleFactor
        if (e.wheelDelta > 0) {
            // Zoom out
            this.scaleFactor += 0.025
        } else if (e.wheelDelta < 0) {
            // Zoom in
            this.scaleFactor -= 0.025
        }

        this.scaleFactor = Math.max(ZOOM.MIN, Math.min(ZOOM.MAX, this.scaleFactor))
        this.offsetX = this.xPixels - (this.xPixels - this.offsetX) * (this.scaleFactor / oldScale)
        this.offsetY = this.yPixels - (this.yPixels - this.offsetY) * (this.scaleFactor / oldScale)

        this.zoomChanged = true
    })

    canvas.addEventListener('mousemove', (e) => {
        if (this.isDragging) {
            const rect = canvas.getBoundingClientRect()
            const xPixels = (e.clientX - rect.left) * (canvas.width / parseInt(canvas.style.width.split('px')[0]) / this.scaleFactor) | 0
            const yPixels = (e.clientY - rect.top) * (canvas.height / parseInt(canvas.style.height.split('px')[0]) / this.scaleFactor) | 0
            this.offsetX += this.xPixels - xPixels
            this.offsetY += this.yPixels - yPixels
            this.zoomChanged = true
            storePosition(e)
        }
        throttle(storePosition, 15)(e)
    })

    canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) { // Single finger touch
            this.isDragging = true
            storePosition(e.touches[0])
        } else if (e.touches.length === 2) { // Two fingers
            this.isPinching = true
            this.prevDistance = distanceBetweenTouches(e.touches[0], e.touches[1])
        }
    })

    canvas.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1) { // Single finger move
            this.isDragging = true
            storePosition(e.touches[0])
        } else if (e.touches.length === 2 && this.isPinching) {
            const currentDistance = distanceBetweenTouches(e.touches[0], e.touches[1])
            const scaleChange = currentDistance / this.prevDistance
            this.prevDistance = currentDistance

            // Apply zoom
            this.scaleFactor *= scaleChange
        }
        e.preventDefault() // Prevent scrolling
    })

    canvas.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) { // If ending with less than two fingers, stop pinching
            this.isPinching = false
        }
        this.isDragging = false
        storePosition(e.changedTouches[0])
    })

    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault() // Prevent right-click menu
    })
  }
}
