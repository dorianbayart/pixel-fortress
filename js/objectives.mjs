// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2024 Pixel Fortress contributors

export {
  initPhaseGoals,
  resetGoals,
  getGoals,
  areAllGoalsComplete,
  setWaveUnits,
  showPhaseBanner,
  renderObjectivesPanel,
  setOnPhaseComplete
}

'use strict'

import { getExplorationPercent } from 'fogOfWar'
import gameState from 'state'
import { t } from 'i18n'

// ── Runtime state ──────────────────────────────────────────────

let _goals = []          // GoalState[]
let _waveUnits = new Map() // waveTag → Set<Unit>
let _unsubscribers = []

// Callback invoked when all goals in the current phase are complete
let _onPhaseComplete = null

function setOnPhaseComplete(callback) {
  _onPhaseComplete = callback
}

// ── Public API ─────────────────────────────────────────────────

/**
 * Initialize goals for a phase. Clears previous goals and event subscriptions.
 * @param {object[]} goalConfigs - Array of goal config objects from level JSON
 */
function initPhaseGoals(goalConfigs) {
  resetGoals()

  _goals = goalConfigs.map(cfg => ({
    ...cfg,
    completed: false,
    progress: 0
  }))

  _goals.forEach(goal => _setupEvaluator(goal))
  renderObjectivesPanel()
}

function resetGoals() {
  _unsubscribers.forEach(fn => fn())
  _unsubscribers = []
  _goals = []
  _waveUnits.clear()
}

function getGoals() {
  return _goals
}

function areAllGoalsComplete() {
  return _goals.length > 0 && _goals.every(g => g.completed)
}

/**
 * Register units belonging to a wave, for kill_units goal tracking.
 * @param {string} waveTag
 * @param {object[]} units - Unit instances
 */
function setWaveUnits(waveTag, units) {
  _waveUnits.set(waveTag, new Set(units))
}

// ── Phase banner ───────────────────────────────────────────────

function showPhaseBanner(text) {
  const banner = document.getElementById('phase-banner')
  const bannerText = document.getElementById('phase-banner-text')
  if (!banner || !bannerText) return
  bannerText.textContent = text
  banner.classList.add('visible')
  setTimeout(() => banner.classList.remove('visible'), 4500)
}

// ── Objectives panel rendering ─────────────────────────────────

function renderObjectivesPanel() {
  const panel = document.getElementById('objectives-panel')
  const list = document.getElementById('objectives-list')
  const header = document.getElementById('objectives-header')
  if (!panel || !list) return

  if (_goals.length === 0) {
    panel.classList.remove('visible')
    return
  }

  if (header) header.textContent = 'Objectives'

  list.innerHTML = ''
  _goals.forEach(goal => {
    const item = document.createElement('div')
    item.className = 'objective-item' + (goal.completed ? ' completed' : '')

    const check = document.createElement('span')
    check.className = 'objective-checkmark'
    check.textContent = goal.completed ? '✓' : '○'

    const textWrap = document.createElement('div')
    textWrap.style.flex = '1'

    const title = document.createElement('div')
    title.style.fontWeight = goal.completed ? 'normal' : 'bold'
    title.style.fontSize = '11px'
    title.textContent = goal.title ? t(goal.title) : goal.id

    const desc = document.createElement('div')
    desc.style.fontSize = '10px'
    desc.style.opacity = '0.8'
    desc.style.lineHeight = '1.3'
    desc.textContent = goal.description ? t(goal.description) : ''

    textWrap.appendChild(title)
    if (goal.description) textWrap.appendChild(desc)

    // Progress bar for incomplete goals with partial progress
    if (!goal.completed && goal.progress > 0) {
      const bar = document.createElement('div')
      bar.className = 'objective-progress'
      const fill = document.createElement('div')
      fill.className = 'objective-progress-fill'
      fill.style.width = `${Math.round(goal.progress * 100)}%`
      bar.appendChild(fill)
      textWrap.appendChild(bar)
    }

    item.appendChild(check)
    item.appendChild(textWrap)
    list.appendChild(item)
  })

  panel.classList.add('visible')
}

// ── Goal evaluators ────────────────────────────────────────────

function _complete(goal) {
  if (goal.completed) return
  goal.completed = true
  goal.progress = 1
  renderObjectivesPanel()
  if (areAllGoalsComplete() && _onPhaseComplete) {
    _onPhaseComplete()
  }
}

function _setupEvaluator(goal) {
  switch (goal.type) {
    case 'has_buildings':
      return _evalHasBuildings(goal)
    case 'has_resources':
      return _evalHasResources(goal)
    case 'has_units':
      return _evalHasUnits(goal)
    case 'has_specialized':
      return _evalHasSpecialized(goal)
    case 'sell_resources':
      return _evalSellResources(goal)
    case 'upgrade_building':
      return _evalUpgradeBuilding(goal)
    case 'explore_percent':
      return _evalExplorePercent(goal)
    case 'kill_units':
      return _evalKillUnits(goal)
    case 'kill_building':
      return _evalKillBuilding(goal)
    default:
      console.warn(`[objectives] Unknown goal type: ${goal.type}`)
  }
}

// ── has_buildings: own N buildings of type key ─────────────────

