export { createParticleEmitter, ParticleEffect, updateAllParticles, drawParticles }

'use strict'

import { getCanvasDimensions, getTileSize } from 'dimensions'
import * as PIXI from 'pixijs'
import { app, containers } from 'renderer'
import { offscreenSprite } from 'sprites'
import gameState from 'state'
import { getCachedSprite } from 'utils'

// Track active particle emitters
const activeEmitters = new Set()
const particleContainer = new PIXI.ParticleContainer(1000, {
  scale: true,
  position: true,
  rotation: true,
  alpha: true
})

// Predefined particle effects
const ParticleEffect = {
  WOOD_HARVEST: 'wood_harvest',
  STONE_MINE: 'stone_mine',
  WATER_COLLECT: 'water_collect',
  GOLD_SPARKLE: 'gold_sparkle',
  BUILDING_PLACE: 'building_place',
  UNIT_ATTACK: 'unit_attack',
  UNIT_DEATH: 'unit_death',
  UI_BUTTON_CLICK: 'ui_button_click'
}

/**
 * Initialize particle system
 */
export function initParticleSystem() {
  // Clear any existing particles
  activeEmitters.clear()
  
  // Create particle container if needed
  if (containers.particles) {
    containers.particles.removeChildren()
  } else {
    containers.particles = new PIXI.Container()
  }
  
  // Add particle container to stage (between units and UI)
  if (app?.stage) {
    const index = app.stage.getChildIndex(containers.units) + 1
    app.stage.addChildAt(containers.particles, index)
  }
}

/**
 * Create a new particle emitter
 * @param {string} effectType - Type of particle effect
 * @param {Object} options - Custom options for this emitter
 * @param {number} options.x - X position in world coordinates
 * @param {number} options.y - Y position in world coordinates
 * @param {number} options.duration - How long the emitter should last (ms)
 * @param {Object} options.customProps - Custom properties for specific effects
 * @returns {Object} The created emitter
 */
function createParticleEmitter(effectType, options = {}) {
  const SPRITE_SIZE = getTileSize()
  const emitter = {
    id: Math.random().toString(36).substring(2, 9),
    effectType,
    x: options.x || 0,
    y: options.y || 0,
    particles: [],
    active: true,
    age: 0,
    duration: options.duration || 500,
    customProps: options.customProps || {}
  }
  
  // Create particles based on effect type
  switch (effectType) {
    case ParticleEffect.WOOD_HARVEST:
      createWoodHarvestParticles(emitter)
      break
    case ParticleEffect.STONE_MINE:
      createStoneMineParticles(emitter)
      break
    case ParticleEffect.WATER_COLLECT:
      createWaterCollectParticles(emitter)
      break
    case ParticleEffect.GOLD_SPARKLE:
      createGoldSparkleParticles(emitter)
      break
    case ParticleEffect.BUILDING_PLACE:
      createBuildingPlaceParticles(emitter)
      break
    case ParticleEffect.UNIT_ATTACK:
      createAttackParticles(emitter)
      break
    case ParticleEffect.UNIT_DEATH:
      createDeathParticles(emitter)
      break
    case ParticleEffect.UI_BUTTON_CLICK: // Add this new case
      createButtonClickParticles(emitter)
      break
  }
  
  // Add to active emitters
  activeEmitters.add(emitter)
  
  return emitter
}

/**
 * Create wood harvesting particles
 * @param {Object} emitter - The emitter to add particles to
 */
