export { Arcana, Archery, Building, CombatBuilding, GoldMine, Quarry, Tent, Well, WorkerBuilding, Barracks, Armory, Citadel, Market, Tower }

'use strict'

import { playBuildingSound } from 'audio'
import CONSTANTS from 'constants'
import { getMapDimensions, getTileSize } from 'dimensions'
import { t } from 'i18n'
import { isPositionVisible } from 'fogOfWar'
import { ParticleEffect, createParticleEmitter } from 'particles'
import { searchPath, updateMapInWorker } from 'pathfinding'
import { Player } from 'players'
import { Projectile } from 'projectile'
import { indicatorMap, removeProgressIndicator, updateProgressIndicator } from 'renderer'
import { sprites } from 'sprites'
import gameState from 'state'
import { showDebugMessage } from 'ui'
import { GoldMiner, LumberjackWorker, Peon, QuarryMiner, WaterCarrier } from 'unit'
import { distance } from 'utils'

const TERRAIN_TYPES = CONSTANTS.TERRAIN.TYPES

/**
 * Apply game mode modifiers to buildings
 * @param {Building} building - The building to modify
 */
function applyGameModeModifiers(building) {
  const gameMode = gameState.settings?.gameMode

  if (gameMode === 'one-shot') {
    // One Shot mode: all buildings have 1 HP
    building.life = 1
    building.maxLife = 1
  } else if (gameMode === 'turbo-gathering') {
    // Turbo Gathering mode: no building-specific modifiers
    // (gathering speed is handled at the unit level)
  }
}

/**
 * Finds the best available spawn location around a building.
 * Calculates a path from the building to the target destination,
 * then uses the first valid tile from that path as the spawn location.
 * @param {number} buildingX - The x-coordinate of the building.
 * @param {number} buildingY - The y-coordinate of the building.
 * @param {number} targetX - The x-coordinate of the target destination.
 * @param {number} targetY - The y-coordinate of the target destination.
 * @returns {Promise<{x: number, y: number}|null>} A promise that resolves to the spawn location or null if none found.
 */
async function findBestSpawnLocation(buildingX, buildingY, targetX, targetY) {
    const { width: MAP_WIDTH, height: MAP_HEIGHT } = getMapDimensions()

    // Calculate path from building to target
    const path = await searchPath(buildingX, buildingY, targetX, targetY)

    if (!path || path.length === 0) {
        // No path found, fallback to adjacent tiles
        return findAdjacentWalkableTile(buildingX, buildingY)
    }

    // Try each tile in the path (starting from first step) until we find a valid spawn location
    for (const tile of path) {
        // Skip the building's own position
        if (tile.x === buildingX && tile.y === buildingY) {
            continue
        }

        // Check if this tile is valid for spawning
        if (isValidSpawnTile(tile.x, tile.y, MAP_WIDTH, MAP_HEIGHT)) {
            return { x: tile.x, y: tile.y }
        }
    }

    // If no tile in path is valid, fallback to adjacent tiles
    return findAdjacentWalkableTile(buildingX, buildingY)
}

/**
 * Checks if a tile is valid for spawning a unit.
 * @param {number} x - The x-coordinate of the tile.
 * @param {number} y - The y-coordinate of the tile.
 * @param {number} mapWidth - The width of the map.
 * @param {number} mapHeight - The height of the map.
 * @returns {boolean} True if the tile is valid for spawning.
 */
function isValidSpawnTile(x, y, mapWidth, mapHeight) {
    // Check map boundaries
    if (x < 0 || x >= mapWidth || y < 0 || y >= mapHeight) {
        return false
    }

    const tile = gameState.map[x][y]

    // Check if the tile is walkable and not occupied
    return tile &&
        tile.type !== TERRAIN_TYPES.WATER.type &&
        tile.type !== TERRAIN_TYPES.ROCK.type &&
        tile.type !== TERRAIN_TYPES.GOLD.type &&
        tile.type !== TERRAIN_TYPES.TREE.type &&
        !tile.building
}

/**
 * Finds any adjacent walkable tile as a fallback.
 * @param {number} x - The x-coordinate of the center tile.
 * @param {number} y - The y-coordinate of the center tile.
 * @returns {{x: number, y: number}|null} An adjacent walkable tile or null if none found.
 */
function findAdjacentWalkableTile(x, y) {
    const { width: MAP_WIDTH, height: MAP_HEIGHT } = getMapDimensions()

    // Check cardinal directions (N, S, E, W)
    const adjacentOffsets = [
        { dx: 0, dy: -1 },  // North
        { dx: 0, dy: 1 },   // South
        { dx: -1, dy: 0 },  // West
        { dx: 1, dy: 0 }    // East
    ]

    for (const offset of adjacentOffsets) {
        const newX = x + offset.dx
        const newY = y + offset.dy

        if (isValidSpawnTile(newX, newY, MAP_WIDTH, MAP_HEIGHT)) {
            return { x: newX, y: newY }
        }
    }

    // no adjacent walkable tile found - fallback to the building tile itself
    return { x: x, y: y }
}


const TREE_PROCESSING_BATCH_SIZE = CONSTANTS.BUILDINGS.TREE_PROCESSING_BATCH_SIZE
const TREE_PROCESSING_DELAY = CONSTANTS.BUILDINGS.TREE_PROCESSING_DELAY


/**
 * Base Building class for all game buildings
 * Handles common building properties and behaviors including:
 * - Health and damage
 * - Positioning on the map
 * - Production timers
 * - Player ownership
 */
class Building {
    static WEIGHT = getMapDimensions().maxWeight / 2 // Movement cost for walking through a building tile

