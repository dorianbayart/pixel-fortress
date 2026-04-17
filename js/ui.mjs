// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) Pixel Fortress contributors
export {
  handleMouseInteraction, initUI, mouse, setupEventListeners, setupGameMenuEventListeners, showDebugMessage, showModal, updateUI, recreateUIElements
}

'use strict'

import { playClickSound, playCloseSound, playConfirmSound } from 'audio'
import { Building, WorkerBuilding } from 'building'
import CONSTANTS from 'constants'
import { t, getLanguage } from 'i18n'
import { getCanvasDimensions, getMapDimensions, getTileSize } from 'dimensions'
import { DEBUG, drawBack, toggleDebug } from 'globals'
import { downloadMapJSON } from 'maps'
import { ParticleEffect, createParticleEmitter } from 'particles'
import * as PIXI from 'pixijs'
import { sprites } from 'sprites'
import { app, containers, indicatorMap, updateZoom, unitSpriteMap, backgroundSpriteMap, worldObjectSpriteMap, getRenderStats } from 'renderer'
import gameState from 'state'
import { getPathfindingStats } from 'pathfinding'
import { viewportChange } from 'viewport'

const UI_FONTS = CONSTANTS.UI.FONTS

// Mouse object (will be initialized in initUI)
let mouse = null
let elapsedUI = -5000
let cursorUpdateRafId = null

// UI elements
let cursorSprite = null
let statsText = null
let statsBackground = null

// building placement
let buildingPreviewSprite = null
let isValidPlacement = false
let selectedBuildingType = null

// DOM-based HUD state
let selectedBuildingIndex = -1
let currentSpecMode = false
let _resourcesChangedHandler = null
let _selectedBuildingChangedHandler = null
let _gameModeMenuBtnBound = null

function getBuildingList() {
  const all = [
    Building.TYPES.LUMBERJACK,
    Building.TYPES.QUARRY,
    Building.TYPES.WELL,
    Building.TYPES.GOLD_MINE,
    Building.TYPES.TENT,
    Building.TYPES.TOWER,
    Building.TYPES.MARKET,
  ]
  const allowed = gameState.campaignAllowedBuildings
  if (!allowed) return all
  return all.filter(bt => allowed.includes(bt.key))
}

const RESOURCE_IMG = {
  wood: 'assets/buildings/wood.png',
  stone: 'assets/buildings/rock.png',
  gold: 'assets/buildings/gold-ore.png',
  water: 'assets/buildings/droplet.png',
  money: 'assets/buildings/coin.png',
}

function _makeCostEl(costs) {
  const el = document.createElement('div')
  el.className = 'bi-btn-cost'
  for (const [r, a] of Object.entries(costs)) {
    const item = document.createElement('span')
    item.className = 'bi-btn-cost-item'
    if (RESOURCE_IMG[r]) {
      const img = document.createElement('img')
      img.src = RESOURCE_IMG[r]
      img.alt = r
      item.appendChild(img)
    } else {
      item.appendChild(document.createTextNode(r + ' '))
    }
    item.appendChild(document.createTextNode(a))
    el.appendChild(item)
  }
  return el
}

// ── DOM helpers ────────────────────────────────────────────────

function showGameUI() {
  document.body.classList.add('playing-mode')
  document.getElementById('game-top-bar').classList.add('visible')
  document.getElementById('game-bottom-bar').classList.add('visible')

  const btn = document.getElementById('game-menu-btn')
  if (!_gameModeMenuBtnBound) {
    _gameModeMenuBtnBound = (e) => { e.stopPropagation(); openGameMenu() }
  }
  btn.removeEventListener('click', _gameModeMenuBtnBound)
  btn.addEventListener('click', _gameModeMenuBtnBound)
}

function hideGameUI() {
  document.body.classList.remove('playing-mode')
  document.getElementById('game-top-bar').classList.remove('visible')
  document.getElementById('game-bottom-bar').classList.remove('visible')

  const btn = document.getElementById('game-menu-btn')
  if (_gameModeMenuBtnBound) {
    btn.removeEventListener('click', _gameModeMenuBtnBound)
  }
}

function updateResourceDisplay(resources) {
  const keys = ['wood', 'stone', 'gold', 'water', 'money', 'population']
  for (const key of keys) {
    const el = document.getElementById(`res-${key}`)
    if (el && resources[key] !== undefined) {
      el.textContent = resources[key].toString()
    }
  }
  // Also refresh affordability on slots and the selected building's action buttons
  _refreshSlotAffordability()
  if (gameState.selectedBuilding) {
    renderBuildingInfo(gameState.selectedBuilding)
  }
}

function _refreshSlotAffordability() {
  const panel = document.getElementById('building-slots-panel')
  if (!panel || !panel.children.length) return
  getBuildingList().forEach((bt, i) => {
    const slot = panel.children[i]
    if (!slot) return
    const canAfford = gameState.humanPlayer?.canAffordBuilding(bt)
    slot.classList.toggle('unaffordable', !canAfford)
    slot.classList.toggle('selected', i === selectedBuildingIndex)
  })
}

function renderBuildingSlots() {
  const panel = document.getElementById('building-slots-panel')
  panel.innerHTML = ''

  getBuildingList().forEach((bt, i) => {
    const canAfford = gameState.humanPlayer?.canAffordBuilding(bt)
    const btn = document.createElement('button')
    btn.className = 'building-slot' + (canAfford ? '' : ' unaffordable')
    if (i === selectedBuildingIndex) btn.classList.add('selected')

    const img = document.createElement('img')
    img.src = bt.sprite || ''
    img.alt = bt.key ? t(`buildings.${bt.key}.name`) : bt.name
    btn.appendChild(img)

    const name = document.createElement('span')
    name.className = 'slot-name'
    name.textContent = bt.key ? t(`buildings.${bt.key}.name`) : bt.name
    btn.appendChild(name)

    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      hideTooltip()
      handleBuildingSelect(i)
      addButtonSparkles(e)
    })

    btn.addEventListener('mouseenter', () => showTooltip(bt, btn))
    btn.addEventListener('mouseleave', () => hideTooltip())

    panel.appendChild(btn)
  })
}

