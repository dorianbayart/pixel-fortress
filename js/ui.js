export {
    handleMouseInteraction, initUI, mouse, setupEventListeners, updateUI
}
  
'use strict'
  
import { ZOOM } from 'game'
import { DEBUG, drawBack, toggleDebug } from 'globals'
import * as PIXI from 'pixijs'
import { app, containers, updateZoom } from 'renderer'
import gameState from 'state'
  
  // Mouse object (will be initialized in initUI)
  let mouse = null
  let elapsedUI = -5000
  
  // UI elements
  let cursorSprite = null
  let statsText = null
  
  /**
   * Initialize UI components
   * @param {Object} mouseInstance - Mouse controller instance
   */
  async function initUI(mouseInstance) {
    mouse = mouseInstance
    setupEventListeners()
    
    // Create cursor sprite
    if (mouse.sprite) {
      const cursorTexture = await createTextureFromOffscreenCanvas(mouse.sprite)
      cursorSprite = new PIXI.Sprite(cursorTexture)
      cursorSprite.pivot.set(4.5, 4.5) // Center the cursor
      containers.ui.addChild(cursorSprite)
    }
    
    // Create debug stats text
    statsText = new PIXI.Text('', {
      fontFamily: 'monospace',
      fontSize: 12,
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

      // Clean up the URL when the texture is loaded
      texture.baseTexture.once('loaded', () => {
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
          
          texture.baseTexture.once('loaded', () => {
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
      gameState.gameStatus = 'playing'
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
    app.view.addEventListener('pointermove', (e) => {
      if (mouse) {
        // Convert client coordinates to canvas coordinates
        const rect = app.view.getBoundingClientRect()
        const canvasX = e.clientX - rect.left
        const canvasY = e.clientY - rect.top
        
        // Update mouse position
        if (mouse.updatePosition) {
          mouse.updatePosition(canvasX, canvasY)
        }
      }
    })
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
      if (map[mouse.x] && map[mouse.x][mouse.y]?.weight < 10) {
        player.addWorker(mouse.x, mouse.y, map)
      }
    }
  
    // Handle zoom changes
    if (mouse?.zoomChanged) {
      updateZoom(mouse)
      drawBack()
      mouse.zoomChanged = false
      ZOOM.current = mouse.scaleFactor
    }
    
    // Update cursor position
    if (cursorSprite && mouse) {
      cursorSprite.position.set(mouse.xPixels, mouse.yPixels)
    }
  }
  
  /**
   * Update UI elements
   * @param {Array} fps - FPS history array
   */
  function updateUI(fps) {
    const now = performance.now()
  
    // Only update UI when necessary
    if (mouse?.needUpdate || (DEBUG() && now - elapsedUI > 500)) {
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
      
      statsText.text = [
        `FPS: ${currentFps}`,
        `Mouse: ${mouse.x}x${mouse.y}${mouse.isDragging ? ' | clic' : ''}`,
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
      div.innerHTML = `Game Status: ${gameState.gameStatus}`
      document.getElementById('stats').appendChild(div)
      
      div = document.createElement('div')
      div.innerHTML = `Units: ${unitsCount} human, ${aiUnitsCount} AI`
      document.getElementById('stats').appendChild(div)
    }
  
    // Reset mouse update flag
    if (mouse) mouse.needUpdate = false
  }