    static TYPES = {
        LUMBERJACK: {
          key: 'lumberjack',
          name: "Wood Hut",
          icon: "🪓",
          costs: { wood: 8 },
          UPGRADES: {
            benefits: { life: 25, maxWorkers: 1 } // +25 life, +1 worker
          },
          description: "Harvests wood from nearby trees",
          details: "Should be placed next to trees.",
          sprite_coords: {
            cyan: { x: 5, y: 33 },
            red: { x: 15, y: 33 },
          },
          sprite: './assets/buildings/axe.png'
        },
        GOLD_MINE: {
          key: 'goldMine',
          name: "Gold Mine",
          icon: "⛏️",
          costs: { wood: 20, stone: 15 },
          UPGRADES: {
            benefits: { life: 25, productionSpeed: 10 } // +25 life, 10% faster
          },
          description: "Mines gold",
          details: "Must be placed on gold ore.",
          sprite_coords: {
            cyan: { x: 6, y: 33 },
            red: { x: 16, y: 33 },
          },
          sprite: './assets/buildings/gold-mine.png'
        },
        QUARRY: {
          key: 'quarry',
          name: "Quarry",
          icon: "🪨",
          costs: { wood: 15 },
          UPGRADES: {
            benefits: { life: 25, productionSpeed: 10 } // +25 life, 10% faster
          },
          description: "Extracts stone",
          details: "Must be placed on rock.",
          sprite_coords: {
            cyan: { x: 6, y: 33 },
            red: { x: 16, y: 33 },
          },
          sprite: './assets/buildings/pick.png'
        },
        WELL: {
          key: 'well',
          name: "Well",
          icon: "🧱",
          costs: { wood: 8, stone: 12 },
          UPGRADES: {
            benefits: { life: 25, maxWorkers: 1 } // +25 life, +1 worker
          },
          description: "Produces water",
          details: "Must be placed next to water.",
          sprite_coords: {
            cyan: { x: 4, y: 37 },
            red: { x: 14, y: 37 },
          },
          sprite: './assets/buildings/well-1.png'
        },
        ARCANA: {
          key: 'arcana',
          name: 'Arcana',
          icon: '🔮',
          costs: { wood: 20, stone: 15, water: 10, gold: 25 },
          UPGRADES: {
            benefits: { life: 50, productionSpeed: 10 }
          },
          description: 'Trains mages',
          details: 'Ranged unit, fires fireballs at long range.',
          sprite_coords: {
            cyan: { x: 9, y: 34 },
            red: { x: 9, y: 34 },
          },
          sprite: './assets/buildings/cristal-ball.png'
        },
        ARCHERY: {
          key: 'archery',
          name: 'Archery',
          icon: '🏹',
          costs: { wood: 20, stone: 10, water: 15, gold: 10 },
          UPGRADES: {
            benefits: { life: 50, productionSpeed: 10 }
          },
          description: 'Trains archers',
          details: 'Ranged unit, good range and moderate damage.',
          sprite_coords: {
            cyan: { x: 6, y: 34 },
            red: { x: 6, y: 34 },
          },
          sprite: './assets/buildings/bow-and-arrow.png'
        },
        BARRACKS: {
          key: 'barracks',
          name: "Barracks",
          icon: "⚔️",
          costs: { wood: 15, water: 10, gold: 5 },
          UPGRADES: {
            benefits: { life: 50, productionSpeed: 10 } // +50 life, 10% faster production
          },
          canSpecializeInto: ['ARMORY', 'CITADEL'],
          description: "Trains soldiers",
          details: "Soldier is basic and versatile.",
          sprite_coords: {
            cyan: { x: 5, y: 34 },
            red: { x: 15, y: 34 },
          },
          sprite: './assets/buildings/crossed-swords.png'
        },
        ARMORY: {
          key: 'armory',
          name: "Armory",
          icon: "🛡️",
          costs: { wood: 25, water: 20, money: 10, gold: 20 },
          UPGRADES: {
            benefits: { life: 75, productionSpeed: 10 } // +75 life, 10% faster production
          },
          description: "Trains heavy infantry",
          details: "Heavy infantry is strong but slow.",
          sprite_coords: {
            cyan: { x: 7, y: 33 },
            red: { x: 17, y: 33 },
          },
          sprite: './assets/buildings/shield.png'
        },
        CITADEL: {
          key: 'citadel',
          name: "Citadel",
          icon: "🏰",
          costs: { wood: 40, water: 40, money: 20, gold: 50 },
          UPGRADES: {
            benefits: { life: 100, productionSpeed: 10 } // +100 life, 10% faster production
          },
          description: "Trains elite warriors",
          details: "Elite warrior has high attack power.",
          sprite_coords: {
            cyan: { x: 8, y: 35 },
            red: { x: 18, y: 35 },
          },
          sprite: './assets/buildings/fleur-de-lis.png'
        },
        MARKET: {
          key: 'market',
          name: "Market",
          icon: "🏦",
          costs: { wood: 10, stone: 10, water: 5, gold: 5 },
          UPGRADES: {
            benefits: { life: 50, sellingPrice: 1 } // +50 life, +1 selling price
          },
          description: "Sell resources against money",
          details: "Automatic exchange of resources for money.",
          sprite_coords: {
            cyan: { x: 5, y: 35 },
            red: { x: 15, y: 35 },
          },
          sprite: './assets/buildings/balance.png'
        },
        TOWER: {
          key: 'tower',
          name: "Tower",
          icon: "🗼",
          costs: { wood: 15, stone: 25 },
          BRANCHES: [
            {
              key: 'bulletTower',
              typeName: 'BULLET_TOWER',
              name: 'Bullet',
              icon: '🗼',
              description: 'Balanced - medium attack, speed and range',
              costs: { wood: 50, stone: 60, gold: 20 },
              initialStats: { life: 230, attackDamage: 8, attackRangeTiles: 6, attackCooldown: 1200 }
            },
            {
              key: 'rapidTower',
              typeName: 'RAPID_TOWER',
              name: 'Rapidfire',
              icon: '🗼',
              description: 'Fast attacks, short range, lower damage',
              costs: { wood: 40, stone: 30, gold: 20 },
              initialStats: { life: 170, attackDamage: 3, attackRangeTiles: 3, attackCooldown: 500 }
            },
            {
              key: 'sniperTower',
              typeName: 'SNIPER_TOWER',
              name: 'Farstrike',
              icon: '🎯',
              description: 'Slow but hits hard at very long range',
              costs: { wood: 30, stone: 80, gold: 40 },
              initialStats: { life: 250, attackDamage: 25, attackRangeTiles: 10, attackCooldown: 4000 }
            }
          ],
          description: "Defensive tower that attacks enemies",
          details: "Specialize into Bullet, Rapidfire or Farstrike.",
          sprite_coords: {
            cyan: { x: 15, y: 26 },
            red: { x: 15, y: 26 },
          },
          sprite: './assets/buildings/tower.png'
        },
        BULLET_TOWER: {
          key: 'bulletTower',
          name: "Bullet",
          icon: "🗼",
          costs: { wood: 30, stone: 40, gold: 20 },
          UPGRADES: {
            benefits: { life: 50, attackDamage: 4, range: 16, cooldown: 10 } // +50 life, +4 atk, +1 tile range, -10% cooldown
          },
          description: "Balanced tower with all-around stats",
          details: "Medium attack power, speed and range.",
          sprite_coords: {
            cyan: { x: 15, y: 26 },
            red: { x: 15, y: 26 },
          },
          sprite: './assets/buildings/tower.png'
        },
        RAPID_TOWER: {
          key: 'rapidTower',
          name: "Rapidfire",
          icon: "🗼",
          costs: { wood: 20, stone: 20, gold: 15 },
          UPGRADES: {
            benefits: { life: 30, attackDamage: 2, range: 8, cooldown: 15 } // +30 life, +2 atk, +0.5 tile range, -15% cooldown
          },
          description: "Fast-firing tower with short range",
          details: "High attack speed, lower damage and range.",
          sprite_coords: {
            cyan: { x: 15, y: 26 },
            red: { x: 15, y: 26 },
          },
          sprite: './assets/buildings/tower.png'
        },
        SNIPER_TOWER: {
          key: 'sniperTower',
          name: "Farstrike",
          icon: "🎯",
          costs: { wood: 20, stone: 60, gold: 30 },
          UPGRADES: {
            benefits: { life: 75, attackDamage: 10, range: 32, cooldown: 5 } // +75 life, +10 atk, +2 tile range, -5% cooldown
          },
          description: "Long-range tower with heavy damage",
          details: "Very slow but hits hard from extreme range.",
          sprite_coords: {
            cyan: { x: 15, y: 26 },
            red: { x: 15, y: 26 },
          },
          sprite: './assets/buildings/tower.png'
        },
        TENT: {
          key: 'tent',
          name: "Tent",
          icon: "⛺",
          costs: { wood: 12, water: 8, stone: 5 },
          UPGRADES: {
            benefits: { life: 50, productionSpeed: 10 } // +50 life, 10% faster production
          },
          canSpecializeInto: ['BARRACKS', 'ARCHERY', 'ARCANA'],
          description: "Produces peons",
          details: "Work work !",
          sprite_coords: {
            cyan: { x: 4, y: 33 },
            red: { x: 14, y: 33 },
          },
          sprite: './assets/buildings/tent.png'
        },
      }

  /**
   * Create a new building
   * @param {number} x - X position in grid coordinates
   * @param {number} y - Y position in grid coordinates
   * @param {number} color - Player colour as 0xRRGGBB hex integer
   * @param {Player} owner - Player who owns this building
   */
  constructor(x, y, color, owner) {
    this.uid = Math.random() * 1000000 | 0
    this.x = x
    this.y = y
    this.color = color
    this.owner = owner
    this.level = 1
    this.life = 100
    this.maxLife = 100
    applyGameModeModifiers(this)
    this.productionTimer = 0
    this.productionCooldown = 10000 // 10 seconds by default
    this.visibilityRange = getTileSize() * 8
    this.type = null
    this.isInitialTent = false // Set to true on the very first Tent each player starts with

    // Progress indicator properties
    this.showProgressIndicator = false
    this.indicatorColor = color
    this.progress = 0
    this.selected = false
    
    // Register building with player
    if (owner) {
      if (!owner.buildings) {
        owner.buildings = []
      }
      owner.buildings.push(this)
    }

    // Position the building onto the map
    // Update map tile to make it hardly walkable
    gameState.map[x][y].weight = Building.WEIGHT
    gameState.map[x][y].type = 'BUILDING'
  }

