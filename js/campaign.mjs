// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2024 Pixel Fortress contributors

export {
  initCampaign,
  resetCampaign,
  onGameLoop,
  isAllowedBuilding,
  isTentProductionEnabled,
  isSpecializationDisabled,
  getMaxPeons
}

'use strict'

import { initPhaseGoals, resetGoals, setWaveUnits, showPhaseBanner, setOnPhaseComplete } from 'objectives'
import { recordLevelComplete, saveGameStats } from 'playerStats'
import { initNarratives, resetNarratives } from 'narrative'
import gameState from 'state'
import { t } from 'i18n'
import { showModal } from 'ui'

// ── Internal state ─────────────────────────────────────────────

let _levelConfig = null
let _currentPhaseIndex = -1
let _campaignElapsedMs = 0
let _executedTriggers = new Set()   // tracks fired on_time / on_phase_start triggers
let _active = false

// ── Public API ─────────────────────────────────────────────────

/**
 * Initialize campaign with a pre-fetched level config object (synchronous).
 * Called from init.mjs after startGame() completes.
 * @param {object} levelConfig - Parsed JSON from campaigns/*.json
 */
function initCampaign(levelConfig) {
  _levelConfig = levelConfig
  _currentPhaseIndex = -1
  _campaignElapsedMs = 0
  _executedTriggers.clear()
  _active = true

  // Apply starting resources to human player
  if (levelConfig.startingResources && gameState.humanPlayer) {
    gameState.humanPlayer.updateResources(levelConfig.startingResources)
  }

  // Apply AI initial state
  const aiConfig = levelConfig.ai
  if (aiConfig && !aiConfig.enabled) {
    gameState.campaignNormalAiEnabled = false
  }

  // Register phase completion callback so objectives.mjs can notify us
  setOnPhaseComplete(_advancePhase)

  // Enter first phase
  _enterPhase(0)
}

function resetCampaign() {
  resetGoals()
  resetNarratives()
  _active = false
  _levelConfig = null
  _currentPhaseIndex = -1
  _campaignElapsedMs = 0
  _executedTriggers.clear()
  // Reset gameState campaign flags to defaults
  gameState.campaignAllowedBuildings = null
  gameState.campaignRestrictSpecialization = false
  gameState.campaignTentProductionEnabled = true
  gameState.campaignMaxPeons = null
  gameState.campaignPeonsMatchBuilding = null
  gameState.campaignNormalAiEnabled = false
}

/**
 * Called every game loop frame. Evaluates time-based AI script triggers.
 * @param {number} elapsedMs - Milliseconds elapsed since last frame
 */
function onGameLoop(elapsedMs) {
  if (!_active || !_levelConfig) return
  _campaignElapsedMs += elapsedMs

  const elapsedSeconds = _campaignElapsedMs / 1000
  const script = _levelConfig.ai?.script || []

  for (const trigger of script) {
    const triggerId = `time_${trigger.seconds}`
    if (trigger.trigger === 'on_time' && !_executedTriggers.has(triggerId)) {
      if (elapsedSeconds >= trigger.seconds) {
        _executedTriggers.add(triggerId)
        _executeScriptEntry(trigger)
      }
    }
  }
}

function isAllowedBuilding(key) {
  const allowed = gameState.campaignAllowedBuildings
  return !allowed || allowed.includes(key)
}

function isTentProductionEnabled() {
  return gameState.campaignTentProductionEnabled
}

function isSpecializationDisabled() {
  return gameState.campaignRestrictSpecialization
}

function getMaxPeons() {
  return gameState.campaignMaxPeons
}

// ── Phase management ───────────────────────────────────────────

function _enterPhase(index) {
  if (!_levelConfig || index >= _levelConfig.phases.length) return

  _currentPhaseIndex = index
  const phase = _levelConfig.phases[index]

  // Apply restrictions for this phase
  _applyRestrictions(phase.restrictions || {})

  // Notify UI that building list may have changed
  gameState.events.emit('campaign-phase-changed', { phaseIndex: index, phase })

  // Initialize objectives
  initPhaseGoals(phase.goals || [])

  // Show phase banner (bannerText is an i18n key)
  if (phase.bannerText) {
    showPhaseBanner(t(phase.bannerText))
  }

  // Start narrative sequence for this phase
  initNarratives(phase.narratives || [])

  // Execute on_phase_start AI triggers
  _executePhaseScriptTriggers('on_phase_start', phase.id)
}