function showTooltip(bt, slotEl) {
  const tooltip = document.getElementById('hud-tooltip')
  const name = bt.key ? t(`buildings.${bt.key}.name`) : bt.name
  const desc = bt.key ? t(`buildings.${bt.key}.description`) : (bt.description || '')
  const details = bt.key ? t(`buildings.${bt.key}.details`) : (bt.details || '')
  const costs = gameState.humanPlayer?.getBuildingCost(bt) || {}

  tooltip.innerHTML = ''

  const titleEl = document.createElement('span')
  titleEl.className = 'tooltip-title'
  titleEl.textContent = name
  tooltip.appendChild(titleEl)

  if (desc) {
    const descEl = document.createElement('span')
    descEl.className = 'tooltip-desc'
    descEl.textContent = desc
    tooltip.appendChild(descEl)
  }

  if (details) {
    const detEl = document.createElement('span')
    detEl.className = 'tooltip-details'
    detEl.textContent = details
    tooltip.appendChild(detEl)
  }

  if (Object.keys(costs).length > 0) {
    const costEl = document.createElement('span')
    costEl.className = 'tooltip-costs'
    costEl.textContent = t('ui.costs') + ': ' + Object.entries(costs)
      .map(([r, a]) => `${r} ${a}`)
      .join('  ')
    tooltip.appendChild(costEl)
  }

  tooltip.classList.add('visible')

  // Position: above the slot, centered
  const rect = slotEl.getBoundingClientRect()
  const tw = tooltip.offsetWidth || 200
  let left = rect.left + rect.width / 2 - tw / 2
  left = Math.max(4, Math.min(left, window.innerWidth - tw - 4))
  const top = rect.top - tooltip.offsetHeight - 6
  tooltip.style.left = `${left}px`
  tooltip.style.top = `${Math.max(4, top)}px`
}

function hideTooltip() {
  document.getElementById('hud-tooltip').classList.remove('visible')
}

// ── Building Info Panel ────────────────────────────────────────