  /**
   * Get the upgrade costs for the next level of a building.
   * @param {Building} building - The building instance.
   * @returns {Object|null} The costs for the next upgrade, or null if no more upgrades.
   */
  getUpgradeCosts() {
    const nextLevel = this.level + 1
    if (this.getUpgradeBenefits()) {
      return Object.fromEntries(
        Object.entries(this.type.costs).map(([key, value]) => [key, value * nextLevel | 0])
      )
    }
    return null
  }

  /**
   * Get the upgrade benefits for the next level of a building.
   * @param {Building} building - The building instance.
   * @returns {Object|null} The benefits for the next upgrade, or null if no more upgrades.
   */
  getUpgradeBenefits() {
    return this.type.UPGRADES?.benefits
  }

  /**
   * Whether this building can currently be specialized into a sub-type.
   * True only if: not the initial Tent, never upgraded (level === 1), and type defines canSpecializeInto.
   */
  get canSpecialize() {
    return !this.isInitialTent && this.level === 1 && Array.isArray(this.type.canSpecializeInto) && this.type.canSpecializeInto.length > 0
  }

  /**
   * Returns the list of specialization options, or null if none available.
   * Each entry has { typeName, type, costs }.
   */
  getSpecializationChoices() {
    if (!this.canSpecialize) return null
    return this.type.canSpecializeInto.map(typeName => ({
      typeName,
      type: Building.TYPES[typeName],
      costs: Building.TYPES[typeName].costs
    }))
  }

  /**
   * Morph this building in-place into the target specialization.
   * Inherits current HP. Replaces type, production behavior, and sprite.
   * @param {string} targetTypeName - Key in Building.TYPES (e.g. 'BARRACKS')
   */
  specializeInPlace(targetTypeName) {
    const targetType = Building.TYPES[targetTypeName]
    if (!targetType) return

    const currentLife = this.life
    const SPRITE_SIZE = getTileSize()

    // Base max-life values per target type
    const baseMaxLifeMap = {
      BARRACKS: 50, ARCHERY: 100, ARCANA: 120, ARMORY: 150, CITADEL: 250
    }
    const baseMaxLife = baseMaxLifeMap[targetTypeName] || 100

    // Update type and HP
    this.type = targetType
    this.name = targetType.name
    this.maxLife = Math.max(baseMaxLife, currentLife)
    this.life = currentLife
    applyGameModeModifiers(this)

    // Update production settings
    const cooldownMap = {
      BARRACKS: 12000, ARCHERY: 16000, ARCANA: 20000, ARMORY: 20000, CITADEL: 30000
    }
    this.productionCooldown = cooldownMap[targetTypeName] || 15000
    this.productionTimer = 0
    this.progress = 0
    this.indicatorColor = 0xFF0000

    // If this was a Tent (WorkerBuilding), install CombatBuilding update logic
    if (this.produceWorker) {
      this.update = function(delay) {
        Building.prototype.update.call(this, delay)
        this.productionTimer += delay
        this.progress = this.productionTimer / this.productionCooldown
        updateProgressIndicator(this, this.progress)
        if (this.productionTimer >= this.productionCooldown) {
          this.produceWarrior()
          this.productionTimer -= this.productionCooldown
          this.progress = 0
        }
      }
      this.produceWorker = null
    }

    // Install the correct produceWarrior for the target type
    const unitMethodMap = {
      BARRACKS: 'addSoldier',
      ARCHERY: 'addArcher',
      ARCANA: 'addMage',
      ARMORY: 'addHeavyInfantry',
      CITADEL: 'addEliteWarrior',
    }
    const addMethod = unitMethodMap[targetTypeName]
    this.produceWarrior = async function() {
      if (this.owner) {
        const enemy = this.owner.getEnemies()[0]
        if (!enemy) {
          console.warn('No enemy tent found to target for combat unit spawn.')
          return
        }
        const target = enemy.currentNode ? enemy.currentNode : enemy
        const spawnLocation = await findBestSpawnLocation(this.x, this.y, target.x, target.y)
        if (spawnLocation) {
          this.owner[addMethod](spawnLocation.x, spawnLocation.y)
        } else {
          console.warn(`No valid spawn location found from ${this.type.name} at (${this.x}, ${this.y})`)
        }
      }
    }

    // Update sprite on the map tile
    const spriteX = targetType.sprite_coords['cyan'].x
    const spriteY = targetType.sprite_coords['cyan'].y
    const buildingSprite = sprites[`tile_${spriteX}_${spriteY}`]
    gameState.map[this.x][this.y].sprite = buildingSprite
    gameState.map[this.x][this.y].building = this
    this.sprite = buildingSprite
    this.tileX = spriteX
    this.tileY = spriteY

    createParticleEmitter(ParticleEffect.BUILDING_PLACE, {
      x: this.x * SPRITE_SIZE + SPRITE_SIZE / 2,
      y: this.y * SPRITE_SIZE + SPRITE_SIZE / 2,
      duration: 1500
    })

    if (this.owner === gameState.humanPlayer) {
      const specName = targetType.key ? t(`buildings.${targetType.key}.name`) : targetType.name
      showDebugMessage(t('ui.specializedInto', { name: specName }))
    }

    // Refresh the info panel if this building is currently selected
    if (gameState.selectedBuilding === this) {
      gameState.events.emit('selected-building-changed', this)
    }
  }

  /**
   * Check affordability, deduct resources and specialize this building in-place.
   * @param {string} targetTypeName - Key in Building.TYPES (e.g. 'BARRACKS')
   * @returns {boolean} True if specialization succeeded
   */
  handleSpecialization(targetTypeName) {
    if (!this.canSpecialize) return false

    const targetType = Building.TYPES[targetTypeName]
    if (!targetType) return false

    const costs = targetType.costs
    const canAfford = Object.entries(costs).every(
      ([resource, amount]) => (this.owner.resources[resource] || 0) >= amount
    )
    if (!canAfford) {
      if (this.owner === gameState.humanPlayer) {
        const costText = Object.entries(costs).map(([r, a]) => `${r}: ${a}`).join(', ')
        showDebugMessage(t('ui.cannotAffordSpec', { costs: costText }))
      }
      return false
    }

    for (const [resource, amount] of Object.entries(costs)) {
      this.owner.addResource(resource, -amount)
    }

    this.specializeInPlace(targetTypeName)
    return true
  }

  /**
   * Apply an upgrade to the building.
   * @param {Building} building - The building instance.
   */
  async applyUpgrade() {
    const nextLevel = this.level + 1
    const benefits = this.getUpgradeBenefits()
    if (benefits) {
      // Apply benefits
      if (benefits.life) {
        const gameMode = gameState.settings?.gameMode
        if (gameMode === 'one-shot') {
          // In one-shot mode, keep health at 1
          this.maxLife = 1
          this.life = 1
        } else {
          this.maxLife += benefits.life
          this.life += benefits.life
        }
      }
      if (benefits.productionSpeed) {
        this.productionCooldown *= (1 - benefits.productionSpeed / 100)
      }
      if (benefits.maxWorkers) {
        this.maxWorkers += benefits.maxWorkers
      }
      if (benefits.sellingPrice) {
        this.sellingPrice += benefits.sellingPrice
      }
      if(benefits.range) {
        if(this.attackRange) {
          this.attackRange += benefits.range
        }
        if(this.visibilityRange) {
          this.visibilityRange += benefits.range
        }
      }
      if(benefits.cooldown) {
        if(this.attackCooldown) {
          this.attackCooldown *= (1 - benefits.cooldown / 100)
        }
      }
      if(benefits.attackDamage) {
        if(this.attackDamage !== undefined) {
          this.attackDamage += benefits.attackDamage
        }
      }

      this.level = nextLevel
      
      createParticleEmitter(ParticleEffect.BUILDING_PLACE, {
        x: this.x * getTileSize() + getTileSize()/2,
        y: this.y * getTileSize() + getTileSize()/2,
        duration: 1500
      })

      return true
    }
    return false
  }


