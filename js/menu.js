export { initHomeMenu }

'use strict'

import gameState from 'state'
import CONSTANTS from 'constants'
import { playClickSound, playCloseSound, playConfirmSound } from 'audio'
import { setupEventListeners } from 'ui'


// Initialize all menu functions
async function initHomeMenu() {
  setupScenariiSection()
  setupAboutSection()
  setupOptionsSection()

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

// Function to handle the Scenarii section modal
async function setupScenariiSection() {
  // Get DOM elements
  const scenariiButton = document.getElementById('scenarii')
  const scenariiSection = document.getElementById('scenariiSection')
  const closeButton = scenariiSection.querySelector('.close')
  const closeScenariiButton = document.getElementById('closeScenarii')
  const scenariiList = document.getElementById('scenarii-list')
  
  // Load predefined maps from seeds.json
  let predefinedMaps = []
  try {
      const response = await fetch('maps/seeds.json')
      if (response.ok) {
          const data = await response.json()
          predefinedMaps = data.interesting_seeds || []
      }
  } catch (error) {
      console.error('Error loading predefined maps:', error)
  }
  
  // Function to open the modal
  const openScenariiModal = () => {
    playClickSound()
    // Clear existing items
    scenariiList.innerHTML = ''
    
    // Add predefined map items
    if (predefinedMaps.length > 0) {
        predefinedMaps.forEach(map => {
            const item = document.createElement('div')
            item.className = 'scenarii-item'
            item.innerHTML = `
                <h3>${map.name}</h3>
                <p>Seed: ${map.seed}</p>
                <button class="play-button" data-seed="${map.seed}">Play</button>
            `
            scenariiList.appendChild(item)
        })
        
        // Add event listeners to play buttons
        const playButtons = scenariiList.querySelectorAll('.play-button')
        playButtons.forEach(button => {
            button.addEventListener('click', () => {
                playConfirmSound()
                // Set map seed
                const seed = parseInt(button.dataset.seed, 10)
                gameState.mapSeed = seed
                // Start game
                gameState.gameStatus = 'initialize'
                // Close modal
                closeScenariiModal()
            })
        })
    } else {
        // Show message if no maps found
        scenariiList.innerHTML = '<p>No predefined scenarios available</p>'
    }
    
    scenariiSection.style.display = 'block'
    // Slight delay to ensure the display change registers before adding the show class
    setTimeout(() => {
        scenariiSection.classList.add('show')
    }, 20)
  }
  
  // Function to close the modal
  const closeScenariiModal = () => {
    playCloseSound()
    scenariiSection.classList.remove('show')
    // Wait for transition to complete before hiding
    setTimeout(() => {
        scenariiSection.style.display = 'none'
    }, 600) // Same as transition time
  }
  
  // Add event listeners
  scenariiButton.addEventListener('click', openScenariiModal)
  closeButton.addEventListener('click', closeScenariiModal)
  closeScenariiButton.addEventListener('click', closeScenariiModal)
  
  // Close the modal if the user clicks outside of it
  window.addEventListener('click', (event) => {
      if (event.target === scenariiSection) {
          closeScenariiModal()
      }
  })
  
  // Escape key also closes the modal
  window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && scenariiSection.classList.contains('show')) {
          closeScenariiModal()
      }
  })
}

