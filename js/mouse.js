export { Mouse }

'use strict'

import { app } from 'renderer'
import { loadAndSplitImage, offscreenSprite } from 'sprites'
import { throttle } from 'utils'


const ZOOM = {
  FACTOR: 0.025,
  MAX: 2,
  MIN: 0.5,
  current: 1
}

class Mouse {
    constructor(xPixels = 0, yPixels = 0) {
      this.xPixels = xPixels
      this.yPixels = yPixels
      this.x = null
      this.y = null
      this.worldX = 0 // World coordinates (accounting for zoom/pan)
      this.worldY = 0
      this.canvas = null
      this.isDragging = false
      this.isPinching = false
      this.clicked = false
      this.dragStartX = 0
      this.dragStartY = 0
      this.lastX = 0
      this.lastY = 0
      this.prevDistance = 0 // distance between fingers
      this.scale = 1
      this.sprite = null
      this.zoomChanged = false

      // Store view transformation for zoom calculation
      this.viewTransform = {
        scale: 1,
        x: 0,
        y: 0
      }
    }
  
    async initMouse(canvas, spriteSize) {
      const SPRITE_SIZE = spriteSize
      this.canvas = canvas

      // Load cursor sprite
      const mouseSprite = (await loadAndSplitImage('assets/ui/crosshair.png', 9))[0][0]
      this.sprite = offscreenSprite(mouseSprite, 9, 'cursor')
    
      // Use this method to update mouse position from event handlers
      this.updatePosition = (clientX, clientY) => {
        // Get position relative to canvas
        const rect = app.canvas.getBoundingClientRect()

        // Screen coordinates
        this.xPixels = (clientX - rect.left)
        this.yPixels = (clientY - rect.top)

        // Calculate mouse position in screen pixels
        const viewWidth = parseInt(app.canvas.style.width)
        const viewHeight = parseInt(app.canvas.style.height)

        // Convert to normalized coordinates (0-1 across canvas)
        const normalizedX = this.xPixels / viewWidth
        const normalizedY = this.yPixels / viewHeight
        
        // Convert to world coordinates based on current view
        this.worldX = ((normalizedX * app.renderer.width /*/ this.viewTransform.scale*/) + this.viewTransform.x)
        this.worldY = ((normalizedY * app.renderer.height /*/ this.viewTransform.scale*/) + this.viewTransform.y)
        // console.log(this.xPixels, viewWidth, normalizedX, app.renderer.width, this.viewTransform.x)
        // Convert to grid coordinates
        this.x = Math.floor(this.worldX / SPRITE_SIZE / this.viewTransform.scale)
        this.y = Math.floor(this.worldY / SPRITE_SIZE / this.viewTransform.scale)
      }
    
      const distanceBetweenTouches = (touch1, touch2) => {
        const dx = touch1.clientX - touch2.clientX
        const dy = touch1.clientY - touch2.clientY
        return Math.sqrt(dx * dx + dy * dy)
      }
  
      // Setup event listeners for Pixi.js view
      const pixiView = app.canvas;
      
      pixiView.addEventListener('pointerdown', (e) => {
        if (e.button === 0) { // Primary button
          this.isDragging = true
          this.dragStartX = e.clientX
          this.dragStartY = e.clientY
          this.updatePosition(e.clientX, e.clientY)
        }
      })
  
      pixiView.addEventListener('pointerup', (e) => {
        if (e.button === 0) { // Primary button
            // If barely moved, treat as a click
            const dx = Math.abs(e.clientX - this.dragStartX)
            const dy = Math.abs(e.clientY - this.dragStartY)
            if (dx < 5 && dy < 5) {
                this.clicked = true
            }
            
          this.isDragging = false
          this.updatePosition(e.clientX, e.clientY)
        }
      })
  
      pixiView.addEventListener('wheel', (e) => {
        e.preventDefault()
        
        // Update position first
        this.updatePosition(e.clientX, e.clientY)
        
        // Calculate zoom direction
        const zoomDirection = e.deltaY < 0 ? 1 : -1
        const zoomFactor = ZOOM.FACTOR * zoomDirection
        
        // Store mouse world position before zoom
        const mouseWorldX = this.worldX
        const mouseWorldY = this.worldY
        
        // Calculate new scale
        const newScale = Math.max(
          ZOOM.MIN, 
          Math.min(ZOOM.MAX, this.viewTransform.scale * (1 + zoomFactor))
        )
        
        // If scale changed, update transforms
        if (newScale !== this.viewTransform.scale) {
          // Calculate new offsets to keep mouse position fixed
          this.viewTransform.scale = newScale
          this.viewTransform.x *= zoomFactor
          this.viewTransform.y *= zoomFactor
          
          // Set flag for renderer to update
          this.zoomChanged = true
        }
      })
  
      // Mouse move event
      pixiView.addEventListener('pointermove', (e) => {
        // Handle dragging (panning the view)
        if (this.isDragging) {
          const dx = (e.clientX - this.lastX) / this.viewTransform.scale
          const dy = (e.clientY - this.lastY) / this.viewTransform.scale
          
          // Update view offset
          this.viewTransform.x -= dx
          this.viewTransform.y -= dy
          
          // Flag that zoom/pan changed
          this.zoomChanged = true
        }
        
        // Store current position for next move event
        this.lastX = e.clientX
        this.lastY = e.clientY
        
        // Update mouse position
        this.updatePosition(e.clientX, e.clientY)
      })
  
      // Touch start event
    pixiView.addEventListener('touchstart', (e) => {
        e.preventDefault()
        
        if (e.touches.length === 1) { // Single finger touch
          this.isDragging = true
          this.dragStartX = e.touches[0].clientX
          this.dragStartY = e.touches[0].clientY
          this.lastX = e.touches[0].clientX
          this.lastY = e.touches[0].clientY
          this.updatePosition(e.touches[0].clientX, e.touches[0].clientY)
        } else if (e.touches.length === 2) { // Two fingers (pinch)
          this.isPinching = true
          this.isDragging = false
          this.prevDistance = distanceBetweenTouches(e.touches[0], e.touches[1])
          
          // Calculate pinch center
          const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2
          const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2
          this.updatePosition(centerX, centerY)
        }
      })
  
      // Touch move event
      pixiView.addEventListener('touchmove', (e) => {
        e.preventDefault()
        
        if (e.touches.length === 1 && this.isDragging) { // Single finger move
          // Calculate drag distance
          const dx = (e.touches[0].clientX - this.lastX) / this.viewTransform.scale
          const dy = (e.touches[0].clientY - this.lastY) / this.viewTransform.scale
          
          // Update view offset
          this.viewTransform.x -= dx
          this.viewTransform.y -= dy
          
          // Store current position
          this.lastX = e.touches[0].clientX
          this.lastY = e.touches[0].clientY
          
          // Update mouse position and flag changes
          this.updatePosition(e.touches[0].clientX, e.touches[0].clientY)
          this.zoomChanged = true
        } else if (e.touches.length === 2 && this.isPinching) { // Pinch zoom
          // Calculate new distance between touches
          const currentDistance = distanceBetweenTouches(e.touches[0], e.touches[1])
          const scaleChange = currentDistance / this.prevDistance
          this.prevDistance = currentDistance
          
          // Calculate pinch center
          const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2
          const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2
          this.updatePosition(centerX, centerY)
          
          // Store world position before zoom
          const pinchWorldX = this.worldX
          const pinchWorldY = this.worldY
          
          // Calculate new scale
          const newScale = Math.max(
            ZOOM.MIN,
            Math.min(ZOOM.MAX, this.viewTransform.scale * scaleChange)
          )
          
          // Apply new scale
          this.viewTransform.scale = newScale
          this.viewTransform.x *= scaleChange
          this.viewTransform.y *= scaleChange
          
          // Flag that zoom changed
          this.zoomChanged = true
        }
      })
  
      // Touch end event
      pixiView.addEventListener('touchend', (e) => {
        e.preventDefault()
        
        if (e.touches.length < 2) {
          this.isPinching = false
        }
        
        if (e.touches.length === 0) {
          // If barely moved, treat as a click
          if (e.changedTouches.length > 0) {
            const dx = Math.abs(e.changedTouches[0].clientX - this.dragStartX)
            const dy = Math.abs(e.changedTouches[0].clientY - this.dragStartY)
            if (dx < 10 && dy < 10) {
              this.clicked = true
              this.updatePosition(e.changedTouches[0].clientX, e.changedTouches[0].clientY)
            }
          }
          this.isDragging = false
        }
      })
  
      // Prevent context menu
      pixiView.addEventListener('contextmenu', (e) => {
        e.preventDefault()
      })
    }
    
    // Method to get current view transform for renderer
    getViewTransform() {
      return { ...this.viewTransform };
    }
  }