/*
 * Pixel Fortress - A 2D real-time strategy game
 * Copyright (C) 2026 Dorian Bayart
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

export { initAnalytics, ANALYTICS_CONFIG }

'use strict'

import gameState from 'state'

// ─── Configuration ─────────────────────────────────────────────────────────
// Toggle individual tracking categories without touching the rest of the code.
// Add new keys here when expanding what the game tracks.
const ANALYTICS_CONFIG = {
  enabled: true,

  events: {
    // Fired once when a game session transitions to 'playing'
    gameStart: true,

    // Fired on win / loss / quit — includes session summary
    gameEnd: true,

    // Attach the full ordered build sequence to the game-ended payload.
    // Entries: placement  → { type, t }
    //          upgrade    → { type, upLvlTo: <number>, t }
    //          specialize → { type, upLvlTo: <string>, t }
    // Useful for AI training: exact build order with timing.
    buildingOrder: true,

    // Count of enemy units killed and own units lost, added to game-ended
    unitKills: true,
  },
}

// ─── Session state ──────────────────────────────────────────────────────────
let sessionStartTime = null  // Date.now() when the session started
let buildingSequence = []    // ordered build/upgrade/specialize events
let killCount  = 0           // enemy units destroyed by the human player
let lossCount  = 0           // human units destroyed by enemies
let previousStatus = null

// ─── Helpers ────────────────────────────────────────────────────────────────
function track(event, data) {
  if (!ANALYTICS_CONFIG.enabled) return
  window.umami?.track(event, data)
}

function elapsedMs() {
  return sessionStartTime ? Date.now() - sessionStartTime : 0
}

function resetSession() {
  sessionStartTime = null
  buildingSequence = []
  killCount  = 0
  lossCount  = 0
}

function startSession() {
  resetSession()
  sessionStartTime = Date.now()

  if (!ANALYTICS_CONFIG.events.gameStart) return

  const s = gameState.settings
  track('game-started', {
    mapSize:       s.mapSize,
    mapSeed:       s.mapSeed ?? null,
    difficulty:    s.difficulty,
    gameMode:      s.gameMode,
    campaignLevel: gameState.campaignLevelId ?? null,
    fogOfWar:      s.fogOfWar,
    language:      s.language,
    customMap:     gameState.customMapId ?? null,
  })
}

function endSession(outcome) {
  if (!ANALYTICS_CONFIG.events.gameEnd) {
    resetSession()
    return
  }

  const placementCount = buildingSequence.filter(e => e.upLvlTo === undefined).length

  const payload = {
    outcome,                                            // 'win' | 'loss' | 'quit'
    playedTimeSec:  Math.round(elapsedMs() / 1000),
    buildingCount:  placementCount,
  }

  if (ANALYTICS_CONFIG.events.buildingOrder && buildingSequence.length > 0) {
    payload.buildingOrder = JSON.stringify(buildingSequence)
  }

  if (ANALYTICS_CONFIG.events.unitKills) {
    payload.killCount = killCount
    payload.lossCount = lossCount
  }

  track('game-ended', payload)

  resetSession()
}

// ─── Event handlers ─────────────────────────────────────────────────────────
function onStatusChanged(status) {
  // Start a fresh session when entering 'playing' from anything except
  // 'paused' — a resume is not a new game, the timer keeps running.
  if (status === 'playing' && previousStatus !== 'paused') {
    startSession()
  }

  if (status === 'win') {
    endSession('win')
  } else if (status === 'gameOver') {
    endSession('loss')
  } else if (status === 'menu' && sessionStartTime !== null) {
    // Player returned to menu while a session was active → quit
    endSession('quit')
  }

  previousStatus = status
}

function onBuildingBuilt({ building, player }) {
  if (!player.isHuman() || !sessionStartTime) return
  if (!ANALYTICS_CONFIG.events.buildingOrder) return
  buildingSequence.push({ type: building.type.key, t: elapsedMs() })
}

function onBuildingUpgraded({ building, level, player }) {
  if (!player.isHuman() || !sessionStartTime) return
  if (!ANALYTICS_CONFIG.events.buildingOrder) return
  buildingSequence.push({ type: building.type.key, upLvlTo: level, t: elapsedMs() })
}

function onBuildingSpecialized({ building, targetTypeName, player }) {
  if (!player.isHuman() || !sessionStartTime) return
  if (!ANALYTICS_CONFIG.events.buildingOrder) return
  // upLvlTo is a string (target type key) to distinguish from numeric upgrades
  buildingSequence.push({ type: building.type.key, upLvlTo: targetTypeName, t: elapsedMs() })
}

function onUnitKilled({ unit, owner }) {
  if (!sessionStartTime) return
  if (!ANALYTICS_CONFIG.events.unitKills) return
  if (owner.isHuman()) {
    lossCount++
  } else {
    killCount++
  }
}

// ─── Init ────────────────────────────────────────────────────────────────────
function initAnalytics() {
  gameState.events.on('game-status-changed',  onStatusChanged)
  gameState.events.on('building-built',       onBuildingBuilt)
  gameState.events.on('building-upgraded',    onBuildingUpgraded)
  gameState.events.on('building-specialized', onBuildingSpecialized)
  gameState.events.on('unit-killed',          onUnitKilled)
}