// Function to handle the Options section modal
async function setupOptionsSection() {
  // Get DOM elements
  const optionsButton = document.getElementById('options')
  const optionsSection = document.getElementById('optionsSection')
  const closeButton = optionsSection.querySelector('.close')
  const saveOptionsButton = document.getElementById('saveOptions')
  const closeOptionsButton = document.getElementById('closeOptions')
  const fogToggle = document.getElementById('fogToggle')
  const debugToggle = document.getElementById('debugToggle')
  const sfxVolumeSlider = document.getElementById('sfxVolumeSlider')
  const musicVolumeSlider = document.getElementById('musicVolumeSlider')
  const healthBarsToggle = document.getElementById('healthBarsToggle')
  
  // Get difficulty and map size buttons
  const difficultyButtons = optionsSection.querySelectorAll('.option-btn[data-difficulty]')
  const mapSizeButtons = optionsSection.querySelectorAll('.option-btn[data-map-size]')
  const gameSpeedButtons = optionsSection.querySelectorAll('.option-btn[data-game-speed]')
  
  // Function to update selected button in a group
  const updateSelection = (buttons, value, datasetKey) => {
    playClickSound()
    buttons.forEach(button => {
        if (button.dataset[datasetKey] === value) {
            button.classList.add('selected')
        } else {
            button.classList.remove('selected')
        }
    })
  }
  
  // Function to open the modal
  const openOptionsModal = () => {
    playClickSound()

    // Set current values based on game settings
    debugToggle.checked = gameState.debug
    healthBarsToggle.checked = gameState.showHealthBars

    // Set fog of war toggle
    fogToggle.checked = gameState.settings?.fogOfWar !== false
    
    // Update difficulty selection (default to "medium" if not set)
    const currentDifficulty = gameState.settings?.difficulty || 'medium'
    updateSelection(difficultyButtons, currentDifficulty, 'difficulty')
    
    // Update map size selection (default to "medium" if not set)
    const currentMapSize = gameState.settings?.mapSize || 'medium'
    updateSelection(mapSizeButtons, currentMapSize, 'mapSize')

    // Update game speed selection (default to "normal" if not set)
    const currentGameSpeed = Object.keys(CONSTANTS.GAME_SPEED_MULTIPLIERS).find(key => CONSTANTS.GAME_SPEED_MULTIPLIERS[key] === gameState.settings?.gameSpeedMultiplier)?.toLowerCase() || 'normal'
    updateSelection(gameSpeedButtons, currentGameSpeed, 'gameSpeed')

    // Update SFX volume
    sfxVolumeSlider.value = gameState.settings?.sfxVolume || 0.75

    // Update Music volume
    musicVolumeSlider.value = gameState.settings?.musicVolume || 0.5
    
    optionsSection.style.display = 'block'
    // Slight delay to ensure the display change registers before adding the show class
    setTimeout(() => {
        optionsSection.classList.add('show')
    }, 20)
  }
  
  // Function to close the modal
  const closeOptionsModal = () => {
    playCloseSound()

    optionsSection.classList.remove('show')
    // Wait for transition to complete before hiding
    setTimeout(() => {
        optionsSection.style.display = 'none'
    }, 600) // Same as transition time
  }
  
  // Function to save options
  const saveOptions = () => {
      // Get selected difficulty
      const selectedDifficulty = optionsSection.querySelector('.option-btn[data-difficulty].selected')?.dataset.difficulty || 'medium'
      
      // Get selected map size
      const selectedMapSize = optionsSection.querySelector('.option-btn[data-map-size].selected')?.dataset.mapSize || 'medium'
      
      // Get fog of war toggle state
      const fogOfWarEnabled = document.getElementById('fogToggle').checked

      // Get SFX volume
      const sfxVolume = document.getElementById('sfxVolumeSlider').value

      // Get Music volume
      const musicVolume = document.getElementById('musicVolumeSlider').value

      // Get selected game speed
      const selectedGameSpeed = optionsSection.querySelector('.option-btn[data-game-speed].selected')?.dataset.gameSpeed || 'normal'

      // Get health bars toggle state
      const showHealthBars = document.getElementById('healthBarsToggle').checked

      // Update game settings
      gameState.updateSettings({
          difficulty: selectedDifficulty,
          mapSize: selectedMapSize,
          fogOfWar: fogOfWarEnabled,
          sfxVolume: sfxVolume,
          musicVolume: musicVolume,
          gameSpeedMultiplier: CONSTANTS.GAME_SPEED_MULTIPLIERS[selectedGameSpeed.toUpperCase()],
          showHealthBars: showHealthBars
      })
      
      // Update debug mode
      gameState.debug = debugToggle.checked
      
      closeOptionsModal()
  }
  
  // Add click handlers for difficulty buttons
  difficultyButtons.forEach(button => {
      button.addEventListener('click', () => {
          updateSelection(difficultyButtons, button.dataset.difficulty, 'difficulty')
      })
  })
  
  // Add click handlers for map size buttons
  mapSizeButtons.forEach(button => {
      button.addEventListener('click', () => {
          updateSelection(mapSizeButtons, button.dataset.mapSize, 'mapSize')
      })
  })

  // Add click handlers for game speed buttons
  gameSpeedButtons.forEach(button => {
      button.addEventListener('click', () => {
          updateSelection(gameSpeedButtons, button.dataset.gameSpeed, 'gameSpeed')
      })
  })
  
  // Add event listeners
  optionsButton.addEventListener('click', openOptionsModal)
  closeButton.addEventListener('click', closeOptionsModal)
  closeOptionsButton.addEventListener('click', closeOptionsModal)
  saveOptionsButton.addEventListener('click', saveOptions)

  fogToggle.addEventListener('change', playClickSound)
  debugToggle.addEventListener('change', playClickSound)
  sfxVolumeSlider.addEventListener('change', playClickSound)
  musicVolumeSlider.addEventListener('change', playClickSound)
  healthBarsToggle.addEventListener('change', playClickSound)
  
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

// Function to handle the About section modal
async function setupAboutSection() {
  // Get DOM elements
  const aboutButton = document.getElementById('about')
  const aboutSection = document.getElementById('aboutSection')
  const closeButton = aboutSection.querySelector('.close')
  const closeAboutButton = document.getElementById('closeAbout')
  const versionInfoElement = aboutSection.querySelector('.version-info p')

  // Pre-fetch the game version
  const gameVersion = await fetchGameVersion()
  
  // Function to open the modal
  const openAboutModal = () => {
    playClickSound()

    // Update version info in the modal
    versionInfoElement.textContent = `Version ${gameVersion}`

    aboutSection.style.display = 'block'
    // Slight delay to ensure the display change registers before adding the show class
    setTimeout(() => {
      aboutSection.classList.add('show')
    }, 20)
  }
  
  // Function to close the modal
  const closeAboutModal = () => {
    playCloseSound()

    aboutSection.classList.remove('show')
    // Wait for transition to complete before hiding
    setTimeout(() => {
      aboutSection.style.display = 'none'
    }, 600) // Same as transition time
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