function _advancePhase() {
  if (!_levelConfig) return
  const completedPhase = _levelConfig.phases[_currentPhaseIndex]
  const nextIndex = _currentPhaseIndex + 1

  // Fire on_phase_complete triggers for the phase that just finished
  if (completedPhase) {
    _executePhaseScriptTriggers('on_phase_complete', completedPhase.id)
  }

  if (nextIndex >= _levelConfig.phases.length) {
    _onLevelComplete()
  } else {
    _enterPhase(nextIndex)
  }
}

function _applyRestrictions(restrictions) {
  gameState.campaignTentProductionEnabled = restrictions.tentProduction !== false
  gameState.campaignMaxPeons = restrictions.maxPeons ?? null
  gameState.campaignPeonsMatchBuilding = restrictions.peonsMatchBuilding ?? null
  gameState.campaignAllowedBuildings = restrictions.allowedBuildings ?? null
  gameState.campaignRestrictSpecialization = restrictions.disableSpecialization === true
}

// ── Level completion ───────────────────────────────────────────

function _onLevelComplete() {
  _active = false
  resetNarratives()
  const levelId = _levelConfig?.id
  showModal(
    t('campaign.levelComplete'),
    t('campaign.levelCompleteMsg'),
    'win',
    'menu',
    () => {
      if (levelId) {
        recordLevelComplete(levelId)
        saveGameStats()
      }
    }
  )
}

// ── AI script execution ────────────────────────────────────────

function _executePhaseScriptTriggers(triggerType, phaseId) {
  if (!_levelConfig?.ai?.script) return
  for (const entry of _levelConfig.ai.script) {
    const triggerId = `${triggerType}_${phaseId}_${entry.action}`
    if (entry.trigger === triggerType && entry.phaseId === phaseId && !_executedTriggers.has(triggerId)) {
      _executedTriggers.add(triggerId)
      _executeScriptEntry(entry)
    }
  }
}

function _executeScriptEntry(entry) {
  switch (entry.action) {
    case 'send_wave':
      _spawnWave(entry)
      break
    case 'enable_normal_ai':
      gameState.campaignNormalAiEnabled = true
      break
    default:
      console.warn(`[campaign] Unknown AI script action: ${entry.action}`)
  }
}

/**
 * Spawn a scripted wave of units for the AI player.
 * Spawned units are registered with objectives.mjs for kill_units goal tracking.
 */
function _spawnWave(entry) {
  const aiPlayer = gameState.aiPlayers?.[0]
  if (!aiPlayer) return

  // Find spawn position near AI tent
  const aiTent = aiPlayer.getTents()?.[0]
  if (!aiTent) return

  const spawnX = aiTent.x
  const spawnY = aiTent.y
  const spawnedUnits = []

  const unitMethodMap = {
    'Peon': 'addWorker',
    'Soldier': 'addSoldier',
    'Archer': 'addArcher',
    'Mage': 'addMage',
    'HeavyInfantry': 'addHeavyInfantry',
    'EliteWarrior': 'addEliteWarrior',
    'PeonSoldier': 'addPeonSoldier'
  }

  for (const unitDef of (entry.units || [])) {
    const method = unitMethodMap[unitDef.unitClass]
    if (!method || typeof aiPlayer[method] !== 'function') {
      console.warn(`[campaign] Unknown unit class for wave: ${unitDef.unitClass}`)
      continue
    }
    const count = unitDef.count || 1
    for (let i = 0; i < count; i++) {
      // Slightly offset each unit from the tent position
      const offsetX = spawnX + (Math.random() * 4 - 2) | 0
      const offsetY = spawnY + (Math.random() * 4 - 2) | 0
      const unit = aiPlayer[method](offsetX, offsetY)
      if (unit) {
        // Apply custom HP if specified (boss units)
        if (unitDef.hp !== undefined) {
          unit.life = unitDef.hp
          unit.maxLife = unitDef.hp
        }
        spawnedUnits.push(unit)
      }
    }
  }

  // Register units with objectives for kill_units tracking
  if (entry.waveTag && spawnedUnits.length > 0) {
    setWaveUnits(entry.waveTag, spawnedUnits)
  }
}

