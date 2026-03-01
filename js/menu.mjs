export { initHomeMenu }

'use strict'

import gameState from 'state'
import CONSTANTS from 'constants'
import { playClickSound, playCloseSound, playConfirmSound } from 'audio'
import { t, setLanguage, getLanguage, getSupportedLanguages } from 'i18n'
import { setupEventListeners } from 'ui'
import { getPredefinedMaps } from 'maps'
import { renderCustomMapPreview, generateMapPreviewFromSeed } from 'map-preview'

/**
 * Apply translations to all elements with data-i18n attributes
 */
function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n)
  })
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder)
  })
}


// Function to simulate a typewriter effect
function typewriterEffect(element, text, delay = 200) {
  let i = 0
  element.textContent = '' // Clear existing text
  element.style.opacity = 1 // Make sure the element is visible

  return new Promise(resolve => {
    function type() {
      if (i < text.length) {
        element.textContent += text.charAt(i)
        i++
        setTimeout(type, delay)
      } else {
        resolve() // Resolve the promise when typing is complete
      }
    }
    type()
  })
}

// Initialize all menu functions
async function initHomeMenu() {
  setupAboutSection()
  setupOptionsSection()
  setupSkirmishSection()

  showMainMenu()

  // Apply translations to all static elements
  applyI18n()

  // Re-apply translations when language changes
  gameState.events.on('language-changed', () => {
    applyI18n()
  })

  // Typewriter effect for the game title
  const gameNameElement = document.getElementById('gameName')
  const originalTitle = gameNameElement.textContent
  gameNameElement.textContent = '' // Clear title for typewriter effect

  // Add a class for the blinking caret
  gameNameElement.classList.add('typewriter-caret')

  const welcomeWord = t('menu.welcome')
  const toWord = t('menu.to')
  let delay = 500
  const typingSpeed = 200
  setTimeout(() => typewriterEffect(gameNameElement, welcomeWord, typingSpeed), delay)
  delay += typingSpeed * welcomeWord.length + 1000
  setTimeout(() => typewriterEffect(gameNameElement, toWord, typingSpeed), delay)
  delay += typingSpeed * toWord.length + 1000
  setTimeout(() => typewriterEffect(gameNameElement, originalTitle, typingSpeed), delay)
  delay += typingSpeed * originalTitle.length + 3000
  setTimeout(() => gameNameElement.classList.remove('typewriter-caret'), delay)


  setupEventListeners()
}