function _evalHasBuildings(goal) {
  const check = () => {
    if (goal.completed) return
    const count = _countBuildings(goal.buildingKey)
    goal.progress = Math.min(1, count / goal.count)
    if (count >= goal.count) _complete(goal)
    else renderObjectivesPanel()
  }
  check() // initial check
  _unsubscribers.push(
    gameState.events.on('building-built', ({ player }) => {
      if (player === gameState.humanPlayer) check()
    })
  )
  _unsubscribers.push(
    gameState.events.on('building-destroyed', ({ owner }) => {
      if (owner === gameState.humanPlayer) check()
    })
  )
}

function _countBuildings(key) {
  return (gameState.humanPlayer?.getBuildings() || []).filter(b => b.type?.key === key).length
}

// ── has_resources: currently hold N of resource ────────────────

function _evalHasResources(goal) {
  const check = () => {
    if (goal.completed) return
    const amount = gameState.humanPlayer?.getResources()?.[goal.resource] || 0
    goal.progress = Math.min(1, amount / goal.amount)
    if (amount >= goal.amount) _complete(goal)
    else renderObjectivesPanel()
  }
  check()
  _unsubscribers.push(
    gameState.events.on('resource-gathered', ({ player }) => {
      if (player === gameState.humanPlayer) check()
    })
  )
  // Also check when resources are spent (player might have lost resources)
  _unsubscribers.push(
    gameState.events.on('resource-spent', ({ player }) => {
      if (player === gameState.humanPlayer) check()
    })
  )
}

// ── has_units: have N alive units of class name ────────────────

function _evalHasUnits(goal) {
  const check = () => {
    if (goal.completed) return
    const count = (gameState.humanPlayer?.getUnits() || []).filter(u => u.constructor.name === goal.unitClass).length
    goal.progress = Math.min(1, count / goal.count)
    if (count >= goal.count) _complete(goal)
    else renderObjectivesPanel()
  }
  check()
  _unsubscribers.push(gameState.events.on('unit-produced', ({ player }) => {
    if (player === gameState.humanPlayer) check()
  }))
  _unsubscribers.push(gameState.events.on('unit-killed', ({ owner }) => {
    if (owner === gameState.humanPlayer) check()
  }))
}

// ── has_specialized: own N buildings of specialized type ───────

function _evalHasSpecialized(goal) {
  const check = () => {
    if (goal.completed) return
    const count = _countBuildings(goal.buildingKey)
    goal.progress = Math.min(1, count / goal.count)
    if (count >= goal.count) _complete(goal)
    else renderObjectivesPanel()
  }
  check()
  _unsubscribers.push(gameState.events.on('building-specialized', ({ player }) => {
    if (player === gameState.humanPlayer) check()
  }))
}

// ── sell_resources: earn N money via Market (cumulative) ────────

function _evalSellResources(goal) {
  let earned = 0
  _unsubscribers.push(
    gameState.events.on('money-earned', ({ amount, player }) => {
      if (goal.completed || player !== gameState.humanPlayer) return
      earned += amount
      goal.progress = Math.min(1, earned / goal.amount)
      if (earned >= goal.amount) _complete(goal)
      else renderObjectivesPanel()
    })
  )
}

// ── upgrade_building: have a building at targetLevel ───────────

function _evalUpgradeBuilding(goal) {
  const check = () => {
    if (goal.completed) return
    const has = (gameState.humanPlayer?.getBuildings() || []).some(
      b => b.type?.key === goal.buildingKey && b.level >= goal.targetLevel
    )
    if (has) _complete(goal)
  }
  check()
  _unsubscribers.push(gameState.events.on('building-upgraded', ({ player }) => {
    if (player === gameState.humanPlayer) check()
  }))
}

// ── explore_percent: explored N% of the map ───────────────────

function _evalExplorePercent(goal) {
  const check = () => {
    if (goal.completed) return
    const pct = getExplorationPercent()
    goal.progress = Math.min(1, pct / goal.percent)
    if (pct >= goal.percent) _complete(goal)
    else renderObjectivesPanel()
  }
  check()
  _unsubscribers.push(gameState.events.on('tile-explored', ({ teamId }) => {
    if (teamId === 'human') check()
  }))
}

// ── kill_units: kill all units tagged to a wave ────────────────

function _evalKillUnits(goal) {
  // waveUnits may not be registered yet at init; check on each kill event
  _unsubscribers.push(
    gameState.events.on('unit-killed', ({ unit }) => {
      if (goal.completed) return
      const waveSet = _waveUnits.get(goal.waveTag)
      if (!waveSet || !waveSet.has(unit)) return
      waveSet.delete(unit)
      const total = (goal._totalCount || 0) || waveSet.size + 1
      if (!goal._totalCount) goal._totalCount = total
      const killed = goal._totalCount - waveSet.size
      goal.progress = Math.min(1, killed / goal._totalCount)
      if (waveSet.size === 0) _complete(goal)
      else renderObjectivesPanel()
    })
  )
}

// ── kill_building: destroy a building of type owned by target ──

function _evalKillBuilding(goal) {
  _unsubscribers.push(
    gameState.events.on('building-destroyed', ({ building, owner }) => {
      if (goal.completed) return
      if (building.type?.key !== goal.buildingKey) return
      const isTargetAi = goal.targetPlayer === 'ai' && owner !== gameState.humanPlayer
      if (isTargetAi) _complete(goal)
    })
  )
}