function renderBuildingInfo(building, specMode = false) {
  currentSpecMode = specMode

  const slotsPanel = document.getElementById('building-slots-panel')
  const infoPanel = document.getElementById('building-info-panel')

  slotsPanel.style.display = 'none'
  infoPanel.innerHTML = ''
  infoPanel.classList.add('visible')

  const padding = 10
  const SPRITE_SIZE = getTileSize()

  // Icon
  if (building.type.sprite) {
    const icon = document.createElement('img')
    icon.className = 'bi-icon'
    icon.src = building.type.sprite
    icon.alt = ''
    infoPanel.appendChild(icon)
  }

  // Main text column
  const main = document.createElement('div')
  main.className = 'bi-main'

  const buildingName = building.type.key ? t(`buildings.${building.type.key}.name`) : building.type.name
  const nameEl = document.createElement('span')
  nameEl.className = 'bi-name'
  nameEl.textContent = `${buildingName} (${t('ui.level')} ${building.level})`
  main.appendChild(nameEl)

  const buildingDesc = building.type.key ? t(`buildings.${building.type.key}.description`) : building.type.description
  const descEl = document.createElement('span')
  descEl.className = 'bi-desc'
  descEl.textContent = buildingDesc
  main.appendChild(descEl)

  const lifeEl = document.createElement('span')
  lifeEl.className = 'bi-life'
  lifeEl.textContent = `${t('ui.life')}: ${building.life.toFixed(0)}/${building.maxLife}`
  main.appendChild(lifeEl)

  // Production info
  if (building.attackDamage === undefined && building.productionCooldown > 1000 && building.productionTimer !== undefined) {
    const prodEl = document.createElement('span')
    prodEl.className = 'bi-extra'
    prodEl.textContent = `${t('ui.producing')}: ${(building.productionTimer / 1000).toFixed(1)}s / ${(building.productionCooldown / 1000).toFixed(1)}s`
    main.appendChild(prodEl)
  }

  // Workers
  if (building.maxWorkers > 0 && building instanceof WorkerBuilding) {
    const wEl = document.createElement('span')
    wEl.className = 'bi-extra'
    wEl.textContent = `${t('ui.workers')}: ${building.assignedWorkers?.length ?? 0} / ${building.maxWorkers}`
    main.appendChild(wEl)
  }

  // Attack stats
  if (building.attackDamage !== undefined) {
    const statsEl = document.createElement('span')
    statsEl.className = 'bi-stats'
    statsEl.textContent = `${t('ui.atk')}: ${building.attackDamage}  ${t('ui.spd')}: ${(1000 / building.attackCooldown).toFixed(2)}/s  ${t('ui.range')}: ${(building.attackRange / SPRITE_SIZE).toFixed(1)} ${t('ui.tiles')}`
    main.appendChild(statsEl)
  }

  infoPanel.appendChild(main)

  // Market UI
  if (building.type === Building.TYPES.MARKET) {
    const marketArea = document.createElement('div')
    marketArea.className = 'bi-actions'
    marketArea.style.flexDirection = 'column'
    marketArea.style.alignItems = 'flex-start'
    marketArea.style.gap = '4px'

    const sellRow = document.createElement('div')
    sellRow.className = 'bi-sell-row'
    const sellLabel = document.createElement('span')
    sellLabel.style.color = '#FFD700'
    sellLabel.style.fontFamily = 'system-ui'
    sellLabel.style.fontSize = '13px'
    sellLabel.textContent = `${t('ui.sell')}: `
    sellRow.appendChild(sellLabel)

    const sellResources = [
      { name: 'wood', icon: '🪵' },
      { name: 'water', icon: '💧' },
      { name: 'stone', icon: '🪨' },
      { name: 'gold', icon: '🪙' }
    ]
    for (const res of sellResources) {
      const sb = document.createElement('button')
      sb.className = 'bi-sell-btn' + (building.sellingResource === res.name ? ' active' : '')
      sb.textContent = res.icon
      sb.addEventListener('click', (e) => {
        e.stopPropagation()
        building.setSellingResource(res.name)
        renderBuildingInfo(building)
      })
      sellRow.appendChild(sb)
    }
    marketArea.appendChild(sellRow)

    const sellingInfo = document.createElement('span')
    sellingInfo.style.color = '#fff'
    sellingInfo.style.fontFamily = 'system-ui'
    sellingInfo.style.fontSize = '12px'
    sellingInfo.textContent = t('ui.selling', { resource: building.sellingResource, price: building.sellingPrice })
    marketArea.appendChild(sellingInfo)

    infoPanel.appendChild(marketArea)
  }

  // Actions area
  const actionsDiv = document.createElement('div')
  actionsDiv.className = 'bi-actions'

  const branchChoices = building.getBranchChoices?.()
  const specializationChoices = building.getSpecializationChoices?.()
  const upgradeCosts = building.getUpgradeCosts()
  const upgradeBenefits = building.getUpgradeBenefits()
  const hasBothActions = specializationChoices && upgradeCosts && upgradeBenefits

  if (branchChoices) {
    // Tower branch selection
    for (const branch of branchChoices) {
      const canAfford = Object.entries(branch.costs).every(
        ([r, a]) => (gameState.humanPlayer.resources[r] || 0) >= a
      )
      const btn = document.createElement('button')
      btn.className = 'bi-btn' + (canAfford ? '' : ' unaffordable')
      btn.disabled = !canAfford

      const branchName = branch.key ? t(`buildings.${branch.key}.name`) : branch.name
      const statsLabel = branch.key ? t(`buildings.${branch.key}.description`) : branch.description

      if (branch.sprite) {
        const iconEl = document.createElement('img')
        iconEl.className = 'bi-btn-icon'
        iconEl.src = branch.sprite
        iconEl.alt = ''
        btn.appendChild(iconEl)
      }

      const textEl = document.createElement('div')
      textEl.className = 'bi-btn-text'

      const titleEl2 = document.createElement('span')
      titleEl2.className = 'bi-btn-title'
      titleEl2.textContent = branchName
      textEl.appendChild(titleEl2)

      const subEl = document.createElement('span')
      subEl.className = 'bi-btn-sub'
      subEl.textContent = statsLabel
      textEl.appendChild(subEl)

      textEl.appendChild(_makeCostEl(branch.costs))
      btn.appendChild(textEl)

      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        if (building.handleBranchUpgrade(branch)) {
          renderBuildingInfo(building)
        }
      })
      actionsDiv.appendChild(btn)
    }
  } else if (hasBothActions) {
    if (specMode) {
      // Back button
      const backBtn = document.createElement('button')
      backBtn.className = 'bi-back-btn'
      backBtn.textContent = '← ' + t('menu.back')
      backBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        renderBuildingInfo(building, false)
      })
      actionsDiv.appendChild(backBtn)

      // Spec choices
      for (const choice of specializationChoices) {
        const canAfford = Object.entries(choice.costs).every(
          ([r, a]) => (gameState.humanPlayer.resources[r] || 0) >= a
        )
        const btn = document.createElement('button')
        btn.className = 'bi-btn' + (canAfford ? '' : ' unaffordable')
        btn.disabled = !canAfford

        const choiceName = choice.type.key ? t(`buildings.${choice.type.key}.name`) : choice.type.name
        const choiceDesc = choice.type.key ? t(`buildings.${choice.type.key}.description`) : choice.type.description

        if (choice.type.sprite) {
          const iconEl = document.createElement('img')
          iconEl.className = 'bi-btn-icon'
          iconEl.src = choice.type.sprite
          iconEl.alt = ''
          btn.appendChild(iconEl)
        }

        const textEl = document.createElement('div')
        textEl.className = 'bi-btn-text'

        const t1 = document.createElement('span')
        t1.className = 'bi-btn-title'
        t1.textContent = choiceName
        textEl.appendChild(t1)

        const t2 = document.createElement('span')
        t2.className = 'bi-btn-sub'
        t2.textContent = choiceDesc
        textEl.appendChild(t2)

        textEl.appendChild(_makeCostEl(choice.costs))
        btn.appendChild(textEl)

        btn.addEventListener('click', (e) => {
          e.stopPropagation()
          if (building.handleSpecialization(choice.typeName)) {
            renderBuildingInfo(building)
          }
        })
        actionsDiv.appendChild(btn)
      }
    } else {
      // Specialize button (primary)
      const canAffordAnySpec = specializationChoices.some(c =>
        Object.entries(c.costs).every(([r, a]) => (gameState.humanPlayer.resources[r] || 0) >= a)
      )
      const specBtn = document.createElement('button')
      specBtn.className = 'bi-btn' + (canAffordAnySpec ? '' : ' unaffordable')
      const specText = document.createElement('div')
      specText.className = 'bi-btn-text'
      const specTitle = document.createElement('span')
      specTitle.className = 'bi-btn-title'
      specTitle.textContent = t('ui.specialize') + ' →'
      specText.appendChild(specTitle)
      const specNames = specializationChoices.map(c => c.type.key ? t(`buildings.${c.type.key}.name`) : c.type.name).join(' · ')
      const specSub = document.createElement('span')
      specSub.className = 'bi-btn-sub'
      specSub.textContent = specNames
      specText.appendChild(specSub)
      specBtn.appendChild(specText)
      specBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        renderBuildingInfo(building, true)
      })
      actionsDiv.appendChild(specBtn)

      // Upgrade button (secondary)
      const canAffordUpgrade = gameState.humanPlayer.canAffordUpgrade(building)
      actionsDiv.appendChild(_makeUpgradeButton(building, canAffordUpgrade, upgradeBenefits, upgradeCosts))
    }
  } else if (specializationChoices) {
    // Only specialization
    for (const choice of specializationChoices) {
      const canAfford = Object.entries(choice.costs).every(
        ([r, a]) => (gameState.humanPlayer.resources[r] || 0) >= a
      )
      const btn = document.createElement('button')
      btn.className = 'bi-btn' + (canAfford ? '' : ' unaffordable')
      btn.disabled = !canAfford

      const choiceName = choice.type.key ? t(`buildings.${choice.type.key}.name`) : choice.type.name
      const choiceDesc = choice.type.key ? t(`buildings.${choice.type.key}.description`) : choice.type.description

      if (choice.type.sprite) {
        const iconEl = document.createElement('img')
        iconEl.className = 'bi-btn-icon'
        iconEl.src = choice.type.sprite
        iconEl.alt = ''
        btn.appendChild(iconEl)
      }

      const textEl = document.createElement('div')
      textEl.className = 'bi-btn-text'

      const t1 = document.createElement('span')
      t1.className = 'bi-btn-title'
      t1.textContent = choiceName
      textEl.appendChild(t1)

      const t2 = document.createElement('span')
      t2.className = 'bi-btn-sub'
      t2.textContent = choiceDesc
      textEl.appendChild(t2)

      textEl.appendChild(_makeCostEl(choice.costs))
      btn.appendChild(textEl)

      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        if (building.handleSpecialization(choice.typeName)) {
          renderBuildingInfo(building)
        }
      })
      actionsDiv.appendChild(btn)
    }
  } else if (upgradeCosts && upgradeBenefits) {
    // Only upgrade
    const canAffordUpgrade = gameState.humanPlayer.canAffordUpgrade(building)
    actionsDiv.appendChild(_makeUpgradeButton(building, canAffordUpgrade, upgradeBenefits, upgradeCosts))
  }

  if (actionsDiv.children.length > 0) {
    infoPanel.appendChild(actionsDiv)
  }
}