function createWoodHarvestParticles(emitter) {
  const SPRITE_SIZE = getTileSize()
  const particleCount = 1 + Math.random() * 2 | 0
  
  // Use earth/brown tones for wood chunks
  const colors = [0x8B4513, 0xA0522D, 0xCD853F, 0xD2B48C]
  
  for (let i = 0; i < particleCount; i++) {
    // Create a small colored square for each particle
    const size = (1 + Math.random() * 1) | 0 // Pixel size from 1-2px
    const graphics = new PIXI.Graphics()
        .rect(0, 0, size, size)
        .fill({ color: colors[Math.floor(Math.random() * colors.length)] })
    
    // Convert to texture
    const canvas = app.renderer.extract.canvas(graphics)
    const texture = PIXI.Texture.from(canvas)
    
    // Create sprite from texture
    const sprite = new PIXI.Sprite(texture)
    sprite.anchor.set(0.5)
    
    // Initial position with slight randomization
    const offsetX = (Math.random() - 0.5) * SPRITE_SIZE / 2
    const offsetY = (Math.random() - 0.5) * SPRITE_SIZE / 2
    
    // Add to container
    containers.particles.addChild(sprite)
    
    // Particle properties
    const particle = {
      sprite,
      x: emitter.x + offsetX,
      y: emitter.y + offsetY,
      vx: (Math.random() - 0.5),
      vy: -0.7 - Math.random(),
      gravity: 0.05 + Math.random() * 0.1,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.2,
      life: 1,
      decay: 0.02 + Math.random() * 0.02
    }
    
    emitter.particles.push(particle)
  }
}

/**
 * Create stone mining particles
 * @param {Object} emitter - The emitter to add particles to
 */
function createStoneMineParticles(emitter) {
    const SPRITE_SIZE = getTileSize()
    const particleCount = 1 + Math.random() * 2 | 0

    // Use gray/rock tones for stone chunks
    const colors = [0x888888, 0xAAAAAA, 0x777777, 0x666666]

    for (let i = 0; i < particleCount; i++) {
        // Create a small colored square for each particle
        const size = (1 + Math.random() * 1) | 0 // Pixel size from 1-2px
        const graphics = new PIXI.Graphics()
            .rect(0, 0, size, size)
            .fill({ color: colors[Math.floor(Math.random() * colors.length)] })
        
        // Convert to texture
        const canvas = app.renderer.extract.canvas(graphics)
        const texture = PIXI.Texture.from(canvas)
        
        // Create sprite from texture
        const sprite = new PIXI.Sprite(texture)
        sprite.anchor.set(0.5)
        
        // Initial position with slight randomization
        const offsetX = (Math.random() - 0.5) * SPRITE_SIZE / 2
        const offsetY = (Math.random() - 0.5) * SPRITE_SIZE / 2
        
        // Add to container
        containers.particles.addChild(sprite)
        
        // Particle properties
        const particle = {
        sprite,
        x: emitter.x + offsetX,
        y: emitter.y + offsetY,
        vx: (Math.random() - 0.5),
        vy: -0.7 - Math.random(),
        gravity: 0.05 + Math.random() * 0.1,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
        life: 1,
        decay: 0.02 + Math.random() * 0.02
        }
        
        emitter.particles.push(particle)
    }
}

/**
 * Create water collection particles
 * @param {Object} emitter - The emitter to add particles to
 */
function createWaterCollectParticles(emitter) {
    const SPRITE_SIZE = getTileSize()
    const particleCount = 1 + Math.random() * 2 | 0

    // Use blue/water tones for water droplets
    const colors = [0x0088FF, 0x0066CC, 0x00AAFF, 0x66CCFF]

    for (let i = 0; i < particleCount; i++) {
        // Create a small colored square for each particle
        const size = (1 + Math.random() * 1) | 0 // Pixel size from 1-2px
        const graphics = new PIXI.Graphics()
            .rect(0, 0, size, size)
            .fill({ color: colors[Math.floor(Math.random() * colors.length)] })
        
        // Convert to texture
        const canvas = app.renderer.extract.canvas(graphics)
        const texture = PIXI.Texture.from(canvas)
        
        // Create sprite from texture
        const sprite = new PIXI.Sprite(texture)
        sprite.anchor.set(0.5)
        
        // Initial position with slight randomization
        const offsetX = (Math.random() - 0.5) * SPRITE_SIZE / 2
        const offsetY = (Math.random() - 0.5) * SPRITE_SIZE / 2
        
        // Add to container
        containers.particles.addChild(sprite)
        
        // Particle properties - make water particles move differently
        const particle = {
        sprite,
        x: emitter.x + offsetX,
        y: emitter.y + offsetY,
        vx: (Math.random() - 0.5) * 0.8, // Slower horizontal movement
        vy: -0.5 - Math.random() * 0.8,  // Slower vertical movement
        gravity: 0.04 + Math.random() * 0.08, // Slightly less gravity
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.1, // Less rotation
        life: 1,
        decay: 0.015 + Math.random() * 0.015 // Slower decay for water drops
        }
        
        emitter.particles.push(particle)
    }
}