// Function to fetch the game version from manifest.json
async function fetchGameVersion() {
    let version = ''
    try {
        const response = await fetch('manifest.json')
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`)
        }
        const manifestData = await response.json()
        
        // Extract version from the manifest
        // If you don't have a specific version field, you can add one or use another field
        version = manifestData.version_name || manifestData.version
    } catch (error) {
        console.error('Error fetching game version:', error)
    }
    return version
}



// Function to handle the Skirmish Setup section modal
// Get DOM elements for Skirmish Setup
const skirmishSetupSection = document.getElementById('skirmishSetupSection')
const closeSkirmishSetupModalButton = skirmishSetupSection.querySelector('.close')
const startSkirmishGameButton = document.getElementById('startSkirmishGame')
const closeSkirmishSetupButton = document.getElementById('closeSkirmishSetup')
const skirmishFogToggle = document.getElementById('skirmishFogToggle')
const mapIdInput = document.getElementById('mapIdInput')
const clearMapIdButton = document.getElementById('clearMapIdButton')
const mapSeedInput = document.getElementById('mapSeedInput')
const randomSeedButton = document.getElementById('randomSeedButton')

// Get tab elements
const tabButtons = skirmishSetupSection.querySelectorAll('.tab-button')
const randomMapTab = document.getElementById('randomMapTab')
const predefinedMapTab = document.getElementById('predefinedMapTab')
const predefinedMapsList = document.getElementById('predefinedMapsList')

// Get option button containers
const mapSizeContainer = skirmishSetupSection.querySelector('#mapSizeButtons')
const aiCountButtons = skirmishSetupSection.querySelectorAll('.option-btn[data-ai-count]')
const difficultyButtons = skirmishSetupSection.querySelectorAll('.option-btn[data-difficulty]')
const gameSpeedButtons = skirmishSetupSection.querySelectorAll('.option-btn[data-game-speed]')
const gameModeButtons = skirmishSetupSection.querySelectorAll('.option-btn[data-game-mode]')
const gameModeDescription = document.getElementById('gameModeDescription')

// ---------------------------------------------------------------------------
// Hue wheel — player color picker
// ---------------------------------------------------------------------------
const hueWheelCanvas = document.getElementById('hueWheelCanvas')
const colorSwatches  = document.getElementById('colorSwatches')
let selectedHue      = gameState.settings?.playerHue ?? 180
let hueWheelDragging = false

/** Convert a hue (0–360) to a CSS hsl string, s=70%, l=50%. */
function hueToCss(hue) {
  return `hsl(${hue}, 70%, 50%)`
}

/** Convert hue (0–360) to [r, g, b] bytes at s=70%, l=50%. */
function hueToRgb(hue) {
  const s = 0.7, l = 0.5
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs((hue / 60) % 2 - 1))
  const m = l - c / 2
  let r, g, b
  if      (hue < 60)  { r = c; g = x; b = 0 }
  else if (hue < 120) { r = x; g = c; b = 0 }
  else if (hue < 180) { r = 0; g = c; b = x }
  else if (hue < 240) { r = 0; g = x; b = c }
  else if (hue < 300) { r = x; g = 0; b = c }
  else                { r = c; g = 0; b = x }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}

const HUE_STEPS = 24
const HUE_STEP  = 360 / HUE_STEPS

/** Snap a raw hue to the nearest quantised step. */
function quantiseHue(hue) {
  return Math.round(hue / HUE_STEP) % HUE_STEPS * HUE_STEP
}

/** Redraw the hue wheel canvas with the current selectedHue.
 *  Drawn at ¼ resolution then scaled up without smoothing.
 *  Colours are quantised to HUE_STEPS discrete bands. */
function drawHueWheel() {
  const canvas = hueWheelCanvas
  const ctx    = canvas.getContext('2d')
  const W  = canvas.width
  const H  = canvas.height
  const cx = W / 2
  const cy = H / 2

  ctx.clearRect(0, 0, W, H)

  const SCALE  = 4
  const sw     = Math.floor(W / SCALE)
  const sh     = Math.floor(H / SCALE)
  const scx    = (sw - 1) / 2
  const scy    = (sh - 1) / 2
  const souter = (cx - 4) / SCALE
  const sinner = (cx * 0.55) / SCALE

  const offscreen = document.createElement('canvas')
  offscreen.width  = sw
  offscreen.height = sh
  const octx = offscreen.getContext('2d')
  const imageData = octx.createImageData(sw, sh)
  const data = imageData.data

  for (let py = 0; py < sh; py++) {
    for (let px = 0; px < sw; px++) {
      const dx = px - scx
      const dy = py - scy
      const r  = Math.sqrt(dx * dx + dy * dy)
      if (r < sinner || r > souter) continue

      const rawHue = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360
      const hue    = quantiseHue(rawHue)
      const [ri, gi, bi] = hueToRgb(hue)
      const idx = (py * sw + px) * 4
      data[idx]     = ri
      data[idx + 1] = gi
      data[idx + 2] = bi
      data[idx + 3] = 255
    }
  }

  octx.putImageData(imageData, 0, 0)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(offscreen, 0, 0, W, H)

  // Pixel-snapped square handle
  const ha   = ((selectedHue - 90) * Math.PI) / 180
  const smid = (souter + sinner) / 2
  const hx   = Math.round(cx + Math.cos(ha) * smid * SCALE)
  const hy   = Math.round(cy + Math.sin(ha) * smid * SCALE)
  const [hr, hg, hb] = hueToRgb(selectedHue)
  ctx.fillStyle = `rgb(${hr},${hg},${hb})`
  ctx.fillRect(hx - SCALE, hy - SCALE, SCALE * 2, SCALE * 2)
  ctx.strokeStyle = 'white'
  ctx.lineWidth = 1
  ctx.strokeRect(hx - SCALE, hy - SCALE, SCALE * 2, SCALE * 2)
}

/** Update the color swatch row from the current selectedHue and aiCount. */
function updateColorSwatches() {
  const aiCount = parseInt(skirmishSetupSection.querySelector('.option-btn[data-ai-count].selected')?.dataset.aiCount ?? '1', 10)
  const total   = aiCount + 1
  const step    = 360 / total
  colorSwatches.innerHTML = ''

  const aiLabel = t('skirmish.ai')
  const labels = [t('skirmish.you'), ...Array.from({ length: aiCount }, (_, i) => `${aiLabel}${aiCount > 1 ? ' ' + (i + 1) : ''}`)]
  for (let i = 0; i < total; i++) {
    const hue     = (selectedHue + i * step) % 360
    const wrapper = document.createElement('div')
    wrapper.className = 'color-swatch-wrapper'

    const swatch  = document.createElement('div')
    swatch.className = 'color-swatch'
    swatch.style.background = hueToCss(hue)

    const label   = document.createElement('span')
    label.className   = 'color-swatch-label'
    label.textContent = labels[i]

    wrapper.appendChild(swatch)
    wrapper.appendChild(label)
    colorSwatches.appendChild(wrapper)
  }
}

/** Compute the hue from a pointer event on the wheel canvas. */
function hueFromPointer(event) {
  const rect = hueWheelCanvas.getBoundingClientRect()
  const scaleX = hueWheelCanvas.width  / rect.width
  const scaleY = hueWheelCanvas.height / rect.height
  const clientX = event.touches ? event.touches[0].clientX : event.clientX
  const clientY = event.touches ? event.touches[0].clientY : event.clientY
  const px    = (clientX - rect.left) * scaleX - hueWheelCanvas.width  / 2
  const py    = (clientY - rect.top)  * scaleY - hueWheelCanvas.height / 2
  const angle = (Math.atan2(py, px) * 180 / Math.PI + 90 + 360) % 360
  return angle
}

/** Check whether a pointer is inside the ring area of the wheel. */
function isOnRing(event) {
  const rect   = hueWheelCanvas.getBoundingClientRect()
  const scaleX = hueWheelCanvas.width  / rect.width
  const scaleY = hueWheelCanvas.height / rect.height
  const clientX = event.touches ? event.touches[0].clientX : event.clientX
  const clientY = event.touches ? event.touches[0].clientY : event.clientY
  const px     = (clientX - rect.left) * scaleX - hueWheelCanvas.width  / 2
  const py     = (clientY - rect.top)  * scaleY - hueWheelCanvas.height / 2
  const r      = Math.sqrt(px * px + py * py)
  const cx     = hueWheelCanvas.width / 2
  const outer  = cx - 4
  const inner  = cx * 0.55
  return r >= inner - 8 && r <= outer + 8  // small tolerance
}

function onHuePointerDown(event) {
  if (isOnRing(event)) {
    hueWheelDragging = true
    selectedHue      = quantiseHue(hueFromPointer(event))
    drawHueWheel()
    updateColorSwatches()
    event.preventDefault()
  }
}

function onHuePointerMove(event) {
  if (!hueWheelDragging) return
  selectedHue = quantiseHue(hueFromPointer(event))
  drawHueWheel()
  updateColorSwatches()
  event.preventDefault()
}

function onHuePointerUp() {
  hueWheelDragging = false
}

hueWheelCanvas.addEventListener('mousedown',  onHuePointerDown)
hueWheelCanvas.addEventListener('touchstart', onHuePointerDown, { passive: false })
window.addEventListener('mousemove',  onHuePointerMove)
window.addEventListener('touchmove',  onHuePointerMove, { passive: false })
window.addEventListener('mouseup',   onHuePointerUp)
window.addEventListener('touchend',  onHuePointerUp)

// Game mode description keys (for i18n)
const gameModeDescriptionKeys = {
  'classic': 'skirmish.modes.classicDesc',
  'one-shot': 'skirmish.modes.oneShotDesc',
  'turbo-gathering': 'skirmish.modes.turboGatheringDesc',
  'tower-defense': 'skirmish.modes.towerDefenseDesc',
}

// Get localized game mode description
function getGameModeDescription(mode) {
  const key = gameModeDescriptionKeys[mode]
  return key ? t(key) : ''
}

// Dynamically create map size buttons from constants
let mapSizeButtons = []
if (mapSizeContainer) {
  CONSTANTS.MAP_SIZES.getAll().forEach((size, index) => {
    const button = document.createElement('button')
    button.className = 'option-btn'
    button.dataset.mapSize = size.id
    button.textContent = size.label
    if (size.id === 'medium') {
      button.classList.add('selected')
    }
    mapSizeContainer.appendChild(button)
    mapSizeButtons.push(button)
  })
}

// Function to update selected button in a group (reused from options)
const updateSelection = (buttons, value, datasetKey) => {
  playClickSound()
  buttons.forEach(button => {
      if (button.dataset[datasetKey] === String(value)) {
          button.classList.add('selected')
      } else {
          button.classList.remove('selected')
      }
  })
}

// Function to render the predefined maps list
const renderPredefinedMapsList = async () => {
  try {
    const maps = await getPredefinedMaps()

    if (!maps || maps.length === 0) {
      predefinedMapsList.innerHTML = '<p class="maps-list-empty">No predefined maps available</p>'
      return
    }

    // Build the list HTML
    let html = '<div class="maps-list-grid">'

    maps.forEach((map, index) => {
      const sizeBadge = map.size ? `<span class="map-badge map-badge--size">${map.size}</span>` : ''

      html += `
        <div class="predefined-map-item" data-map-id="${map.id}" data-map-index="${index}">
          <div class="map-item-preview">
            <canvas
              class="map-preview-canvas"
              data-map-id="${map.id}"
            ></canvas>
          </div>
          <div class="map-item-info">
            <div class="map-item-header">
              <h4 class="map-item-name">${map.name}</h4>
              <span class="map-badge map-badge--difficulty map-badge--${map.difficulty}">${map.difficulty}</span>
            </div>
            <p class="map-item-description">${map.description || ''}</p>
            <div class="map-item-tags">
              <span class="map-badge map-badge--type">${map.type}</span>
              ${sizeBadge}
              <span class="map-item-id">${map.id}</span>
            </div>
          </div>
        </div>
      `
    })

    html += '</div>'
    predefinedMapsList.innerHTML = html

    // Render map previews sequentially to avoid gameState conflicts
    const canvases = predefinedMapsList.querySelectorAll('.map-preview-canvas')

    // Show loading state for all canvases first
    canvases.forEach((canvas, index) => {
      const ctx = canvas.getContext('2d')
      canvas.width = 80
      canvas.height = 80
      ctx.fillStyle = '#1a1a1a'
      ctx.fillRect(0, 0, 80, 80)
      ctx.fillStyle = '#ffffff'
      ctx.font = '10px monospace'
      ctx.textAlign = 'center'
      ctx.fillText('Loading...', 40, 40)
    })

    // Generate previews sequentially to prevent gameState race conditions
    for (let index = 0; index < canvases.length; index++) {
      const canvas = canvases[index]
      const map = maps[index]

      try {
        // Render preview based on map type
        if (map.type === 'custom') {
          await renderCustomMapPreview(canvas, map.id, 80)
        } else if (map.type === 'seed') {
          await generateMapPreviewFromSeed(canvas, map.seed, map.size || 'medium', 80)
        }
      } catch (error) {
        console.error(`Error rendering preview for ${map.name}:`, error)
        // Show error state on canvas
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#dc143c'
        ctx.font = '9px monospace'
        ctx.fillText('Error', 40, 40)
      }
    }

    // Add click handlers to map items
    const mapItems = predefinedMapsList.querySelectorAll('.predefined-map-item')
    mapItems.forEach(item => {
      item.addEventListener('click', () => {
        playClickSound()
        const mapId = item.dataset.mapId
        mapIdInput.value = mapId

        // Highlight selected map
        mapItems.forEach(mi => mi.classList.remove('selected'))
        item.classList.add('selected')
      })
    })

  } catch (error) {
    console.error('Error rendering predefined maps:', error)
    predefinedMapsList.innerHTML = '<p class="maps-list-error">Error loading maps</p>'
  }
}

// Function to switch tabs
const switchTab = (tabName) => {
  // Update tab buttons
  tabButtons.forEach(button => {
    if (button.dataset.tab === tabName) {
      button.classList.add('active')
    } else {
      button.classList.remove('active')
    }
  })

  // Update tab content
  if (tabName === 'randomMap') {
    randomMapTab.classList.add('active')
    predefinedMapTab.classList.remove('active')
  } else if (tabName === 'predefinedMap') {
    randomMapTab.classList.remove('active')
    predefinedMapTab.classList.add('active')
  }
}

// Function to open the Skirmish Setup modal
const openSkirmishSetupModal = async () => {
  playClickSound()

  // Restore saved hue and redraw wheel
  selectedHue = gameState.settings?.playerHue ?? 180
  drawHueWheel()
  updateColorSwatches()

  // Set current values based on game settings or defaults
  updateSelection(mapSizeButtons, gameState.settings?.mapSize || 'medium', 'mapSize')
  updateSelection(aiCountButtons, gameState.settings?.aiCount || 1, 'aiCount')
  updateSelection(difficultyButtons, gameState.settings?.difficulty || 'medium', 'difficulty')
  updateSelection(gameSpeedButtons, Object.keys(CONSTANTS.GAME_SPEED_MULTIPLIERS).find(key => CONSTANTS.GAME_SPEED_MULTIPLIERS[key] === gameState.settings?.gameSpeedMultiplier)?.toLowerCase() || 'normal', 'gameSpeed')
  const currentGameMode = gameState.settings?.gameMode || 'classic'
  updateSelection(gameModeButtons, currentGameMode, 'gameMode')
  // Update game mode description
  if (gameModeDescription && getGameModeDescription(currentGameMode)) {
    gameModeDescription.textContent = getGameModeDescription(currentGameMode)
  }
  skirmishFogToggle.checked = gameState.settings?.fogOfWar !== false

  // Set map ID input (empty or show current custom map ID)
  mapIdInput.value = gameState.customMapId || ''

  // Always clear seed input when opening the modal so a new random map is generated
  mapSeedInput.value = ''

  // Load and render predefined maps list
  await renderPredefinedMapsList()

  // Always default to predefined map tab when opening the modal
  switchTab('predefinedMap')

  skirmishSetupSection.style.display = 'block'
  setTimeout(() => {
      skirmishSetupSection.classList.add('show')
  }, 20)
}

// Function to close the Skirmish Setup modal
const closeSkirmishSetupModal = () => {
  playCloseSound()
  skirmishSetupSection.classList.remove('show')
  setTimeout(() => {
      skirmishSetupSection.style.display = 'none'
  }, 600)
}

// Function to start the game with selected options
const startSkirmishGame = () => {
  playConfirmSound()

  const selectedMapSize = skirmishSetupSection.querySelector('.option-btn[data-map-size].selected')?.dataset.mapSize || 'medium'
  const selectedAiCount = parseInt(skirmishSetupSection.querySelector('.option-btn[data-ai-count].selected')?.dataset.aiCount || '1', 10)
  const selectedDifficulty = skirmishSetupSection.querySelector('.option-btn[data-difficulty].selected')?.dataset.difficulty || 'medium'
  const selectedGameSpeed = skirmishSetupSection.querySelector('.option-btn[data-game-speed].selected')?.dataset.gameSpeed || 'normal'
  const selectedGameMode = skirmishSetupSection.querySelector('.option-btn[data-game-mode].selected')?.dataset.gameMode || 'classic'
  const fogOfWarEnabled = skirmishFogToggle.checked

  // Check which tab is active
  const activeTab = skirmishSetupSection.querySelector('.tab-button.active')?.dataset.tab

  let mapId = null
  let mapSeed = null

  if (activeTab === 'predefinedMap') {
    // Get map ID from predefined maps tab
    const mapIdValue = mapIdInput.value.trim()
    mapId = mapIdValue || null
  } else {
    // Get seed from random map tab (null if empty for random generation)
    const seedValue = mapSeedInput.value.trim()
    mapSeed = seedValue ? parseInt(seedValue, 10) : null
  }

  gameState.updateSettings({
      mapSize: selectedMapSize,
      aiCount: selectedAiCount,
      difficulty: selectedDifficulty,
      gameSpeedMultiplier: CONSTANTS.GAME_SPEED_MULTIPLIERS[selectedGameSpeed.toUpperCase()],
      gameMode: selectedGameMode,
      fogOfWar: fogOfWarEnabled,
      playerHue: Math.round(selectedHue),
  })

  // Set custom map ID or seed based on active tab
  gameState.customMapId = mapId
  gameState.mapSeed = mapSeed

  gameState.gameStatus = 'initialize'
  document.getElementById('homeMenu').style.display = 'none'
  closeSkirmishSetupModal()
}

async function setupSkirmishSection() {
  // Set seed input constraints from constants
  mapSeedInput.min = CONSTANTS.SEED.MIN
  mapSeedInput.max = CONSTANTS.SEED.MAX

  // Add event listeners
  closeSkirmishSetupModalButton.addEventListener('click', closeSkirmishSetupModal)
  closeSkirmishSetupButton.addEventListener('click', closeSkirmishSetupModal)
  startSkirmishGameButton.addEventListener('click', startSkirmishGame)

  // Tab switching
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      playClickSound()
      switchTab(button.dataset.tab)
    })
  })

  // Clear map ID button
  clearMapIdButton.addEventListener('click', () => {
    playClickSound()
    mapIdInput.value = ''
  })

  // Random seed button generates a random seed number
  randomSeedButton.addEventListener('click', () => {
    playClickSound()
    mapSeedInput.value = Math.floor(Math.random() * (CONSTANTS.SEED.MAX + 1))
  })

  // Play click sound when focusing inputs
  mapIdInput.addEventListener('focus', playClickSound)
  mapSeedInput.addEventListener('focus', playClickSound)

  // Escape key also closes the modal
  window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && document.getElementById('skirmishSetupSection').classList.contains('show')) {
          closeSkirmishSetupModal()
      }
  })

  // Add click handlers for option buttons
  mapSizeButtons.forEach(button => {
      button.addEventListener('click', () => {
          updateSelection(mapSizeButtons, button.dataset.mapSize, 'mapSize')
      })
  })
  aiCountButtons.forEach(button => {
      button.addEventListener('click', () => {
          updateSelection(aiCountButtons, button.dataset.aiCount, 'aiCount')
          updateColorSwatches()
      })
  })
  difficultyButtons.forEach(button => {
      button.addEventListener('click', () => {
          updateSelection(difficultyButtons, button.dataset.difficulty, 'difficulty')
      })
  })
  gameSpeedButtons.forEach(button => {
      button.addEventListener('click', () => {
          updateSelection(gameSpeedButtons, button.dataset.gameSpeed, 'gameSpeed')
      })
  })
  gameModeButtons.forEach(button => {
      button.addEventListener('click', () => {
          updateSelection(gameModeButtons, button.dataset.gameMode, 'gameMode')
          // Update description
          const mode = button.dataset.gameMode
          if (gameModeDescription && getGameModeDescription(mode)) {
            gameModeDescription.textContent = getGameModeDescription(mode)
          }
      })
  })
  skirmishFogToggle.addEventListener('change', playClickSound)

  // Close the modal if the user clicks outside of it
  window.addEventListener('click', (event) => {
      if (event.target === skirmishSetupSection) {
          closeSkirmishSetupModal()
      }
  })

  // Re-apply game mode description on language change
  gameState.events.on('language-changed', () => {
    const activeMode = skirmishSetupSection.querySelector('.option-btn[data-game-mode].selected')?.dataset.gameMode
    if (gameModeDescription && activeMode) {
      gameModeDescription.textContent = getGameModeDescription(activeMode)
    }
  })

  // Escape key also closes the modal
  window.addEventListener('keydown', (event) => {
    const optionsSection = document.getElementById('optionsSection')
    const closeOptionsModal = () => {
      playCloseSound()
      optionsSection.classList.remove('show')
      setTimeout(() => {
          optionsSection.style.display = 'none'
      }, 600)
    }
      if (event.key === 'Escape' && optionsSection.classList.contains('show')) {
          closeOptionsModal()
      }
  })
}

// Function to handle the About section modal
async function setupAboutSection() {
  const aboutButton = document.getElementById('about')
  const aboutSection = document.getElementById('aboutSection')
  const closeButton = aboutSection.querySelector('.close')
  const closeAboutButton = document.getElementById('closeAbout')
  const gameVersionElement = aboutSection.querySelector('.version-info p')

  // Function to open the modal
  const openAboutModal = async () => {
    playClickSound()
    aboutSection.style.display = 'block'
    setTimeout(() => {
      aboutSection.classList.add('show')
    }, 20)

    // Fetch and display game version
    const version = await fetchGameVersion()
    if (version) {
      gameVersionElement.textContent = `v${version}`
    }
  }

  // Function to close the modal
  const closeAboutModal = () => {
    playCloseSound()
    aboutSection.classList.remove('show')
    setTimeout(() => {
      aboutSection.style.display = 'none'
    }, 600)
  }

  // Add event listeners
  aboutButton.addEventListener('click', openAboutModal)
  closeButton.addEventListener('click', closeAboutModal)
  closeAboutButton.addEventListener('click', closeAboutModal)

  // Close the modal if the user clicks outside of it
  window.addEventListener('click', (event) => {
    if (event.target === aboutSection) {
      closeAboutModal()
    }
  })

  // Escape key also closes the modal
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && aboutSection.classList.contains('show')) {
      closeAboutModal()
    }
  })
}

// Function to handle the Options section modal
async function setupOptionsSection() {
  const optionsButton = document.getElementById('options')
  const optionsSection = document.getElementById('optionsSection')
  const closeButton = optionsSection.querySelector('.close')
  const saveOptionsButton = document.getElementById('saveOptions')
  const closeOptionsButton = document.getElementById('closeOptions')

  // Get option buttons
  const debugToggle = document.getElementById('debugToggle')
  const healthBarsToggle = document.getElementById('healthBarsToggle')
  const fullscreenToggle = document.getElementById('fullscreenToggle')
  const antialiasingToggle = document.getElementById('antialiasingToggle')
  const antialiasingStatus = document.getElementById('antialiasingStatus')
  const fpsCapSelect = document.getElementById('fpsCapSelect')
  const sfxVolumeSlider = document.getElementById('sfxVolumeSlider')
  const musicVolumeSlider = document.getElementById('musicVolumeSlider')
  const languageSelect = document.getElementById('languageSelect')

  // Function to update antialiasing status text
  const updateAntialiasingStatus = () => {
    if (antialiasingToggle.checked) {
      antialiasingStatus.textContent = '(2x resolution)'
    } else {
      antialiasingStatus.textContent = ''
    }
  }

  // Function to open the modal
  const openOptionsModal = () => {
    playClickSound()

    // Set current values based on game settings or defaults
    debugToggle.checked = gameState.settings?.debugMode === true
    healthBarsToggle.checked = gameState.settings?.showHealthBars === true
    fullscreenToggle.checked = gameState.settings?.fullscreen ?? false
    antialiasingToggle.checked = gameState.settings?.antialiasing ?? false
    fpsCapSelect.value = gameState.settings?.fpsCap ?? 0
    sfxVolumeSlider.value = gameState.settings?.sfxVolume ?? 0.8
    musicVolumeSlider.value = gameState.settings?.musicVolume ?? 0.5
    languageSelect.value = getLanguage()

    // Update status texts
    updateAntialiasingStatus()

    optionsSection.style.display = 'block'
    setTimeout(() => {
        optionsSection.classList.add('show')
    }, 20)
  }

  // Function to close the modal
  const closeOptionsModal = () => {
    playCloseSound()
    optionsSection.classList.remove('show')
    setTimeout(() => {
        optionsSection.style.display = 'none'
    }, 600)
  }

  // Function to save options
  const saveOptions = async () => {
    playConfirmSound()

    const debugModeEnabled = debugToggle.checked
    const showHealthBarsEnabled = healthBarsToggle.checked
    const fullscreenEnabled = fullscreenToggle.checked
    const antialiasingEnabled = antialiasingToggle.checked
    const fpsCap = parseInt(fpsCapSelect.value)
    const sfxVolume = parseFloat(sfxVolumeSlider.value)
    const musicVolume = parseFloat(musicVolumeSlider.value)
    const selectedLanguage = languageSelect.value

    // Apply language change if needed
    if (selectedLanguage !== getLanguage()) {
      await setLanguage(selectedLanguage)
    }

    gameState.updateSettings({
        debugMode: debugModeEnabled,
        showHealthBars: showHealthBarsEnabled,
        fullscreen: fullscreenEnabled,
        antialiasing: antialiasingEnabled,
        fpsCap: fpsCap,
        sfxVolume: sfxVolume,
        musicVolume: musicVolume,
    })

    // Apply fullscreen setting immediately
    if (fullscreenEnabled && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`)
      })
    } else if (!fullscreenEnabled && document.fullscreenElement) {
      document.exitFullscreen().catch(err => {
        console.error(`Error attempting to exit fullscreen: ${err.message}`)
      })
    }

    closeOptionsModal()
  }

  // Add event listeners
  optionsButton.addEventListener('click', openOptionsModal)
  closeButton.addEventListener('click', closeOptionsModal)
  closeOptionsButton.addEventListener('click', closeOptionsModal)
  saveOptionsButton.addEventListener('click', saveOptions)

  // Add click handlers for option buttons
  debugToggle.addEventListener('change', playClickSound)
  healthBarsToggle.addEventListener('change', playClickSound)
  fullscreenToggle.addEventListener('change', playClickSound)
  antialiasingToggle.addEventListener('change', () => {
    playClickSound()
    updateAntialiasingStatus()
  })
  fpsCapSelect.addEventListener('change', playClickSound)
  sfxVolumeSlider.addEventListener('change', playClickSound)
  musicVolumeSlider.addEventListener('change', playClickSound)

  // Close the modal if the user clicks outside of it
  window.addEventListener('click', (event) => {
      if (event.target === optionsSection) {
          closeOptionsModal()
      }
  })

  // Escape key also closes the modal
  window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && optionsSection.classList.contains('show')) {
          closeOptionsModal()
      }
  })
}

// Function to show the main menu buttons
function showMainMenu() {
  document.getElementById('mainMenuButtons').style.display = 'block'
  document.getElementById('playOptionsButtons').style.display = 'none'
  document.getElementById('playButton').addEventListener('click', showPlayOptions)
}

// Function to show the play options (Campaign, Skirmish, Back)
function showPlayOptions() {
  playClickSound()
  document.getElementById('mainMenuButtons').style.display = 'none'
  document.getElementById('playOptionsButtons').style.display = 'block'
  document.getElementById('backButton').addEventListener('click', () => {
    playCloseSound()
    showMainMenu()
  })
  document.getElementById('campaignButton').addEventListener('click', () => {
    playClickSound()
    console.log('Campaign button clicked - functionality to be implemented')
    // TODO: Implement campaign selection/start logic
  })
  document.getElementById('skirmishButton').addEventListener('click', () => {
    openSkirmishSetupModal()
  })
}

