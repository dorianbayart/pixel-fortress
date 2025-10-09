export {
  CombatUnit, EliteWarrior, GoldMiner, HeavyInfantry, LumberjackWorker, Mage, MeleeUnit, Peon, PeonSoldier, QuarryMiner, RangedUnit, Soldier, Unit, WaterCarrier, WorkerUnit
}

'use strict'

import { getMapDimensions, getTileSize } from 'dimensions'
import { TERRAIN_TYPES, updateSprite } from 'game'
import { ParticleEffect, createParticleEmitter } from 'particles'
import { searchPath } from 'pathfinding'
import { indicatorMap, removeProgressIndicator } from 'renderer'
import { UNIT_SPRITE_SIZE, offscreenSprite, unitsSprites, unitsSpritesDescription } from 'sprites'
import gameState from 'state'
import { distance } from 'utils'

const PI = Math.PI


/*
Class hierarchy

Unit (base class)
├── WorkerUnit (collects resources)
│   ├── Peon
|   └── Lumberjack (wood)
|   └── QuarryMiner (stone)
|   └── WaterCarrier (water)
|   └── GoldMiner (gold)
├── CombatUnit (fighting capabilities)
│   ├── MeleeUnit (close combat)
│   │   ├── PeonSoldier
│   │   ├── Soldier
│   │   └── HeavyInfantry
│   │   └── EliteWarrior
│   └── RangedUnit (attacks from distance)
│       └── Mage

*/



/**
 * Base Unit class for all game units
 * Handles common unit behaviors including:
 * - Movement and pathfinding
 * - Sprite animation and direction
 * - Task management
 * - Basic unit properties (health, speed, etc.)
 * 
 * Acts as the foundation for specialized unit types.
 */
class Unit {
  /**
   * Create a new unit
   * @param {number} x - X position in grid coordinates
   * @param {number} y - Y position in grid coordinates
   * @param {Player} owner - The Player owning this unit
   */
  constructor(x, y, owner) {
    const SPRITE_SIZE = getTileSize()

    this.owner = owner

    // Position and movement
    this.uid = Math.random() * 1000000 | 0
    this.x = x * SPRITE_SIZE | 0
    this.y = y * SPRITE_SIZE | 0
    this.currentNode = { x: this.x/SPRITE_SIZE, y: this.y/SPRITE_SIZE }
    this.nextNode = { x: this.x/SPRITE_SIZE, y: this.y/SPRITE_SIZE }
    this.nextNextNode = { x: this.x/SPRITE_SIZE, y: this.y/SPRITE_SIZE }
    this.angle = -PI/2
    this.visible = true

    // Tasks management
    this.task = 'idle'
    
    // Path finding
    this.path = null
    this.goal = null
    
    // Timing
    this.spriteTimer = 0
    this.lastMoveUpdate = 0
    this.lastPathUpdate = 0
    
    // Unit properties (to be set by subclasses)
    this.range = null
    this.life = null
    this.speed = null
    this.attack = null
    this.spriteName = null
    this.sprite = null
    this.visibilityRange = getTileSize() * 5

    // Progress indicator properties
    this.showProgressIndicator = false
    this.indicatorColor = 0x0000BB
    this.progress = 0
  }

  /**
   * Properly cleanup object
   */
  destroy() {
    this.path = null
    this.goal = null
    this.sprite = null
    
    if (indicatorMap?.has(this.uid)) {
      removeProgressIndicator(this.uid)
    }
  }

  /**
   * Update unit state
   * @param {number} delay - Time elapsed since last update (ms)
   */
  update(delay) {
    const time = performance.now() | 0
    this.timeSinceLastTask += delay

    if(this.life <= 0) {
      // Cleanup unit
      this.destroy()

      // Create death particles
      createParticleEmitter(ParticleEffect.UNIT_DEATH, {
        x: this.x + getTileSize()/2,
        y: this.y + getTileSize()/2,
        duration: 1000
      })
      
      return
    }

    this.handleTasks(delay, time)

    if(!this.goal) return

    if(distance(this.currentNode, this.goal.currentNode ? { x: this.goal.x / getTileSize(), y: this.goal.y / getTileSize() } : this.goal) > (this.range) / getTileSize()) {
      this.updatePath(delay, time)
    } else {
      this.goalReached(delay, time)
      this.timeSinceLastTask = 0
    }
    
    
    this.updateMovement(delay, time)
  }

  /**
   * Handle tasks
   * @param {number} delay - Time elapsed since last update (ms)
   * @param {number} time - The current time (ms)
   */
  handleTasks(delay, time) {
    // To be implemented by subclasses
  }

  /**
   * Update path of the unit
   * @param {number} delay - Time elapsed since last update (ms)
   * @param {number} time - The current time (ms)
   */
  updatePath(delay, time) {
    if (this.isAtGoal()) return

    const mathPathLength = this.path?.length || 1
    const maxTime = Math.min(4500, mathPathLength * 400)
    const updatePath = time - this.lastPathUpdate > maxTime
    const distToNextNode = distance(this.currentNode, this.nextNode) || 0

    if(distToNextNode < 1 && mathPathLength > 1) {
      // Just trim the path if we've reached the next node
      this.path.splice(0, 1)
      this.timeSinceLastTask = 0
    }

    if(!this.path || updatePath) {
      this.lastPathUpdate = time
      this.findPath()
    }

  }

