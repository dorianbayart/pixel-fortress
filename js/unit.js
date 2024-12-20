export { Unit, HumanSoldier, Mage, Soldier, Warrior, Worker }

'use strict'

import { DEBUG, drawBack, isDrawBackRequested } from 'globals'
import { MAP_HEIGHT, MAP_WIDTH, MAX_WEIGHT } from 'maps'
import { searchPath } from 'pathfinding'
import { offscreenSprite, unitsSprites, unitsSpritesDescription, SPRITE_SIZE, UNIT_SPRITE_SIZE } from 'sprites'
import { distance } from 'utils'



const PI = Math.PI



class Unit {
  constructor(x, y, color, map, enemies) {
    this.x = x * SPRITE_SIZE | 0
    this.y = y * SPRITE_SIZE | 0
    this.currentNode = { x: this.x/SPRITE_SIZE, y: this.y/SPRITE_SIZE }
    this.nextNode = { x: this.x/SPRITE_SIZE, y: this.y/SPRITE_SIZE }
    this.nextNextNode = { x: this.x/SPRITE_SIZE, y: this.y/SPRITE_SIZE }
    this.spriteTimer = 0
    this.path = this.pathToNearestEnemy(map, enemies)
    this.lastMoveUpdate = 0
    this.lastPathUpdate = 0
    this.goal = null
    this.angle = -PI/2
    this.range = null
    this.life = null
    this.speed = null
    this.spriteName = null
    this.sprite = null
  }

  update(delay, map, enemies) {
    const time = performance.now() | 0

    const updatePath = time - this.lastPathUpdate > Math.min((this.path?.length || 1)*400, 1500)

    // Update Path
    if((this.currentNode.x === this.nextNode.x && this.currentNode.y === this.nextNode.y) || updatePath) {
      if(updatePath) {
        this.lastPathUpdate = time

        this.path = this.pathToNearestEnemy(map, enemies)

      } else if(this.currentNode.x === this.nextNode.x && this.currentNode.y === this.nextNode.y && this.path?.length > 1) {
          this.path.splice(0, 1)
      }

      this.isAttacking = false

      if(this.goal && distance(this, this.goal) <= this.range) {
        this.isAttacking = true
        this.goal.life -= this.attack * delay / 1000
        this.lastMoveUpdate = time
        this.move(Math.min(delay, 40), map)
        return
      }

      if(!this.path) {
        this.life -= delay / 1000
        this.goal = null
        this.lastMoveUpdate = time
        this.move(Math.min(delay, 40), map)
        return
      }
      if(this.path.length === 1) {
        //this.life -= delay / 1000
        this.lastMoveUpdate = time
        this.move(Math.min(delay, 40), map)
        return
      }

      this.nextNode.x = this.path[1]?.x
      this.nextNode.y = this.path[1]?.y

      if(this.path[2]) {
        this.nextNextNode.x = this.path[2]?.x
        this.nextNextNode.y = this.path[2]?.y
      } else {
        this.nextNextNode.x = this.path[1]?.x
        this.nextNextNode.y = this.path[1]?.y
      }

      if(DEBUG) drawBack()
    }

    this.lastMoveUpdate = time
    this.move(Math.min(delay, 40), map)
  }

  pathToNearestEnemy(map, enemies = []) {
    let path, pathLength = MAP_WIDTH * MAP_HEIGHT
    this.goal = null
    enemies.forEach((enemy) => {
      const temp = searchPath(map, this.currentNode.x, this.currentNode.y, enemy.currentNode.x, enemy.currentNode.y)
      if(temp?.length < pathLength) {
        path = temp
        pathLength = path.length
        this.goal = enemy
      }
    })
    return path
  }