function _makeUpgradeButton(building, canAfford, benefits, costs) {
  const btn = document.createElement('button')
  btn.className = 'bi-btn' + (canAfford ? '' : ' unaffordable')
  btn.disabled = !canAfford

  const iconEl = document.createElement('img')
  iconEl.className = 'bi-btn-icon'
  iconEl.src = 'assets/ui/upgrade.png'
  iconEl.alt = ''
  btn.appendChild(iconEl)

  const textEl = document.createElement('div')
  textEl.className = 'bi-btn-text'

  const titleEl3 = document.createElement('span')
  titleEl3.className = 'bi-btn-title'
  titleEl3.textContent = 'Upgrade'
  textEl.appendChild(titleEl3)

  // Benefits summary
  let benefitsArr = []
  if (benefits.life) benefitsArr.push(t('ui.lifeUpgrade', { amount: benefits.life }))
  if (benefits.attackDamage) benefitsArr.push(t('ui.atkUpgrade', { amount: benefits.attackDamage }))
  if (benefits.cooldown) benefitsArr.push(t('ui.cooldownUpgrade', { amount: benefits.cooldown }))
  if (benefits.range) benefitsArr.push(t('ui.rangeUpgrade', { amount: (benefits.range / getTileSize()).toFixed(1) }))
  if (benefits.productionSpeed) benefitsArr.push(t('ui.productionSpeedUpgrade', { amount: benefits.productionSpeed }))
  if (benefits.maxWorkers) benefitsArr.push(t('ui.maxWorkersUpgrade', { amount: benefits.maxWorkers }))

  if (benefitsArr.length > 0) {
    const subEl2 = document.createElement('span')
    subEl2.className = 'bi-btn-sub'
    subEl2.textContent = benefitsArr.join(', ')
    textEl.appendChild(subEl2)
  }

  textEl.appendChild(_makeCostEl(costs))
  btn.appendChild(textEl)

  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    building.handleBuildingUpgrade()
    addButtonSparkles(e)
  })
  return btn
}

function hideBuildingInfoDOM() {
  const slotsPanel = document.getElementById('building-slots-panel')
  const infoPanel = document.getElementById('building-info-panel')
  infoPanel.classList.remove('visible')
  infoPanel.innerHTML = ''
  slotsPanel.style.display = ''
  renderBuildingSlots()
}

// ── Main UI init ───────────────────────────────────────────────

/**
 * Initialize UI components
 * @param {Object} mouseInstance - Mouse controller instance
 */
async function initUI(mouseInstance) {
  if(!mouse) {
    // Subscribe to state changes
    gameState.events.on('debug-changed', (value) => {
      statsText.visible = value
      if (statsBackground) statsBackground.visible = value
    })

    gameState.events.on('game-status-changed', async (status) => {
      if (status === 'playing') {
        playConfirmSound()

        document.getElementById('homeMenu').style.opacity = 0
        setTimeout(() => {
          document.getElementById('homeMenu').style.display = 'none'
        }, 600)

        showGameUI()
        renderBuildingSlots()

        // Show objectives panel if in campaign mode
        const objPanel = document.getElementById('objectives-panel')
        if (gameState.settings?.gameMode === 'campaign') {
          objPanel?.classList.add('visible')
        } else {
          objPanel?.classList.remove('visible')
        }

        // Re-render building slots when campaign phase changes (allowed buildings may change)
        gameState.events.on('campaign-phase-changed', () => {
          renderBuildingSlots()
        })

        // Subscribe to resource changes
        if (_resourcesChangedHandler) {
          gameState.humanPlayer?.events.off?.('resources-changed', _resourcesChangedHandler)
        }
        _resourcesChangedHandler = () => {
          updateResourceDisplay(gameState.humanPlayer.getResources())
        }
        if (gameState.humanPlayer) {
          gameState.humanPlayer.events.on('resources-changed', _resourcesChangedHandler)
          // Initial resource display
          updateResourceDisplay(gameState.humanPlayer.getResources())
        }

        // Subscribe to building selection
        if (_selectedBuildingChangedHandler) {
          gameState.events.off?.('selected-building-changed', _selectedBuildingChangedHandler)
        }
        _selectedBuildingChangedHandler = (building) => {
          currentSpecMode = false
          if (building) {
            renderBuildingInfo(building)
          } else {
            hideBuildingInfoDOM()
          }
        }
        gameState.events.on('selected-building-changed', _selectedBuildingChangedHandler)

        // Resize canvas for bars
        viewportChange()

      } else if (status === 'paused') {
        playCloseSound()

        // Remove preview sprite if it exists
        if (buildingPreviewSprite && buildingPreviewSprite.parent) {
          buildingPreviewSprite.parent.removeChild(buildingPreviewSprite)
          buildingPreviewSprite = null
        }
        selectedBuildingType = null
        selectedBuildingIndex = -1

      } else if (status === 'menu') {
        playClickSound()

        // Remove preview sprite if it exists
        if (buildingPreviewSprite?.parent) {
          buildingPreviewSprite.parent.removeChild(buildingPreviewSprite)
          buildingPreviewSprite = null
        }
        selectedBuildingType = null
        selectedBuildingIndex = -1

        // Show home menu
        document.getElementById('homeMenu').style.display = 'flex'
        setTimeout(() => {
          document.getElementById('homeMenu').style.opacity = 1
        }, 20)

        document.getElementById('objectives-panel')?.classList.remove('visible')
        hideGameUI()
        viewportChange()

      } else if (status === 'gameOver' || status === 'win') {
        document.getElementById('objectives-panel')?.classList.remove('visible')
        hideGameUI()
        viewportChange()
      }
    })
  } else if (gameState.gameStatus === 'playing') {
    showGameUI()
    renderBuildingSlots()
  }

  mouse = mouseInstance
  gameState.UI = { mouse: mouse }

  // Create cursor sprite
  if (mouse?.sprite) {
    cursorSprite = new PIXI.Sprite(mouse.sprite)
    cursorSprite.pivot.set(4.5, 4.5) // Center the cursor
    containers.ui.addChild(cursorSprite)

    // Start dedicated cursor update loop
    updateCursor()
  }

  // Create debug stats background
  statsBackground = new PIXI.Graphics()
  statsBackground.position.set(5, 33)
  statsBackground.visible = DEBUG()
  containers.ui.addChild(statsBackground)

  // Create debug stats text
  statsText = new PIXI.Text({
    text: '',
    style: {
      fontFamily: UI_FONTS.MONOSPACE,
      fontSize: 14 * (window.devicePixelRatio || 1),
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: 2
    },
    resolution: window.devicePixelRatio || 1
  })
  statsText.position.set(10, 38)
  statsText.scale.set(1 / (window.devicePixelRatio || 1))
  statsText.visible = DEBUG()
  containers.ui.addChild(statsText)
}