  /**
   * Check if unit is at goal or very close to it
   * @returns {boolean} True if the unit is at or very close to its goal
   */
  isAtGoal() {
    if (!this.goal) return false;
    const goalX = this.goal.currentNode?.x || this.goal.x;
    const goalY = this.goal.currentNode?.y || this.goal.y;
    const dist = distance({ x: this.currentNode.x, y: this.currentNode.y }, { x: goalX, y: goalY });
    return dist <= (this.range / getTileSize());
  }

  /**
   * Check if unit is near its goal
   * @returns {boolean} True if the unit is near its goal
   */
  isNearGoal() {
    if (!this.goal) return false;
    const goalX = this.goal.currentNode?.x || this.goal.x;
    const goalY = this.goal.currentNode?.y || this.goal.y;
    const dist = distance({ x: this.currentNode.x, y: this.currentNode.y }, { x: goalX, y: goalY });
    // Consider "near" as within 5 tiles or the unit's range, whichever is larger
    return dist <= Math.max(5, this.range / getTileSize() * 2);
  }

  /**
   * Find the best path to the goal
   */
  findPath() {
    if(this.nextNode) {
      const path = searchPath(this.nextNode.x, this.nextNode.y, this.goal.x, this.goal.y)
      this.path = path ? [this.currentNode, ...path] : [this.currentNode]
    } else {
      this.path = searchPath(this.currentNode.x, this.currentNode.y, this.goal.x, this.goal.y)
    }
  }

  /**
   * Do action when goal is reached
   * @param {number} delay - Time elapsed since last update (ms)
   * @param {number} time - The current time (ms)
   */
  goalReached(delay, time) {
    // To be implemented by subclasses
  }

  /**
   * Update movement of the unit
   * @param {number} delay - Time elapsed since last update (ms)
   * @param {number} time - The current time (ms)
   */
  updateMovement(delay, time) {
    // Handle no path case
    if(!this.path) {
      this.handleNoPath(delay)
    } else {
      // Set next node in path
      this.nextNode.x = this.path[1]?.x
      this.nextNode.y = this.path[1]?.y

      // Look ahead one more node if possible
      if(this.path[2]) {
        this.nextNextNode.x = this.path[2]?.x
        this.nextNextNode.y = this.path[2]?.y
      } else {
        this.nextNextNode.x = this.path[1]?.x
        this.nextNextNode.y = this.path[1]?.y
      }
    }

    this.lastMoveUpdate = time
    this.move(Math.min(delay, 40))
  }

  /**
   * Attack the target enemy
   * @param {number} delay - Time elapsed since last update (ms)
   */
  attackEnemy(delay) {
    if(this.goal) {
      this.goal.life -= this.attack * delay / 1000

      // Add attack particles
      if (Math.random() < 0.2) { // 30% chance per attack frame
        const SPRITE_SIZE = getTileSize()
        let targetX, targetY
        
        // Get target position
        if (this.goal.currentNode) {
          // Unit target
          targetX = this.goal.x
          targetY = this.goal.y
        } else {
          // Building target
          targetX = this.goal.x * SPRITE_SIZE
          targetY = this.goal.y * SPRITE_SIZE
        }
        
        // Create attack particles
        createParticleEmitter(ParticleEffect.UNIT_ATTACK, {
          x: targetX + SPRITE_SIZE/2,
          y: targetY + SPRITE_SIZE/2,
          duration: 500,
          // customProps: {
          //   targetX: targetX,
          //   targetY: targetY
          // }
        })
      }
    }
  }

  /**
   * Handle case when no path is found
   * @param {number} delay - Time elapsed since last update (ms)
   */
  handleNoPath(delay) {
    // this.life -= delay / 1000
    // this.goal = null
  }

  /**
   * Move unit based on current path
   * @param {number} delay - Time elapsed since last update (ms)
   */
  move(delay) {
    const SPRITE_SIZE = getTileSize()
    const devX = ((this.nextNode.x * SPRITE_SIZE - this.x) * 2 + (this.nextNextNode.x * SPRITE_SIZE - this.x)) / 3
    const devY = ((this.nextNode.y * SPRITE_SIZE - this.y) * 2 + (this.nextNextNode.y * SPRITE_SIZE - this.y)) / 3
    const theta = Math.atan2(devY, devX)
    const nodeForSpeedFactor = { x: Math.round(this.x / SPRITE_SIZE), y: Math.round(this.y / SPRITE_SIZE) }
    const speedFactor = Math.max(1/gameState.map[nodeForSpeedFactor.x][nodeForSpeedFactor.y].weight, 1/8)
    let vx = this.speed * (delay/1000) * Math.cos(theta) * speedFactor * SPRITE_SIZE
    let vy = this.speed * (delay/1000) * Math.sin(theta) * speedFactor * SPRITE_SIZE

    let type = 'static'
    if (distance(this.currentNode, this.goal?.currentNode ? { x: this.goal.x / getTileSize(), y: this.goal.y / getTileSize() } : this.goal) <= this.range/getTileSize()) {
      // Stop walking if arrived at goal
      vx = vy = 0
    }

    // Attack
    if(this.task === 'attack') {
      type = 'attack'
    }
    if(this.task === 'gathering') {
      type = 'lumberjack'
    }
    // Walk
    if(this.goal && Math.abs(vx) + Math.abs(vy) > this.speed * (delay/2000)) {
      type = 'walk'
      this.x += vx
      this.y += vy
      this.theta = theta

      if(Math.hypot(devX, devY) < SPRITE_SIZE/3) {
        // we finally are on nextNode now
        this.currentNode.x = this.nextNode.x
        this.currentNode.y = this.nextNode.y
      }
    }

    this.sprite = this.updateSprite(type, -this.theta, delay)
  }

