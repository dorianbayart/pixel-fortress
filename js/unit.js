export { Unit }

'use strict'

import { DEBUG, drawBack, isDrawBackRequested } from 'globals'
import { MAP_HEIGHT, MAP_WIDTH, MAX_WEIGHT } from 'maps'
import { bestFirstSearch } from 'pathfinding'
import { offscreenSprite, unitsSprites, unitsSpritesDescription, SPRITE_SIZE, UNIT_SPRITE_SIZE } from 'sprites'



const MAX_SPEED = globalThis.innerHeight / 400
const PI = Math.PI



class Unit {
  constructor(x, y, sprite, map, enemies) {
    this.x = x * SPRITE_SIZE | 0
    this.y = y * SPRITE_SIZE | 0
    this.currentNode = { x: this.x/SPRITE_SIZE, y: this.y/SPRITE_SIZE }
    this.nextNode = { x: this.x/SPRITE_SIZE, y: this.y/SPRITE_SIZE }
    this.nextNextNode = { x: this.x/SPRITE_SIZE, y: this.y/SPRITE_SIZE }
    this.spriteName = Object.keys(unitsSpritesDescription)[Math.random() * Object.keys(unitsSpritesDescription).length | 0]
    this.spriteTimer = 0
    this.sprite = offscreenSprite(sprite ?? unitsSprites[this.spriteName][unitsSpritesDescription[this.spriteName].static._0.s.x][unitsSpritesDescription[this.spriteName].static._0.s.y], UNIT_SPRITE_SIZE, `${this.spriteName}static_0s`)
    this.path = this.pathToNearestEnemy(map, enemies)
    this.lastMoveUpdate = 0
    this.lastPathUpdate = 0
    this.goal = null
    this.life = 1
    this.speed = (MAX_SPEED * Math.random()) % (MAX_SPEED - 0.5) + 0.5
  }

  update(delay, map, enemies) {
    const time = performance.now() | 0

    const updatePath = time - this.lastPathUpdate > (this.path?.length-1)*150 || 1000

    // Update Path
    if((this.currentNode.x === this.nextNode.x && this.currentNode.y === this.nextNode.y) || updatePath) {
      if(updatePath) {
        this.lastPathUpdate = time

        this.path = this.pathToNearestEnemy(map, enemies)

      } else if(this.currentNode.x === this.nextNode.x && this.currentNode.y === this.nextNode.y && this.path?.length > 1) {
          this.path.splice(0, 1)
      }

      if(!this.path) {
        this.life -= delay / 4000
        this.goal = null
        return
      }
      if(this.path.length === 1) {
        this.life -= delay / 1000
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
      const temp = bestFirstSearch(map, this.currentNode.x, this.currentNode.y, enemy.currentNode.x, enemy.currentNode.y)
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
    this.x += vx * (delay)
    this.y += vy * (delay)

    const type = Math.abs(vx) + Math.abs(vy) > this.speed * (delay/2000) ? 'walk' : 'static'

    this.sprite = this.updateSprite(type, Math.atan2(-devY, devX), delay)

    if(Math.hypot(devX, devY) < SPRITE_SIZE/3) {
      // we finally are on nextNode now
      this.currentNode.x = this.nextNode.x
      this.currentNode.y = this.nextNode.y
    }
  }

  updateSprite(type, theta, delay) {
    this.spriteTimer += delay
    if(this.spriteTimer >= 800) this.spriteTimer -= 800
    const spriteVar = `_${this.spriteTimer / 400 | 0}`
    const speedCoef = 1.4 * this.speed * (delay/1000)

    if(this.goal === null) {
      return offscreenSprite(unitsSprites[this.spriteName][unitsSpritesDescription[this.spriteName]['static'][spriteVar].s.x][unitsSpritesDescription[this.spriteName]['static'][spriteVar].s.y], UNIT_SPRITE_SIZE, `${this.spriteName}static${spriteVar}s`)
    }

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

    return this.sprite
  }
}