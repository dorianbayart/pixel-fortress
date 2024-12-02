'use strict'

const mouse = {
  xPixels: 0,
  yPixels: 0,
  x: null,
  y: null,
  isDragging: false,
  isPinching: false,
  needUpdate: false,
  offsetX: 0,
  offsetY: 0,
  prevDistance: 0, // distance between fingers
  scaleFactor: 1,
  sprite: null,
  zoomChanged: false,
}

const initMouseEvents = async (uiCanvas, spriteSize) => {
  const SPRITE_SIZE = spriteSize
  const canvas = uiCanvas

  mouse.sprite = offscreenSprite(sprites[spriteCoords_Mouse.x][spriteCoords_Mouse.y], SPRITE_SIZE)
  mouse.offsetX = 0
  mouse.offsetY = 0

  const storePosition = (e) => {
    const rect = canvas.getBoundingClientRect() // Get canvas position and size
    mouse.xPixels = (e.clientX - rect.left) * (canvas.width/parseInt(canvas.style.width.split('px')[0]) / mouse.scaleFactor) | 0
    mouse.yPixels = (e.clientY - rect.top) * (canvas.height/parseInt(canvas.style.height.split('px')[0]) / mouse.scaleFactor) | 0
    mouse.x = mouse.xPixels / SPRITE_SIZE / mouse.scaleFactor | 0
    mouse.y = mouse.yPixels / SPRITE_SIZE / mouse.scaleFactor | 0
    mouse.needUpdate = true
  }

  const distanceBetweenTouches = (touch1, touch2) => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  canvas.addEventListener('mousedown', (e) => {
    if(e.which === 1) { // left clic
      mouse.isDragging = true
      storePosition(e)
      console.log(e)
    }
  })

  canvas.addEventListener('mouseup', (e) => {
    if(e.which === 1) { // left clic
      mouse.isDragging = false
      mouse.clicked = true
      storePosition(e)
    }
  })

  canvas.addEventListener('wheel', (e) => {
      storePosition(e)
      const oldScale = mouse.scaleFactor
      if(e.wheelDelta > 0) {
        // Zoom out
        mouse.scaleFactor += 0.025
      } else if (e.wheelDelta < 0) {
        // Zoom in
        mouse.scaleFactor -= 0.025
      }

      


      mouse.scaleFactor = Math.max(ZOOM.MIN, Math.min(ZOOM.MAX, mouse.scaleFactor))
      //mouse.offsetX = (mouse.xPixels - mouse.offsetX) * (1 - mouse.scaleFactor / oldScale) + mouse.offsetX;
      //mouse.offsetY = (mouse.yPixels - mouse.offsetY) * (1 - mouse.scaleFactor / oldScale) + mouse.offsetY;
      mouse.zoomChanged = true
  })

  canvas.addEventListener('mousemove', (e) => {
    
    if(mouse.isDragging) {
      const rect = canvas.getBoundingClientRect()
      const xPixels = (e.clientX - rect.left) * (canvas.width/parseInt(canvas.style.width.split('px')[0]) / mouse.scaleFactor) | 0
      const yPixels = (e.clientY - rect.top) * (canvas.height/parseInt(canvas.style.height.split('px')[0]) / mouse.scaleFactor) | 0
      mouse.offsetX += mouse.xPixels - xPixels
      mouse.offsetY += mouse.yPixels - yPixels
      mouse.zoomChanged = true
      storePosition(e)
    } else {
      throttle(storePosition, 15)(e)
    }

    
  })

  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) { // Single finger touch
      mouse.isDragging = true
      storePosition(e.touches[0])
    } else if (e.touches.length === 2) { // Two fingers
      mouse.isPinching = true
      mouse.prevDistance = distanceBetweenTouches(e.touches[0], e.touches[1])
    }
  })

  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1) { // Single finger move
      mouse.isDragging = true
      storePosition(e.touches[0])
    } else if (e.touches.length === 2 && mouse.isPinching) {
      const currentDistance = distanceBetweenTouches(e.touches[0], e.touches[1])
      const scaleChange = currentDistance / mouse.prevDistance
      mouse.prevDistance = currentDistance

      // Apply zoom
      mouse.scaleFactor *= scaleChange
    }
    e.preventDefault() // Prevent scrolling
  })

  canvas.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) { // If ending with less than two fingers, stop pinching
      mouse.isPinching = false
    }
    mouse.isDragging = false
    storePosition(e.changedTouches[0])
  })

  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault() // Prevent right-click menu
  })
}