  /**
   * Update unit sprite based on state and direction
   * @param {string} type - Sprite type ('static', 'walk', 'attack')
   * @param {number} theta - Direction angle
   * @param {number} delay - Time elapsed since last update (ms)
   * @returns {OffscreenCanvas} Updated sprite
   */
  updateSprite(type, theta = -PI/2, delay) {
    if(!unitsSpritesDescription) return
    const keys = Object.keys(unitsSpritesDescription[this.spriteName][type])

    this.spriteTimer += delay
    if(this.spriteTimer >= keys.length * 300) this.spriteTimer -= keys.length * 300
    const spriteVar = `_${this.spriteTimer / 300 | 0}`

    try {
      if(theta > -7*PI/12 && theta < -5*PI/12) {
        return offscreenSprite(unitsSprites[this.spriteName][unitsSpritesDescription[this.spriteName][type][spriteVar].s.x][unitsSpritesDescription[this.spriteName][type][spriteVar].s.y], UNIT_SPRITE_SIZE, `${this.spriteName}${type}${spriteVar}s`)
      } else if(theta >= -5*PI/12 && theta < -PI/12) {
        return offscreenSprite(unitsSprites[this.spriteName][unitsSpritesDescription[this.spriteName][type][spriteVar].se.x][unitsSpritesDescription[this.spriteName][type][spriteVar].se.y], UNIT_SPRITE_SIZE, `${this.spriteName}${type}${spriteVar}se`)
      } else if(theta >= -PI/12 && theta < PI/12) {
        return offscreenSprite(unitsSprites[this.spriteName][unitsSpritesDescription[this.spriteName][type][spriteVar].e.x][unitsSpritesDescription[this.spriteName][type][spriteVar].e.y], UNIT_SPRITE_SIZE, `${this.spriteName}${type}${spriteVar}e`)
      } else if(theta >= PI/12 && theta < 5*PI/12) {
        return offscreenSprite(unitsSprites[this.spriteName][unitsSpritesDescription[this.spriteName][type][spriteVar].ne.x][unitsSpritesDescription[this.spriteName][type][spriteVar].ne.y], UNIT_SPRITE_SIZE, `${this.spriteName}${type}${spriteVar}ne`)
      } else if(theta >= 5*PI/12 && theta < 7*PI/12) {
        return offscreenSprite(unitsSprites[this.spriteName][unitsSpritesDescription[this.spriteName][type][spriteVar].n.x][unitsSpritesDescription[this.spriteName][type][spriteVar].n.y], UNIT_SPRITE_SIZE, `${this.spriteName}${type}${spriteVar}n`)
      } else if(theta >= 7*PI/12 && theta < 11*PI/12) {
        return offscreenSprite(unitsSprites[this.spriteName][unitsSpritesDescription[this.spriteName][type][spriteVar].nw.x][unitsSpritesDescription[this.spriteName][type][spriteVar].nw.y], UNIT_SPRITE_SIZE, `${this.spriteName}${type}${spriteVar}nw`)
      } else if(theta >= 11*PI/12 || theta < -11*PI/12) {
        return offscreenSprite(unitsSprites[this.spriteName][unitsSpritesDescription[this.spriteName][type][spriteVar].w.x][unitsSpritesDescription[this.spriteName][type][spriteVar].w.y], UNIT_SPRITE_SIZE, `${this.spriteName}${type}${spriteVar}w`)
      } else if(theta >= -11*PI/12 && theta < -7*PI/12) {
        return offscreenSprite(unitsSprites[this.spriteName][unitsSpritesDescription[this.spriteName][type][spriteVar].sw.x][unitsSpritesDescription[this.spriteName][type][spriteVar].sw.y], UNIT_SPRITE_SIZE, `${this.spriteName}${type}${spriteVar}sw`)
      }
    } catch {}

    return this.sprite
  }
}

/**
 * Base class for worker units
 */
class WorkerUnit extends Unit {
  constructor(x, y, owner) {
    super(x, y, owner)
    
    // Peon units have weaker stats but can collect resources
    this.life = 5
    this.attack = 1
    this.range = 1 * getTileSize()
    this.speed = getTileSize() / 12
    this.resources = 0
    this.maxResources = 1

    // Task states
    this.task = 'idle' // 'idle', 'gathering', 'returning', 'assigned'
    this.assignedPath = null // Path assigned by a building

    this.timeSinceLastTask = 0
  }

  /**
   * Set an assigned path from a building
   * @param {Array} path - Path to follow
   */
  assignPath(path) {
    this.assignedPath = path
    this.path = path
    this.task = 'assigned'
    this.goal = path[path.length - 1]
  }

}

/**
 * Peon unit implementation
 */
class Peon extends WorkerUnit {
  constructor(x, y, owner) {
    super(x, y, owner)
    this.spriteName = 'human-worker-' + this.owner.getColor()
    this.sprite = offscreenSprite(unitsSprites[this.spriteName][unitsSpritesDescription[this.spriteName].static._0.s.x][unitsSpritesDescription[this.spriteName].static._0.s.y], UNIT_SPRITE_SIZE, `${this.spriteName}static_0s`)
  }
}

