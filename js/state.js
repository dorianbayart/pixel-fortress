export { GameState, EventSystem }

'use strict'

/**
 * Event system to handle state change subscriptions
 */
class EventSystem {
  constructor() {
    this.listeners = {}
  }

  /**
   * Subscribe to an event
   * @param {string} event - Event name
   * @param {Function} callback - Function to call when event is triggered
   * @returns {Function} Unsubscribe function
   */
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = []
    }
    this.listeners[event].push(callback)

    // Return unsubscribe function
    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback)
    }
  }

  /**
   * Emit an event
   * @param {string} event - Event name
   * @param {any} data - Data to pass to listeners
   */
  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data))
    }
  }
}

/**
 * Centralized game state management
 */
class GameState {
  constructor() {
    this.events = new EventSystem()
    
    // Debug state
    this._debug = false
    
    // Rendering state
    this._isDrawBackRequested = true
    
    // Player state
    this._players = {
      human: null,
      ais: []
    }
    
    // Map state
    this._map = null
    
    // Game status
    this._gameStatus = 'menu' // 'menu', 'playing', 'paused', 'gameOver'
    
    // Game settings
    this._settings = {
      difficulty: 'medium',
      mapSeed: null
    }

    // UI references
    this.UI = null
  }

  /* Debug state getters/setters */
  get debug() {
    return this._debug
  }

  set debug(value) {
    const oldValue = this._debug
    this._debug = value
    if (oldValue !== value) {
      this.events.emit('debug-changed', value)
    }
  }

  toggleDebug() {
    this.debug = !this.debug
    return this.debug
  }

  /* Rendering state getters/setters */
  get isDrawBackRequested() {
    return this._isDrawBackRequested
  }

  set isDrawBackRequested(value) {
    const oldValue = this._isDrawBackRequested
    this._isDrawBackRequested = value
    if (oldValue !== value) {
      this.events.emit('draw-back-requested-changed', value)
    }
  }

  drawBack() {
    this.isDrawBackRequested = true
  }

  backDrawn() {
    this.isDrawBackRequested = false
  }

  /* Player state getters/setters */
  get humanPlayer() {
    return this._players.human
  }

  set humanPlayer(player) {
    this._players.human = player
    this.events.emit('human-player-changed', player)
  }

  get aiPlayers() {
    return [...this._players.ais]
  }

  addAiPlayer(player) {
    this._players.ais.push(player)
    this.events.emit('ai-players-changed', this.aiPlayers)
  }

  clearAiPlayers() {
    this._players.ais = []
    this.events.emit('ai-players-changed', this.aiPlayers)
  }

  removeAiPlayer(player) {
    const index = this._players.ais.indexOf(player)
    if (index > -1) {
      this._players.ais.splice(index, 1)
      this.events.emit('ai-players-changed', this.aiPlayers)
    }
  }

  /* Map state getters/setters */
  get map() {
    return this._map
  }

  set map(newMap) {
    this._map = newMap
    this.events.emit('map-changed', newMap)
  }

  /* Game status getters/setters */
  get gameStatus() {
    return this._gameStatus
  }

  set gameStatus(status) {
    if (['menu', 'initialize', 'playing', 'paused', 'gameOver'].includes(status)) {
      console.log(status)
      const oldStatus = this._gameStatus
      this._gameStatus = status
      if (oldStatus !== status) {
        this.events.emit('game-status-changed', status)
      }
    } else {
      console.error(`Invalid game status: ${status}`)
    }
  }

  /* Game settings getters/setters */
  get settings() {
    return {...this._settings}
  }

  updateSettings(newSettings) {
    const oldSettings = {...this._settings}
    this._settings = {...this._settings, ...newSettings}
    this.events.emit('settings-changed', {
      oldSettings,
      newSettings: this._settings
    })
  }

  get mapSeed() {
    return this._settings.mapSeed
  }

  set mapSeed(seed) {
    this._settings.mapSeed = seed
    this.events.emit('map-seed-changed', seed)
  }
}

// Singleton instance
const gameState = new GameState()
export default gameState