/**
 * Recreate UI elements after renderer recreation
 * Call this after containers have been recreated
 */
function recreateUIElements() {
  // Recreate debug stats background
  statsBackground = new PIXI.Graphics()
  statsBackground.position.set(5, 33)
  statsBackground.visible = DEBUG()
  containers.ui.addChild(statsBackground)

  // Recreate debug stats text
  statsText = new PIXI.Text({
    text: '',
    style: {
      fontFamily: UI_FONTS.MONOSPACE,
      fontSize: 14 * (window.devicePixelRatio || 1),
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: 2
    },
    resolution: window.devicePixelRatio || 1
  })
  statsText.position.set(10, 38)
  statsText.scale.set(1 / (window.devicePixelRatio || 1))
  statsText.visible = DEBUG()
  containers.ui.addChild(statsText)

  // Recreate cursor sprite if mouse exists
  if (mouse?.sprite) {
    cursorSprite = new PIXI.Sprite(mouse.sprite)
    cursorSprite.pivot.set(4.5, 4.5)
    containers.ui.addChild(cursorSprite)
  }
}

/**
 * Setup all event listeners for UI interaction
 */
function setupEventListeners() {

  // Keyboard shortcuts
  window.addEventListener('keypress', (event) => {
    // Don't prevent default if user is typing in an input field
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
      return
    }

    event.preventDefault()
    switch(event.key) {
      case 'd':
        toggleDebug()
        break
      case 'h':
        gameState.showHealthBars = !gameState.showHealthBars
        showDebugMessage(gameState.showHealthBars ? t('ui.healthBarsOn') : t('ui.healthBarsOff'))
        break
      case 'u':
        if (gameState.selectedBuilding && gameState.humanPlayer.canAffordUpgrade(gameState.selectedBuilding)) {
          gameState.selectedBuilding.handleBuildingUpgrade()
          addButtonSparkles({ clientX: window.innerWidth / 2, clientY: window.innerHeight - CONSTANTS.UI.BOTTOM_BAR_HEIGHT / 2 })
        }
        break
    }
  })

  setupGameMenuEventListeners()
}

/**
 * Setup event listeners for the in-game menu
 */
function setupGameMenuEventListeners() {
  const gameMenuSection = document.getElementById('gameMenuSection')
  const closeButton = gameMenuSection.querySelector('.close')
  const resumeGameButton = document.getElementById('resumeGame')
  const openOptionsButton = document.getElementById('openOptionsFromGame')
  const resetMapButton = document.getElementById('resetMap')
  const quitToHomeButton = document.getElementById('quitToHome')
  const exportMapButton = document.getElementById('exportMapButton')

  // Resume game button
  resumeGameButton.addEventListener('click', closeGameMenu)

  // Close button
  closeButton.addEventListener('click', closeGameMenu)

  // Options button - open options on top of the game menu (keep game menu open)
  openOptionsButton.addEventListener('click', () => {
    playClickSound()
    openOptionsModal()
  })

  // Reset map button
  resetMapButton.addEventListener('click', resetCurrentMap)

  // Quit to home button
  quitToHomeButton.addEventListener('click', quitToHome)

  // Export map button
  exportMapButton.addEventListener('click', handleExportMap)

  // Close the modal if the user clicks outside of it
  window.addEventListener('click', (event) => {
    if (event.target === gameMenuSection) {
      closeGameMenu('game')
    }
  })

  // Escape key toggles the menu
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (gameMenuSection.classList.contains('show')) {
        closeGameMenu('game')
      } else if (gameState.gameStatus === 'playing') {
        openGameMenu()
      }
    }
  })
}

/**
 * Open the Options modal from in-game
 */