/**
 * Create gold collection particles
 * @param {Object} emitter - The emitter to add particles to
 */
function createGoldSparkleParticles(emitter) {
  const SPRITE_SIZE = getTileSize()
  const particleCount = 1 + Math.random() * 2 | 0
  
  // Gold colors
  const colors = [0xFFD700, 0xFFA500, 0xDAA520]
  
  for (let i = 0; i < particleCount; i++) {
    // Create a small gold particle
    const size = (1 + Math.random() * 1) | 0
    const graphics = new PIXI.Graphics()
        .rect(0, 0, size, size)
        .fill({ color: colors[Math.floor(Math.random() * colors.length)] })
    
    // Convert to texture
    const canvas = app.renderer.extract.canvas(graphics)
    const texture = PIXI.Texture.from(canvas)
    
    // Create sprite from texture
    const sprite = new PIXI.Sprite(texture)
    sprite.anchor.set(0.5)
    
    // Initial position with slight randomization
    const offsetX = (Math.random() - 0.5) * SPRITE_SIZE / 3
    const offsetY = (Math.random() - 0.5) * SPRITE_SIZE / 3
    
    // Add to container
    containers.particles.addChild(sprite)
    
    // Particle properties - rising gold sparkles
    const particle = {
      sprite,
      x: emitter.x + offsetX,
      y: emitter.y + offsetY,
      vx: (Math.random() - 0.5) * 0.5,
      vy: -0.2 - Math.random() * 0.3, // Slower upward movement
      gravity: 0.01, // Very light gravity
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.1,
      life: 1,
      decay: 0.01 + Math.random() * 0.01 // Slower decay for longer-lasting particles
    }
    
    emitter.particles.push(particle)
  }
}

/**
 * Create building placement particles
 * @param {Object} emitter - The emitter to add particles to
 */
function createBuildingPlaceParticles(emitter) {
  const SPRITE_SIZE = getTileSize()
  const particleCount = 15 + Math.random() * 10 | 0
  
  // Use green/gold/white for building placement effect
  const colors = [0xFFD700, 0x228B22, 0xFFFFFF]
  
  for (let i = 0; i < particleCount; i++) {
    // Create a small colored pixel for each particle
    const graphics = new PIXI.Graphics()
        .rect(0, 0, 2, 2) // 2x2 pixel
        .fill({ color: colors[Math.floor(Math.random() * colors.length)] })
    
    // Convert to texture
    const canvas = app.renderer.extract.canvas(graphics)
    const texture = PIXI.Texture.from(canvas)
    
    // Create sprite from texture
    const sprite = new PIXI.Sprite(texture)
    sprite.anchor.set(0.5)
    
    // Initial position (circle around building center)
    const angle = Math.random() * Math.PI * 2
    const distance = SPRITE_SIZE * (0.5 + Math.random() * 0.5)
    const offsetX = Math.cos(angle) * distance
    const offsetY = Math.sin(angle) * distance
    
    // Add to container
    containers.particles.addChild(sprite)
    
    // Particle properties - rising dust effect
    const particle = {
      sprite,
      x: emitter.x + offsetX,
      y: emitter.y + offsetY,
      vx: offsetX * 0.02,
      vy: offsetY * 0.02 - 0.5 - Math.random(),
      gravity: 0.02 + Math.random() * 0.02,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.1,
      life: 1,
      decay: 0.01 + Math.random() * 0.02
    }
    
    emitter.particles.push(particle)
  }
}

