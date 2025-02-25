export { Mouse }

'use strict'

import { app } from 'renderer'
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
      this.clicked = false
      this.offsetX = 0
      this.offsetY = 0
      this.prevDistance = 0 // distance between fingers
      this.scaleFactor = 1
      this.sprite = null
      this.zoomChanged = false
    }
  
    needUpdateCheck() {
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
    
      // Use this method to update mouse position from event handlers
      this.updatePosition = (clientX, clientY) => {
        const rect = canvas.getBoundingClientRect()
        this.xPixels = (clientX - rect.left) * (canvas.width/parseInt(canvas.style.width.split('px')[0]) / this.scaleFactor) | 0
        this.yPixels = (clientY - rect.top) * (canvas.height/parseInt(canvas.style.height.split('px')[0]) / this.scaleFactor) | 0
        this.x = this.xPixels / SPRITE_SIZE / this.scaleFactor | 0
        this.y = this.yPixels / SPRITE_SIZE / this.scaleFactor | 0
        this.needUpdate = true
      }
    
      const distanceBetweenTouches = (touch1, touch2) => {
        const dx = touch1.clientX - touch2.clientX
        const dy = touch1.clientY - touch2.clientY
        return Math.sqrt(dx * dx + dy * dy)
      }
  
      // Setup event listeners for Pixi.js view
      const pixiView = app.view;
      
      pixiView.addEventListener('pointerdown', (e) => {
        if (e.button === 0) { // Primary button
          this.isDragging = true
          this.updatePosition(e.clientX, e.clientY)
        }
      })
  
      pixiView.addEventListener('pointerup', (e) => {
        if (e.button === 0) { // Primary button
          this.isDragging = false
          this.clicked = true
          this.updatePosition(e.clientX, e.clientY)
        }
      })
  
      pixiView.addEventListener('wheel', (e) => {
        this.updatePosition(e.clientX, e.clientY)
        const oldScale = this.scaleFactor
        if (e.deltaY < 0) {
          // Zoom in
          this.scaleFactor += 0.025
        } else if (e.deltaY > 0) {
          // Zoom out
          this.scaleFactor -= 0.025
        }
  
        this.scaleFactor = Math.max(ZOOM.MIN, Math.min(ZOOM.MAX, this.scaleFactor))
        this.offsetX = this.xPixels - (this.xPixels - this.offsetX) * (this.scaleFactor / oldScale)
        this.offsetY = this.yPixels - (this.yPixels - this.offsetY) * (this.scaleFactor / oldScale)
  
        this.zoomChanged = true
        e.preventDefault()
      })
  
      pixiView.addEventListener('pointermove', (e) => {
        if (this.isDragging) {
          const rect = pixiView.getBoundingClientRect()
          const xPixels = (e.clientX - rect.left) * (pixiView.width / parseInt(pixiView.style.width.split('px')[0]) / this.scaleFactor) | 0
          const yPixels = (e.clientY - rect.top) * (pixiView.height / parseInt(pixiView.style.height.split('px')[0]) / this.scaleFactor) | 0
          
          this.offsetX += this.xPixels - xPixels
          this.offsetY += this.yPixels - yPixels
          this.zoomChanged = true
          this.updatePosition(e.clientX, e.clientY)
        }
        throttle(() => this.updatePosition(e.clientX, e.clientY), 15)()
      })
  
      // Touch events
      pixiView.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) { // Single finger touch
          this.isDragging = true
          this.updatePosition(e.touches[0].clientX, e.touches[0].clientY)
        } else if (e.touches.length === 2) { // Two fingers
          this.isPinching = true
          this.prevDistance = distanceBetweenTouches(e.touches[0], e.touches[1])
        }
        e.preventDefault()
      })
  
      pixiView.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1) { // Single finger move
          this.isDragging = true
          this.updatePosition(e.touches[0].clientX, e.touches[0].clientY)
        } else if (e.touches.length === 2 && this.isPinching) {
          const currentDistance = distanceBetweenTouches(e.touches[0], e.touches[1])
          const scaleChange = currentDistance / this.prevDistance
          this.prevDistance = currentDistance
  
          // Apply zoom
          const oldScale = this.scaleFactor
          this.scaleFactor *= scaleChange
          this.scaleFactor = Math.max(ZOOM.MIN, Math.min(ZOOM.MAX, this.scaleFactor))
          
          // Calculate center of pinch
          const touch1 = e.touches[0]
          const touch2 = e.touches[1]
          const centerX = (touch1.clientX + touch2.clientX) / 2
          const centerY = (touch1.clientY + touch2.clientY) / 2
          
          // Update offsets to zoom to/from pinch center
          const rect = pixiView.getBoundingClientRect()
          const pinchCenterX = (centerX - rect.left) * (pixiView.width / parseInt(pixiView.style.width.split('px')[0]) / oldScale) | 0
          const pinchCenterY = (centerY - rect.top) * (pixiView.height / parseInt(pixiView.style.height.split('px')[0]) / oldScale) | 0
          
          this.offsetX = pinchCenterX - (pinchCenterX - this.offsetX) * (this.scaleFactor / oldScale)
          this.offsetY = pinchCenterY - (pinchCenterY - this.offsetY) * (this.scaleFactor / oldScale)
          
          this.zoomChanged = true
        }
        e.preventDefault() // Prevent scrolling
      })
  
      pixiView.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) { // If ending with less than two fingers, stop pinching
          this.isPinching = false
        }
        if (e.touches.length === 0) {
          this.isDragging = false
          this.clicked = true
        }
        if (e.changedTouches.length > 0) {
          this.updatePosition(e.changedTouches[0].clientX, e.changedTouches[0].clientY)
        }
        e.preventDefault()
      })
  
      pixiView.addEventListener('contextmenu', (e) => {
        e.preventDefault() // Prevent right-click menu
      })
    }
  }