/**
 * Specialized worker for gathering wood from trees
 * Can harvest trees, transport wood back to lumberjack buildings,
 * and track resource gathering progress.
 * 
 * Has unique behaviors for tree selection, harvesting, and resource depletion.
 */
class LumberjackWorker extends WorkerUnit {
  constructor(x, y, owner) {
    super(x, y, owner)
    this.spriteName = 'human-worker-' + this.owner.getColor()
    this.sprite = offscreenSprite(unitsSprites[this.spriteName][unitsSpritesDescription[this.spriteName].static._0.s.x][unitsSpritesDescription[this.spriteName].static._0.s.y], UNIT_SPRITE_SIZE, `${this.spriteName}static_0s`)
    
    // Specialized properties
    this.harvestRate = 0.1 // Wood per second
    this.maxResources = 1
    this.assignedBuilding = null // Reference to lumberjack building

    this.showProgressIndicator = true
    this.indicatorColor = 0x804729 // Brown for wood

    this.task = 'gathering'
  }

  handleTasks(delay, time) {
    // if(this.task === 'idle') return

    // Store previous task to detect changes
    const previousTask = this.task
    
    if(this.resources < this.maxResources) {
      this.task = 'gathering'
    } else {
      this.task = 'returning'
    }

    // If task has changed, clear path to force recalculation
    if(previousTask !== this.task) {
      this.path = null;
      this.lastPathUpdate = 0; // Force immediate path recalculation
    }

    switch(this.task) {
      case 'gathering':
        this.findTreeToHarvest(time)
        break
      case 'returning':
        this.goal = this.assignedBuilding
        break
    }

    this.timeSinceLastTask = 0
  }

  /**
   * Do action when goal is reached
   * @param {number} delay - Time elapsed since last update (ms)
   * @param {number} time - The current time (ms)
   */
  goalReached(delay, time) {
    switch(this.task) {
      case 'gathering':
        this.harvest(delay)
        break
      case 'returning':
        this.depositResources()
        break
    }
  }
  
  /**
   * Find and harvest trees
   */
  findTreeToHarvest(time) {
    if (this.goal) return

    // Get a tree from the assigned building's list
    const tree = this.assignedBuilding?.getNextHarvestableTree()
    
    if (tree) {
      this.lastPathUpdate = time
      this.path = searchPath(this.currentNode.x, this.currentNode.y, tree.x, tree.y)
      if (this.path) this.goal = tree
    } else {
      // No tree found, stay idle
      this.task = 'idle'
    }
  }
  
  /**
   * Find and harvest trees
   */
  harvest(delay) {
    // Get the tree tile
    const tree = gameState.map[this.goal.x][this.goal.y]

    // Check if this is still a valid tree
    if (tree?.type === 'TREE' && tree?.lifeRemaining > 0) {
      // Calculate how much to harvest (limited by what's left in the tree)
      const amountToHarvest = Math.min(
        this.harvestRate * delay / 1000,
        tree.lifeRemaining,
        this.maxResources - this.resources
      )

      // Add to worker's carried resources
      this.resources += amountToHarvest

      // Update progress for indicator
      this.progress = this.resources / this.maxResources

      // Reduce tree's remaining resources
      tree.lifeRemaining -= amountToHarvest

      // Add harvest particles (occasionally, not every frame)
      if (Math.random() < 0.15) { // 15% chance per frame
        createParticleEmitter(ParticleEffect.WOOD_HARVEST, {
          x: this.goal.x * getTileSize() + getTileSize() / 2,
          y: this.goal.y * getTileSize() + getTileSize() / 2,
          duration: 800
        })
      }

      // Check if tree is depleted
      if (tree.lifeRemaining <= 0) {
        this.depleteTree({ x: this.goal.x, y: this.goal.y })
        this.goal = null
        this.path = null
      }
    } else {
      // Tree is no longer valid, find a new one
      this.goal = null
      this.path = null
    }
  }

  /**
   * Handle tree depletion
   * @param {Object} tree - The tree tile
   */
  async depleteTree(tree) {
    // Update the map tile
    gameState.map[tree.x][tree.y].type = 'DEPLETED_TREE'
    gameState.map[tree.x][tree.y].weight = TERRAIN_TYPES.GRASS.weight
    
    updateSprite(tree.x, tree.y)
    
    // Remove from lumberjack's tree list if applicable
    if (this.assignedBuilding) {
        this.assignedBuilding.removeTree(tree)
    }
  }
  
  /**
   * Deposit collected resources at lumberjack building
   */
  depositResources() {
    // If we're close to the building, deposit resources
    if (this.assignedBuilding) {
      if (this.resources > 0) {
          this.assignedBuilding.owner.addResource('wood', this.resources | 0)
          this.resources = 0
          this.progress = 0 // Reset progress after depositing
      }
    } else {
      // Assigned building as been probably destroyed
      this.task = 'idle'
    }

    this.goal = null
    this.path = null
  }
}


/**
 * Specialized worker for extracting stone from rock
 */