/**
 * Create attack particles
 * @param {Object} emitter - The emitter to add particles to
 */
function createAttackParticles(emitter) {
  const SPRITE_SIZE = getTileSize()
  const particleCount = 1 + Math.random() * 1 | 0
  
  // Use red/orange/yellow for attack sparks
  const colors = [0xFF0000, 0xFF4500, 0xFFD700]
  
  for (let i = 0; i < particleCount; i++) {
    // Create a small colored spark for each particle
    const graphics = new PIXI.Graphics()
    
    // Create different spark shapes
    if (Math.random() > 0.5) {
      // Small square
      graphics.rect(0, 0, 2, 2)
    } else {
      // Small line
      graphics.rect(0, 0, 3, 1)
    }

    graphics.fill({ color: colors[Math.floor(Math.random() * colors.length)] })
    
    // Convert to texture
    const canvas = app.renderer.extract.canvas(graphics)
    const texture = PIXI.Texture.from(canvas)
    
    // Create sprite from texture
    const sprite = new PIXI.Sprite(texture)
    sprite.anchor.set(0.5)
    
    // Direction toward target if provided
    let dirX = Math.random() - 0.5
    let dirY = Math.random() - 0.5
    
    if (emitter.customProps.targetX !== undefined && emitter.customProps.targetY !== undefined) {
      dirX = emitter.customProps.targetX - emitter.x
      dirY = emitter.customProps.targetY - emitter.y
      const length = Math.sqrt(dirX * dirX + dirY * dirY)
      if (length > 0) {
        dirX /= length
        dirY /= length
      }
    }
    
    // Add to container
    containers.particles.addChild(sprite)
    
    // Particle properties - impact sparks
    const particle = {
      sprite,
      x: emitter.x,
      y: emitter.y,
      vx: dirX * (0 + Math.random() * 2),
      vy: dirY * (0 + Math.random() * 2),
      gravity: 0.02, // + Math.random() * 0.02,
      rotation: Math.atan2(dirY, dirX),
      rotationSpeed: (Math.random() - 0.5) * 0.1,
      life: 1,
      decay: 0.03 + Math.random() * 0.05
    }
    
    emitter.particles.push(particle)
  }
}

/**
 * Create death particles
 * @param {Object} emitter - The emitter to add particles to
 */
function createDeathParticles(emitter) {
  const SPRITE_SIZE = getTileSize()
  const particleCount = 20 + Math.random() * 10 | 0
  
  // Use red/darker red for blood effect
  const colors = [0x8B0000, 0xB22222, 0xDC143C]
  
  for (let i = 0; i < particleCount; i++) {
    // Create a small colored splash for each particle
    const size = 1 + Math.random() | 0 // Small square
    const graphics = new PIXI.Graphics()
        .rect(0, 0, size, size)
        .fill({ color: colors[Math.floor(Math.random() * colors.length)] })

    
    
    // Convert to texture
    const canvas = app.renderer.extract.canvas(graphics)
    const texture = PIXI.Texture.from(canvas)
    
    // Create sprite from texture
    const sprite = new PIXI.Sprite(texture)
    sprite.anchor.set(0.5)
    
    // Explosion effect radiating outward
    const angle = Math.random() * Math.PI * 2
    const speed = 0.02 + Math.random() / 4
    
    // Add to container
    containers.particles.addChild(sprite)
    
    // Particle properties - blood splatter
    const particle = {
      sprite,
      x: emitter.x,
      y: emitter.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      gravity: 0, // 0.1 + Math.random() * 0.1,
      rotation: angle, // Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.1,
      life: 1,
      decay: 0.01 + Math.random() * 0.02
    }
    
    emitter.particles.push(particle)
  }
}

/**
 * Create button click sparkle particles
 * @param {Object} emitter - The emitter to add particles to
 */