function openOptionsModal() {
  const optionsSection = document.getElementById('optionsSection')
  const debugToggle = document.getElementById('debugToggle')
  const healthBarsToggle = document.getElementById('healthBarsToggle')
  const fullscreenToggle = document.getElementById('fullscreenToggle')
  const antialiasingToggle = document.getElementById('antialiasingToggle')
  const antialiasingStatus = document.getElementById('antialiasingStatus')
  const fpsCapSelect = document.getElementById('fpsCapSelect')
  const fpsCapValue = document.getElementById('fpsCapValue')
  const sfxVolumeSlider = document.getElementById('sfxVolumeSlider')
  const musicVolumeSlider = document.getElementById('musicVolumeSlider')

  // Set current values based on game settings
  debugToggle.checked = gameState.settings?.debugMode === true
  healthBarsToggle.checked = gameState.settings?.showHealthBars === true
  fullscreenToggle.checked = gameState.settings?.fullscreen ?? false
  antialiasingToggle.checked = gameState.settings?.antialiasing ?? false
  fpsCapSelect.value = gameState.settings?.fpsCap ?? 0
  sfxVolumeSlider.value = gameState.settings?.sfxVolume ?? 0.8
  musicVolumeSlider.value = gameState.settings?.musicVolume ?? 0.5
  const languageSelect = document.getElementById('languageSelect')
  if (languageSelect) languageSelect.value = getLanguage()

  // Update antialiasing status text
  if (antialiasingToggle.checked) {
    antialiasingStatus.textContent = '(2x resolution)'
  } else {
    antialiasingStatus.textContent = ''
  }

  // Show the modal
  optionsSection.style.display = 'block'
  setTimeout(() => {
    optionsSection.classList.add('show')
  }, 20)
}

/**
 * Handle mouse interactions with the game
 * @param {Array} map - Game map
 * @param {Object} player - Player object
 */
function handleMouseInteraction(map, player) {
  // Right-click cancels building placement
  if (mouse?.rightClicked) {
    mouse.rightClicked = false
    if (selectedBuildingIndex >= 0) {
      handleBuildingSelect(selectedBuildingIndex) // toggles off
    }
  }

  // Update building preview if a building type is selected
  if (selectedBuildingType) {
    updateBuildingPreview()

    // Handle mouse click to place building
    if (mouse?.clicked) {
      // Check if player can afford the building
      if (isValidPlacement && player.canAffordBuilding(selectedBuildingType)) {
        // Create the building
        player.addBuilding(mouse.x, mouse.y, selectedBuildingType)

        // Show message
        const placedName = selectedBuildingType.key ? t(`buildings.${selectedBuildingType.key}.name`) : selectedBuildingType.name
        showDebugMessage(t('ui.placed', { name: placedName }))

        // Clear selection
        if (selectedBuildingIndex >= 0) {
          handleBuildingSelect(selectedBuildingIndex)
        }

        // Request background redraw
        drawBack()
      }
    }
  }

  // Always consume the click so stale clicks don't trigger placements
  if (mouse?.clicked) {
    mouse.clicked = false
  }

  // Handle zoom changes
  if (mouse?.zoomChanged) {
    updateZoom()

    statsText.style.fontSize = 14 * (window.devicePixelRatio || 1)
    statsText.resolution = window.devicePixelRatio || 1
    statsText.scale.set(1 / (window.devicePixelRatio || 1))

    // Remove preview sprite if it exists
    if (buildingPreviewSprite && buildingPreviewSprite.parent) {
      buildingPreviewSprite.parent.removeChild(buildingPreviewSprite)
      buildingPreviewSprite = null
    }
    // Recreate the preview sprite
    updateBuildingPreview()

    drawBack()
    mouse.zoomChanged = false
  }
}

function updateCursor() {
  // Only update if cursor sprite and mouse exist
  if (cursorSprite && mouse) {
    cursorSprite.position.set(mouse.xPixels, mouse.yPixels);
  }

  // Continue the cursor update loop
  cursorUpdateRafId = requestAnimationFrame(updateCursor);
}

/**
 * Update UI elements
 * @param {number} fps - Current FPS value
 */
function updateUI(fps) {
  const now = performance.now()

  // Only update debug UI every 250ms (4 times per second) to reduce CPU usage
  if ((DEBUG() && now - elapsedUI > 250)) {
    drawUI(fps)
    elapsedUI = now
  }
}

/**
 * Draw UI elements
 * @param {number} fps - Current FPS value
 */
function drawUI(fps) {
  // Update debug stats text
  const unitsCount = gameState.humanPlayer?.getUnits().length
  const aiUnitsCount = gameState.aiPlayers?.reduce((sum, ai) => sum + ai.getUnits().length, 0)
  const viewTransform = mouse.getViewTransform()

  const { width: MAP_WIDTH, height: MAP_HEIGHT } = getMapDimensions()
  const SPRITE_SIZE = getTileSize()

  const pathfindingStats = getPathfindingStats()
  const renderStats = getRenderStats()

  // Calculate viewport dimensions
  const viewportTiles = renderStats.viewportTiles
  const viewportWidth = viewportTiles.endX - viewportTiles.startX
  const viewportHeight = viewportTiles.endY - viewportTiles.startY
  const totalViewportTiles = viewportWidth * viewportHeight

  // Format background sprite info (bitmap vs individual sprites)
  const backgroundInfo = renderStats.backgroundSpritesVisible === 1 ? '1 (bitmap)' : String(renderStats.backgroundSpritesVisible)

  statsText.text = [
    `== Performance ==`,
    `FPS: ${fps.toFixed(1)} | Frame Time: ${(1000 / fps).toFixed(2)}ms`,
    `DPR: ${getCanvasDimensions().dpr}:${globalThis.devicePixelRatio || 1}`,
    ``,
    `== Rendering ==`,
    `Map: ${MAP_WIDTH}x${MAP_HEIGHT} tiles (${renderStats.tilesRendered} total)`,
    `Visible Sprites: ${renderStats.backgroundSpritesVisible + renderStats.worldObjectSpritesVisible + renderStats.unitSpritesVisible}`,
    `  - Background: ${backgroundInfo}`,
    `  - World Objects: ${renderStats.worldObjectSpritesVisible}`,
    `  - Units: ${renderStats.unitSpritesVisible}`,
    `Particles: ${containers.particles.children?.length}`,
    ``,
    `== Sprite Maps (Cached) ==`,
    `World Objects: ${worldObjectSpriteMap.size}`,
    `Units: ${unitSpriteMap.size} | Indicators: ${indicatorMap.size}`,
    ``,
    `== Game State ==`,
    `Status: ${gameState.gameStatus}`,
    `Units: ${unitsCount} human, ${aiUnitsCount} AI`,
    `Zoom: ${viewTransform.scale?.toFixed(2)}x`,
    `Mouse: (${mouse.x}, ${mouse.y}) World: (${mouse.worldX.toFixed(0)}, ${mouse.worldY.toFixed(0)})${mouse.isDragging ? ' [dragging]' : ''}`,
    `Pathfinding (/s): ${pathfindingStats.map((count, i) => `W${i}: ${count}`).join(', ')}`,
    ``,
    `== Map ==`,
    `Size: ${MAP_WIDTH}x${MAP_HEIGHT} (${MAP_WIDTH*SPRITE_SIZE}x${MAP_HEIGHT*SPRITE_SIZE}px)`,
    `Renderer: ${app.renderer.width}x${app.renderer.height}`,
  ].join('\n')

  // Update background size to match text
  if (statsBackground && statsText) {
    const padding = 8
    const textBounds = statsText.getBounds()
    statsBackground.clear()
      .roundRect(0, 0, textBounds.width + padding * 2, textBounds.height + padding * 2, 6)
      .fill({ color: 0x000000, alpha: 0.7 })
  }
}

