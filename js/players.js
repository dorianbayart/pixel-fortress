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
  constructor(type = PlayerType.HUMAN, difficulty = 'medium') {

    this.type = type
    this.units = []
    this.buildings = []

    this.resources = {
      wood: 15 + (Building.TYPES.TENT.costs.wood || 0),
      stone: 5 + (Building.TYPES.TENT.costs.stone || 0),
      water: 5 + (Building.TYPES.TENT.costs.water || 0),
      gold: 0 + (Building.TYPES.TENT.costs.gold || 0),
      money: 0 + (Building.TYPES.TENT.costs.money || 0),
      population: 0
    }

    // Track how many of each building type has been built
    this.buildingsBuiltCount = {}
    for (const type in Building.TYPES) {
      this.buildingsBuiltCount[Building.TYPES[type].name] = 0
    }

    if(this.isHuman()) {
      gameState.humanPlayer = this
    } else {
      gameState.addAiPlayer(this)
      this.difficulty = difficulty
      this.aiBuildingTimer = 0

      console.log(gameState)

      // Set cooldowns based on difficulty
      const difficultySettings = {
        'easy': { cooldown: 25000 }, // 25 seconds
        'medium': { cooldown: 9500 }, // 9.5 seconds
        'hard': { cooldown: 5000 }    // 5 seconds
      }
      this.aiBuildingCooldown = difficultySettings[this.difficulty].cooldown

      // Pre-calculate resource tile locations for AI
      this.goldTiles = []
      this.rockTiles = []
      setTimeout(async () => {
        if(gameState.gameStatus === 'menu') return
        const { width: MAP_WIDTH, height: MAP_HEIGHT } = getMapDimensions()
        for (let x = 0; x < MAP_WIDTH; x++) {
          for (let y = 0; y < MAP_HEIGHT; y++) {
            const tile = gameState.map[x][y]
            if (tile.type === TERRAIN_TYPES.GOLD.type) {
              this.goldTiles.push({ x, y })
            }
            if (tile.type === TERRAIN_TYPES.ROCK.type) {
              this.rockTiles.push({ x, y })
            }
          }
        }
      }, 2500)
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
    const costs = this.getBuildingCost(buildingType)
    for (const [resource, cost] of Object.entries(costs)) {
      if (!resources[resource] || resources[resource] < cost) {
        return false
      }
    }
    return true
  }

  /**
   * Check if the player can afford a building upgrade
   * @param {Building} building - The building instance to check for upgrade affordability
   * @returns {boolean} - True if the player can afford the upgrade, false otherwise
   */
  canAffordUpgrade(building) {
    const resources = this.getResources()
    const upgradeCosts = building.getUpgradeCosts()

    if (!upgradeCosts) return false // No upgrades available

    for (const [resource, cost] of Object.entries(upgradeCosts)) {
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
    const searchRadius = MAP_WIDTH / 2 * 0.80 | 0; // Define a search radius around tents

    // Specific search logic based on building type
    switch (buildingType) {
      case Building.TYPES.LUMBERJACK:
        for (const tent of tents) {
          const startX = Math.max(0, tent.x - searchRadius);
          const endX = Math.min(MAP_WIDTH - 1, tent.x + searchRadius);
          const startY = 0;
          const endY = Math.min(MAP_HEIGHT - 1, 2 * searchRadius);

          for (let x = startX; x <= endX; x++) {
            for (let y = startY; y <= endY; y++) {
              const tile = gameState.map[x][y];
              if (isOccupied(x, y)) continue;
              if ((tile.type === TERRAIN_TYPES.GRASS.type || tile.type === TERRAIN_TYPES.SAND.type) && countNearbyTrees(x, y, 3) >= 3 && !this.getBuildings().some(b => distance({ x, y }, b) < 3)) {
                potentialPlacements.push({ x, y });
              }
            }
          }
        }
        break;

      case Building.TYPES.QUARRY:
        for (const { x, y } of this.rockTiles) {
          if (!isOccupied(x, y)) {
            potentialPlacements.push({ x, y });
          }
        }
        break;

      case Building.TYPES.WELL:
        for (const tent of tents) {
          const startX = Math.max(0, tent.x - searchRadius);
          const endX = Math.min(MAP_WIDTH - 1, tent.x + searchRadius);
          const startY = 0;
          const endY = Math.min(MAP_HEIGHT - 1, 2 * searchRadius);

          for (let x = startX; x <= endX; x++) {
            for (let y = startY; y <= endY; y++) {
              const tile = gameState.map[x][y];
              if (isOccupied(x, y)) continue;
              if ((tile.type === TERRAIN_TYPES.GRASS.type || tile.type === TERRAIN_TYPES.SAND.type) && isAdjacentToWater(x, y) && !this.getBuildings().some(b => distance({ x, y }, b) < 2)) {
                potentialPlacements.push({ x, y });
              }
            }
          }
        }
        break;

      case Building.TYPES.GOLD_MINE:
        for (const { x, y } of this.goldTiles) {
          if (!isOccupied(x, y)) {
            potentialPlacements.push({ x, y });
          }
        }
        break;

      default: // For TENT, BARRACKS, ARMORY, CITADEL (general buildings)
        for (const tent of tents) {
          const startX = Math.max(0, tent.x - searchRadius);
          const endX = Math.min(MAP_WIDTH - 1, tent.x + searchRadius);
          const startY = 0;
          const endY = Math.min(MAP_HEIGHT - 1, 2 * searchRadius);

          for (let x = startX; x <= endX; x++) {
            for (let y = startY; y <= endY; y++) {
              const tile = gameState.map[x][y];
              if (isOccupied(x, y)) continue;
              if ((tile.type === TERRAIN_TYPES.GRASS.type || tile.type === TERRAIN_TYPES.SAND.type) && !this.getBuildings().some(b => distance({ x, y }, b) < 3)) {
                potentialPlacements.push({ x, y });
              }
            }
          }
        }
        break;
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
      const candidatesToCheck = potentialPlacements.slice(0, 5); // Check up to 5 closest candidates
      for (const placement of candidatesToCheck) {
        for (const tent of tents) {
          const path = await searchPath(tent.x, tent.y, placement.x, placement.y);
          if (path) {
            return placement; // Return the first accessible placement
          }
        }
      }
    } else {
      // For general buildings, return the closest valid placement without pathfinding
      if (potentialPlacements.length > 0) {
        const length = Math.min(5, potentialPlacements.length)
        return potentialPlacements[Math.floor(Math.random()*length)]
      }
    }

    return null
  }

  /**
   * AI logic to decide the next building type to construct based on difficulty.
   * @returns {object|null} - The building type object or null if no building is decided.
   */
  async decideNextBuildingType() {
    const resources = this.getResources()
    const buildings = this.getBuildings()
    const lumberjacks = buildings.filter(b => b.type === Building.TYPES.LUMBERJACK).length
    const quarries = buildings.filter(b => b.type === Building.TYPES.QUARRY).length
    const wells = buildings.filter(b => b.type === Building.TYPES.WELL).length
    const goldMines = buildings.filter(b => b.type === Building.TYPES.GOLD_MINE).length
    const markets = buildings.filter(b => b.type === Building.TYPES.MARKET).length
    const barracks = buildings.filter(b => b.type === Building.TYPES.BARRACKS).length
    const armories = buildings.filter(b => b.type === Building.TYPES.ARMORY).length
    const citadels = buildings.filter(b => b.type === Building.TYPES.CITADEL).length
    const tents = buildings.filter(b => b.type === Building.TYPES.TENT).length

    // Helper to check if AI can afford and if a building type is needed
    const canBuild = (buildingType, currentCount, targetCount) => {
      return currentCount < targetCount && this.canAffordBuilding(buildingType)
    }

    switch (this.difficulty) {
      case 'easy':
        // Simple, sequential priorities, very guided AI
        if (canBuild(Building.TYPES.LUMBERJACK, lumberjacks, 2) && this.findBuildingPlacement(Building.TYPES.LUMBERJACK)) return Building.TYPES.LUMBERJACK
        if (canBuild(Building.TYPES.QUARRY, quarries, 1) && this.findBuildingPlacement(Building.TYPES.QUARRY)) return Building.TYPES.QUARRY
        if (canBuild(Building.TYPES.WELL, wells, 1) && this.findBuildingPlacement(Building.TYPES.WELL)) return Building.TYPES.WELL
        if (canBuild(Building.TYPES.GOLD_MINE, goldMines, 1) && this.findBuildingPlacement(Building.TYPES.GOLD_MINE)) return Building.TYPES.GOLD_MINE
        if (canBuild(Building.TYPES.LUMBERJACK, lumberjacks, 3) && this.findBuildingPlacement(Building.TYPES.LUMBERJACK)) return Building.TYPES.LUMBERJACK // third lumberjack
        if (canBuild(Building.TYPES.QUARRY, quarries, 2) && this.findBuildingPlacement(Building.TYPES.QUARRY)) return Building.TYPES.QUARRY
        if (canBuild(Building.TYPES.WELL, wells, 2) && this.findBuildingPlacement(Building.TYPES.WELL)) return Building.TYPES.WELL
        if (canBuild(Building.TYPES.BARRACKS, barracks, 1) && this.findBuildingPlacement(Building.TYPES.BARRACKS)) return Building.TYPES.BARRACKS
        if (canBuild(Building.TYPES.GOLD_MINE, goldMines, 3) && this.findBuildingPlacement(Building.TYPES.GOLD_MINE)) return Building.TYPES.GOLD_MINE
        if (canBuild(Building.TYPES.LUMBERJACK, lumberjacks, 5) && this.findBuildingPlacement(Building.TYPES.LUMBERJACK)) return Building.TYPES.LUMBERJACK
        if (canBuild(Building.TYPES.QUARRY, quarries, 4) && this.findBuildingPlacement(Building.TYPES.QUARRY)) return Building.TYPES.QUARRY
        if (canBuild(Building.TYPES.MARKET, markets, 2) && this.findBuildingPlacement(Building.TYPES.MARKET)) return Building.TYPES.MARKET
        if (canBuild(Building.TYPES.BARRACKS, barracks, 3) && this.findBuildingPlacement(Building.TYPES.BARRACKS)) return Building.TYPES.BARRACKS
        if (canBuild(Building.TYPES.WELL, wells, 4) && this.findBuildingPlacement(Building.TYPES.WELL)) return Building.TYPES.WELL
        if (canBuild(Building.TYPES.ARMORY, armories, 1) && armories >= 1 && this.findBuildingPlacement(Building.TYPES.ARMORY)) return Building.TYPES.ARMORY
        if (canBuild(Building.TYPES.CITADEL, citadels, 1) && barracks >= 1 && this.findBuildingPlacement(Building.TYPES.CITADEL)) return Building.TYPES.CITADEL
        // Keep building, basic growth, with high but finite targets
        if (canBuild(Building.TYPES.LUMBERJACK, lumberjacks, 8) && this.findBuildingPlacement(Building.TYPES.LUMBERJACK)) return Building.TYPES.LUMBERJACK
        if (canBuild(Building.TYPES.QUARRY, quarries, 7) && this.findBuildingPlacement(Building.TYPES.QUARRY)) return Building.TYPES.QUARRY
        if (canBuild(Building.TYPES.WELL, wells, 6) && this.findBuildingPlacement(Building.TYPES.WELL)) return Building.TYPES.WELL
        if (canBuild(Building.TYPES.GOLD_MINE, goldMines, this.goldTiles/4) && this.findBuildingPlacement(Building.TYPES.GOLD_MINE)) return Building.TYPES.GOLD_MINE
        if (canBuild(Building.TYPES.MARKET, markets, 4) && this.findBuildingPlacement(Building.TYPES.MARKET)) return Building.TYPES.MARKET
        if (canBuild(Building.TYPES.BARRACKS, barracks, 8) && this.findBuildingPlacement(Building.TYPES.BARRACKS)) return Building.TYPES.BARRACKS
        if (canBuild(Building.TYPES.ARMORY, armories, 6) && this.findBuildingPlacement(Building.TYPES.ARMORY)) return Building.TYPES.ARMORY
        if (canBuild(Building.TYPES.CITADEL, citadels, 4) && this.findBuildingPlacement(Building.TYPES.CITADEL)) return Building.TYPES.CITADEL
        if (canBuild(Building.TYPES.TENT, tents, 5) && this.findBuildingPlacement(Building.TYPES.TENT)) return Building.TYPES.TENT
        break

      case 'medium':
        // First, gather resources
        if (canBuild(Building.TYPES.LUMBERJACK, lumberjacks, 3) && this.findBuildingPlacement(Building.TYPES.LUMBERJACK)) return Building.TYPES.LUMBERJACK
        if (canBuild(Building.TYPES.QUARRY, quarries, 3) && this.findBuildingPlacement(Building.TYPES.QUARRY)) return Building.TYPES.QUARRY
        if (canBuild(Building.TYPES.WELL, wells, 2) && this.findBuildingPlacement(Building.TYPES.WELL)) return Building.TYPES.WELL
        if (canBuild(Building.TYPES.GOLD_MINE, goldMines, 2) && this.findBuildingPlacement(Building.TYPES.GOLD_MINE)) return Building.TYPES.GOLD_MINE
        // Attack a bit
        if (canBuild(Building.TYPES.BARRACKS, barracks, 1) && this.findBuildingPlacement(Building.TYPES.BARRACKS)) return Building.TYPES.BARRACKS
        // Then grow
        if (canBuild(Building.TYPES.MARKET, markets, 5) && this.findBuildingPlacement(Building.TYPES.MARKET)) return Building.TYPES.MARKET
        if (canBuild(Building.TYPES.LUMBERJACK, lumberjacks, 10) && this.findBuildingPlacement(Building.TYPES.LUMBERJACK)) return Building.TYPES.LUMBERJACK
        if (canBuild(Building.TYPES.QUARRY, quarries, 10) && this.findBuildingPlacement(Building.TYPES.QUARRY)) return Building.TYPES.QUARRY
        if (canBuild(Building.TYPES.WELL, wells, 6) && this.findBuildingPlacement(Building.TYPES.WELL)) return Building.TYPES.WELL
        if (canBuild(Building.TYPES.GOLD_MINE, goldMines, this.goldTiles.length/2) && this.findBuildingPlacement(Building.TYPES.GOLD_MINE)) return Building.TYPES.GOLD_MINE
        if (canBuild(Building.TYPES.BARRACKS, barracks, 8) && this.findBuildingPlacement(Building.TYPES.BARRACKS)) return Building.TYPES.BARRACKS
        if (canBuild(Building.TYPES.ARMORY, armories, 8) && this.findBuildingPlacement(Building.TYPES.ARMORY)) return Building.TYPES.ARMORY
        if (canBuild(Building.TYPES.CITADEL, citadels, 8) && this.findBuildingPlacement(Building.TYPES.CITADEL)) return Building.TYPES.CITADEL
        if (canBuild(Building.TYPES.TENT, tents, 10) && this.findBuildingPlacement(Building.TYPES.TENT)) return Building.TYPES.TENT
        break

      case 'hard':
        // More aggressive resources gathering
        if (canBuild(Building.TYPES.LUMBERJACK, lumberjacks, 5) && this.findBuildingPlacement(Building.TYPES.LUMBERJACK)) return Building.TYPES.LUMBERJACK
        if (canBuild(Building.TYPES.QUARRY, quarries, 4) && this.findBuildingPlacement(Building.TYPES.QUARRY)) return Building.TYPES.QUARRY
        if (canBuild(Building.TYPES.WELL, wells, 3) && this.findBuildingPlacement(Building.TYPES.WELL)) return Building.TYPES.WELL
        if (canBuild(Building.TYPES.GOLD_MINE, goldMines, 3) && this.findBuildingPlacement(Building.TYPES.GOLD_MINE)) return Building.TYPES.GOLD_MINE
        if (canBuild(Building.TYPES.MARKET, markets, 2) && this.findBuildingPlacement(Building.TYPES.MARKET)) return Building.TYPES.MARKET
        // Then build-up with unlimited military buildings
        if (canBuild(Building.TYPES.LUMBERJACK, lumberjacks, 12) && this.findBuildingPlacement(Building.TYPES.LUMBERJACK)) return Building.TYPES.LUMBERJACK
        if (canBuild(Building.TYPES.QUARRY, quarries, 12) && this.findBuildingPlacement(Building.TYPES.QUARRY)) return Building.TYPES.QUARRY
        if (canBuild(Building.TYPES.WELL, wells, 12) && this.findBuildingPlacement(Building.TYPES.WELL)) return Building.TYPES.WELL
        if (canBuild(Building.TYPES.GOLD_MINE, goldMines, this.goldTiles.length) && this.findBuildingPlacement(Building.TYPES.GOLD_MINE)) return Building.TYPES.GOLD_MINE
        if (canBuild(Building.TYPES.BARRACKS, barracks, 5) && this.findBuildingPlacement(Building.TYPES.BARRACKS)) return Building.TYPES.BARRACKS
        if (canBuild(Building.TYPES.MARKET, markets, 5) && this.findBuildingPlacement(Building.TYPES.MARKET)) return Building.TYPES.MARKET
        if (canBuild(Building.TYPES.ARMORY, armories, 8) && this.findBuildingPlacement(Building.TYPES.ARMORY)) return Building.TYPES.ARMORY
        if (canBuild(Building.TYPES.CITADEL, citadels, 15) && this.findBuildingPlacement(Building.TYPES.CITADEL)) return Building.TYPES.CITADEL
        if (canBuild(Building.TYPES.TENT, tents, 8) && this.findBuildingPlacement(Building.TYPES.TENT)) return Building.TYPES.TENT
        // Default
        if (canBuild(Building.TYPES.BARRACKS, barracks, Infinity) && this.findBuildingPlacement(Building.TYPES.BARRACKS)) return Building.TYPES.BARRACKS
        break
    }

    return null // No building to construct at this time
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
    this.buildings = this.getBuildings().filter(building => building.life > 0)

    // AI building logic
    if (!this.isHuman()) {
      this.aiBuildingTimer += delay
      if (this.aiBuildingTimer >= this.aiBuildingCooldown) {
        this.aiBuildingTimer -= this.aiBuildingCooldown
        const buildingType = await this.decideNextBuildingType()

        if (buildingType) {
          const placement = await this.findBuildingPlacement(buildingType)
          if (placement?.x && placement?.y) {
            const building = this.addBuilding(placement.x, placement.y, buildingType)

            if(building.type === Building.TYPES.MARKET) { // Sell a random resource
              building.setSellingResource(building.getValidSellingResources()[Math.random() * building.getValidSellingResources().length | 0])
            }
          }
        }
      }
    }
  }

  /**
   * Get the current cost of a building, adjusted by how many have been built.
   * @param {object} buildingType - The building type object.
   * @returns {object} - An object containing the adjusted costs.
   */
  getBuildingCost(buildingType) {
    const baseCosts = buildingType.costs
    const builtCount = this.buildingsBuiltCount[buildingType.name] || 0
    const adjustedCosts = {}

    for (const [resource, cost] of Object.entries(baseCosts)) {
      // Increase cost by 25% for each building of the same type already built
      adjustedCosts[resource] = cost * (1 + builtCount * 0.25) | 0
    }
    return adjustedCosts
  }

  addBuilding(x, y, buildingType) {
    // Deduct resources
    const currentCosts = this.getBuildingCost(buildingType)
    const resources = this.getResources()
    for (const [resource, cost] of Object.entries(currentCosts)) {
      resources[resource] -= cost
    }
    this.updateResources(resources)

    // Increment the count for this building type
    if(buildingType.name === 'Tent' && this.buildingsBuiltCount[buildingType.name] === 0) {
      this.buildingsBuiltCount[buildingType.name] = -1 // First Tent is not counted
    }
    this.buildingsBuiltCount[buildingType.name] = (this.buildingsBuiltCount[buildingType.name] || 0) + 1

    // Create building
    return Building.create(buildingType, x, y, this.getColor(), this)
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