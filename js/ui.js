export {
  handleMouseInteraction, initUI, mouse, setupEventListeners, showDebugMessage, updateUI
}
  
'use strict'
  
import { DEBUG, drawBack, toggleDebug } from 'globals'
import * as PIXI from 'pixijs'
import { containers, updateZoom } from 'renderer'
import gameState from 'state'
import { getCachedSprite } from 'utils'
  
  // Mouse object (will be initialized in initUI)
  let mouse = null
  let elapsedUI = -5000
  let cursorUpdateRafId = null
  
  // UI elements
  let cursorSprite = null
  let statsText = null
  
  /**
   * Initialize UI components
   * @param {Object} mouseInstance - Mouse controller instance
   */
  async function initUI(mouseInstance) {
    mouse = mouseInstance
    gameState.UI = { mouse: mouse }

    setupEventListeners()
    
    // Create cursor sprite
    if (mouse.sprite) {
      const cursorTexture = await createTextureFromOffscreenCanvas(mouse.sprite)
      cursorSprite = getCachedSprite(cursorTexture, 'cursor')
      cursorSprite.pivot.set(4.5, 4.5) // Center the cursor
      containers.ui.addChild(cursorSprite)

      // Start dedicated cursor update loop
      updateCursor()
    }
    
    // Create debug stats text
    statsText = new PIXI.Text({
      text: '',
      fontFamily: 'monospace',
      fontSize: 14,
      resolution: window.devicePixelRatio || 1,
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: 2
    })
    statsText.position.set(10, 10)
    statsText.visible = DEBUG()
    containers.ui.addChild(statsText)
    
    // Subscribe to state changes
    gameState.events.on('debug-changed', (value) => {
      statsText.visible = value
      if (!value) {
        document.getElementById('stats').innerHTML = null
      }
      drawBack()
    })
    
    gameState.events.on('game-status-changed', (status) => {
      if (status === 'playing') {
        document.getElementById('homeMenu').style.opacity = 0
        setTimeout(() => {
          document.getElementById('homeMenu').style.display = 'none'
        }, 750)
      }
    })
  }
  
  /**
   * Create a PIXI texture from an OffscreenCanvas
   * @param {OffscreenCanvas} canvas - The offscreen canvas
   * @returns {Promise<PIXI.Texture>} The created texture
   */
  async function createTextureFromOffscreenCanvas(canvas) {
    // For newer browsers that support convertToBlob
    if (canvas.convertToBlob) {
      const blob = await canvas.convertToBlob()
      const url = URL.createObjectURL(blob)
      const texture = await PIXI.Assets.load({
        src: url,
        // format: 'png',
        loadParser: 'loadTextures',
      })

      texture.source.scaleMode = PIXI.SCALE_MODES.NEAREST

      // Clean up the URL when the texture is loaded
      texture.source.once('loaded', () => {
        URL.revokeObjectURL(url)
      })
      
      return texture
    } 
    // Fallback for browsers without convertToBlob
    else {
      return new Promise((resolve) => {
        canvas.toBlob(async (blob) => {
          const url = URL.createObjectURL(blob)
          const texture = await PIXI.Assets.load({
            src: url,
            // format: 'png',
            loadParser: 'loadTextures',
          })
          
          texture.source.scaleMode = PIXI.SCALE_MODES.NEAREST

          texture.source.once('loaded', () => {
            URL.revokeObjectURL(url)
          })
          
          resolve(texture)
        })
      })
    }
  }
  
  /**
   * Setup all event listeners for UI interaction
   */
  function setupEventListeners() {
    // Debug button toggle
    document.getElementById('debugButton').addEventListener('click', () => {
      toggleDebug()
    })
  
    // Start game on "Random Map" click
    document.getElementById('generated').addEventListener('click', () => {
      gameState.gameStatus = 'initialize'
    })
  
    // Keyboard shortcuts
    window.addEventListener('keypress', (event) => {
      event.preventDefault()
      switch(event.key) {
        case 'd':
          toggleDebug()
          break
      }
    })
    
    // Handle mouse interactions with Pixi
    // app.canvas.addEventListener('pointermove', (e) => {
    //   if (mouse) {
    //     // Convert client coordinates to canvas coordinates
    //     const rect = app.canvas.getBoundingClientRect()
    //     const canvasX = e.clientX - rect.left
    //     const canvasY = e.clientY - rect.top
        
    //     // Update mouse position
    //     if (mouse.updatePosition) {
    //       mouse.updatePosition(canvasX, canvasY)
    //     }
    //   }
    // })
  }
  
  /**
   * Handle mouse interactions with the game
   * @param {Array} map - Game map
   * @param {Object} player - Player object
   */
  function handleMouseInteraction(map, player) {
    // Handle mouse click to create units
    if (mouse?.clicked) {
      mouse.clicked = false
      console.log('clicked', mouse.x, mouse.y, mouse.worldX, mouse.worldY)
      if (map[mouse.x] && map[mouse.x][mouse.y]?.weight < 10) {
        player.addWorker(mouse.x, mouse.y, map)
      }
    }
  
    // Handle zoom changes
    if (mouse?.zoomChanged) {
      updateZoom(mouse)
      drawBack()
      mouse.zoomChanged = false
    }
    
    // // Update cursor position
    // if (cursorSprite && mouse) {
    //   cursorSprite.position.set(mouse.xPixels * (globalThis.devicePixelRatio || 1) - mouse.sprite.width, mouse.yPixels * (globalThis.devicePixelRatio || 1) - mouse.sprite.height)
    //   cursorSprite.scale.set(1, 1);
    // }
  }
  
  function updateCursor() {
    // Only update if cursor sprite and mouse exist
    if (cursorSprite && mouse) {
      cursorSprite.position.set(
        mouse.xPixels * (window.devicePixelRatio || 1) - mouse.sprite.width,
        mouse.yPixels * (window.devicePixelRatio || 1) - mouse.sprite.height
      );
    }
    
    // Continue the cursor update loop
    cursorUpdateRafId = requestAnimationFrame(updateCursor);
  }

  /**
   * Update UI elements
   * @param {Array} fps - FPS history array
   */
  function updateUI(fps) {
    const now = performance.now()
  
    // Only update UI when necessary
    if ((DEBUG() && now - elapsedUI > 200)) {
      drawUI(fps)
      elapsedUI = now
    }
  }
  
  /**
   * Draw UI elements
   * @param {Array} fps - FPS history array
   */
  function drawUI(fps) {
    // Update debug stats text
    if (DEBUG()) {
      const currentFps = (1000 * fps.length / fps.reduce((res, curr) => res + curr, 0)).toFixed(1)
      const unitsCount = gameState.humanPlayer.getUnits().length
      const aiUnitsCount = gameState.aiPlayers.reduce((sum, ai) => sum + ai.getUnits().length, 0)
      const viewTransform = mouse.getViewTransform()
      
      statsText.text = [
        `FPS: ${currentFps} | DPR: ${globalThis.devicePixelRatio || 1}`,
        `Mouse: ${mouse.x}x${mouse.y}${mouse.isDragging ? ' | clic' : ''}`,
        `World: (${mouse.worldX.toFixed(0)}, ${mouse.worldY.toFixed(0)})`,
        `Zoom: ${viewTransform.scale.toFixed(2)}x`,
        `Game Status: ${gameState.gameStatus}`,
        `Units: ${unitsCount} human, ${aiUnitsCount} AI`
      ].join('\n')
      
      // Also update HTML stats for legacy support
      document.getElementById('stats').innerHTML = null
      
      let div = document.createElement('div')
      div.innerHTML = `FPS: ${currentFps}`
      document.getElementById('stats').appendChild(div)
      
      div = document.createElement('div')
      div.innerHTML = `Mouse: ${mouse.x}x${mouse.y}${mouse.isDragging ? ' | clic' : ''}`
      document.getElementById('stats').appendChild(div)

      div = document.createElement('div')
      div.innerHTML = `World: (${mouse.worldX.toFixed(0)}, ${mouse.worldY.toFixed(0)})`
      document.getElementById('stats').appendChild(div)

      div = document.createElement('div')
      div.innerHTML = `Zoom: ${viewTransform.scale.toFixed(2)}x`
      document.getElementById('stats').appendChild(div)
      
      div = document.createElement('div')
      div.innerHTML = `Game Status: ${gameState.gameStatus}`
      document.getElementById('stats').appendChild(div)
      
      div = document.createElement('div')
      div.innerHTML = `Units: ${unitsCount} human, ${aiUnitsCount} AI`
      document.getElementById('stats').appendChild(div)
    }
  }

const showDebugMessage = async (message) => {
  const debugElement = document.createElement('div')
  debugElement.style.position = 'absolute'
  debugElement.style.bottom = '40px'
  debugElement.style.right = '40px'
  debugElement.style.backgroundColor = 'rgba(0,0,0,0.7)'
  debugElement.style.color = 'white'
  debugElement.style.padding = '5px'
  debugElement.style.zIndex = '1000'
  debugElement.textContent = message
  document.body.appendChild(debugElement)
  
  setTimeout(() => {
      document.body.removeChild(debugElement)
  }, 3000)
}