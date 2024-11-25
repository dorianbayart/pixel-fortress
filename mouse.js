'use strict'

const mouse = {
  x: null,
  y: null,
  isDragging: false,
  isPinching: false,
  prevDistance: 0, // distance between fingers
  scaleFactor: 1,
  sprite: null,
  needUpdate: false
}

const initMouseEvents = async (uiCanvas, spriteSize) => {
  const SPRITE_SIZE = spriteSize
  const canvas = uiCanvas

  mouse.sprite = offscreenSprite(sprites[spriteCoords_Mouse.x][spriteCoords_Mouse.y], SPRITE_SIZE)

  const storePosition = (e) => {
    const rect = canvas.getBoundingClientRect() // Get canvas position and size
    const posX = (e.clientX - rect.left)*(canvas.width/parseInt(canvas.style.width.split('px')[0]))/SPRITE_SIZE | 0
    const posY = (e.clientY - rect.top)*(canvas.height/parseInt(canvas.style.height.split('px')[0]))/SPRITE_SIZE | 0
    if(posX !== mouse.x || posY !== mouse.y) {
      mouse.x = posX
      mouse.y = posY
      mouse.needUpdate = true
    }
  }

  const distanceBetweenTouches = (touch1, touch2) => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  canvas.addEventListener('mousedown', (e) => {
    mouse.isDragging = true
    storePosition(e)
  })

  canvas.addEventListener('mouseup', (e) => {
    mouse.isDragging = false
    mouse.clicked = true
    storePosition(e)
  })

  canvas.addEventListener('mousemove', (e) => {
    throttle(storePosition, 10)(e)
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
