export { GameState, EventSystem }

'use strict'

/**
 * Event system to handle state change subscriptions
 * Provides a publish/subscribe mechanism for game state changes
 * allowing components to react to state updates
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
      mapSeed: null,
      mapSize: 'medium',
      fogOfWar: true
    }

    // UI references
    this.UI = null
  }

  /**
   * Get the debug state value
   * @returns {boolean} The debug state value
   */
  get debug() {
    return this._debug
  }

  /**
   * Set the debug state value and emit event
   * @param {boolean} The debug state value
   */
  set debug(value) {
    const oldValue = this._debug
    this._debug = value
    if (oldValue !== value) {
      this.events.emit('debug-changed', value)
    }
  }

  /**
   * Toggle the debug state value
   * @returns {boolean} The new debug state value
   */
  toggleDebug() {
    this.debug = !this.debug
    return this.debug
  }

  /**
   * Get the drawing background request
   * Indicates if the background needs to be drawn
   * @returns {boolean} The request value value
   */
  get isDrawBackRequested() {
    return this._isDrawBackRequested
  }

  /**
   * Set the drawing background request and emit event
   * @param {boolean} The drawing background request value
   */
  set isDrawBackRequested(value) {
    const oldValue = this._isDrawBackRequested
    this._isDrawBackRequested = value
    if (oldValue !== value) {
      this.events.emit('draw-back-requested-changed', value)
    }
  }

  /**
   * Ask for a draw of the background
   */
  drawBack() {
    this.isDrawBackRequested = true
  }

  /**
   * The background has been drawn
   */
  backDrawn() {
    this.isDrawBackRequested = false
  }

  /**
   * Get the human player object
   * @returns {Player} The human player
   */
  get humanPlayer() {
    return this._players.human
  }

  /**
   * Set the human player object and emit event
   * @param {Player} The human player
   */
  set humanPlayer(player) {
    this._players.human = player
    this.events.emit('human-player-changed', player)
  }

  /**
   * Clear the human player object and all its children and emit event
   */
  clearHumanPlayer() {
    if(this._players.human) this._players.human.clear()
    this._players.human = null
    this.events.emit('human-player-changed', this._players.human)
  }

  /**
   * Get the list of AI players objects
   * @returns {Player[]} An array of AI players
   */
  get aiPlayers() {
    return [...this._players.ais]
  }

  /**
   * Add an AI player to the list of AI players and emit event
   * @param {Player} The AI player to add
   */
  addAiPlayer(player) {
    this._players.ais.push(player)
    this.events.emit('ai-players-changed', this.aiPlayers)
  }

  /**
   * Clear the AI players list and emit event
   */
  clearAiPlayers() {
    this._players.ais.forEach(ai => ai.clear())
    this._players.ais = []
    this.events.emit('ai-players-changed', this.aiPlayers)
  }

  /**
   * Remove an AI player from the list of AI players and emit event
   * @param {Player} The AI player to remove
   */
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