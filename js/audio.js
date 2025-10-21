export {
  musicManager,
  playBuildingSound,
  playClickSound,
  playCloseSound,
  playConfirmSound,
  playHoverSound,
  playMenuMusic
}

'use strict'

import gameState from 'state'

/* Sounds */
// const hoverSound = new Audio('assets/sounds/menu_hover.wav')
const clickSound = new Audio('assets/sounds/button_fx_mid_002_02_cc0_avr.wav')
const closeSound = new Audio('assets/sounds/button_fx_mid_002_01_cc0_avr.wav')
const confirmSound = new Audio('assets/sounds/confirm_style_2_001.ogg')
const buildingSound = new Audio('assets/sounds/Chest Close 2.ogg')

/* Ambient */
const forestDayAmbient = new Audio('assets/sounds/Forest Day.ogg')
let ambientTimer = null

/* Music */
const sonatina_letsadventure_3ToArms = new Audio('assets/music/sonatina_letsadventure_3ToArms.ogg')
let menuMusicTimer = null

// Initialize volumes from gameState
clickSound.volume = gameState.sfxVolume
closeSound.volume = gameState.sfxVolume
confirmSound.volume = gameState.sfxVolume
buildingSound.volume = gameState.sfxVolume
forestDayAmbient.volume = gameState.sfxVolume
sonatina_letsadventure_3ToArms.volume = gameState.musicVolume

// Subscribe to volume changes
gameState.events.on('sfx-volume-changed', (volume) => {
  clickSound.volume = volume
  closeSound.volume = volume
  confirmSound.volume = volume
  buildingSound.volume = volume
  forestDayAmbient.volume = volume
})

gameState.events.on('music-volume-changed', (volume) => {
  sonatina_letsadventure_3ToArms.volume = volume
})

/* Sounds */
const playHoverSound = async () => {
  if (hoverSound.paused) {
    hoverSound.play()
  } else if (confirmSound.currentTime > .75) {
    hoverSound.currentTime = 0
  }
}

const playClickSound = async () => {
  if (clickSound.paused) {
    clickSound.play()
  } else if (confirmSound.currentTime > .75) {
    clickSound.currentTime = 0
  }
}

const playCloseSound = async () => {
  if (closeSound.paused) {
    closeSound.play()
  } else if (confirmSound.currentTime > .75) {
    closeSound.currentTime = 0
  }
}

const playConfirmSound = async () => {
  if (confirmSound.paused) {
    confirmSound.play()
  } else if (confirmSound.currentTime > .75) {
    confirmSound.currentTime = 0
  }
}

const playBuildingSound = async () => {
  if (buildingSound.paused) {
    buildingSound.play()
  } else if (buildingSound.currentTime > .75) {
    buildingSound.currentTime = 0
  }
}

/* Music */
const musicManager = async () => {
  playMenuMusic(gameState.gameStatus)

  gameState.events.on('game-status-changed', async (status) => {
    playMenuMusic(status)
    playAmbientSounds(status)
  })
}

const playAmbientSounds = async (status) => {
  clearTimeout(ambientTimer)

  if (status === 'playing') {
    if (forestDayAmbient.paused || forestDayAmbient.ended) {
      forestDayAmbient.currentTime = 0
      forestDayAmbient.play()
    }
    ambientTimer = setTimeout(() => playAmbientSounds(gameState.gameStatus), 5000)
  } else {
    forestDayAmbient.pause()
  }
}

const playMenuMusic = async (status) => {
  clearTimeout(menuMusicTimer)

  if (status === 'menu') {
    if (sonatina_letsadventure_3ToArms.paused || sonatina_letsadventure_3ToArms.ended) {
      sonatina_letsadventure_3ToArms.currentTime = 0
      sonatina_letsadventure_3ToArms.play()
    }
    menuMusicTimer = setTimeout(() => playMenuMusic(gameState.gameStatus), 5000)
  } else {
    sonatina_letsadventure_3ToArms.pause()
  }
}