  /**
   * Handle building upgrade logic.
   */
  async handleBuildingUpgrade() {
    const upgradeCosts = this.getUpgradeCosts()
    if (!upgradeCosts) {
      showDebugMessage(t('ui.noMoreUpgrades'))
      return
    }

    const canAfford = this.owner.canAffordUpgrade(this)

    if (canAfford) {
      // Deduct costs
      for (const [resource, amount] of Object.entries(upgradeCosts)) {
        this.owner.addResource(resource, -amount)
      }

      // Apply upgrade benefits
      this.applyUpgrade()

      const upgradedName = this.type.key ? t(`buildings.${this.type.key}.name`) : this.type.name
      showDebugMessage(t('ui.upgradedToLevel', { name: upgradedName, level: this.level }))

      // Refresh the info panel if this building is currently selected
      if (gameState.selectedBuilding === this) {
        gameState.events.emit('selected-building-changed', this)
      }
    } else {
      const costText = Object.entries(upgradeCosts)
        .map(([resource, amount]) => `${resource}: ${amount}`)
        .join(', ')
      showDebugMessage(t('ui.cannotAffordUpgrade', { costs: costText }))
    }
  }

  /**
   * Properly cleanup object
   */
  async destroy() {
    if (indicatorMap?.has(this.uid)) {
      removeProgressIndicator(this.uid)
    }
  }
  
  /**
   * Update building state
   * @param {number} delay - Time elapsed since last update (ms)
   */
  update(delay) {
    if(this.life <= 0) {
      const tile = gameState.map[this.x][this.y]

      // Save reference to building sprite to destroy it later
      const buildingSprite = tile.sprite

      // Restore original terrain
      tile.sprite = tile.originalSprite
      tile.type = tile.originalType
      tile.weight = tile.originalWeight
      tile.back = tile.originalBack

      tile.originalSprite = undefined
      tile.originalType = undefined
      tile.originalWeight = undefined
      tile.originalBack = undefined

      // Destroy the building sprite after restoration is complete
      tile.building = undefined
      if (buildingSprite && buildingSprite !== tile.sprite) {
        buildingSprite.destroy()
      }
      // Cleanup
      this.destroy()

      updateMapInWorker()

      // Create destroyed particles
      createParticleEmitter(ParticleEffect.UNIT_DEATH, {
        x: this.x * getTileSize() + getTileSize()/2,
        y: this.y * getTileSize() + getTileSize()/2,
        duration: 1000
      })

      return
    }
  }

  static create(buildingType, x, y, color, owner) {
    const tile = gameState.map[x][y]

    // Save original terrain
    tile.originalSprite = tile.sprite
    tile.originalType = tile.type
    tile.originalWeight = tile.weight
    tile.originalBack = tile.back

    let building
    switch (buildingType) {
        case Building.TYPES.LUMBERJACK:
            building = new Lumberjack(x, y, color, owner)
            break
        case Building.TYPES.TENT:
            building = new Tent(x, y, color, owner)
            break
        case Building.TYPES.QUARRY:
          building = new Quarry(x, y, color, owner)
          break
        case Building.TYPES.WELL:
          building = new Well(x, y, color, owner)
          break
        case Building.TYPES.GOLD_MINE:
          building = new GoldMine(x, y, color, owner)
          break
        case Building.TYPES.MARKET:
          building = new Market(x, y, color, owner)
          break
        case Building.TYPES.ARCANA:
          building = new Arcana(x, y, color, owner)
          break
        case Building.TYPES.ARCHERY:
          building = new Archery(x, y, color, owner)
          break
        case Building.TYPES.BARRACKS:
          building = new Barracks(x, y, color, owner)
          break
        case Building.TYPES.ARMORY:
          building = new Armory(x, y, color, owner)
          break
        case Building.TYPES.CITADEL:
          building = new Citadel(x, y, color, owner)
          break
        case Building.TYPES.TOWER:
          building = new Tower(x, y, color, owner)
          break
    }

    gameState.map[x][y].type = building.type
    gameState.map[x][y].building = building
    updateMapInWorker()

    const spriteX = building.type.sprite_coords['cyan'].x
    const spriteY = building.type.sprite_coords['cyan'].y
    const buildingSprite = sprites[`tile_${spriteX}_${spriteY}`]
    gameState.map[x][y].sprite = buildingSprite
    building.sprite = buildingSprite
    building.tileX = spriteX
    building.tileY = spriteY
    building.name = building.type.name

    // Add building placement particle effect
    createParticleEmitter(ParticleEffect.BUILDING_PLACE, {
      x: x * getTileSize() + getTileSize()/2,
      y: y * getTileSize() + getTileSize()/2,
      duration: 1500
    })

    if(owner === gameState.humanPlayer || isPositionVisible(x, y)) {
      playBuildingSound()
    }
    
    return building
  }
}

/**
 * Building that produces worker units
 */
class WorkerBuilding extends Building {
  constructor(x, y, color, owner) {
    super(x, y, color, owner)
    this.type = 'WORKER_BUILDING'
    this.lastWorkerConversionTime = 0

    this.maxWorkers = 0
    this.assignedWorkers = []

    // Production timer for converting workers
    this.productionTimer = 0
    this.productionCooldown = 1000 // Small delay to convert a worker
    this.convertingWorker = null
  }
  
}

/**
 * Building that produces combat units
 */
class CombatBuilding extends Building {
  constructor(x, y, color, owner) {
    super(x, y, color, owner)
    this.type = 'COMBAT_BUILDING'
    this.productionCooldown = 15000 // 15 seconds by default for combat units
    this.indicatorColor = 0xFF0000 // Red color for combat production
    this.showProgressIndicator = owner === gameState.humanPlayer
  }

  /**
   * Update building state and produce combat units
   * @param {number} delay - Time elapsed since last update (ms)
   */
  update(delay) {
    super.update(delay)
    
    // Update production timer
    this.productionTimer += delay

    // Update progress for indicator
    this.progress = this.productionTimer / this.productionCooldown

    updateProgressIndicator(this, this.progress)
    
    // Check if it's time to produce a combat unit
    if (this.productionTimer >= this.productionCooldown) {
      this.produceWarrior()
      this.productionTimer -= this.productionCooldown
      this.progress = 0 // Reset progress after producing
    }
  }
  
  /**
   * Produce a combat unit (to be overridden by specific combat buildings)
   */
  produceWarrior() {
    // This method will be overridden by Barracks, Armory, Citadel
  }
}

/**
 * Tent is a specialized worker building (the player's base)
 */
class Tent extends WorkerBuilding {
  constructor(x, y, color, owner) {
    super(x, y, color, owner)
    this.type = Building.TYPES.TENT
    this.life = 200
    this.maxLife = 200
    applyGameModeModifiers(this)
    this.productionCooldown = 10000 // 10 seconds
    this.indicatorColor = 0x00FF00 // Green color
    this.showProgressIndicator = owner === gameState.humanPlayer
  }

  /**
   * Update building and produce workers
   * @param {number} delay - Time elapsed since last update (ms)
   */
  update(delay) {
    super.update(delay)
    
    // Update production timer
    this.productionTimer += delay

    // Update progress for indicator
    this.progress = this.productionTimer / this.productionCooldown

    updateProgressIndicator(this, this.progress)
    
    // Check if it's time to produce a worker
    if (this.productionTimer >= this.productionCooldown) {
      this.produceWorker()
      this.productionTimer -= this.productionCooldown
      this.progress = 0 // Reset progress after producing
    }
  }
  
  /**
   * Produce a worker unit
   */
  async produceWorker() {
    if (this.owner) {
      const target = this.owner.getEnemies()[0].currentNode ? this.owner.getEnemies()[0].currentNode : this.owner.getEnemies()[0]
      const spawnLocation = await findBestSpawnLocation(this.x, this.y, target.x, target.y)
      if (spawnLocation) {
        this.owner.addWorker(spawnLocation.x, spawnLocation.y)
      } else {
        console.warn(`No valid spawn location found for worker from ${this.type.name} at (${this.x}, ${this.y})`)
      }
    }
  }
}

/**
 * Lumberjack building for wood harvesting
 * Converts regular idle workers to specialized lumberjack workers.
 * Identifies harvestable trees in the vicinity and assigns workers to them.
 * Processes harvested wood and transfers it to the player's resources.
 */
