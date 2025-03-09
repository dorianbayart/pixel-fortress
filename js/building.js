export { Building, WorkerBuilding, Tent }

'use strict'

import { getTileSize } from 'dimensions'
import { Player, PlayerType } from 'players'
import gameState from 'state'

/**
 * Base Building class for all game buildings
 */
class Building {
    static TYPES = {
        LUMBERJACK: {
          name: "Lumberjack's Hut",
          icon: "🪓",
          costs: { wood: 10 },
          description: "Harvests wood from nearby trees"
        },
        TENT: {
          name: "Tent",
          icon: "⛺",
          costs: { wood: 5, water: 5, money: 5 },
          description: "Produces peons"
        },
        GOLD_MINE: {
          name: "Gold Mine",
          icon: "⛏️",
          costs: { wood: 25, rock: 5 },
          description: "Mines gold"
        },
        QUARRY: {
          name: "Stone Quarry",
          icon: "🪨",
          costs: { wood: 20 },
          description: "Extracts rock"
        },
        WELL: {
          name: "Well",
          icon: "🧱",
          costs: { wood: 10, rock: 10 },
          description: "Produces water"
        },
        BARRACKS: {
          name: "Barracks",
          icon: "⚔️",
          costs: { wood: 15, water: 10, gold: 5 },
          description: "Trains soldiers"
        },
        ARMORY: {
          name: "Armory",
          icon: "🛡️",
          costs: { wood: 25, water: 20, rock: 15, gold: 20 },
          description: "Trains heavy infantry"
        },
        CITADEL: {
          name: "Citadel",
          icon: "🏰",
          costs: { wood: 40, water: 40, rock: 20, gold: 50 },
          description: "Trains elite warriors"
        }
      }

  /**
   * Create a new building
   * @param {number} x - X position in grid coordinates
   * @param {number} y - Y position in grid coordinates
   * @param {string} color - Building color ('cyan' or 'red')
   * @param {Player} owner - Player who owns this building
   */
  constructor(x, y, color, owner) {
    this.uid = Math.random() * 1000000 | 0
    this.x = x
    this.y = y
    this.color = color
    this.owner = owner
    this.health = 100
    this.maxHealth = 100
    this.productionTimer = 0
    this.productionCooldown = 10000 // 10 seconds by default
    this.type = null
    
    // Register building with player
    if (owner) {
      if (!owner.buildings) {
        owner.buildings = []
      }
      owner.buildings.push(this)
    }
  }
  
  /**
   * Update building state
   * @param {number} delay - Time elapsed since last update (ms)
   */
  update(delay) {
    // Base building doesn't produce anything
    // But we should update any status effects, etc.
  }

  static checkCanAffordBuilding(building) {
    if (!gameState.humanPlayer) return false
    
    const resources = gameState.humanPlayer.getResources()
    
    for (const [resource, cost] of Object.entries(building.costs)) {
      if (!resources[resource] || resources[resource] < cost) {
        return false
      }
    }
    
    return true
  }
}

/**
 * Building that produces worker units
 */
class WorkerBuilding extends Building {
  constructor(x, y, color, owner) {
    super(x, y, color, owner)
    this.type = 'worker_building'
  }
  
  /**
   * Update building and produce workers
   * @param {number} delay - Time elapsed since last update (ms)
   */
  update(delay) {
    super.update(delay)
    
    // Update production timer
    this.productionTimer += delay
    
    // Check if it's time to produce a worker
    if (this.productionTimer >= this.productionCooldown) {
      this.produceWorker()
      this.productionTimer -= this.productionCooldown
    }
  }
  
  /**
   * Produce a worker unit
   */
  produceWorker() {
    if (this.owner) {
      this.owner.addWorker(this.x, this.y + 1)
    }
  }
}

/**
 * Tent is a specialized worker building (the player's base)
 */
class Tent extends WorkerBuilding {
  constructor(x, y, color, owner) {
    super(x, y, color, owner)
    this.type = 'tent'
    this.health = 200
    this.maxHealth = 200
    this.productionCooldown = 10000 // 10 seconds
  }
}