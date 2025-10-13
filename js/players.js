export { Player, PlayerType }

'use strict'

import { Building } from 'building'
import gameState, { EventSystem } from 'state'
import { getMapDimensions } from 'dimensions'
import { TERRAIN_TYPES } from 'game'
import { EliteWarrior, GoldMiner, HeavyInfantry, LumberjackWorker, Peon, PeonSoldier, QuarryMiner, Soldier, WaterCarrier, WorkerUnit } from 'unit'
import { searchPath } from 'pathfinding'
import { distance } from 'utils'

const PlayerType = {
  HUMAN: 'human',
  AI: 'ai'
}

class Player {
  constructor(type = PlayerType.HUMAN) {

    this.type = type
    this.units = []
    this.buildings = []

    this.resources = {
      wood: 10 + 5,
      water: 0 + 5,
      gold: 0,
      money: 0 + 5,
      stone: 0,
      population: 0
    }

    if(this.isHuman()) {
      gameState.humanPlayer = this
    } else {
      gameState.addAiPlayer(this)
      this.aiBuildingQueue = [
        Building.TYPES.LUMBERJACK,
        Building.TYPES.LUMBERJACK,
        Building.TYPES.QUARRY,
        Building.TYPES.LUMBERJACK,
        Building.TYPES.QUARRY,
        Building.TYPES.WELL,
        Building.TYPES.GOLD_MINE,
        Building.TYPES.GOLD_MINE,
        Building.TYPES.WELL,
        Building.TYPES.BARRACKS,
        Building.TYPES.LUMBERJACK,
        Building.TYPES.QUARRY,
        Building.TYPES.WELL,
        Building.TYPES.GOLD_MINE,
        Building.TYPES.BARRACKS,
        Building.TYPES.LUMBERJACK,
        Building.TYPES.QUARRY,
        Building.TYPES.WELL,
        Building.TYPES.GOLD_MINE,
        Building.TYPES.ARMORY,
        Building.TYPES.ARMORY,
        Building.TYPES.CITADEL,
        Building.TYPES.BARRACKS,
      ]
      this.aiBuildingTimer = 0
      this.aiBuildingCooldown = 9500 // 9.5 seconds
      this.aiBuildingDelay = 9500 // 9.5 seconds
    }

    this.events = new EventSystem()
  }

  clear() {
    if (this.units) {
      this.units.forEach(unit => {
        unit.destroy()
      })
      this.units = []
    }
    if (this.buildings) {
      this.buildings.forEach(building => {
        building.destroy()
      })
      this.buildings = []
    }

    if (this.events) {
      this.events.removeAllListeners()
    }
  }

  getUnits() {
    return this.units
  }

  getBuildings() {
    return this.buildings
  }

  getTents() {
    return this.buildings.filter(building => building.type === Building.TYPES.TENT)
  }

  getColor() {
    return this.isHuman() ? 'cyan' : 'red'
  }

  isHuman() {
    return this.type === PlayerType.HUMAN
  }

  getEnemies() {
    return this.isHuman() ? 
      [
        ...gameState.aiPlayers.flatMap(ai => ai.getUnits()),
        ...gameState.aiPlayers.flatMap(ai => ai.getBuildings())
      ] : [
        ...gameState.humanPlayer.getUnits(),
        ...gameState.humanPlayer.getBuildings()
      ]
  }

  getResources() {
    // Calculate current population based on units
    this.resources.population = this.units.length
    return { ...this.resources }
  }

  updateResources(updates) {
    const oldResources = { ...this.resources }
    this.resources = { ...this.resources, ...updates }
    this.events.emit('resources-changed', this.resources, oldResources)
  }

  // Add wood, subtract wood, etc.
  addResource(type, amount) {
    if (this.resources[type] !== undefined) {
      this.resources[type] += amount
      this.events.emit('resources-changed', this.resources)
    }
  }

  /**
   * Check if the player can afford a building
   * @param {object} buildingType - The building type object
   * @returns {boolean} - True if the player can afford it, false otherwise
   */
  canAffordBuilding(buildingType) {
    const resources = this.getResources()
    for (const [resource, cost] of Object.entries(buildingType.costs)) {
      if (!resources[resource] || resources[resource] < cost) {
        return false
      }
    }
    return true
  }