class QuarryMiner extends WorkerUnit {
  constructor(x, y, owner) {
    super(x, y, owner)
    this.spriteName = 'human-worker-' + this.owner.getColor()
    this.sprite = offscreenSprite(unitsSprites[this.spriteName][unitsSpritesDescription[this.spriteName].static._0.s.x][unitsSpritesDescription[this.spriteName].static._0.s.y], UNIT_SPRITE_SIZE, `${this.spriteName}static_0s`)
    
    // Specialized properties
    this.miningRate = 0.1 // Stone per second
    this.maxResources = 1
    this.assignedBuilding = null // Reference to quarry building

    this.showProgressIndicator = true
    this.indicatorColor = 0xAAAAAA // Gray color for stone

    this.task = 'mining'
    this.timeSinceLastTask = 0
  }

  handleTasks(delay, time) {
    // Store previous task to detect changes
    const previousTask = this.task
    
    if(this.resources < this.maxResources) {
      this.task = 'mining'

      // Hide the miner when mining at the quarry
      if (this.isAtGoal() && this.goal === this.assignedBuilding) {
        this.visible = false
      }
    } else {
      this.task = 'returning'

      // Always make the miner visible when returning
      this.visible = true
    }

    // If task has changed, clear path to force recalculation
    if(previousTask !== this.task) {
      this.path = null
      this.lastPathUpdate = 0 // Force immediate path recalculation
    }

    switch(this.task) {
      case 'mining':
        this.goal = this.assignedBuilding
        break
      case 'returning':
        this.goal = this.findNearestTent()
        break
    }

    this.timeSinceLastTask = 0
  }

  /**
   * Do action when goal is reached
   * @param {number} delay - Time elapsed since last update (ms)
   * @param {number} time - The current time (ms)
   */
  goalReached(delay, time) {
    switch(this.task) {
      case 'mining':
        this.mine(delay)
        this.visible = false
        break
      case 'returning':
        this.depositResources()
        break
    }
  }
  
  /**
   * Mine stone from rock
   */
  mine(delay) {
    // Calculate how much to mine
    const amountToMine = Math.min(
      this.miningRate * delay / 1000,
      this.maxResources - this.resources
    )

    // Add to worker's carried resources
    this.resources += amountToMine

    // Update progress for indicator
    this.progress = this.resources / this.maxResources

    // Add mining particles (occasionally, not every frame)
    if (Math.random() < 0.15) { // 15% chance per frame
      createParticleEmitter(ParticleEffect.STONE_MINE, {
        x: this.goal.x * getTileSize() + getTileSize() / 2,
        y: this.goal.y * getTileSize() + getTileSize() / 2,
        duration: 800
      })
    }
  }

  /**
   * Deposit collected resources at quarry building
   */
  findNearestTent() {
    const tents = this.assignedBuilding.owner.getTents()
    
    // If there's only one tent, return it immediately
    if (tents.length === 1) {
      return tents[0]
    } 
    // If we have multiple tents, find the nearest one
    else if (tents.length > 1) {
      let nearestTent = null
      let shortestDistance = Infinity
      
      for (const tent of tents) {
        // Calculate path to this tent
        const path = searchPath(
          this.assignedBuilding.x, 
          this.assignedBuilding.y,
          tent.x,
          tent.y
        )
        
        // If path exists and is shorter than current shortest
        if (path && path.length < shortestDistance) {
          shortestDistance = path.length
          nearestTent = tent
        }
      }
      
      // Return nearest tent, or first tent if no path found
      return nearestTent || tents[0]
    }
    
    return null
  }
  
  /**
   * Deposit collected resources
   */
  depositResources() {
    // If we're close to the building, deposit resources
    if (this.goal) {
      if (this.resources > 0) {
          this.assignedBuilding.owner.addResource('stone', this.resources | 0)
          this.resources = 0
          this.progress = 0 // Reset progress after depositing
      }
    } else {
      // Assigned building has been probably destroyed
      this.task = 'idle'
    }

    this.goal = null
    this.path = null
  }
}

/**
 * Specialized worker for collecting water
 */
class WaterCarrier extends WorkerUnit {
  constructor(x, y, owner) {
    super(x, y, owner)
    this.spriteName = 'human-worker-' + this.owner.getColor()
    this.sprite = offscreenSprite(unitsSprites[this.spriteName][unitsSpritesDescription[this.spriteName].static._0.s.x][unitsSpritesDescription[this.spriteName].static._0.s.y], UNIT_SPRITE_SIZE, `${this.spriteName}static_0s`)
    
    // Specialized properties
    this.collectionRate = 0.1 // Water per second
    this.maxResources = 1
    this.assignedBuilding = null // Reference to well building

    this.showProgressIndicator = true
    this.indicatorColor = 0x0088FF // Blue color for water

    this.task = 'collecting'
    this.timeSinceLastTask = 0
    this.waterSource = null
  }

  handleTasks(delay, time) {
    // Store previous task to detect changes
    const previousTask = this.task
    
    if(this.resources < this.maxResources) {
      this.task = 'collecting'
    } else {
      this.task = 'returning'
    }

    // If task has changed, clear path to force recalculation
    if(previousTask !== this.task) {
      this.path = null
      this.lastPathUpdate = 0 // Force immediate path recalculation
    }

    switch(this.task) {
      case 'collecting':
        // this.findWaterSource()
        this.goal = this.assignedBuilding
        break
      case 'returning':
        this.goal = this.findNearestTent()
        break
    }

    this.timeSinceLastTask = 0
  }