// ── Building slot selection ────────────────────────────────────

function handleBuildingSelect(index) {
  // If clicking same building, deselect it
  if (selectedBuildingIndex === index) {
    selectedBuildingIndex = -1
    selectedBuildingType = null

    // Remove preview sprite if it exists
    if (buildingPreviewSprite && buildingPreviewSprite.parent) {
      buildingPreviewSprite.parent.removeChild(buildingPreviewSprite)
      buildingPreviewSprite = null
    }
    _refreshSlotAffordability()
    return
  }

  const bt = getBuildingList()[index]
  if (!bt) return

  selectedBuildingIndex = index
  selectedBuildingType = bt

  const canAfford = gameState.humanPlayer.canAffordBuilding(bt)
  _refreshSlotAffordability()

  const costs = gameState.humanPlayer.getBuildingCost(bt)
  const costText = Object.entries(costs).map(([r, a]) => `${r}: ${a}`).join(', ')
  const slotName = bt.key ? t(`buildings.${bt.key}.name`) : bt.name
  const statusMessage = canAfford ?
    t('ui.selectedForPlacement', { name: slotName }) :
    t('ui.cannotAfford', { name: slotName, costs: costText })
  showDebugMessage(statusMessage)

  if (!canAfford) {
    selectedBuildingIndex = -1
    selectedBuildingType = null
    _refreshSlotAffordability()
  }
}

// ── Building placement preview ─────────────────────────────────

function isValidBuildingPosition(x, y) {
  // Check if coordinates are in bounds
  if (!gameState.map[x] || !gameState.map[x][y]) return false

  // For quarry, check if it's placed on ROCK tile
  if (selectedBuildingType === Building.TYPES.QUARRY) {
    return gameState.map[x][y].type === 'ROCK';
  }

  // For gold mine, check if it's placed on GOLD tile
  if (selectedBuildingType === Building.TYPES.GOLD_MINE) {
    return gameState.map[x][y].type === 'GOLD';
  }

  // For well, check if it's placed next to WATER tile
  if (selectedBuildingType === Building.TYPES.WELL) {
    // Check orthogonal and diagonal neighbors for water
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue // Skip the center tile

        const nx = x + dx
        const ny = y + dy

        // Check bounds
        if (nx >= 0 && nx < getMapDimensions().width &&
            ny >= 0 && ny < getMapDimensions().height) {
          // Check if this neighbor is water
          if (gameState.map[nx][ny].type === 'WATER') {
            // Target tile must be grass or sand
            return ['GRASS', 'SAND'].includes(gameState.map[x][y].type)
          }
        }
      }
    }
    return false // No adjacent water found
  }

  // For other buildings, only allow building on grass or sand tiles
  return ['GRASS', 'SAND'].includes(gameState.map[x][y].type)
}

/**
 * Draw a building sprite preview following the mouse cursor.
 */
async function updateBuildingPreview() {
  if (!selectedBuildingType || !mouse) return

  const viewTransform = gameState.UI?.mouse?.getViewTransform()

  // Create preview sprite if it doesn't exist
  if (!buildingPreviewSprite) {
    // Load the building sprite texture
    const spriteX = selectedBuildingType.sprite_coords.cyan.x
    const spriteY = selectedBuildingType.sprite_coords.cyan.y
    buildingPreviewSprite = new PIXI.Sprite(sprites[`tile_${spriteX}_${spriteY}`])
    buildingPreviewSprite.anchor.set(0.5, 0.5)
    containers.ui.addChild(buildingPreviewSprite)
  }

  // Check if the current position is valid
  isValidPlacement = isValidBuildingPosition(mouse.x, mouse.y)

  // Update preview position
  const tileSize = getTileSize()

  // Convert grid coordinates to world coordinates (center of the tile)
  const worldX = (mouse.x * tileSize) + (tileSize / 2)
  const worldY = (mouse.y * tileSize) + (tileSize / 2)

  // Convert world coordinates to screen coordinates (with zoom)
  const screenX = (worldX - viewTransform.x) * viewTransform.scale
  const screenY = (worldY - viewTransform.y) * viewTransform.scale

  // Update preview position to be at the center of the grid tile
  buildingPreviewSprite.x = screenX
  buildingPreviewSprite.y = screenY
  buildingPreviewSprite.scale.set(viewTransform.scale)

  // Set tint color based on validity (green if valid, red if invalid)
  buildingPreviewSprite.tint = isValidPlacement ? 0x00FF00 : 0xFF0000

  // Set alpha for better visibility
  buildingPreviewSprite.alpha = 0.7
}

// ── Sparkles ───────────────────────────────────────────────────

/**
 * Add sparkle effect at button position
 * @param {Object} event - The click/touch event
 */
function addButtonSparkles(event) {
  const x = event.clientX || (event.touches ? event.touches[0].clientX : 0)
  const y = event.clientY || (event.touches ? event.touches[0].clientY : 0)

  createParticleEmitter(ParticleEffect.UI_BUTTON_CLICK, {
    x: x,
    y: y,
    duration: 500
  })
}