function createButtonClickParticles(emitter) {
    const particleCount = 10 + Math.random() * 8 | 0
    
    // Use gold, white, and light blue colors for a magical sparkle effect
    const colors = [0xFFD700, 0xFFFFFF, 0x87CEFA]
    
    for (let i = 0; i < particleCount; i++) {
      // Create a small sparkle for each particle
      const graphics = new PIXI.Graphics()
      
      // Create different sparkle shapes
      if (Math.random() > 0.7) {
        // Small square
        graphics.rect(0, 0, 2, 2)
      } else if (Math.random() > 0.4) {
        // Small star (really just a dot for pixel aesthetic)
        graphics.rect(0, 0, 1, 1)
      } else {
        // Small line for streaking effect
        graphics.rect(0, 0, 3, 1)
      }
      
      graphics.fill({ color: colors[Math.floor(Math.random() * colors.length)] })
      
      // Convert to texture
      const canvas = app.renderer.extract.canvas(graphics)
      const texture = PIXI.Texture.from(canvas)
      
      // Create sprite from texture
      const sprite = new PIXI.Sprite(texture)
      sprite.anchor.set(0.5)
      
      // Explosion effect radiating outward
      const angle = Math.random() * Math.PI * 2
      const speed = 0.5 + Math.random() * 2
      
      // Add to container - for UI elements, add to UI container to ensure they stay on top
      containers.ui.addChild(sprite)
      
      // Particle properties - faster decay for UI elements
      const particle = {
        sprite,
        x: emitter.x,
        y: emitter.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: -0.02, // Slightly float upward for UI elements
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
        life: 1,
        decay: 0.03 + Math.random() * 0.03, // Faster decay
        uiParticle: true // Flag for special handling
      }
      
      emitter.particles.push(particle)
    }
  }

/**
 * Update all particle emitters
 * @param {number} delay - Time elapsed since last update (ms)
 */
function updateAllParticles(delay) {
  // Skip if game is paused
  if (gameState.gameStatus !== 'playing' && gameState.gameStatus !== 'menu') return
  
  // Get view transform for culling
  const viewTransform = gameState.UI?.mouse?.getViewTransform()
  
  // Update each emitter
  for (const emitter of activeEmitters) {
    // Update emitter age
    emitter.age += delay
    
    // Check if emitter should be removed
    if (emitter.age >= emitter.duration) {
      // Clean up remaining particles
      for (const particle of emitter.particles) {
        if (particle.sprite.parent) {
          particle.sprite.parent.removeChild(particle.sprite)
        }
      }
      activeEmitters.delete(emitter)
      continue
    }
    
    // Update particles for this emitter
    for (let i = emitter.particles.length - 1; i >= 0; i--) {
      const particle = emitter.particles[i]
      
      // Update position
      particle.x += particle.vx
      particle.y += particle.vy
      
      // Apply gravity
      particle.vy += particle.gravity
      
      // Update rotation
      particle.rotation += particle.rotationSpeed
      
      // Update life
      particle.life -= particle.decay * (delay / 16)
      
      // Remove if dead
      if (particle.life <= 0) {
        if (particle.sprite.parent) {
          particle.sprite.parent.removeChild(particle.sprite)
        }
        emitter.particles.splice(i, 1)
        continue
      }
      
      // Update sprite
      particle.sprite.position.set(particle.x, particle.y)
      particle.sprite.rotation = particle.rotation
      particle.sprite.alpha = particle.life
      
      // Apply scaling effect
      const scale = 0.5 + particle.life * 0.5
      particle.sprite.scale.set(scale, scale)
    }
  }
  
  // Apply transform to container
  if (viewTransform) {
    containers.particles.scale.set(viewTransform.scale, viewTransform.scale)
    containers.particles.position.set(
      -viewTransform.x * viewTransform.scale,
      -viewTransform.y * viewTransform.scale
    )
  }
}

/**
 * Draw all particles
 * This function doesn't do much since particles are auto-drawn by Pixi.js
 * It's here for completeness and potential future optimizations
 */
function drawParticles() {
  // Particles are automatically drawn by Pixi, nothing needed here
}