  /**
   * Do action when goal is reached
   * @param {number} delay - Time elapsed since last update (ms)
   * @param {number} time - The current time (ms)
   */
  goalReached(delay, time) {
    switch(this.task) {
      case 'collecting':
        this.collectWater(delay)
        break
      case 'returning':
        this.depositResources()
        break
    }
  }
  
  /**
   * Find a water source to collect from
   */
  findWaterSource() {
    if (this.goal) return
    
    // If we don't have a water source yet, find one
    if (!this.waterSource) {
      this.waterSource = this.assignedBuilding?.findNearestWaterTile()
    }
    
    if (this.waterSource) {
      this.path = searchPath(this.currentNode.x, this.currentNode.y, this.waterSource.x, this.waterSource.y)
      if (this.path) this.goal = this.waterSource
    } else {
      // No water source found, stay idle
      this.task = 'idle'
    }
  }
  
  /**
   * Collect water from a water source
   */
  collectWater(delay) {
    // Calculate how much to collect
    const amountToCollect = Math.min(
      this.collectionRate * delay / 1000,
      this.maxResources - this.resources
    )

    // Add to worker's carried resources
    this.resources += amountToCollect

    // Update progress for indicator
    this.progress = this.resources / this.maxResources

    // Add collection particles (occasionally)
    if (Math.random() < 0.15) { // 15% chance per frame
      createParticleEmitter(ParticleEffect.WATER_COLLECT, {
        x: this.goal.x * getTileSize() + getTileSize() / 2,
        y: this.goal.y * getTileSize() + getTileSize() / 2,
        duration: 800
      })
    }
  }

  /**
   * Find the nearest tent to return water to
   * @returns {Object|null} The nearest tent or null if none found
   */
  findNearestTent() {
    const tents = this.assignedBuilding.owner.getTents()
    
    // If there's only one tent, return it immediately
    if (tents.length === 1) {
      return tents[0]
    } 
    // If we have multiple tents, find the nearest one
    else if (tents.length > 1) {
      let nearestTent = null
      let shortestDistance = Infinity
      
      for (const tent of tents) {
        // Calculate path to this tent
        const path = searchPath(
          this.currentNode.x, 
          this.currentNode.y,
          tent.x,
          tent.y
        )
        
        // If path exists and is shorter than current shortest
        if (path && path.length < shortestDistance) {
          shortestDistance = path.length
          nearestTent = tent
        }
      }
      
      // Return nearest tent, or first tent if no path found
      return nearestTent || tents[0]
    }
    
    return null
  }
  
  /**
   * Deposit collected water resources
   */
  depositResources() {
    // If we're close to a tent, deposit resources
    if (this.goal) {
      if (this.resources > 0) {
        this.assignedBuilding.owner.addResource('water', this.resources | 0)
        this.resources = 0
        this.progress = 0 // Reset progress after depositing
      }
    } else {
      // Tent has been probably destroyed
      this.task = 'idle'
    }

    this.goal = null
    this.path = null
  }
}

/**
 * Specialized worker for extracting gold from gold deposits
 */
class GoldMiner extends WorkerUnit {
  constructor(x, y, owner) {
    super(x, y, owner)
    this.spriteName = 'human-worker-' + this.owner.getColor()
    this.sprite = offscreenSprite(unitsSprites[this.spriteName][unitsSpritesDescription[this.spriteName].static._0.s.x][unitsSpritesDescription[this.spriteName].static._0.s.y], UNIT_SPRITE_SIZE, `${this.spriteName}static_0s`)
    
    // Specialized properties
    this.miningRate = 0.1 // Gold per second
    this.maxResources = 1
    this.assignedBuilding = null // Reference to gold mine building

    this.showProgressIndicator = true
    this.indicatorColor = 0xFFD700 // Gold color

    this.task = 'mining'
    this.timeSinceLastTask = 0
  }

  handleTasks(delay, time) {
    // Store previous task to detect changes
    const previousTask = this.task
    
    if(this.resources < this.maxResources) {
      this.task = 'mining'

      // Hide the miner when mining at the gold mine
      if (this.isAtGoal() && this.goal === this.assignedBuilding) {
        this.visible = false
      }
    } else {
      this.task = 'returning'

      // Always make the miner visible when returning
      this.visible = true
    }

    // If task has changed, clear path to force recalculation
    if(previousTask !== this.task) {
      this.path = null
      this.lastPathUpdate = 0 // Force immediate path recalculation
    }

    switch(this.task) {
      case 'mining':
        this.goal = this.assignedBuilding
        break
      case 'returning':
        this.goal = this.findNearestTent()
        break
    }

    this.timeSinceLastTask = 0
  }

  /**
   * Do action when goal is reached
   * @param {number} delay - Time elapsed since last update (ms)
   * @param {number} time - The current time (ms)
   */
  goalReached(delay, time) {
    switch(this.task) {
      case 'mining':
        this.mine(delay)
        this.visible = false
        break
      case 'returning':
        this.depositResources()
        break
    }
  }
  