class Lumberjack extends WorkerBuilding {
    constructor(x, y, color, owner) {
        super(x, y, color, owner)
        this.type = Building.TYPES.LUMBERJACK
        this.life = 150
        this.maxLife = 150
        applyGameModeModifiers(this)

        this.maxWorkers = 1

        // Add nearby trees array
        this.nearbyTrees = []
        this.treeSearchRadius = 10 // Search within 10 tiles radius

        this.treeProcessingInProgress = false
        this.treeProcessingQueue = []

        this.lastTreeReevaluationTime = performance.now()

        // Find and order nearby trees after construction
        this.findAndOrderNearbyTrees()
    }

    /**
     * Update building state and convert workers
     */
    async update(delay) {
        super.update(delay)

        this.assignedWorkers = this.assignedWorkers.filter(unit => unit.life > 0)

        // If we're not at max capacity and not already converting
        if (this.assignedWorkers.filter(unit => unit instanceof LumberjackWorker).length < this.maxWorkers && !this.convertingWorker) {
            // Look for nearby workers to convert
            await this.findWorkerToConvert()
        }

        // If we're converting a worker
        if (this.convertingWorker) {
            this.productionTimer += delay

            // Launch tree ordering before the end of the conversion
            if(this.productionTimer > this.productionCooldown * 0.4) {
              this.findAndOrderNearbyTrees()
            }
            
            // Check if conversion is complete
            if (this.productionTimer >= this.productionCooldown) {
                this.completeWorkerConversion()
                this.productionTimer = 0
                this.convertingWorker = null
            }
        }

        if (this.lastTreeReevaluationTime + 20000 < performance.now()) {
          // Refresh the list every 20 seconds
          this.findAndOrderNearbyTrees()
        }
    }

    /**
     * Find and order nearby trees by path distance
     */
    async findAndOrderNearbyTrees() {
        // If already processing, don't start again
        if (this.treeProcessingInProgress) {
            return
        }
        this.lastTreeReevaluationTime = performance.now()

        this.treeProcessingInProgress = true
        const { width, height } = getMapDimensions()
        this.treeProcessingQueue = []

        // First, find all trees within radius
        for (let dx = -this.treeSearchRadius; dx <= this.treeSearchRadius; dx++) {
            for (let dy = -this.treeSearchRadius; dy <= this.treeSearchRadius; dy++) {
                const tileX = this.x + dx
                const tileY = this.y + dy

                // Check if coordinates are valid
                if (tileX >= 0 && tileX < width && tileY >= 0 && tileY < height) {
                    const tile = gameState.map[tileX][tileY]

                    // Check if it's a harvestable tree
                    if (tile?.type === 'TREE' && tile?.resource > 0) {
                        // Use geometric distance for initial filtering
                        const geoDist = Math.sqrt(dx * dx + dy * dy)
                        if (geoDist <= this.treeSearchRadius) {
                            this.treeProcessingQueue.push({ x: tileX, y: tileY, geoDist })
                        }
                    }
                }
            }
        }

        // Sort by geometric distance
        this.treeProcessingQueue.sort((a, b) => a.geoDist - b.geoDist)

        // Build new list in temporary array (keep old list available)
        this.tempNearbyTrees = []

        // Process trees in background
        if (this.treeProcessingQueue.length > 0) {
            this.processNextTreeInQueue()
        } else {
            this.treeProcessingInProgress = false
        }
    }

    /**
     * Sort trees by path quality and limit the number stored
     */
    sortTreesByPathQuality() {
        this.tempNearbyTrees.sort((a, b) => {
            // First compare by path weight
            if (a.pathWeight !== b.pathWeight) {
                return a.pathWeight - b.pathWeight
            }
            // Then by path distance as a tiebreaker
            return a.pathDistance - b.pathDistance
        });

        // Limit to 10 trees max to avoid memory issues
        if (this.tempNearbyTrees.length > 10) {
            this.tempNearbyTrees = this.tempNearbyTrees.slice(0, 10)
        }
    }

    /**
     * Process next tree in the queue without blocking the main thread
     */
    async processNextTreeInQueue() {
        // If building is destroyed, stop
        if (!this.owner || this.life <= 0) {
            this.treeProcessingInProgress = false
            this.treeProcessingQueue = []
            return
        }

        // If no more trees to process, finalize
        if (this.treeProcessingQueue.length === 0) {
            this.treeProcessingInProgress = false
            // Swap the completed list
            this.nearbyTrees = this.tempNearbyTrees
            this.tempNearbyTrees = []
            return
        }

        const startX = this.x
        const startY = this.y

        const batchPromises = []
        const treesToProcess = []

        // Process a batch of trees
        for (let i = 0; i < TREE_PROCESSING_BATCH_SIZE && this.treeProcessingQueue.length > 0; i++) {
            const tree = this.treeProcessingQueue.shift()
            treesToProcess.push(tree)
            batchPromises.push(searchPath(startX, startY, tree.x, tree.y))
        }

        const paths = await Promise.all(batchPromises)

        paths.forEach((path, index) => {
            const tree = treesToProcess[index]
            if (path?.length > 0) {
                this.tempNearbyTrees.push({
                    x: tree.x,
                    y: tree.y,
                    pathDistance: path.length,
                    pathWeight: path.reduce((sum, node) => sum + node.weight, 0)
                })
            }
        })

        // Re-sort and trim the list after processing the batch
        this.sortTreesByPathQuality()

        // Process next batch after a delay
        setTimeout(() => this.processNextTreeInQueue(), TREE_PROCESSING_DELAY)
    }


    /**
     * Get the next available tree for harvesting
     * @returns {Object|null} The next tree to harvest or null if none available
     */
    getNextHarvestableTree() {
        // Get list of trees already assigned to other workers from this hut
        // Check assignedTree, not goal (goal changes to building when returning)
        const assignedTrees = this.assignedWorkers
            .filter(w => w instanceof LumberjackWorker && w.assignedTree)
            .map(w => ({ x: w.assignedTree.x, y: w.assignedTree.y }))

        // Return the first valid tree that's not already assigned
        for (let i = 0; i < this.nearbyTrees?.length; i++) {
            const tree = this.nearbyTrees[i]

            // Check if tree is already assigned to another worker
            const isAssigned = assignedTrees.some(t => t.x === tree.x && t.y === tree.y)
            if (isAssigned) continue

            // Verify the tree still exists and harvestable
            if (gameState.map[tree.x][tree.y].type === 'TREE' && gameState.map[tree.x][tree.y].resource > 0) {
                return tree
            } else {
                this.removeTree(tree)
            }
        }

        // No valid trees found
        return null
    }

    /**
     * Remove a tree from the nearbyTrees list
     * @param {Object} tree - The tree to remove
     */
    async removeTree(tree) {
        // Remove from current trees list
        this.nearbyTrees = this.nearbyTrees.filter(t => 
            !(t.x === tree.x && t.y === tree.y)
        )

        // Also remove from processing queue if it's there
        this.treeProcessingQueue = this.treeProcessingQueue.filter(t => 
            !(t.x === tree.x && t.y === tree.y)
        )

        // Update the available trees in background
        setTimeout(() => this.findAndOrderNearbyTrees(), 40)
    }

    /**
     * Find a nearby regular worker to convert
     */
    async findWorkerToConvert() {
        if (!this.owner) return

        const regularWorker = this.assignedWorkers.find(unit => unit instanceof Peon)
        if(regularWorker) {
            const d = distance(
                regularWorker.currentNode, this
            )

            if (d < 2) {
                this.convertingWorker = regularWorker
            } else {
                this.convertingWorker = null
                this.productionTimer = 0
            }
            return
        }

        // Get all the owner's regular workers, and sort by geometric distance for initial filtering
        const regularWorkers = this.owner.getUnits()
            .filter(unit => unit instanceof Peon && unit.task !== 'assigned' && !(unit instanceof LumberjackWorker))
            .map(worker => ({ worker, dist: distance(worker.currentNode, this) }))
            .sort((a, b) => a.dist - b.dist)
            .slice(0, 5) // Consider only the 5 closest peons for pathfinding
            .map(item => item.worker)

        // Find the closest worker
        let closestWorker = null
        let closestDistance = Infinity
        let shortestPath = null

        for (const worker of regularWorkers) {
            const path = await searchPath(
                worker.currentNode.x, 
                worker.currentNode.y,
                this.x,
                this.y
              )
            
            if (path?.length < closestDistance && worker.task !== 'assigned') {
                closestDistance = path.length
                shortestPath = path
                closestWorker = worker
            }
        }

         // If we found a close worker
        if(closestWorker && closestWorker.task !== 'assigned') {
            // Move the worker to the building
            closestWorker.assignPath(shortestPath)
            this.assignedWorkers.push(closestWorker)
        }
    }

