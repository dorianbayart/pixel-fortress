export { handleMouseInteraction, initUI, mouse, setupEventListeners, updateUI }
  
'use strict'
  
import { ZOOM } from 'game'
import { DEBUG, drawBack, toggleDebug } from 'globals'
import { canvases, updateZoom } from 'renderer'
import gameState from 'state'
  
// Mouse object (will be initialized in initUI)
let mouse = null;
let elapsedUI = -5000;

// Initialize UI components
async function initUI(mouseInstance) {
  mouse = mouseInstance;
  setupEventListeners();
  
  // Subscribe to state changes
  gameState.events.on('debug-changed', (value) => {
    if (!value) {
      document.getElementById('stats').innerHTML = null;
    }
    drawBack();
  });
  
  gameState.events.on('game-status-changed', (status) => {
    if (status === 'playing') {
      document.getElementById('homeMenu').style.opacity = 0;
      setTimeout(() => {
        document.getElementById('homeMenu').style.display = 'none';
      }, 750);
    }
  });
}

// Setup all event listeners for UI interaction
function setupEventListeners() {
  // Debug button toggle
  document.getElementById('debugButton').addEventListener('click', () => {
    toggleDebug();
  });

  // Start game on "Random Map" click
  document.getElementById('generated').addEventListener('click', () => {
    gameState.gameStatus = 'playing';
  });

  // Keyboard shortcuts
  window.addEventListener('keypress', (event) => {
    event.preventDefault();
    switch(event.key) {
      case 'd':
        toggleDebug();
        break;
    }
  });
}

// Handle mouse interactions with the game
function handleMouseInteraction(map, player) {
  // Handle mouse click to create units
  if (mouse?.clicked) {
    mouse.clicked = false;
    if (map[mouse.x] && map[mouse.x][mouse.y]?.weight < 10) {
      player.addWorker(mouse.x, mouse.y, map);
    }
  }

  // Handle zoom changes
  if (mouse?.zoomChanged) {
    updateZoom(mouse);
    drawBack();
    mouse.zoomChanged = false;
    ZOOM.current = mouse.scaleFactor;
  }
}

// Update UI elements
function updateUI(fps) {
  const now = performance.now();

  // Only update UI when necessary
  if (mouse?.needUpdate || (DEBUG() && now - elapsedUI > 500)) {
    drawUI(fps);
    elapsedUI = now;
  }
}

// Draw UI elements
function drawUI(fps) {
  // Clear the UI canvas
  canvases.offCtx1.clearRect(0, 0, canvases.uiCanvas.width, canvases.uiCanvas.height);
  
  // Draw mouse cursor
  if (mouse && mouse.sprite) {
    canvases.offCtx1.drawImage(mouse.sprite, mouse.xPixels - 9/2, mouse.yPixels - 9/2);
  }
  
  // Copy to the UI canvas
  canvases.uiCtx.clearRect(0, 0, canvases.uiCanvas.width, canvases.uiCanvas.height);
  canvases.uiCtx.drawImage(canvases.offCanvas1, 0, 0, canvases.uiCanvas.width, canvases.uiCanvas.height);

  // Display debug information
  if (DEBUG()) {
    document.getElementById('stats').innerHTML = null;
    
    let div = document.createElement('div');
    div.innerHTML = `FPS: ${(1000 * fps.length / fps.reduce((res, curr) => res + curr, 0)).toFixed(1)}`;
    document.getElementById('stats').appendChild(div);
    
    div = document.createElement('div');
    div.innerHTML = `Mouse: ${mouse.x}x${mouse.y}${mouse.isDragging ? ' | clic' : ''}`;
    document.getElementById('stats').appendChild(div);
    
    div = document.createElement('div');
    div.innerHTML = `Game Status: ${gameState.gameStatus}`;
    document.getElementById('stats').appendChild(div);
    
    div = document.createElement('div');
    div.innerHTML = `Units: ${gameState.humanPlayer.getUnits().length} human, ${gameState.aiPlayers.reduce((sum, ai) => sum + ai.getUnits().length, 0)} AI`;
    document.getElementById('stats').appendChild(div);
  }

  // Reset mouse update flag
  if (mouse) mouse.needUpdate = false;
}