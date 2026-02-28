/*
 * Pixel Fortress - A 2D real-time strategy game
 * Copyright (C) 2026 Dorian Bayart
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

export { Projectile, updateProjectiles, resetProjectiles }

'use strict'

import { getTileSize } from 'dimensions'
import * as PIXI from 'pixijs'
import { containers } from 'renderer'

const activeProjectiles = new Set()

/**
 * A projectile (arrow) fired by a Tower or ranged unit, flying toward a target.
 */
class Projectile {
  /**
   * @param {number} x - Start pixel X position
   * @param {number} y - Start pixel Y position
   * @param {Object} target - Enemy unit or building to fly toward
   * @param {number} damage - Damage dealt on hit
   * @param {number} speed - Travel speed in pixels per second
   */
  constructor(x, y, target, damage, speed = getTileSize() * 6) {
    this.x = x
    this.y = y
    this.target = target
    this.damage = damage
    this.speed = speed
    this.alive = true

    // Draw the arrow shape once; only position/rotation change each frame
    this.graphics = new PIXI.Graphics()
    this.graphics.rect(-4, -1, 8, 2).fill({ color: 0x6D5226 })
    containers.particles?.addChild(this.graphics)

    activeProjectiles.add(this)
  }

  /** Returns the target's current center position in pixels */
  getTargetPixelPos() {
    const SPRITE_SIZE = getTileSize()
    if (this.target.currentNode) {
      // Unit: x and y are pixel coords of the tile top-left; add half a tile to reach the center
      return {
        x: this.target.x + SPRITE_SIZE / 2,
        y: this.target.y + SPRITE_SIZE / 2
      }
    }
    // Building: x and y are in tile coordinates; convert to pixel center
    return {
      x: this.target.x * SPRITE_SIZE + SPRITE_SIZE / 2,
      y: this.target.y * SPRITE_SIZE + SPRITE_SIZE / 2
    }
  }

  /**
   * Advance projectile position, check for hit, update graphics.
   * @param {number} delay - Time elapsed since last update (ms)
   */
  update(delay) {
    if (!this.alive) return

    if (this.target.life <= 0) {
      this.destroy()
      return
    }

    const targetPos = this.getTargetPixelPos()
    const dx = targetPos.x - this.x
    const dy = targetPos.y - this.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const hitRadius = getTileSize() * 0.6

    if (dist <= hitRadius) {
      this.target.life -= this.damage
      this.destroy()
      return
    }

    const moveDistance = this.speed * delay / 1000
    const ratio = Math.min(moveDistance / dist, 1)
    this.x += dx * ratio
    this.y += dy * ratio

    this.graphics.position.set(this.x, this.y)
    this.graphics.rotation = Math.atan2(dy, dx)
  }

  /** Remove this projectile from the stage and mark it dead */
  destroy() {
    this.alive = false
    if (this.graphics?.parent) {
      this.graphics.parent.removeChild(this.graphics)
    }
    this.graphics?.destroy()
    this.graphics = null
  }
}

/**
 * Advance all active projectiles.
 * Call once per game loop tick with the scaled delay.
 * @param {number} delay - Time elapsed since last update (ms)
 */
function updateProjectiles(delay) {
  for (const projectile of activeProjectiles) {
    projectile.update(delay)
    if (!projectile.alive) {
      activeProjectiles.delete(projectile)
    }
  }
}

/**
 * Destroy all active projectiles.
 * Call when starting or resetting a game session.
 */
function resetProjectiles() {
  for (const projectile of activeProjectiles) {
    projectile.destroy()
  }
  activeProjectiles.clear()
}
