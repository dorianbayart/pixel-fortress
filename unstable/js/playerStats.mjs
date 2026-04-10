// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2024 Pixel Fortress contributors

export {
  initLevelStats,
  getLevelStats,
  getGameStats,
  recordLevelComplete,
  isLevelCompleted,
  saveGameStats,
  loadGameStats
}

'use strict'

import gameState from 'state'

const STORAGE_KEY = 'pixelFortress.gameStats'

// ── Level stats ────────────────────────────────────────────────
// Reset at the start of each campaign level. Used by objectives.mjs for goal evaluation.

let levelStats = _emptyLevelStats()
let _unsubscribers = []

function _emptyLevelStats() {
  return {
    buildingsBuilt: {},    // { lumberjack: 2, tent: 1, ... }
    unitsKilled: {},       // { Soldier: 3, Archer: 1, ... }
    unitsProduced: {},     // { Peon: 5, Soldier: 2, ... }
    resourcesGathered: {}, // { wood: 450, stone: 200, ... }
    resourcesSpent: {},    // { wood: 300, stone: 150, ... }
    moneyEarned: 0,
    tilesExplored: 0,
    totalTiles: 0
  }
}

// ── Game stats ─────────────────────────────────────────────────
// Persisted across sessions. Foundation for achievements.

let gameStats = _defaultGameStats()

function _defaultGameStats() {
  return {
    hoursPlayed: 0,
    levelsCompleted: [],
    lastPlayedAt: null
  }
}

// ── Level stats init ───────────────────────────────────────────

/**
 * Reset level stats and subscribe to game events for the human player.
 * Call after the map is generated so totalTiles is accurate.
 * @param {number} totalTiles - Width × height of the current map
 */
function initLevelStats(totalTiles) {
  // Clean up any previous subscriptions
  _unsubscribers.forEach(fn => fn())
  _unsubscribers = []

  levelStats = _emptyLevelStats()
  levelStats.totalTiles = totalTiles

  // Subscribe to events — only track human player actions
  _unsubscribers.push(
    gameState.events.on('building-built', ({ building, player }) => {
      if (player !== gameState.humanPlayer) return
      const key = building.type?.key
      if (key) levelStats.buildingsBuilt[key] = (levelStats.buildingsBuilt[key] || 0) + 1
    })
  )

  _unsubscribers.push(
    gameState.events.on('unit-killed', ({ unit, owner }) => {
      // Count kills of enemy units (owned by non-human players)
      if (owner === gameState.humanPlayer) return
      const name = unit.constructor.name
      levelStats.unitsKilled[name] = (levelStats.unitsKilled[name] || 0) + 1
    })
  )

  _unsubscribers.push(
    gameState.events.on('unit-produced', ({ unit, player }) => {
      if (player !== gameState.humanPlayer) return
      const name = unit.constructor.name
      levelStats.unitsProduced[name] = (levelStats.unitsProduced[name] || 0) + 1
    })
  )

  _unsubscribers.push(
    gameState.events.on('resource-gathered', ({ type, amount, player }) => {
      if (player !== gameState.humanPlayer) return
      levelStats.resourcesGathered[type] = (levelStats.resourcesGathered[type] || 0) + amount
    })
  )

  _unsubscribers.push(
    gameState.events.on('resource-spent', ({ type, amount, player }) => {
      if (player !== gameState.humanPlayer) return
      levelStats.resourcesSpent[type] = (levelStats.resourcesSpent[type] || 0) + amount
    })
  )

  _unsubscribers.push(
    gameState.events.on('money-earned', ({ amount, player }) => {
      if (player !== gameState.humanPlayer) return
      levelStats.moneyEarned += amount
    })
  )

  _unsubscribers.push(
    gameState.events.on('tile-explored', ({ teamId }) => {
      if (teamId === 'human') levelStats.tilesExplored++
    })
  )
}

// ── Public accessors ───────────────────────────────────────────

function getLevelStats() {
  return { ...levelStats }
}

function getGameStats() {
  return { ...gameStats }
}

// ── Campaign progression ───────────────────────────────────────

function recordLevelComplete(levelId) {
  if (!gameStats.levelsCompleted.includes(levelId)) {
    gameStats.levelsCompleted.push(levelId)
  }
  gameStats.lastPlayedAt = new Date().toISOString()
}

function isLevelCompleted(levelId) {
  return gameStats.levelsCompleted.includes(levelId)
}

// ── Persistence ────────────────────────────────────────────────

async function loadGameStats() {
  try {
    let data = null
    if (window.electronAPI?.loadSettings) {
      data = await window.electronAPI.loadSettings('gameStats')
    } else {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) data = JSON.parse(raw)
    }
    if (data && typeof data === 'object') {
      gameStats = { ..._defaultGameStats(), ...data }
    }
  } catch (err) {
    console.warn('[playerStats] Failed to load game stats:', err)
  }
}

function saveGameStats() {
  try {
    const data = { ...gameStats }
    if (window.electronAPI?.saveSettings) {
      window.electronAPI.saveSettings('gameStats', data)
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    }
  } catch (err) {
    console.warn('[playerStats] Failed to save game stats:', err)
  }
}