  /**
   * Mine gold from deposit
   */
  mine(delay) {
    // Calculate how much to mine (gold never gets depleted)
    const amountToMine = Math.min(
      this.miningRate * delay / 1000,
      this.maxResources - this.resources
    )

    // Add to worker's carried resources
    this.resources += amountToMine

    // Update progress for indicator
    this.progress = this.resources / this.maxResources

    // Add mining particles (occasionally, not every frame)
    if (Math.random() < 0.15) { // 15% chance per frame
      createParticleEmitter(ParticleEffect.GOLD_SPARKLE, {
        x: this.goal.x * getTileSize() + getTileSize() / 2,
        y: this.goal.y * getTileSize() + getTileSize() / 2,
        duration: 800
      })
    }
  }

  /**
   * Find the nearest tent to return gold to
   * @returns {Object|null} The nearest tent or null if none found
   */
  findNearestTent() {
    const tents = this.assignedBuilding.owner.getTents()
    
    // If there's only one tent, return it immediately
    if (tents.length === 1) {
      return tents[0]
    } 
    // If we have multiple tents, find the nearest one
    else if (tents.length > 1) {
      let nearestTent = null
      let shortestDistance = Infinity
      
      for (const tent of tents) {
        // Calculate path to this tent
        const path = searchPath(
          this.currentNode.x, 
          this.currentNode.y,
          tent.x,
          tent.y
        )
        
        // If path exists and is shorter than current shortest
        if (path && path.length < shortestDistance) {
          shortestDistance = path.length
          nearestTent = tent
        }
      }
      
      // Return nearest tent, or first tent if no path found
      return nearestTent || tents[0]
    }
    
    return null
  }
  
  /**
   * Deposit collected gold resources
   */
  depositResources() {
    // If we're close to a tent, deposit resources
    if (this.goal) {
      if (this.resources > 0) {
        this.assignedBuilding.owner.addResource('gold', this.resources | 0)
        this.resources = 0
        this.progress = 0 // Reset progress after depositing
      }
    } else {
      // Tent has been probably destroyed
      this.task = 'idle'
    }

    this.goal = null
    this.path = null
  }
}

/**
 * Base class for combat units
 */
class CombatUnit extends Unit {
  constructor(x, y, owner) {
    super(x, y, owner)
    
    this.range = 1 * getTileSize()
    this.life = 10
    this.speed = getTileSize() / 12 | 0
    this.attack = 2

    // Combat units have specialized stats for fighting
    this.kills = 0
    this.experience = 0
    this.level = 1

    this.task = 'idle' // 'idle', 'attack'
  }

  handleTasks(delay, time) {
    this.attack = false

    if (!this.goal || this.goal.life <= 0) {
      this.goal = null
      this.task = 'idle'
    }

    switch(this.task) {
      case 'idle':
        if(!this.path || !this.goal || time - this.lastPathUpdate > Math.min(4500, this.path?.length * 250)) {
          this.path = this.pathToNearestEnemy()
          this.lastPathUpdate = time
        }
        break
      case 'attack':
        this.attack = true
        break
    }
  }


  /**
   * Find path to nearest enemy
   * @param {Array} enemies - Array of enemy units
   * @returns {Array|null} Path to nearest enemy or null if no path found
   */
  pathToNearestEnemy() {
    const { width: MAP_WIDTH, height: MAP_HEIGHT } = getMapDimensions()
    let path, pathLength = MAP_WIDTH * MAP_HEIGHT
    this.goal = null
    const enemies = this.owner.getEnemies().map(enemy => {
            const distance = Math.abs(enemy.currentNode?.x - this.currentNode?.x) + 
                             Math.abs(enemy.currentNode?.y - this.currentNode?.y)
                             || 1
            return { enemy, distance }
          }).sort((a, b) => a.distance - b.distance)
          .slice(0, 3) // Keep only 3 nearest enemies
          .map(item => item.enemy)

    enemies.forEach((enemy) => {
      let temp
      if(enemy instanceof Unit) {
        temp = searchPath(this.nextNextNode?.x ?? (this.nextNode?.x ?? this.currentNode.x), this.nextNextNode?.y ?? (this.nextNode?.y ?? this.currentNode.y), enemy.nextNode?.x ?? enemy.currentNode.x, enemy.nextNode?.y ?? enemy.currentNode.y)
      } else {
        // Buildings are not using CurrentNode
        temp = searchPath(this.nextNextNode?.x ?? (this.nextNode?.x ?? this.currentNode.x), this.nextNextNode?.y ?? (this.nextNode?.y ?? this.currentNode.y), enemy.x, enemy.y)
      }

      if(temp?.length < pathLength) {
        path = temp
        pathLength = path.length
        this.goal = enemy
      }

      temp = null
    })

    if(this.nextNode) return [this.currentNode, this.nextNode, ...path]
    if(this.currentNode) return [this.currentNode, ...path]
    return path
  }

  /**
   * Do action when goal is reached
   */
  goalReached(delay, time) {
    this.task = 'attack'
    this.attackEnemy(delay)
  }
  
  /**
   * Override attack to track kills and gain experience
   */
  attackEnemy(delay) {
    super.attackEnemy(delay)
    
    // Check if killed enemy
    if (this.goal?.life <= 0) {
      this.kills++
      this.gainExperience(5)
    }
  }
  
  /**
   * Gain combat experience
   * @param {number} amount - Amount of experience to gain
   */
  gainExperience(amount) {
    this.experience += amount
    
    // Check for level up
    const expNeeded = this.level * 10
    if (this.experience >= expNeeded) {
      this.levelUp()
    }
  }
  