    /**
     * Complete worker conversion
     */
    completeWorkerConversion() {
        if (!this.convertingWorker || !this.owner) return

        // Create a lumberjack's worker
        const lumberjackWorker = this.owner.addLumberjackWorker(
            this.convertingWorker.currentNode.x,
            this.convertingWorker.currentNode.y,
            this
        )

        // Remove the regular worker
        const assignedWorkerIndex = this.assignedWorkers.indexOf(this.convertingWorker)
        if (assignedWorkerIndex > -1) {
            this.assignedWorkers.splice(assignedWorkerIndex, 1)
        }
        const workerIndex = this.owner.units.indexOf(this.convertingWorker)
        if (workerIndex > -1) {
            this.owner.units.splice(workerIndex, 1)
        }
    }
}

/**
 * Quarry building for stone extraction
 * Converts regular idle workers to specialized quarry miners
 * Identifies mineable rocks in the vicinity and assigns workers to them
 */
class Quarry extends WorkerBuilding {
  constructor(x, y, color, owner) {
      super(x, y, color, owner)
      this.type = Building.TYPES.QUARRY
      this.life = 150
      this.maxLife = 150
      applyGameModeModifiers(this)

      this.maxWorkers = 1
  }

  /**
   * Update building state and convert workers
   */
  async update(delay) {
      super.update(delay)

      this.assignedWorkers = this.assignedWorkers.filter(unit => unit.life > 0)

      // If we're not at max capacity and not already converting
      if (this.assignedWorkers.filter(unit => unit instanceof QuarryMiner).length < this.maxWorkers && !this.convertingWorker) {
          // Look for nearby workers to convert
          await this.findWorkerToConvert()
      }

      // If we're converting a worker
      if (this.convertingWorker) {
          this.productionTimer += delay
          
          // Check if conversion is complete
          if (this.productionTimer >= this.productionCooldown) {
              this.completeWorkerConversion()
              this.productionTimer = 0
              this.convertingWorker = null
          }
      }
  }

  /**
   * Find a nearby regular worker to convert
   */
  async findWorkerToConvert() {
      if (!this.owner) return

      const regularWorker = this.assignedWorkers.find(unit => unit instanceof Peon)
      if(regularWorker) {
          const d = distance(
              regularWorker.currentNode, this
          )

          if (d < 2) {
              this.convertingWorker = regularWorker
          } else {
              this.convertingWorker = null
              this.productionTimer = 0
          }
          return
      }

      // Get all the owner's regular workers, and sort by geometric distance for initial filtering
      const regularWorkers = this.owner.getUnits()
          .filter(unit => unit instanceof Peon && unit.task !== 'assigned' && !(unit instanceof QuarryMiner))
          .map(worker => ({ worker, dist: distance(worker.currentNode, this) }))
          .sort((a, b) => a.dist - b.dist)
          .slice(0, 5) // Consider only the 5 closest peons for pathfinding
          .map(item => item.worker)

      // Find the closest worker
      let closestWorker = null
      let closestDistance = Infinity
      let shortestPath = null

      for (const worker of regularWorkers) {
          const path = await searchPath(
              worker.currentNode.x, 
              worker.currentNode.y,
              this.x,
              this.y
            )
          
          if (path?.length < closestDistance && worker.task !== 'assigned') {
              closestDistance = path.length
              shortestPath = path
              closestWorker = worker
          }
      }

      // If we found a close worker
      if(closestWorker && closestWorker.task !== 'assigned') {
          // Move the worker to the building
          closestWorker.assignPath(shortestPath)
          this.assignedWorkers.push(closestWorker)
      }
  }

  /**
   * Complete worker conversion
   */
  completeWorkerConversion() {
      if (!this.convertingWorker || !this.owner) return

      // Create a quarry miner
      const quarryMiner = this.owner.addQuarryMiner(
          this.convertingWorker.currentNode.x,
          this.convertingWorker.currentNode.y,
          this
      )

      // Remove the regular worker
      const assignedWorkerIndex = this.assignedWorkers.indexOf(this.convertingWorker)
      if (assignedWorkerIndex > -1) {
          this.assignedWorkers.splice(assignedWorkerIndex, 1)
      }
      const workerIndex = this.owner.units.indexOf(this.convertingWorker)
      if (workerIndex > -1) {
          this.owner.units.splice(workerIndex, 1)
      }
  }
}

/**
 * Well building for water collection
 * Converts regular idle workers to specialized water carriers
 * Identifies water sources in the vicinity and assigns workers to them
 */
class Well extends WorkerBuilding {
  constructor(x, y, color, owner) {
    super(x, y, color, owner)
    this.type = Building.TYPES.WELL
    this.life = 150
    this.maxLife = 150
    applyGameModeModifiers(this)

    this.maxWorkers = 1
  }

  /**
   * Update building state and convert workers
   */
  async update(delay) {
    super.update(delay)

    this.assignedWorkers = this.assignedWorkers.filter(unit => unit.life > 0)

    // If we're not at max capacity and not already converting
    if (this.assignedWorkers.filter(unit => unit instanceof WaterCarrier).length < this.maxWorkers && !this.convertingWorker) {
      // Look for nearby workers to convert
      await this.findWorkerToConvert()
    }

    // If we're converting a worker
    if (this.convertingWorker) {
      this.productionTimer += delay
      
      // Check if conversion is complete
      if (this.productionTimer >= this.productionCooldown) {
        this.completeWorkerConversion()
        this.productionTimer = 0
        this.convertingWorker = null
      }
    }
  }

  /**
   * Find a nearby regular worker to convert
   */
  async findWorkerToConvert() {
    if (!this.owner) return

    const regularWorker = this.assignedWorkers.find(unit => unit instanceof Peon)
    if(regularWorker) {
      const d = distance(
        regularWorker.currentNode, this
      )

      if (d < 2) {
        this.convertingWorker = regularWorker
      } else {
        this.convertingWorker = null
        this.productionTimer = 0
      }
      return
    }

    // Get all the owner's regular workers, and sort by geometric distance for initial filtering
    const regularWorkers = this.owner.getUnits()
        .filter(unit => unit instanceof Peon && unit.task !== 'assigned' && !(unit instanceof WaterCarrier))
        .map(worker => ({ worker, dist: distance(worker.currentNode, this) }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 5) // Consider only the 5 closest peons for pathfinding
        .map(item => item.worker)

    // Find the closest worker
    let closestWorker = null
    let closestDistance = Infinity
    let shortestPath = null

    for (const worker of regularWorkers) {
      const path = await searchPath(
        worker.currentNode.x, 
        worker.currentNode.y,
        this.x,
        this.y
      )
      
      if (path?.length < closestDistance && worker.task !== 'assigned') {
        closestDistance = path.length
        shortestPath = path
        closestWorker = worker
      }
    }

    // If we found a close worker
    if(closestWorker && closestWorker.task !== 'assigned') {
      // Move the worker to the building
      closestWorker.assignPath(shortestPath)
      this.assignedWorkers.push(closestWorker)
    }
  }

  /**
   * Complete worker conversion
   */
  completeWorkerConversion() {
    if (!this.convertingWorker || !this.owner) return

    // Create a water carrier
    const waterCarrier = this.owner.addWaterCarrier(
      this.convertingWorker.currentNode.x,
      this.convertingWorker.currentNode.y,
      this
    )

    // Remove the regular worker
    const assignedWorkerIndex = this.assignedWorkers.indexOf(this.convertingWorker)
    if (assignedWorkerIndex > -1) {
      this.assignedWorkers.splice(assignedWorkerIndex, 1)
    }
    const workerIndex = this.owner.units.indexOf(this.convertingWorker)
    if (workerIndex > -1) {
      this.owner.units.splice(workerIndex, 1)
    }
  }
}

/**
 * Gold mine building for gold extraction
 * Converts regular idle workers to specialized gold miners
 * Identifies gold deposits in the vicinity and assigns workers to them
 */
class GoldMine extends WorkerBuilding {
  constructor(x, y, color, owner) {
    super(x, y, color, owner)
    this.type = Building.TYPES.GOLD_MINE
    this.life = 150
    this.maxLife = 150
    applyGameModeModifiers(this)

    this.maxWorkers = 1
  }

