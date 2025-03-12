export {
  CombatUnit, HumanSoldier, LumberjackWorker,
  Mage, MeleeUnit, Peon, PeonSoldier, RangedUnit, Soldier, Unit, Warrior, WorkerUnit
}

'use strict'

import { Building } from 'building'
import { getMapDimensions, getTileSize } from 'dimensions'
import { searchPath } from 'pathfinding'
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
├── CombatUnit (fighting capabilities)
│   ├── MeleeUnit (close combat)
│   │   ├── HumanSoldier
│   │   ├── Soldier 
│   │   └── Warrior
│   └── RangedUnit (attacks from distance)
│       └── Mage

*/



/**
 * Base Unit class for all game units
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
      this.path = null
      this.sprite = null
      return
    }

    this.handleTasks(delay, time)

    if(!this.goal) return

    this.updatePath(delay, time)

    if(distance(this.currentNode, this.goal.currentNode ?? this.goal) <= this.range / getTileSize()) {
      this.goalReached(delay, time)
      this.next = null
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
    const mathPathLength = this.path?.length || 1
    const maxTime = Math.log(mathPathLength) * 150 + mathPathLength * 50
    const updatePath = time - this.lastPathUpdate > maxTime
    const distToNextNode = distance(this.currentNode, this.nextNode) || 0

    //console.log(this.task, mathPathLength, distToNextNode, updatePath)

    // Update Path
    if(!this.path || distToNextNode < 1 || updatePath) {
      if(updatePath) {
        this.lastPathUpdate = time
        this.findPath()
      } else if(distToNextNode < 1 && mathPathLength > 1) {
        this.path.splice(0, 1)
      }
      this.timeSinceLastTask = 0
    }
  }

  /**
   * Find the best path to the goal
   */
  findPath() {
    let temp = searchPath(this.currentNode.x, this.currentNode.y, this.goal.x, this.goal.y)
    //if(!this.path || temp?.length < this.path?.length) {
      this.path = temp
    //}
    temp = null
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
    /*
      this.isAttacking = false

      // Handle attacking enemy in range
      if(this.goal && distance(this, this.goal) <= this.range) {
        this.attackEnemy(delay)
        this.lastMoveUpdate = time
        this.move(Math.min(delay, 40))
        return
      }

      // Handle no path case
      if(!this.path) {
        this.handleNoPath(delay)
        this.lastMoveUpdate = time
        this.move(Math.min(delay, 40))
        return
      }
      
      // Handle end of path
      if(this.path.length === 1) {
        this.lastMoveUpdate = time
        this.move(Math.min(delay, 40))
        return
      }
      */
      // // Set next node in path
      // this.nextNode.x = this.path[1]?.x
      // this.nextNode.y = this.path[1]?.y

      // // Look ahead one more node if possible
      // if(this.path[2]) {
      //   this.nextNextNode.x = this.path[2]?.x
      //   this.nextNextNode.y = this.path[2]?.y
      // } else {
      //   this.nextNextNode.x = this.path[1]?.x
      //   this.nextNextNode.y = this.path[1]?.y
      // }

      //if(DEBUG) drawBack()
    

    this.lastMoveUpdate = time
    this.move(Math.min(delay, 40))
  }

  /**
   * Attack the target enemy
   * @param {number} delay - Time elapsed since last update (ms)
   */
  attackEnemy(delay) {
    if(this.goal) this.goal.life -= this.attack * delay / 1000
  }

  /**
   * Handle case when no path is found
   * @param {number} delay - Time elapsed since last update (ms)
   */
  handleNoPath(delay) {
    this.life -= delay / 1000
    // this.goal = null
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
    const enemies = this.owner.getEnemies()
    enemies.forEach((enemy) => {
      let temp
      if(enemy instanceof Unit) temp = searchPath(this.currentNode.x, this.currentNode.y, enemy.currentNode.x, enemy.currentNode.y)
      if(enemy instanceof Building) temp = searchPath(this.currentNode.x, this.currentNode.y, enemy.x, enemy.y)
      if(temp?.length < pathLength) {
        path = temp
        pathLength = path.length
        this.goal = enemy
      }
      temp = null
    })
    return path
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
    const vx = this.speed * (delay/1000) * Math.cos(theta) / gameState.map[this.currentNode.x][this.currentNode.y].weight
    const vy = this.speed * (delay/1000) * Math.sin(theta) / gameState.map[this.currentNode.x][this.currentNode.y].weight

    let type = 'static'
    // Attack
    if(this.task === 'attack') {
      type = 'attack'
    }
    if(distance(this.currentNode, this.goal) <= this.range/getTileSize() && this.task === 'gathering') {
      type = 'lumberjack'
    }
    // Walk
    if(this.goal && Math.abs(vx) + Math.abs(vy) > this.speed * (delay/2000)) {
      type = 'walk'
      this.x += vx * (delay)
      this.y += vy * (delay)
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
    this.speed = getTileSize() / 10 | 0
    this.resources = 0
    this.maxResources = 1

    // Task states
    this.task = 'idle' // 'idle', 'gathering', 'returning', 'assigned'
    this.assignedPath = null // Path assigned by a building

    this.timeSinceLastTask = 0
  }

  /**
   * Override to handle worker's specific behavior
   * @param {number} delay - Time elapsed since last update (ms)
   * @param {Array} enemies - Array of enemy units
   */
  // update(delay) {
  //   const time = performance.now() | 0
    
  //   if(this.life <= 0) {
  //     // Cleanup unit
  //     this.path = null
  //     this.sprite = null
  //     return
  //   }

  //   this.handleTasks(delay)

  //   this.updateMovement(delay)
  // }

  /**
   * Update movement of the unit
   * @param {number} delay - Time elapsed since last update (ms)
   */
  // updateMovement(delay, time) {

  //   const mathPathLength = this.path?.length || 1
  //   const updatePath = time - this.lastPathUpdate > /*Math.min(*/Math.log(mathPathLength)*150 + 50*mathPathLength/*, 4000)*/
  //   const distToNextNode = distance(this.currentNode, this.nextNode) || 0
    
  //   // Update Path
  //   if(distToNextNode < 1 || updatePath) {
  //     if(updatePath) {
  //       this.lastPathUpdate = time
        
  //       // Only look for enemies if we're not on a specific task
  //       if (this.task === 'idle') {
  //         const path = this.pathToNearestEnemy()
  //         if (!path || !this.path || path?.length < this.path?.length) this.path = path
  //       } 
  //       // For assigned tasks, maintain the assigned path
  //       else if (this.task === 'assigned' && this.assignedPath) {
  //         this.path = this.assignedPath
  //         // Don't clear the assigned path - we might need it if interrupted
  //       }
  //       // Other tasks like 'gathering' or 'returning' are handled in handleNoPath
  //     } else if(distToNextNode < 1 && mathPathLength > 1) {
  //       this.path.splice(0, 1)
  //     }

  //     this.isAttacking = false

  //     // Handle attacking enemy in range - but only if not on a critical task
  //     if(this.goal && distance(this, this.goal) < this.range && this.task === 'idle') {
  //       this.attackEnemy(delay)
  //       this.lastMoveUpdate = time
  //       this.move(Math.min(delay, 40))
  //       return
  //     }

  //     // Handle no path case
  //     if(!this.path) {
  //       this.handleNoPath(delay)
  //       this.lastMoveUpdate = time
  //       this.move(Math.min(delay, 40))
  //       return
  //     }

      
      
  //     // Handle end of path
  //     if(this.path.length <= 1) {
  //       // If we've reached our destination for an assigned task
  //       if (this.task === 'assigned' || this.task === 'returning') {
  //         // Clear assigned path to signal completion
  //         this.assignedPath = null
  //         this.goal = null
  //       }
        
  //       this.lastMoveUpdate = time
  //       this.move(Math.min(delay, 40))
  //       return
  //     }

  //     // Set next node in path
  //     this.nextNode.x = this.path[1]?.x
  //     this.nextNode.y = this.path[1]?.y

  //     // Look ahead one more node if possible
  //     if(this.path[2]) {
  //       this.nextNextNode.x = this.path[2]?.x
  //       this.nextNextNode.y = this.path[2]?.y
  //     } else {
  //       this.nextNextNode.x = this.path[1]?.x
  //       this.nextNextNode.y = this.path[1]?.y
  //     }
  //   }

  //   this.lastMoveUpdate = time
  //   this.move(Math.min(delay, 40))
  // }

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

    this.task = 'gathering'
  }

  handleTasks(delay, time) {
    if(this.task === 'idle') return
    
    if(this.resources < this.maxResources) {
      this.task = 'gathering'
    } else {
      this.task = 'returning'
    }

    switch(this.task) {
      case 'gathering':
        this.findTreeToHarvest(time)
        break
      case 'returning':
        this.goal = { x: this.assignedBuilding.x, y: this.assignedBuilding.y + 1 }
        break
    }

    this.timeSinceLastTask = 0

    // console.log(this.task, this.resources, this.currentNode, this.path?.length, distance(this.currentNode, this.goal))
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
    if(this.goal) return
    // Find closest tree tile
    const tree = this.findClosestTree()
    
    if (tree) {
      // if (distance(this.currentNode, tree) <= this.range * 1.42 / getTileSize()) {
      //   // Harvest wood based on rate and delay
      //   // const harvestedAmount = this.harvestRate * delay / 1000
      //   // this.resources += harvestedAmount
      //   // this.goal = null
      //   // this.path = null
      // } else {
        // try a regular path to get as close as possible
        let shortestPath = null
        let path = null
          // Find a suitable adjacent tile to the tree
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const adjX = tree.x + dx
            const adjY = tree.y + dy
            
            // Check if this adjacent tile is walkable
            if (gameState.map[adjX]?.[adjY] && gameState.map[adjX][adjY].weight < getMapDimensions().maxWeight) {
              path = searchPath(this.currentNode.x, this.currentNode.y, adjX, adjY)
              if(path?.length < (shortestPath?.length || Infinity)) {
                shortestPath = path
              }
          }
        }

        this.lastPathUpdate = time
        this.path = shortestPath
        this.goal = this.path[this.path.length - 1]
      //}
    }
  }
  
  /**
   * Find and harvest trees
   */
  harvest(delay) {
    this.resources += this.harvestRate * delay / 1000
  }

  /**
   * Find the closest tree tile
   * @returns {Object|null} Coordinates of closest tree or null if none found
   */
  findClosestTree() {
    const { width, height } = getMapDimensions()
    let closestTree = null
    let closestDistance = Infinity
    
    // Search in gradually expanding radius for efficiency
    for (let radius = 1; radius < 24; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          // Only check tiles on the perimeter of this radius
          if (Math.abs(dx) === radius || Math.abs(dy) === radius) {
            const tileX = this.currentNode.x + dx
            const tileY = this.currentNode.y + dy
            
            // Check if coordinates are valid
            if (tileX >= 0 && tileX < width && tileY >= 0 && tileY < height) {
              const tile = gameState.map[tileX][tileY]
              
              // Check if it's a tree
              if (tile.type === 'TREE') {
                const dist = Math.hypot(dx, dy)
                if (dist < closestDistance) {
                  closestDistance = dist
                  closestTree = { x: tileX, y: tileY }
                }
              }
            }
          }
        }
      }
      
      // If we found a tree in this radius, return it
      if (closestTree) {
        return closestTree
      }
    }
    
    this.task = 'idle'
    return null
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
 * Base class for combat units
 */
