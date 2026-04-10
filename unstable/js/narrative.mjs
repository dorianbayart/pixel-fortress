// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2024 Pixel Fortress contributors

export { initNarratives, resetNarratives }

'use strict'

import gameState from 'state'
import { t } from 'i18n'

let _narratives = []
let _currentIndex = -1
let _dismissUnsub = null
let _advancing = false
let _generation = 0  // incremented on reset; stale event callbacks self-reject

// ── Public API ──────────────────────────────────────────────────

/**
 * Initialize the narrative sequence for a phase.
 * Shows the first message immediately if any are defined.
 * @param {object[]} narrativeConfigs - Array of narrative entry objects
 */
function initNarratives(narrativeConfigs) {
  resetNarratives()
  if (!narrativeConfigs || narrativeConfigs.length === 0) return
  _narratives = narrativeConfigs
  _showAt(0)
}

/**
 * Reset narrative state — hides the box and removes all listeners.
 */
function resetNarratives() {
  _generation++  // invalidate any in-flight event callbacks from the previous phase
  _teardownDismiss()
  _narratives = []
  _currentIndex = -1
  _advancing = false
  _hideBox()
}

// ── Internal ────────────────────────────────────────────────────

function _showAt(index) {
  _currentIndex = index
  if (index >= _narratives.length) {
    _hideBox()
    return
  }
  const entry = _narratives[index]
  _showBox(entry.message)
  _setupDismiss(entry)
}

function _advance() {
  if (_advancing) return
  _advancing = true
  _teardownDismiss()
  const next = _currentIndex + 1
  _advancing = false
  _showAt(next)
}

function _setupDismiss(entry) {
  // Wire up the close button — hides the box without advancing
  const closeBtn = document.getElementById('narrative-close')
  if (closeBtn) {
    // Replace with a fresh clone to avoid stacking listeners across phases
    const fresh = closeBtn.cloneNode(true)
    closeBtn.parentNode.replaceChild(fresh, closeBtn)
    fresh.addEventListener('click', (e) => {
      e.stopPropagation()
      _hideBox()
    })
  }

  // Event-based auto-advance (the only way to progress the narrative)
  if (entry.autoAdvanceOn) {
    const gen = _generation  // capture current generation; stale callbacks self-reject
    _dismissUnsub = gameState.events.on(entry.autoAdvanceOn, (data) => {
      if (_generation !== gen) return  // callback belongs to a previous phase — ignore
      if (!_matchesFilter(data, entry.autoAdvanceFilter)) return
      _advance()
    })
  }
}

function _teardownDismiss() {
  if (_dismissUnsub) {
    _dismissUnsub()
    _dismissUnsub = null
  }
}

function _showBox(message) {
  const box = document.getElementById('narrative-box')
  if (!box) return
  const text = document.getElementById('narrative-text')
  if (text) text.textContent = t(message)
  box.classList.add('visible')
}

function _hideBox() {
  const box = document.getElementById('narrative-box')
  if (!box) return
  box.classList.remove('visible')
}

/**
 * Returns true if event data matches the filter criteria.
 * By default, events with a `player` field are required to be the human player.
 */
function _matchesFilter(data, filter) {
  if (!data) return true

  // Always require human player for player-tagged events
  if ('player' in data && data.player !== gameState.humanPlayer) return false

  if (!filter) return true
  if (filter.buildingKey && data.building?.type?.key !== filter.buildingKey) return false
  if (filter.resource && data.type !== filter.resource) return false
  return true
}