  move(delay, map) {
    const devX = ((this.nextNode.x * SPRITE_SIZE - this.x) * 2 + (this.nextNextNode.x * SPRITE_SIZE - this.x)) / 3
    const devY = ((this.nextNode.y * SPRITE_SIZE - this.y) * 2 + (this.nextNextNode.y * SPRITE_SIZE - this.y)) / 3
    const theta = Math.atan2(devY, devX)
    const vx = this.speed * (delay/1000) * Math.cos(theta) / map[this.currentNode.x][this.currentNode.y].weight
    const vy = this.speed * (delay/1000) * Math.sin(theta) / map[this.currentNode.x][this.currentNode.y].weight

    let type = 'static'
    // Attack
    if(this.isAttacking) {
      type = 'attack'
      this.theta = theta
    }
    // Walk
    else if(this.goal && Math.abs(vx) + Math.abs(vy) > this.speed * (delay/2000)) {
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

  updateSprite(type, theta = -PI/2, delay) {
    const keys = Object.keys(unitsSpritesDescription[this.spriteName][type])

    this.spriteTimer += delay
    if(this.spriteTimer >= keys.length * 400) this.spriteTimer -= keys.length * 400
    const spriteVar = `_${this.spriteTimer / 400 | 0}`
    const speedCoef = 1.4 * this.speed * (delay/1000)

    // if(this.goal === null) {
    //   return offscreenSprite(unitsSprites[this.spriteName][unitsSpritesDescription[this.spriteName]['static'][spriteVar].s.x][unitsSpritesDescription[this.spriteName]['static'][spriteVar].s.y], UNIT_SPRITE_SIZE, `${this.spriteName}static${spriteVar}s`)
    // }
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

class Worker extends Unit {
  constructor(x, y, color, map, enemies) {
    super(x, y, color, map, enemies)
    this.spriteName = 'human-worker-' + color
    this.sprite = offscreenSprite(unitsSprites[this.spriteName][unitsSpritesDescription[this.spriteName].static._0.s.x][unitsSpritesDescription[this.spriteName].static._0.s.y], UNIT_SPRITE_SIZE, `${this.spriteName}static_0s`)
    this.life = 5
    this.attack = 1
    this.range = 0.75 * SPRITE_SIZE
    this.speed = SPRITE_SIZE / 10 | 0
  }
}

class HumanSoldier extends Unit {
  constructor(x, y, color, map, enemies) {
    super(x, y, color, map, enemies)
    this.spriteName = 'human-soldier-' + color
    this.sprite = offscreenSprite(unitsSprites[this.spriteName][unitsSpritesDescription[this.spriteName].static._0.s.x][unitsSpritesDescription[this.spriteName].static._0.s.y], UNIT_SPRITE_SIZE, `${this.spriteName}static_0s`)
    this.life = 10
    this.attack = 2
    this.range = 1 * SPRITE_SIZE
    this.speed = SPRITE_SIZE / 10 | 0
  }
}

class Mage extends Unit {
  constructor(x, y, color, map, enemies) {
    super(x, y, color, map, enemies)
    this.spriteName = 'mage-' + color
    this.sprite = offscreenSprite(unitsSprites[this.spriteName][unitsSpritesDescription[this.spriteName].static._0.s.x][unitsSpritesDescription[this.spriteName].static._0.s.y], UNIT_SPRITE_SIZE, `${this.spriteName}static_0s`)
    this.life = 8
    this.attack = 10
    this.range = 4 * SPRITE_SIZE
    this.speed = SPRITE_SIZE / 12 | 0
  }
}

class Soldier extends Unit {
  constructor(x, y, color, map, enemies) {
    super(x, y, color, map, enemies)
    this.spriteName = 'soldier-' + color
    this.sprite = offscreenSprite(unitsSprites[this.spriteName][unitsSpritesDescription[this.spriteName].static._0.s.x][unitsSpritesDescription[this.spriteName].static._0.s.y], UNIT_SPRITE_SIZE, `${this.spriteName}static_0s`)
    this.life = 15
    this.attack = 8
    this.range = 1 * SPRITE_SIZE
    this.speed = SPRITE_SIZE / 16 | 0
  }
}

class Warrior extends Unit {
  constructor(x, y, color, map, enemies) {
    super(x, y, color, map, enemies)
    this.spriteName = 'warrior-' + color
    this.sprite = offscreenSprite(unitsSprites[this.spriteName][unitsSpritesDescription[this.spriteName].static._0.s.x][unitsSpritesDescription[this.spriteName].static._0.s.y], UNIT_SPRITE_SIZE, `${this.spriteName}static_0s`)
    this.life = 40
    this.attack = 5
    this.range = 0.75 * SPRITE_SIZE
    this.speed = SPRITE_SIZE / 20 | 0
  }
}