  /**
   * Level up the unit, improving stats
   */
  levelUp() {
    this.level++
    this.attack *= 1.2
    this.life *= 1.1
    this.experience = 0

    // console.log(`Unit level up !`, this)
  }
}

/**
 * Base class for melee combat units (close-range fighters)
 */
class MeleeUnit extends CombatUnit {
  constructor(x, y, owner) {
    super(x, y, owner)
    
    // Melee units have shorter range but higher health
    this.range = 1 * getTileSize()
  }
}

/**
 * Base class for ranged combat units (long-range attackers)
 */
class RangedUnit extends CombatUnit {
  constructor(x, y, owner) {
    const SPRITE_SIZE = getTileSize()
    super(x, y, owner)
    
    // Ranged units have longer range but lower health
    this.range = 4 * getTileSize()
    this.visibilityRange = getTileSize() * 8
  }
}

/**
 * Peon soldier unit implementation
 */
class PeonSoldier extends MeleeUnit {
  constructor(x, y, owner) {
    super(x, y, owner)
    this.spriteName = 'human-worker-' + this.owner.getColor()
    this.sprite = offscreenSprite(unitsSprites[this.spriteName][unitsSpritesDescription[this.spriteName].static._0.s.x][unitsSpritesDescription[this.spriteName].static._0.s.y], UNIT_SPRITE_SIZE, `${this.spriteName}static_0s`)
    this.life = 5
    this.attack = 1
    this.speed = getTileSize() / 12 // Speedier than normal Combat other units
  }
}

// /**
//  * Human soldier unit implementation
//  */
// class HumanSoldier extends MeleeUnit {
//   constructor(x, y, owner) {
//     super(x, y, owner)
//     this.spriteName = 'human-soldier-' + this.owner.getColor()
//     this.sprite = offscreenSprite(unitsSprites[this.spriteName][unitsSpritesDescription[this.spriteName].static._0.s.x][unitsSpritesDescription[this.spriteName].static._0.s.y], UNIT_SPRITE_SIZE, `${this.spriteName}static_0s`)
//     this.life = 10
//     this.attack = 2
//   }
// }

/**
 * Mage unit implementation (ranged magic user)
 */
class Mage extends RangedUnit {
  constructor(x, y, owner) {
    super(x, y, owner)
    this.spriteName = 'mage-' + this.owner.getColor()
    this.sprite = offscreenSprite(unitsSprites[this.spriteName][unitsSpritesDescription[this.spriteName].static._0.s.x][unitsSpritesDescription[this.spriteName].static._0.s.y], UNIT_SPRITE_SIZE, `${this.spriteName}static_0s`)
    this.life = 8
    this.attack = 10
    this.speed = getTileSize() / 15
  }
}

/**
 * Soldier unit implementation (medium melee fighter)
 */
class Soldier extends MeleeUnit {
  constructor(x, y, owner) {
    super(x, y, owner)
    this.spriteName = 'human-soldier-' + this.owner.getColor()
    this.sprite = offscreenSprite(unitsSprites[this.spriteName][unitsSpritesDescription[this.spriteName].static._0.s.x][unitsSpritesDescription[this.spriteName].static._0.s.y], UNIT_SPRITE_SIZE, `${this.spriteName}static_0s`)
    this.life = 12
    this.attack = 5
    this.speed = getTileSize() / 14
  }
}

// /**
//  * Warrior unit implementation (heavy melee fighter)
//  */
// class Warrior extends MeleeUnit {
//   constructor(x, y, owner) {
//     super(x, y, owner)
//     this.spriteName = 'soldier-' + this.owner.getColor()
//     this.sprite = offscreenSprite(unitsSprites[this.spriteName][unitsSpritesDescription[this.spriteName].static._0.s.x][unitsSpritesDescription[this.spriteName].static._0.s.y], UNIT_SPRITE_SIZE, `${this.spriteName}static_0s`)
//     this.life = 40
//     this.attack = 5
//     this.range = 0.75 * getTileSize()
//     this.speed = getTileSize() / 18 | 0
//   }
// }

/**
 * Heavy Infantry unit implementation (stronger melee fighter)
 */
class HeavyInfantry extends MeleeUnit {
  constructor(x, y, owner) {
    super(x, y, owner)
    this.spriteName = 'soldier-' + this.owner.getColor() // Placeholder sprite for now
    this.sprite = offscreenSprite(unitsSprites[this.spriteName][unitsSpritesDescription[this.spriteName].static._0.s.x][unitsSpritesDescription[this.spriteName].static._0.s.y], UNIT_SPRITE_SIZE, `${this.spriteName}static_0s`)
    this.life = 40
    this.attack = 5
    this.range = 0.75 * getTileSize()
    this.speed = getTileSize() / 20
  }
}

/**
 * Elite Warrior unit implementation (very strong melee fighter)
 */
class EliteWarrior extends MeleeUnit {
  constructor(x, y, owner) {
    super(x, y, owner)
    this.spriteName = 'warrior-' + this.owner.getColor() // Placeholder sprite for now
    this.sprite = offscreenSprite(unitsSprites[this.spriteName][unitsSpritesDescription[this.spriteName].static._0.s.x][unitsSpritesDescription[this.spriteName].static._0.s.y], UNIT_SPRITE_SIZE, `${this.spriteName}static_0s`)
    this.life = 25
    this.attack = 12
    this.speed = getTileSize() / 17
  }
}