class CombatUnit extends Unit {
  constructor(x, y, owner) {
    super(x, y, owner)
    
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
        this.path = this.pathToNearestEnemy()
        this.lastPathUpdate = time
        break
      case 'attack':
        this.attack = true
        break
    }
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
    this.speed = getTileSize() / 10 | 0
  }
}

/**
 * Human soldier unit implementation
 */
class HumanSoldier extends MeleeUnit {
  constructor(x, y, owner) {
    super(x, y, owner)
    this.spriteName = 'human-soldier-' + this.owner.getColor()
    this.sprite = offscreenSprite(unitsSprites[this.spriteName][unitsSpritesDescription[this.spriteName].static._0.s.x][unitsSpritesDescription[this.spriteName].static._0.s.y], UNIT_SPRITE_SIZE, `${this.spriteName}static_0s`)
    this.life = 10
    this.attack = 2
    this.speed = getTileSize() / 10 | 0
  }
}

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
    this.speed = getTileSize() / 12 | 0
  }
}

/**
 * Soldier unit implementation (medium melee fighter)
 */
class Soldier extends MeleeUnit {
  constructor(x, y, owner) {
    super(x, y, owner)
    this.spriteName = 'soldier-' + this.owner.getColor()
    this.sprite = offscreenSprite(unitsSprites[this.spriteName][unitsSpritesDescription[this.spriteName].static._0.s.x][unitsSpritesDescription[this.spriteName].static._0.s.y], UNIT_SPRITE_SIZE, `${this.spriteName}static_0s`)
    this.life = 15
    this.attack = 8
    this.speed = getTileSize() / 16 | 0
  }
}

/**
 * Warrior unit implementation (heavy melee fighter)
 */
class Warrior extends MeleeUnit {
  constructor(x, y, owner) {
    super(x, y, owner)
    this.spriteName = 'warrior-' + this.owner.getColor()
    this.sprite = offscreenSprite(unitsSprites[this.spriteName][unitsSpritesDescription[this.spriteName].static._0.s.x][unitsSpritesDescription[this.spriteName].static._0.s.y], UNIT_SPRITE_SIZE, `${this.spriteName}static_0s`)
    this.life = 40
    this.attack = 5
    this.range = 0.75 * getTileSize()
    this.speed = getTileSize() / 20 | 0
  }
}