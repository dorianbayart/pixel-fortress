export { initHomeMenu }

'use strict'

import gameState from 'state'
import CONSTANTS from 'constants'
import { playClickSound, playCloseSound, playConfirmSound } from 'audio'
import { setupEventListeners } from 'ui'


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

// Get option buttons
const mapSizeButtons = skirmishSetupSection.querySelectorAll('.option-btn[data-map-size]')
const aiCountButtons = skirmishSetupSection.querySelectorAll('.option-btn[data-ai-count]')
const difficultyButtons = skirmishSetupSection.querySelectorAll('.option-btn[data-difficulty]')
const gameSpeedButtons = skirmishSetupSection.querySelectorAll('.option-btn[data-game-speed]')

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

// Function to open the Skirmish Setup modal
const openSkirmishSetupModal = () => {
  playClickSound()

  // Set current values based on game settings or defaults
  updateSelection(mapSizeButtons, gameState.settings?.mapSize || 'medium', 'mapSize')
  updateSelection(aiCountButtons, gameState.settings?.aiCount || 1, 'aiCount')
  updateSelection(difficultyButtons, gameState.settings?.difficulty || 'medium', 'difficulty')
  updateSelection(gameSpeedButtons, Object.keys(CONSTANTS.GAME_SPEED_MULTIPLIERS).find(key => CONSTANTS.GAME_SPEED_MULTIPLIERS[key] === gameState.settings?.gameSpeedMultiplier)?.toLowerCase() || 'normal', 'gameSpeed')
  skirmishFogToggle.checked = gameState.settings?.fogOfWar !== false

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
  const fogOfWarEnabled = skirmishFogToggle.checked

  gameState.updateSettings({
      mapSize: selectedMapSize,
      aiCount: selectedAiCount,
      difficulty: selectedDifficulty,
      gameSpeedMultiplier: CONSTANTS.GAME_SPEED_MULTIPLIERS[selectedGameSpeed.toUpperCase()],
      fogOfWar: fogOfWarEnabled,
  })

  gameState.gameStatus = 'initialize'
  document.getElementById('homeMenu').style.display = 'none'
  closeSkirmishSetupModal()
}

async function setupSkirmishSection() {
  // Add event listeners
  closeSkirmishSetupModalButton.addEventListener('click', closeSkirmishSetupModal)
  closeSkirmishSetupButton.addEventListener('click', closeSkirmishSetupModal)
  startSkirmishGameButton.addEventListener('click', startSkirmishGame)
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
  const sfxVolumeSlider = document.getElementById('sfxVolumeSlider')
  const musicVolumeSlider = document.getElementById('musicVolumeSlider')

  // Function to open the modal
  const openOptionsModal = () => {
    playClickSound()

    // Set current values based on game settings or defaults
    debugToggle.checked = gameState.settings?.debugMode === true
    healthBarsToggle.checked = gameState.settings?.showHealthBars === true
    sfxVolumeSlider.value = gameState.settings?.sfxVolume ?? 0.8
    musicVolumeSlider.value = gameState.settings?.musicVolume ?? 0.5

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
    const sfxVolume = parseFloat(sfxVolumeSlider.value)
    const musicVolume = parseFloat(musicVolumeSlider.value)

    gameState.updateSettings({
        debugMode: debugModeEnabled,
        showHealthBars: showHealthBarsEnabled,
        sfxVolume: sfxVolume,
        musicVolume: musicVolume,
    })

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