// ── Game menu ──────────────────────────────────────────────────

/**
 * Open the game menu modal, pausing the game
 */
function openGameMenu() {
  gameState.gameStatus = 'paused'

  // Update map info display
  updateMapInfo()

  // Show the menu
  const gameMenuSection = document.getElementById('gameMenuSection')
  gameMenuSection.style.display = 'block'

  // Slight delay for fade-in effect
  setTimeout(() => {
    gameMenuSection.classList.add('show')
  }, 20)
}

/**
 * Update the map information display in the game menu
 */
function updateMapInfo() {
  const seedElement = document.getElementById('currentMapSeed')
  const sizeElement = document.getElementById('currentMapSize')

  // Check if this is a custom map
  if (gameState.customMapId) {
    // Display custom map ID
    seedElement.textContent = gameState.customMapId
    // Show custom map name if available
    if (gameState.customMapData?.name) {
      seedElement.title = gameState.customMapData.name
    }
  } else {
    // Display seed or "Random" if no seed
    if (gameState.mapSeed !== null && gameState.mapSeed !== undefined) {
      seedElement.textContent = gameState.mapSeed
    } else {
      seedElement.textContent = t('ui.random')
    }
  }

  // Display map size
  const mapSizeLabel = gameState.settings.mapSize || 'medium'
  sizeElement.textContent = mapSizeLabel.charAt(0).toUpperCase() + mapSizeLabel.slice(1)
}

/**
 * Close the game menu modal, resuming the game
 */
function closeGameMenu(destination) {
  const gameMenuSection = document.getElementById('gameMenuSection')
  gameMenuSection.classList.remove('show')

  playCloseSound()

  // Wait for transition to complete before hiding and resuming
  setTimeout(() => {
    gameMenuSection.style.display = 'none'

    // Resume game state unless navigating away
    if (destination !== 'home' && destination !== 'reset') {
      gameState.gameStatus = 'playing'
    }
  }, 250) // Same as transition time
}

/**
 * Reset the current map while keeping the same seed
 */
function resetCurrentMap() {
  // Close the menu first
  closeGameMenu('reset')

  console.log('Reset to Map Seed: ', gameState.mapSeed)
  gameState.gameStatus = 'initialize'

  showDebugMessage(t('ui.resettingMap'))
}

/**
 * Quit to the home menu
 */
function quitToHome() {
  // Close the menu first
  closeGameMenu('home')

  // Set game status to menu (triggers hideGameUI via event listener)
  gameState.gameStatus = 'menu'

  showDebugMessage(t('ui.returningToMenu'))
}

/**
 * Handle map export button click
 */
function handleExportMap() {
  playConfirmSound()

  try {
    // Get map name - use custom map name if available, otherwise use seed
    let mapName
    if (gameState.customMapData?.name) {
      mapName = `${gameState.customMapData.name} (Modified)`
    } else if (gameState.mapSeed !== null && gameState.mapSeed !== undefined) {
      mapName = `Map Seed ${gameState.mapSeed}`
    } else {
      mapName = 'Random Map'
    }

    const mapSize = gameState.settings.mapSize || 'medium'
    const description = gameState.customMapData?.description
      ? `Modified from: ${gameState.customMapData.description}`
      : `Exported ${mapSize} map from Pixel Fortress`

    // Download the map as JSON
    const filename = downloadMapJSON(mapName, description)

    showDebugMessage(t('ui.mapExported', { filename }))
  } catch (error) {
    console.error('Error exporting map:', error)
    showDebugMessage(t('ui.errorExportingMap'))
  }
}

// ── Debug message ──────────────────────────────────────────────

const showDebugMessage = async (message) => {
  const debugElement = document.createElement('div')
  debugElement.style.position = 'fixed'
  debugElement.style.bottom = `${CONSTANTS.UI.BOTTOM_BAR_HEIGHT + 8}px`
  debugElement.style.right = '16px'
  debugElement.style.backgroundColor = 'rgba(0,0,0,0.75)'
  debugElement.style.color = '#fff'
  debugElement.style.padding = '5px 10px'
  debugElement.style.borderRadius = '4px'
  debugElement.style.zIndex = '30'
  debugElement.style.fontFamily = 'system-ui, sans-serif'
  debugElement.style.fontSize = '13px'
  debugElement.style.pointerEvents = 'none'
  debugElement.textContent = message
  document.body.appendChild(debugElement)

  setTimeout(() => {
      document.body.removeChild(debugElement)
  }, 3000)
}

// ── Generic modal ──────────────────────────────────────────────

/**
 * Show a generic modal with a title, message, and a close button.
 */
function showModal(title, message, gameStatus, destinationStatus, onCloseCallback) {
  // Pause the game
  gameState.gameStatus = gameStatus

  const modalSection = document.getElementById('genericModalSection')
  const modalTitle = document.getElementById('genericModalTitle')
  const modalMessage = document.getElementById('genericModalMessage')
  const genericCloseButton = document.getElementById('genericModalCloseButton')
  const closeButton = document.getElementById('modalCloseButton')

  modalTitle.textContent = title
  modalMessage.textContent = message

  // Ensure previous listeners are removed to prevent multiple calls
  const newCloseHandler = (event) => {
    event.stopPropagation()
    closeModal(destinationStatus)
    if (onCloseCallback) {
      onCloseCallback()
    }
    genericCloseButton.removeEventListener('click', newCloseHandler)
    closeButton.removeEventListener('click', newCloseHandler)
  }
  genericCloseButton.addEventListener('click', newCloseHandler)
  closeButton.addEventListener('click', newCloseHandler)

  modalSection.style.display = 'block'
  setTimeout(() => {
    modalSection.classList.add('show')
  }, 20)
}

/**
 * Close the generic modal and resume the game.
 */
function closeModal(destination) {
  const modalSection = document.getElementById('genericModalSection')
  modalSection.classList.remove('show')

  setTimeout(() => {
    modalSection.style.display = 'none'
    gameState.gameStatus = destination ?? 'playing'

    if(gameState.gameStatus === 'menu') {
      quitToHome()
    }
  }, 500)
}