  /**
   * Update building state and convert workers
   */
  async update(delay) {
    super.update(delay)

    this.assignedWorkers = this.assignedWorkers.filter(unit => unit.life > 0)

    // If we're not at max capacity and not already converting
    if (this.assignedWorkers.filter(unit => unit instanceof GoldMiner).length < this.maxWorkers && !this.convertingWorker) {
      // Look for nearby workers to convert
      await this.findWorkerToConvert()
    }

    // If we're converting a worker
    if (this.convertingWorker) {
      this.productionTimer += delay
      
      // Check if conversion is complete
      if (this.productionTimer >= this.productionCooldown) {
        this.completeWorkerConversion()
        this.productionTimer = 0
        this.convertingWorker = null
      }
    }
  }

  /**
   * Find a nearby regular worker to convert
   */
  async findWorkerToConvert() {
    if (!this.owner) return

    const regularWorker = this.assignedWorkers.find(unit => unit instanceof Peon)
    if(regularWorker) {
      const d = distance(
        regularWorker.currentNode, this
      )

      if (d < 2) {
        this.convertingWorker = regularWorker
      } else {
        this.convertingWorker = null
        this.productionTimer = 0
      }
      return
    }

    // Get all the owner's regular workers, and sort by geometric distance for initial filtering
    const regularWorkers = this.owner.getUnits()
        .filter(unit => unit instanceof Peon && unit.task !== 'assigned' && !(unit instanceof GoldMiner))
        .map(worker => ({ worker, dist: distance(worker.currentNode, this) }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 5) // Consider only the 5 closest peons for pathfinding
        .map(item => item.worker)

    // Find the closest worker
    let closestWorker = null
    let closestDistance = Infinity
    let shortestPath = null

    for (const worker of regularWorkers) {
      const path = await searchPath(
        worker.currentNode.x, 
        worker.currentNode.y,
        this.x,
        this.y
      )
      
      if (path?.length < closestDistance && worker.task !== 'assigned') {
        closestDistance = path.length
        shortestPath = path
        closestWorker = worker
      }
    }

    // If we found a close worker
    if(closestWorker && closestWorker.task !== 'assigned') {
      // Move the worker to the building
      closestWorker.assignPath(shortestPath)
      this.assignedWorkers.push(closestWorker)
    }
  }

  /**
   * Complete worker conversion
   */
  completeWorkerConversion() {
    if (!this.convertingWorker || !this.owner) return

    // Create a gold miner
    const goldMiner = this.owner.addGoldMiner(
      this.convertingWorker.currentNode.x,
      this.convertingWorker.currentNode.y,
      this
    )

    // Remove the regular worker
    const assignedWorkerIndex = this.assignedWorkers.indexOf(this.convertingWorker)
    if (assignedWorkerIndex > -1) {
      this.assignedWorkers.splice(assignedWorkerIndex, 1)
    }
    const workerIndex = this.owner.units.indexOf(this.convertingWorker)
    if (workerIndex > -1) {
      this.owner.units.splice(workerIndex, 1)
    }
  }
}

/**
 * Barracks building for training soldiers
 */
class Barracks extends CombatBuilding {
  constructor(x, y, color, owner) {
    super(x, y, color, owner)
    this.type = Building.TYPES.BARRACKS
    this.life = 50
    this.maxLife = 50
    applyGameModeModifiers(this)
    this.productionCooldown = 12000 // 12 seconds to train a soldier
  }

  /**
   * Produce a soldier unit
   */
  async produceWarrior() {
    if (this.owner) {
      const enemy = this.owner.getEnemies()[0]
      if (!enemy) {
        console.warn('No enemy tent found to target for combat unit spawn.')
        return
      }
      const target = enemy.currentNode ? enemy.currentNode : enemy
      const spawnLocation = await findBestSpawnLocation(this.x, this.y, target.x, target.y)
      if (spawnLocation) {
        this.owner.addSoldier(spawnLocation.x, spawnLocation.y)
      } else {
        console.warn(`No valid spawn location found for soldier from ${this.type.name} at (${this.x}, ${this.y})`)
      }
    }
  }
}

/**
 * Arcana building (magic school) for training mages
 */
class Arcana extends CombatBuilding {
  constructor(x, y, color, owner) {
    super(x, y, color, owner)
    this.type = Building.TYPES.ARCANA
    this.life = 120
    this.maxLife = 120
    applyGameModeModifiers(this)
    this.productionCooldown = 20000 // 20 seconds to train a mage
  }

  /**
   * Produce a mage unit
   */
  async produceWarrior() {
    if (this.owner) {
      const enemy = this.owner.getEnemies()[0]
      if (!enemy) {
        console.warn('No enemy tent found to target for combat unit spawn.')
        return
      }
      const target = enemy.currentNode ? enemy.currentNode : enemy
      const spawnLocation = await findBestSpawnLocation(this.x, this.y, target.x, target.y)
      if (spawnLocation) {
        this.owner.addMage(spawnLocation.x, spawnLocation.y)
      } else {
        console.warn(`No valid spawn location found for mage from ${this.type.name} at (${this.x}, ${this.y})`)
      }
    }
  }
}

/**
 * Archery building for training archers
 */
class Archery extends CombatBuilding {
  constructor(x, y, color, owner) {
    super(x, y, color, owner)
    this.type = Building.TYPES.ARCHERY
    this.life = 100
    this.maxLife = 100
    applyGameModeModifiers(this)
    this.productionCooldown = 16000 // 16 seconds to train an archer
  }

  /**
   * Produce an archer unit
   */
  async produceWarrior() {
    if (this.owner) {
      const enemy = this.owner.getEnemies()[0]
      if (!enemy) {
        console.warn('No enemy tent found to target for combat unit spawn.')
        return
      }
      const target = enemy.currentNode ? enemy.currentNode : enemy
      const spawnLocation = await findBestSpawnLocation(this.x, this.y, target.x, target.y)
      if (spawnLocation) {
        this.owner.addArcher(spawnLocation.x, spawnLocation.y)
      } else {
        console.warn(`No valid spawn location found for archer from ${this.type.name} at (${this.x}, ${this.y})`)
      }
    }
  }
}

/**
 * Armory building for training heavy infantry
 */
class Armory extends CombatBuilding {
  constructor(x, y, color, owner) {
    super(x, y, color, owner)
    this.type = Building.TYPES.ARMORY
    this.life = 150
    this.maxLife = 150
    applyGameModeModifiers(this)
    this.productionCooldown = 20000 // 20 seconds to train heavy infantry
  }

  /**
   * Produce a heavy infantry unit
   */
  async produceWarrior() {
    if (this.owner) {
      const enemy = this.owner.getEnemies()[0]
      if (!enemy) {
        console.warn('No enemy tent found to target for combat unit spawn.')
        return
      }
      const target = enemy.currentNode ? enemy.currentNode : enemy
      const spawnLocation = await findBestSpawnLocation(this.x, this.y, target.x, target.y)
      if (spawnLocation) {
        this.owner.addHeavyInfantry(spawnLocation.x, spawnLocation.y)
      } else {
        console.warn(`No valid spawn location found for heavy infantry from ${this.type.name} at (${this.x}, ${this.y})`)
      }
    }
  }
}

/**
 * Citadel building for training elite warriors
 */
class Citadel extends CombatBuilding {
  constructor(x, y, color, owner) {
    super(x, y, color, owner)
    this.type = Building.TYPES.CITADEL
    this.life = 250
    this.maxLife = 250
    applyGameModeModifiers(this)
    this.productionCooldown = 30000 // 30 seconds to train an elite warrior
  }

