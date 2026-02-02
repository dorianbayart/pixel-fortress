export { initHomeMenu }

'use strict'

import gameState from 'state'
import CONSTANTS from 'constants'
import { playClickSound, playCloseSound, playConfirmSound } from 'audio'
import { setupEventListeners } from 'ui'
import { getPredefinedMaps } from 'maps'
import { renderCustomMapPreview, generateMapPreviewFromSeed } from 'map-preview'


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

  // Typewriter effect for the game title
  const gameNameElement = document.getElementById('gameName')
  const originalTitle = gameNameElement.textContent
  gameNameElement.textContent = '' // Clear title for typewriter effect

  // Add a class for the blinking caret
  gameNameElement.classList.add('typewriter-caret')

  let delay = 500
  const typingSpeed = 200
  setTimeout(() => typewriterEffect(gameNameElement, 'Welcome', typingSpeed), delay)
  delay += typingSpeed * 'Welcome'.length + 1000
  setTimeout(() => typewriterEffect(gameNameElement, 'to', typingSpeed), delay)
  delay += typingSpeed * 'to'.length + 1000
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

// Game mode descriptions
const gameModeDescriptions = {
  'classic': 'Standard gameplay with balanced combat and gathering.',
  'one-shot': 'Every unit and building has exactly one life point. Any damage is fatal.',
  'turbo-gathering': 'All resource gatherers work at significantly increased speed.',
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
      predefinedMapsList.innerHTML = '<p style="opacity: 0.7; text-align: center;">No predefined maps available</p>'
      return
    }

    // Build the list HTML
    let html = '<div style="display: grid; gap: 10px;">'

    maps.forEach((map, index) => {
      // Create a difficulty badge
      const difficultyColors = {
        easy: '#228b22',
        medium: '#ffa500',
        hard: '#dc143c'
      }
      const difficultyColor = difficultyColors[map.difficulty] || '#808080'

      // Create a size badge
      const sizeBadge = map.size ? `<span style="background: rgba(255, 215, 0, 0.3); padding: 2px 6px; border-radius: 3px; font-size: 0.85em;">${map.size}</span>` : ''

      html += `
        <div class="predefined-map-item" data-map-id="${map.id}" data-map-index="${index}" style="
          display: flex;
          gap: 12px;
          padding: 12px;
          background: rgba(34, 139, 34, 0.2);
          border: 2px solid rgba(255, 215, 0, 0.3);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease-in-out;
        ">
          <div style="flex-shrink: 0;">
            <canvas
              class="map-preview-canvas"
              data-map-id="${map.id}"
              style="
                width: 80px;
                height: 80px;
                background: rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(255, 215, 0, 0.3);
                border-radius: 4px;
                image-rendering: pixelated;
                image-rendering: crisp-edges;
              "
            ></canvas>
          </div>
          <div style="flex-grow: 1; min-width: 0;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 6px;">
              <h4 style="margin: 0; font-size: 1.1em;">${map.name}</h4>
              <span style="background: ${difficultyColor}; padding: 2px 8px; border-radius: 3px; font-size: 0.85em; font-weight: bold;">${map.difficulty}</span>
            </div>
            <p style="margin: 4px 0; font-size: 0.9em; opacity: 0.85;">${map.description || ''}</p>
            <div style="display: flex; gap: 8px; margin-top: 6px; font-size: 0.85em;">
              <span style="background: rgba(0, 0, 0, 0.3); padding: 2px 6px; border-radius: 3px;">${map.type}</span>
              ${sizeBadge}
              <span style="opacity: 0.7; font-family: monospace; font-size: 0.8em;">${map.id}</span>
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
      item.addEventListener('mouseenter', () => {
        item.style.background = 'rgba(34, 139, 34, 0.4)'
        item.style.borderColor = 'rgba(255, 215, 0, 0.6)'
        item.style.transform = 'translateY(-2px)'
      })

      item.addEventListener('mouseleave', () => {
        item.style.background = 'rgba(34, 139, 34, 0.2)'
        item.style.borderColor = 'rgba(255, 215, 0, 0.3)'
        item.style.transform = 'translateY(0)'
      })

      item.addEventListener('click', () => {
        playClickSound()
        const mapId = item.dataset.mapId
        mapIdInput.value = mapId

        // Highlight selected map
        mapItems.forEach(mi => {
          mi.style.borderColor = 'rgba(255, 215, 0, 0.3)'
          mi.style.boxShadow = 'none'
        })
        item.style.borderColor = '#ffd700'
        item.style.boxShadow = '0 0 10px rgba(255, 215, 0, 0.5)'
      })
    })

  } catch (error) {
    console.error('Error rendering predefined maps:', error)
    predefinedMapsList.innerHTML = '<p style="color: #dc143c; text-align: center;">Error loading maps</p>'
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

  // Set current values based on game settings or defaults
  updateSelection(mapSizeButtons, gameState.settings?.mapSize || 'medium', 'mapSize')
  updateSelection(aiCountButtons, gameState.settings?.aiCount || 1, 'aiCount')
  updateSelection(difficultyButtons, gameState.settings?.difficulty || 'medium', 'difficulty')
  updateSelection(gameSpeedButtons, Object.keys(CONSTANTS.GAME_SPEED_MULTIPLIERS).find(key => CONSTANTS.GAME_SPEED_MULTIPLIERS[key] === gameState.settings?.gameSpeedMultiplier)?.toLowerCase() || 'normal', 'gameSpeed')
  const currentGameMode = gameState.settings?.gameMode || 'classic'
  updateSelection(gameModeButtons, currentGameMode, 'gameMode')
  // Update game mode description
  if (gameModeDescription && gameModeDescriptions[currentGameMode]) {
    gameModeDescription.textContent = gameModeDescriptions[currentGameMode]
  }
  skirmishFogToggle.checked = gameState.settings?.fogOfWar !== false

  // Set map ID input (empty or show current custom map ID)
  mapIdInput.value = gameState.customMapId || ''

  // Set seed input (empty for random, or show current seed if exists)
  mapSeedInput.value = gameState.mapSeed || ''

  // Load and render predefined maps list
  await renderPredefinedMapsList()

  // Switch to appropriate tab based on current state
  if (gameState.mapSeed) {
    switchTab('randomMap')
  } else {
    switchTab('predefinedMap')
  }

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
          if (gameModeDescription && gameModeDescriptions[mode]) {
            gameModeDescription.textContent = gameModeDescriptions[mode]
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
  const saveOptions = () => {
    playConfirmSound()

    const debugModeEnabled = debugToggle.checked
    const showHealthBarsEnabled = healthBarsToggle.checked
    const fullscreenEnabled = fullscreenToggle.checked
    const antialiasingEnabled = antialiasingToggle.checked
    const fpsCap = parseInt(fpsCapSelect.value)
    const sfxVolume = parseFloat(sfxVolumeSlider.value)
    const musicVolume = parseFloat(musicVolumeSlider.value)

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