  /**
   * Find a suitable placement for a new building
   * @param {object} buildingType - The building type object
   * @returns {Promise<object|null>} - An object with x, y coordinates or null if no placement found
   */
  async findBuildingPlacement(buildingType) {
    const { width: MAP_WIDTH, height: MAP_HEIGHT } = getMapDimensions()
    const tents = this.getTents()

    if (tents.length === 0) return null // No base to build from

    // Helper to check if a tile is occupied
    const isOccupied = (x, y) => {
      const tile = gameState.map[x][y]
      return tile.building || this.getUnits().some(unit => unit.x === x && unit.y === y) || this.getEnemies().some(enemy => enemy.x === x && enemy.y === y)
    }

    // Helper to check for water adjacency for Well
    const isAdjacentToWater = (x, y) => {
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue
          const nx = x + dx
          const ny = y + dy
          if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT && gameState.map[nx][ny].type === TERRAIN_TYPES.WATER.type) {
            return true
          }
        }
      }
      return false
    }

    // Helper to count nearby trees for Lumberjack
    const countNearbyTrees = (x, y, radius) => {
      let count = 0
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          const nx = (x + dx) | 0
          const ny = (y + dy) | 0
          if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_HEIGHT && gameState.map[nx][ny].type === TERRAIN_TYPES.TREE.type) {
            count++
          }
        }
      }
      return count
    }

    let potentialPlacements = []

    // Collect all potential placements based on building type
    for (let x = 0; x < MAP_WIDTH; x++) {
      for (let y = 0; y < MAP_HEIGHT/2; y++) {
        const tile = gameState.map[x][y]
        if (isOccupied(x, y)) continue

        let isValidCandidate = false
        switch (buildingType) {
          case Building.TYPES.LUMBERJACK:
            if ((tile.type === TERRAIN_TYPES.GRASS.type || tile.type === TERRAIN_TYPES.SAND.type) && countNearbyTrees(x, y, 3) >= 3 && !this.getBuildings().some(b => distance({x,y}, b) < 3)) {
              isValidCandidate = true
            }
            break
          case Building.TYPES.QUARRY:
            if (tile.type === TERRAIN_TYPES.ROCK.type) {
              isValidCandidate = true
            }
            break
          case Building.TYPES.WELL:
            if ((tile.type === TERRAIN_TYPES.GRASS.type || tile.type === TERRAIN_TYPES.SAND.type) && isAdjacentToWater(x, y) && !this.getBuildings().some(b => distance({x,y}, b) < 2)) {
              isValidCandidate = true
            }
            break
          case Building.TYPES.GOLD_MINE:
            if (tile.type === TERRAIN_TYPES.GOLD.type) {
              isValidCandidate = true
            }
            break
          default: // For TENT, BARRACKS, ARMORY, CITADEL (general buildings)
            if ((tile.type === TERRAIN_TYPES.GRASS.type || tile.type === TERRAIN_TYPES.SAND.type) && !this.getBuildings().some(b => distance({x,y}, b) < 3)) {
              isValidCandidate = true
            }
            break
        }

        if (isValidCandidate) {
          potentialPlacements.push({ x, y })
        }
      }
    }

    // Sort potential placements by Euclidean distance to the nearest tent
    potentialPlacements.sort((a, b) => {
      let distA = Infinity
      for (const tent of tents) {
        distA = Math.min(distA, distance(a, tent))
      }
      let distB = Infinity
      for (const tent of tents) {
        distB = Math.min(distB, distance(b, tent))
      }
      return distA - distB
    })

    // For resource buildings, check path for a limited number of closest candidates
    if ([Building.TYPES.LUMBERJACK, Building.TYPES.QUARRY, Building.TYPES.WELL, Building.TYPES.GOLD_MINE].includes(buildingType)) {
      console.log(buildingType, potentialPlacements)
      const candidatesToCheck = potentialPlacements.slice(0, 10) // Check up to 20 closest candidates
      for (const placement of candidatesToCheck) {
        for (const tent of tents) {
          const path = await searchPath(tent.x, tent.y, placement.x, placement.y)
          if (path) {
            return placement // Return the first accessible placement
          }
        }
      }
    } else {
      // For general buildings, return the closest valid placement without pathfinding
      if (potentialPlacements.length > 0) {
        return potentialPlacements[0]
      }
    }

    return null
  }

  /**
   * AI logic to build the next queued building
   * @param {Array<Array<object>>} map - The game map
   */
  async buildNextQueuedBuilding(map) {
    if (this.aiBuildingQueue.length === 0) return

    const buildingType = this.aiBuildingQueue[0]

    // Check if AI can afford the building
    if (this.canAffordBuilding(buildingType)) {
      // Find a suitable placement
      const placement = await this.findBuildingPlacement(buildingType)

      if (placement?.x && placement?.y) {
        // Build it
        this.addBuilding(placement.x, placement.y, buildingType)
        console.log(`AI built a ${buildingType.name} at ${placement.x}, ${placement.y}`)
        this.aiBuildingQueue.shift() // Remove from queue
      } else {
        // If no placement found, try again next time (don't remove from queue)
        console.log(`AI could not find placement for ${buildingType.name}, pushing it to the end of the queue`)
        this.aiBuildingQueue.shift()
        this.aiBuildingQueue.push(buildingType)
      }
    } else {
      // If not enough resources, try again next time (don't remove from queue)
      console.log(`AI cannot afford ${buildingType.name}`)
    }
  }

  async update(delay) {
    // Update all buildings
    for (let i = 0; i < this.getBuildings().length; i++) {
      this.buildings[i].update(delay)
    }
    
    // Update all units
    this.getUnits().map(async unit => {
      unit.update(delay)

      if(unit instanceof WorkerUnit && unit.timeSinceLastTask > 75 && unit.task === 'idle') {
        // inactive Peons are converted to PeonSoldier
        this.addPeonSoldier(unit.currentNode.x, unit.currentNode.y)
        unit.life = 0
      }
    })

    this.units = this.getUnits().filter(unit => unit.life > 0)
    this.buildings = this.getBuildings().filter(building => building.health > 0)

    // AI building logic
    if (!this.isHuman()) {
      this.aiBuildingTimer += delay
      if (this.aiBuildingTimer >= this.aiBuildingCooldown) {
        this.aiBuildingTimer -= this.aiBuildingCooldown
        this.buildNextQueuedBuilding(gameState.map)
      }
    }
  }

  addBuilding(x, y, buildingType) {
    // Deduct resources
    const resources = this.getResources()
    for (const [resource, cost] of Object.entries(buildingType.costs)) {
      resources[resource] -= cost
    }
    this.updateResources(resources)

    // Create building
    Building.create(buildingType, x, y, this.getColor(), this)
  }

  addWorker(x, y) {
    this.units.push(
      new Peon(x, y, this)
    )
  }

  addLumberjackWorker(x, y, assignedBuilding) {
    const worker = new LumberjackWorker(x, y, this)
    
    if (assignedBuilding) {
      // Assign the worker to the building
      worker.assignedBuilding = assignedBuilding
      assignedBuilding.assignedWorkers.push(worker)
    }
    
    this.units.push(worker)
    return worker
  }

  addQuarryMiner(x, y, assignedBuilding) {
    const miner = new QuarryMiner(x, y, this)
    
    if (assignedBuilding) {
      // Assign the miner to the building
      miner.assignedBuilding = assignedBuilding
      assignedBuilding.assignedWorkers.push(miner)
    }
    
    this.units.push(miner)
    return miner
  }

  addWaterCarrier(x, y, assignedBuilding) {
    const carrier = new WaterCarrier(x, y, this)
    
    if (assignedBuilding) {
      // Assign the worker to the building
      carrier.assignedBuilding = assignedBuilding
      assignedBuilding.assignedWorkers.push(carrier)
    }
    
    this.units.push(carrier)
    return carrier
  }

  addGoldMiner(x, y, assignedBuilding) {
    const miner = new GoldMiner(x, y, this)
    
    if (assignedBuilding) {
      // Assign the miner to the building
      miner.assignedBuilding = assignedBuilding
      assignedBuilding.assignedWorkers.push(miner)
    }
    
    this.units.push(miner)
    return miner
  }

  addPeonSoldier(x, y) {
    this.units.push(
      new PeonSoldier(x, y, this)
    )
  }

  // addHumanSoldier(x, y) {
  //   this.units.push(
  //     new HumanSoldier(x, y, this)
  //   )
  // }

  addSoldier(x, y) {
    this.units.push(
      new Soldier(x, y, this)
    )
  }

  addHeavyInfantry(x, y) {
    this.units.push(
      new HeavyInfantry(x, y, this)
    )
  }

  addEliteWarrior(x, y) {
    this.units.push(
      new EliteWarrior(x, y, this)
    )
  }
}