  /**
   * Produce an elite warrior unit
   */
  async produceWarrior() {
    if (this.owner) {
      const enemy = this.owner.getEnemies()[0]
      if (!enemy) {
        console.warn('No enemy tent found to target for combat unit spawn.')
        return
      }
      const target = enemy.currentNode ? enemy.currentNode : enemy
      const spawnLocation = await findBestSpawnLocation(this.x, this.y, target.x, target.y)
      if (spawnLocation) {
        this.owner.addEliteWarrior(spawnLocation.x, spawnLocation.y)
      } else {
        console.warn(`No valid spawn location found for elite warrior from ${this.type.name} at (${this.x}, ${this.y})`)
      }
    }
  }
}

/**
 * Market building for selling resources
 */
class Market extends Building {
  constructor(x, y, color, owner) {
    super(x, y, color, owner)
    this.type = Building.TYPES.MARKET
    this.life = 100
    this.maxLife = 100
    applyGameModeModifiers(this)
    this.productionCooldown = 15000 // Sell every 15 seconds
    this.indicatorColor = 0xFFA500 // Orange color for market
    this.sellingResource = 'wood' // Default resource to sell
    this.sellingPrice = 1 // Default price per unit
    this.showProgressIndicator = owner === gameState.humanPlayer
  }

  /**
   * Update building state and sell resources
   * @param {number} delay - Time elapsed since last update (ms)
   */
  update(delay) {
    super.update(delay)

    // Update production timer
    this.productionTimer += delay

    // Update progress for indicator
    this.progress = this.productionTimer / this.productionCooldown

    updateProgressIndicator(this, this.progress)
    
    // Check if it's time to sell resources
    if (this.productionTimer >= this.productionCooldown) {
      this.sellResources()
      this.productionTimer -= this.productionCooldown
      this.progress = 0 // Reset progress after selling
    }
  }

  getValidSellingResources() {
    return ['wood', 'water', 'stone', 'gold']
  }

  /**
   * Set the resource to be sold by the market.
   * @param {string} resourceType - The type of resource to sell ('wood', 'water', 'stone', 'gold').
   */
  setSellingResource(resourceType) {
    const validResources = this.getValidSellingResources()
    if (validResources.includes(resourceType)) {
      this.sellingResource = resourceType
      // // Adjust selling price based on resource type (example logic, can be refined)
      // switch (resourceType) {
      //   case 'wood':
      //     this.sellingPrice = 5
      //     break
      //   case 'water':
      //     this.sellingPrice = 7
      //     break
      //   case 'stone':
      //     this.sellingPrice = 6
      //     break
      //   case 'gold':
      //     this.sellingPrice = 10
      //     break
      //   default:
      //     this.sellingPrice = 5
      // }
    } else {
      console.warn(`Invalid resource type for Market: ${resourceType}`)
    }
  }

  /**
   * Sell resources to gain money
   */
  sellResources() {
    if (this.owner) {
      const resourceAmount = 1 // Sell 1 unit of resource at a time
      if (this.owner.resources[this.sellingResource] >= resourceAmount) {
        this.owner.addResource(this.sellingResource, -resourceAmount)
        this.owner.addResource('money', this.sellingPrice * resourceAmount | 0)
      }
    }
  }
}

/**
 * Tower building for defense
 * Automatically attacks enemies within range (to be implemented)
 */
class Tower extends Building {
  constructor(x, y, color, owner) {
    super(x, y, color, owner)
    this.type = Building.TYPES.TOWER
    this.life = 200
    this.maxLife = 200
    applyGameModeModifiers(this)
    this.attackRange = 5 * getTileSize() // Attack range in pixels
    this.visibilityRange = this.attackRange + 2 * getTileSize()
    this.attackDamage = 5 // Base attack damage
    this.attackCooldown = 2000 // 2 seconds between attacks
    this.attackTimer = 0
  }

  /** Base Tower can only be specialized; specialized towers use the normal upgrade path */
  getUpgradeCosts() {
    if (this.type.BRANCHES) return null // unspecialized: branch selection only
    return super.getUpgradeCosts()
  }

  /** Returns branch specialization options, or null if already specialized */
  getBranchChoices() {
    return this.type.BRANCHES || null
  }

  /**
   * Check affordability, deduct resources and specialize this tower.
   * @param {Object} branchInfo - One entry from TOWER.BRANCHES
   * @returns {boolean} True if the specialization succeeded
   */
  handleBranchUpgrade(branchInfo) {
    const costs = branchInfo.costs
    const canAfford = Object.entries(costs).every(
      ([resource, amount]) => (this.owner.resources[resource] || 0) >= amount
    )

    if (!canAfford) {
      const costText = Object.entries(costs).map(([r, a]) => `${r}: ${a}`).join(', ')
      showDebugMessage(t('ui.cannotAffordSpec', { costs: costText }))
      return false
    }

    for (const [resource, amount] of Object.entries(costs)) {
      this.owner.addResource(resource, -amount)
    }

    this.specialize(branchInfo)
    return true
  }

  /**
   * Morph this Tower instance into a specialized branch in-place.
   * @param {Object} branchInfo - One entry from TOWER.BRANCHES
   */
  specialize(branchInfo) {
    const branchType = Building.TYPES[branchInfo.typeName]
    if (!branchType) return

    const stats = branchInfo.initialStats
    const SPRITE_SIZE = getTileSize()

    this.type = branchType
    this.maxLife = stats.life
    this.life = stats.life
    this.attackDamage = stats.attackDamage
    this.attackRange = SPRITE_SIZE * stats.attackRangeTiles
    this.visibilityRange = Math.max(this.attackRange + 2 * getTileSize(), this.visibilityRange)
    this.attackCooldown = stats.attackCooldown
    this.level = 1
    applyGameModeModifiers(this)

    createParticleEmitter(ParticleEffect.BUILDING_PLACE, {
      x: this.x * SPRITE_SIZE + SPRITE_SIZE / 2,
      y: this.y * SPRITE_SIZE + SPRITE_SIZE / 2,
      duration: 1500
    })

    const branchName = branchType.key ? t(`buildings.${branchType.key}.name`) : branchType.name
    showDebugMessage(t('ui.towerSpecialized', { name: branchName }))

    // Refresh the info panel if this building is currently selected
    if (gameState.selectedBuilding === this) {
      gameState.events.emit('selected-building-changed', this)
    }
  }

  /**
   * Update tower state: tick attack timer and fire when ready
   * @param {number} delay - Time elapsed since last update (ms)
   */
  update(delay) {
    super.update(delay)

    this.attackTimer += delay

    if (this.attackTimer >= this.attackCooldown) {
      this.attackTimer -= this.attackCooldown
      const enemy = this.findNearestEnemy()
      if (enemy) {
        this.fireProjectile(enemy)
      }
    }
  }

  /**
   * Find the nearest visible enemy within attack range.
   * @returns {Object|null} The closest enemy unit or building, or null if none in range
   */
  findNearestEnemy() {
    const SPRITE_SIZE = getTileSize()
    const towerCX = this.x * SPRITE_SIZE + SPRITE_SIZE / 2
    const towerCY = this.y * SPRITE_SIZE + SPRITE_SIZE / 2

    const enemies = this.owner.getVisibleEnemies()
    let nearest = null
    let nearestDist = Infinity

    for (const enemy of enemies) {
      if (enemy.life <= 0) continue

      const enemyX = enemy.currentNode
        ? enemy.x + SPRITE_SIZE / 2
        : enemy.x * SPRITE_SIZE + SPRITE_SIZE / 2
      const enemyY = enemy.currentNode
        ? enemy.y + SPRITE_SIZE / 2
        : enemy.y * SPRITE_SIZE + SPRITE_SIZE / 2

      const dx = enemyX - towerCX
      const dy = enemyY - towerCY
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist <= this.attackRange && dist < nearestDist) {
        nearestDist = dist
        nearest = enemy
      }
    }

    return nearest
  }

  /**
   * Create and launch an arrow projectile toward the given target.
   * @param {Object} target - Enemy unit or building to attack
   */
  fireProjectile(target) {
    const SPRITE_SIZE = getTileSize()
    const towerCX = this.x * SPRITE_SIZE + SPRITE_SIZE / 2
    const towerCY = this.y * SPRITE_SIZE + SPRITE_SIZE / 2
    new Projectile(towerCX, towerCY, target, this.attackDamage)
  }
}