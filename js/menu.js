export { initHomeMenu }

'use strict'


// Initialize all menu functions
async function initHomeMenu() {
    setupAboutSection()
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
      // Update version info in the modal
      versionInfoElement.textContent = `Version ${gameVersion}`

      aboutSection.style.display = 'block'
      // Slight delay to ensure the display change registers before adding the show class
      setTimeout(() => {
        aboutSection.classList.add('show')
      }, 10)
    }
    
    // Function to close the modal
    const closeAboutModal = () => {
      aboutSection.classList.remove('show')
      // Wait for transition to complete before hiding
      setTimeout(() => {
        aboutSection.style.display = 'none'
      }, 750) // Same as transition time
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