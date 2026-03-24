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

export { Projectile, FireballProjectile, updateProjectiles, resetProjectiles }

'use strict'

import { getTileSize } from 'dimensions'
import { createParticleEmitter, ParticleEffect } from 'particles'
import * as PIXI from 'pixijs'
import { containers } from 'renderer'
import { fireballTextures } from 'sprites'

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

    // Offset start position toward target so projectile spawns at the shooter's edge
    this.lastTargetPos = this.getTargetPixelPos()
    const dx = this.lastTargetPos.x - x
    const dy = this.lastTargetPos.y - y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist > 0) {
      const offset = getTileSize() * 0.7
      this.x = x + (dx / dist) * offset
      this.y = y + (dy / dist) * offset
    }

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

    // Keep tracking the target position while it's alive
    if (this.target.life > 0) {
      this.lastTargetPos = this.getTargetPixelPos()
    }

    const targetPos = this.lastTargetPos
    const dx = targetPos.x - this.x
    const dy = targetPos.y - this.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const hitRadius = getTileSize() * 0.6

    if (dist <= hitRadius) {
      if (this.target.life > 0) this.target.life -= this.damage
      createParticleEmitter(ParticleEffect.ARROW_IMPACT, { x: this.x, y: this.y, duration: 600 })
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
 * An animated fireball projectile fired by a Mage unit.
 * Uses a 3-frame sprite animation from assets/attacks/fireball.png.
 */
class FireballProjectile extends Projectile {
  /**
   * @param {number} x - Start pixel X position
   * @param {number} y - Start pixel Y position
   * @param {Object} target - Enemy unit or building to fly toward
   * @param {number} damage - Damage dealt on hit
   */
  constructor(x, y, target, damage) {
    super(x, y, target, damage, getTileSize() * 3)

    // Replace the arrow graphics with an animated sprite
    if (this.graphics?.parent) {
      this.graphics.parent.removeChild(this.graphics)
    }
    this.graphics?.destroy()
    this.graphics = null

    this.animFrame = 0
    this.animTimer = 0
    this.animSpeed = 120 // ms per frame
    this.spinAngle = 0
    this.spinSpeed = 4 // radians per second
    this.trailTimer = 0
    this.trailInterval = 50 // ms between trail particle bursts

    this.sprite = null
    if (fireballTextures.length > 0) {
      this.sprite = new PIXI.Sprite(fireballTextures[0])
      this.sprite.anchor.set(0.5)
      containers.particles?.addChild(this.sprite)
      this.sprite.position.set(this.x, this.y)
    }
  }

  update(delay) {
    if (!this.alive) return

    // Keep tracking the target position while it's alive
    if (this.target.life > 0) {
      this.lastTargetPos = this.getTargetPixelPos()
    }

    // Advance animation
    this.animTimer += delay
    while (this.animTimer >= this.animSpeed) {
      this.animTimer -= this.animSpeed
      this.animFrame = (this.animFrame + 1) % 3
    }

    const targetPos = this.lastTargetPos
    const dx = targetPos.x - this.x
    const dy = targetPos.y - this.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const hitRadius = getTileSize() * 0.6

    if (dist <= hitRadius) {
      if (this.target.life > 0) this.target.life -= this.damage
      createParticleEmitter(ParticleEffect.FIREBALL_IMPACT, { x: this.x, y: this.y, duration: 1500 })
      this.destroy()
      return
    }

    const moveDistance = this.speed * delay / 1000
    const ratio = Math.min(moveDistance / dist, 1)
    this.x += dx * ratio
    this.y += dy * ratio

    this.spinAngle += this.spinSpeed * delay / 1000

    // Emit trail particles
    this.trailTimer += delay
    while (this.trailTimer >= this.trailInterval) {
      this.trailTimer -= this.trailInterval
      createParticleEmitter(ParticleEffect.FIREBALL_TRAIL, { x: this.x, y: this.y, duration: 800 })
    }

    if (this.sprite) {
      this.sprite.texture = fireballTextures[this.animFrame]
      this.sprite.position.set(this.x, this.y)
      this.sprite.rotation = Math.atan2(dy, dx) + this.spinAngle
    }
  }

  destroy() {
    this.alive = false
    if (this.sprite?.parent) {
      this.sprite.parent.removeChild(this.sprite)
    }
    this.sprite?.destroy()
    this.sprite = null
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
