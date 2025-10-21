export { Building, CombatBuilding, GoldMine, Quarry, Tent, Well, WorkerBuilding, Barracks, Armory, Citadel, Market }

'use strict'

import { playBuildingSound } from 'audio'
import { getMapDimensions, getTileSize } from 'dimensions'
import { isPositionVisible } from 'fogOfWar'
import { TERRAIN_TYPES } from 'game'
import { ParticleEffect, createParticleEmitter } from 'particles'
import { searchPath, updateMapInWorker } from 'pathfinding'
import { Player } from 'players'
import { createProgressIndicator, indicatorMap, removeProgressIndicator, updateProgressIndicator } from 'renderer'
import { sprites } from 'sprites'
import gameState from 'state'
import { showDebugMessage } from 'ui'
import { GoldMiner, LumberjackWorker, Peon, QuarryMiner, WaterCarrier } from 'unit'
import { distance } from 'utils'

const TREE_PROCESSING_BATCH_SIZE = 5 // Process 5 trees at once
const TREE_PROCESSING_DELAY = 150 // 150ms delay between batches


/**
 * Base Building class for all game buildings
 * Handles common building properties and behaviors including:
 * - Health and damage
 * - Positioning on the map
 * - Production timers
 * - Player ownership
 */
class Building {
    static WEIGHT = getMapDimensions().maxWeight / 2 // Movement cost for walking through a building tile

    static TYPES = {
        LUMBERJACK: {
          name: "Wood Hut",
          icon: "🪓",
          costs: { wood: 10 },
          UPGRADES: {
            benefits: { life: 25, maxWorkers: 1 } // +25 life, +1 worker
          },
          description: "Harvests wood from nearby trees",
          sprite_coords: {
            cyan: { x: 5, y: 33 },
            red: { x: 15, y: 33 },
          },
          sprite: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAAAsTAAALEwEAmpwYAAABXklEQVR4nO2ZwW2EMBBFLRcDBQUpW8AafEiwvQ3MLdvD7oHUFNzOhogcCLACZHEI9vwv/QL4898wAiEgCIIg6H9FJDPVdIs+Nw+RtAgBSPYNyNVnt+RMpYYATSfeP+Tp7pd984ntBEIAkn0D8jHnZZM4AhQ4cQTg0YBTagjkIcxH3wDayfxTAG1n36uJ22sx+Ov68mAVgEMAFccG6MGu1swCuG/thPJbcA7AvJW8G2COHkDWv/dvfsPt1AE7wdT6YAgEfvLKVTNjWid2KBECkGiAWkegv+4GGx24E46OwExEJFdP248ibCcgAI8GZLEh4EbMX0z1W/uxJwjUevWGeD16AyiQ+afLLvZfZ4QACA1wAcxHjwDtnXjsIgRAaIDbw3xsIkycUHnLfes7MF/wmrjlXnnLPQAH5gteE7fcK28RQPXXgDrx236rAXMn98BzIQBCAyRrBCAIgiCRpn4AbtcHa+oFkwUAAAAASUVORK5CYII='
        },
        GOLD_MINE: {
          name: "Gold Mine",
          icon: "⛏️",
          costs: { wood: 25, stone: 15 },
          UPGRADES: {
            benefits: { life: 25, productionSpeed: 10 } // +25 life, 10% faster
          },
          description: "Mines gold",
          sprite_coords: {
            cyan: { x: 6, y: 33 },
            red: { x: 16, y: 33 },
          },
          sprite: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAAAsTAAALEwEAmpwYAAACLUlEQVR4nO2ZsUscQRSHt9DmOksbq32XmYju71hJPA5yAYsUFoIgXmFhSOAOjjuIIJjUSRHSJYVJk6Q4FLQStFBI/h/Bq2wMCYzsycmxybqr3uRmdt4Hrxv2lo+Z39t553kMwzAaAUmlowKSfwJfrnmuCoAtEqBRgBUSoFmA8RIQe9nXRyf3rufvPqjSg2k7JECDAKskQJMAayRAowArJCAmoPFxW20dHg9Vwvrb939L8MXv2aJcNbILzM+V1dKLump8+pz/nYCUFlZ+XFHLjZZqfevkU0JAYjvw5VmWfl5deKZqm2/Uxu5+vo5DGIbjAYlFkOjAF+dpIkrFhyor1kjoE06GhRKJWkDiAL74lSThPgJukuCZxMzUzASK4iVI/owL6Lae3FhpAvoS4s/1TAUaBETFAoh3gOIjQJwBypgQRMYhR25DECxADm0UFn0xvtrZy+cOQMaK7g5WC+jGzvZtBUQXKKcFgKRqf++YJwB3DLssLwxf/Bhcs9LecExAsXeBul5TqTy1VwBSKvEWSfJicF3zy1d3BET05gkD65brTbMFdO8YdknPj4Yqg+vKj8r/nDbnVkA4GRbi47Vo5P7fBUBj2KX/tugM60hZKeBq0GqJAGh4sWq1OgYSp84K6P/vYJSA7pDDznjgigCMMOyMACxAjjTsRg5YgHQj7JLgtCdOe8XtjjjtFYcdcdorbneUg76eBFxpd0nAlW/7JMACJO8AuHwEGIbxXOIScpe5PQPthBcAAAAASUVORK5CYII='
        },
        QUARRY: {
          name: "Quarry",
          icon: "🪨",
          costs: { wood: 20 },
          UPGRADES: {
            benefits: { life: 25, productionSpeed: 10 } // +25 life, 10% faster
          },
          description: "Extracts stone",
          sprite_coords: {
            cyan: { x: 6, y: 33 },
            red: { x: 16, y: 33 },
          },
          sprite: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAAAsTAAALEwEAmpwYAAABq0lEQVR4nO1ayW3DMBBcHy0wHfAVN+B8XIVqoB+xsUoDLECqJF/Lqc7gBkIgQCFsMYwO65gB5iMIC+5gZkkdRAAAAAAwOPhkbnwyriIRrWhJ4J/GpaK1dk1LAkMAM28HsJfxOxSPTfdOb0bw/Sb/zck5hCGAmbcDOD7jbTmuGcH9NDkdhzAEMPN2AA+f8XHNCB5nk8M5hCGAWZYDCv16u+idq1FmxnpvTvyZcNE7V+idLIWW6LcjIICGA9yzbYkIaMwAwRDUT9oFhGhVXqyYqb3L1V7mQku0rfcXPApn8xMg7lkggwB7OCAfgXURAYUZIBiCCruAYBtUOAcIDkJqwJOgRD4bpO9G0tNjZpELblvvk5JN1Nk/hKAAgbey+ctbnAAt63XSdB0QQMEBrimj16Jo5Mf52Jjhruv1HoHUy2S5qK/r9SFDGe66HgQgOGDdaQTEOxf4X49jLWsPh22f9ahvcNsFe19ru64HAfoGL90BVM4Ea9cV0/Ox8YeKJEk29ftD9UpB0nKvf8A/1BsWHPijJHaRXdfrHQwBzLIdQF6GfY6gHgAAAEAevgEc3qOLmwTvWAAAAABJRU5ErkJggg=='
        },
        WELL: {
          name: "Well",
          icon: "🧱",
          costs: { wood: 8, stone: 20 },
          UPGRADES: {
            benefits: { life: 25, maxWorkers: 1 } // +25 life, +1 worker
          },
          description: "Produces water",
          sprite_coords: {
            cyan: { x: 4, y: 37 },
            red: { x: 14, y: 37 },
          },
          sprite: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAAAsTAAALEwEAmpwYAAABxklEQVR4nO1aQU7DMBDcBqm8oPlLuZMf8AXKJVZ7orc0Fzi0L+EGivOs+gXJIguCEguUrOIEV52R5tSuHI9mdu20RAAAAAAwGOc8rc4HVTc8rdYs4eblvW5TWn8+pD9rW9LcMLniNk+xUIDXjw6P8Z2o3l2fmRYQYE4YOEAFFYFjvK6Pq7/J5DkiJjAB+tbPiCII4BMGDlBBReDtgW6szRva3F9VBNg5B0CAFRxQzxoBFh5F3QgQs6g+uAgwBCA4gAS4+ggsk311m+y5IWVZNGUP8H43MCN7wPL+uVome244tQDe7wYGAig4wAgi0Gd5aST6HGgz3r4buBxl/0sQYHIYCKDgACOw4OPX+39usfO7gPMZ+3agdxjhA7gnvz72XY4gQA4HMCKQowcwmmCOKcCzjMFS66rUmodym27qNiW1Puoz4fV6CgE61EXBc9ZDgAwOiMgnSkRAoweUaIL6eqfANt3UO/XEQ+luQFI7tt5+3+vmLdwHCp3k+09R2wA2BQHSf3SALorOFHBzKm1SY+vdDc9+FN45G5BeVsbW900JCJDBAREi4BMleoBGEywFY2jsGAtuCvyChV2kIV1ePQAAAEDf+AQS3+go4fDeQAAAAABJRU5ErkJggg=='
        },
        BARRACKS: {
          name: "Barracks",
          icon: "⚔️",
          costs: { wood: 15, water: 10, gold: 5 },
          UPGRADES: {
            benefits: { life: 50, productionSpeed: 10 } // +50 life, 10% faster production
          },
          description: "Trains soldiers",
          sprite_coords: {
            cyan: { x: 5, y: 34 },
            red: { x: 15, y: 34 },
          },
          sprite: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAAAsTAAALEwEAmpwYAAABZ0lEQVR4nO2ZUW6DMBBEN/QeSW8AN/R9+LZzIe8x2k7lj0ipVbBIjDH2PGn/UFBmZ9YLiBBCCCG7ApFBryNylb+O33ImQAGEDtCWI4DMHT6dQKAAQgdoTxEAOy59dTyGDpD3HeBv02JpqJocgNyb3G3C3bnlsrZty3sKMLXvAL+Scf+ZFmBtJlQvgE91eGtZi6J/uDYBnLU/ciSgAJJ0wKaMv+AAY8zwKACXqhzgc2e+tkiAAggdoJVFoOhMQGUOKD4TQAGEDlBGYOQMUA7BkaeAHnQMhqNuqe7OfYVd4FHNHYMucc6HZWjXvQAUQOgAXXsfECJg7d8quPvvHoHaI0EBDB0wdB0BAJfomrLfCn30oSK2ZOm9YHdAAYQO0MwR+Ge/f3kvOByzUYDUuV79TIihAKZDB5inTM7z/LH1ef75t0Km166PZ8ThM8EkOpa7Q6Xvl4QCmM4dgERm44yf7X6EEEKkUX4BxuhHPhXplNUAAAAASUVORK5CYII='
        },
        ARMORY: {
          name: "Armory",
          icon: "🛡️",
          costs: { wood: 25, water: 20, stone: 15, gold: 20 },
          UPGRADES: {
            benefits: { life: 75, productionSpeed: 10 } // +75 life, 10% faster production
          },
          description: "Trains heavy infantry",
          sprite_coords: {
            cyan: { x: 7, y: 33 },
            red: { x: 17, y: 33 },
          },
          sprite: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAAAsTAAALEwEAmpwYAAAB3ElEQVR4nO2aUXKCMBiEYzuT3uTvSUpP4OABSq9QfOIeZQb63OvIdRDHYqn+Ar+BQIPZndk3g+RjN6BEKQiCIAiyLv3yUeogrmxZKbVSS5IO4r1VAEnyoJYkDQDxfSeA3vKSorzqcpjuqs3nn/Xr1mjCfPxz9NX5XUcrVc27RlCU7UUAadF4EICz8SKAuRNCAJD5lQASOi8B+HHPmsA7z8dKACZfE0i44jcB6EmE9HljALYTQQCQ+ZUAzZ7lKcqMTsB0TRg7Ye7RvyU0e5KbBIDFKy4CME2EBoAYCdBXDyjbxlIl6vt60ZjeB1TGYDw/P+sV0Mw3ATjr9CAABuOt/5rUABALCcj9TkDIOnrltttbT6evjieM535q6f30ANJisFsBjDgeAARIQDXFf4qrX/NKuF6B04Sb8x8y+QstFIA9aQCI/U7ASU2nwnRXugRgvf5+tNp5Sa4BSJJq3vcCIQDskIANKlBgDdhgESz8vAuMvSuMBfDvE+YCgBQJKL2uAEX5xcvTzv/1BgLgr8pm3xNk+vpcmpApAP5593aNRQCw9yoBZLhnaGo7t0+Q5gbg2j5BAoD8vhNQ69i7dttOSD3B7u9TrokmAbAgEQBkfiegVl9nTQ1BEAQp2zoAV9s22rKd+csAAAAASUVORK5CYII='
        },
        CITADEL: {
          name: "Citadel",
          icon: "🏰",
          costs: { wood: 40, water: 40, stone: 20, gold: 50 },
          UPGRADES: {
            benefits: { life: 100, productionSpeed: 10 } // +100 life, 10% faster production
          },
          description: "Trains elite warriors",
          sprite_coords: {
            cyan: { x: 8, y: 35 },
            red: { x: 18, y: 35 },
          },
          sprite: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAAAsTAAALEwEAmpwYAAAB70lEQVR4nO1aUW6CQBAdaKM9id4ET9CIB7BXqH7NPaCJfnsJozewcJmmxmkwRUWFZbIsi+685H0tzK5v3xtXAUAgEAgE7YMI/At64BKIwN9vPcr5u/EO4BJIBIDndwAi+WVcr/H1WoCq64HosXoEIvlhnFIZJ1/fVBBg65dee2SUPJZDUASg53cAVmT2fbV6aVqATvUIVOywimwBVGzbISgCkHsOQEbGbQhgtCeg5o4bF8C0I1AEIHFAeGWzcZycGEa3NqwarxMBnfrGIzCOExpMF2d+LIgzrhJAt74IEIkDDma/96P0aLucwxsLpjScLk8cTJe8HqBZX/tcgA13/dbPAbrnAhQBSBwQ8m1WTW4EGPXsRyBKqBfMStkP5swmyKsnAsTiAOp0BHqjeSG/k3h3G4GL8fGzRaB3xbfRZ1GAjce6XwQIxAFkNAJA5GU3FaiIQLYrObPMV1p4NDvaPufPxq9l+xOznlLjQ5+Z7nkCtNwTrGdeBREAHXcAGO4Jncu8bUfY33EFRAB00AGo82ywBQG6/WwwMiyAaUegCEDuOQAbfB/gX4BDXfaDefU5w3RPwKb/FWbuiO35wfYCbM8Pthdge364e/ZXsW0BWOuz/dsgaliArr05iiIAue0AUPYMZgabricQCAQCAdzDH7txa8JBeNntAAAAAElFTkSuQmCC'
        },
        MARKET: {
          name: "Market",
          icon: "🏦",
          costs: { wood: 25, water: 10, money: 50, gold: 20 },
          UPGRADES: {
            benefits: { life: 50, productionSpeed: 10 } // +50 life, 10% faster production (for selling rate)
          },
          description: "Sell resources against money",
          sprite_coords: {
            cyan: { x: 5, y: 35 },
            red: { x: 15, y: 35 },
          },
          sprite: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAMAAADXqc3KAAAAFVBMVEXH2+uuw9LM3u2Wrr1vnKxWZXEQV61ZyqlCAAAAAnRSTlMB9aJf+uoAAACFSURBVHjarZJBCsNADANtjaz/P7k0TUjabKGHzsXgERiB6xekWtF6soqT0LrHSTbzptQNgYDQJc4IkgAa1EecmQacgGaOS8I2EBNo297FC5wEvairaX/sSzfOEiNpZrYhdR2mxz0bYi4VpUG76LsAWArb/oeQ2raRTtELnnuWVJWWfH+ZBzq/A+PL/IUwAAAAAElFTkSuQmCC'
        },
        TENT: {
          name: "Tent",
          icon: "⛺",
          costs: { wood: 75, water: 50, money: 50 },
          UPGRADES: {
            benefits: { life: 50, productionSpeed: 10 } // +50 life, 10% faster production
          },
          description: "Produces peons",
          sprite_coords: {
            cyan: { x: 4, y: 33 },
            red: { x: 14, y: 33 },
          },
          sprite: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAMAAADXqc3KAAAALVBMVEUAAAC9aS5MLinxnT/xnj+bLBrtXjHxnj+cKxrxnkDsYDLsXzLCRCWbLRs1Ly5aaGaRAAAACXRSTlMAH1FbrLjK6eoLXuamAAAAaklEQVR42t3QQQ6AIAxEUUAUZBjuf1wBwRRTL2CXfflpUvOvscFbFc5n8AHAUgYB0IMVvAAiKUECCqAGucKhXWDJgBoUziTKC6wwE8qgwUwoL7Dcwt5sbc0KHMAOw9j3dM5G7kY8zL3+fQFVsQkOwk/8+wAAAABJRU5ErkJggg=='
          //sprite: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAMAAADXqc3KAAAAYFBMVEUAAAD/KgDiMACyLQD/PAC9LADtOACGMQL/PADCLgD/PQCzKgD/PADBLgD/1I7/x4P/q2jvrW3/nVz/ejq9e0n/UxX/UhP+PQDqOACcSyPCLwCuMQGLJwN/HwBqGwBWFwBLdjRBAAAADnRSTlMABho3TGp1oay31NXZ8z/XQMYAAACJSURBVBgZxcFbDoJAEATAluUhAoMIONDuyv1vKZHAbMK/VuEPMuLE5Q1XDrGEhwqxmgYxnXhwMPmsNDC6jDQJdul9aZWHBjuVRZTGYZP3w7vrJxpsVPx7EKUpUaBA/ZQQZtGJpgBcqq2EEOSh3DUOq/Q6dt57EVV+lYhklfSq5IsZTi75zSf4pQ+FhxNQ6zbK1gAAAABJRU5ErkJggg=='
        },
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
    this.level = 1
    this.life = 100
    this.maxLife = 100
    this.productionTimer = 0
    this.productionCooldown = 10000 // 10 seconds by default
    this.visibilityRange = getTileSize() * 8
    this.type = null

    // Progress indicator properties
    this.showProgressIndicator = false
    this.indicatorColor = color
    this.progress = 0
    this.selected = false
    
    // Register building with player
    if (owner) {
      if (!owner.buildings) {
        owner.buildings = []
      }
      owner.buildings.push(this)
    }

    // Position the building onto the map
    // Update map tile to make it hardly walkable
    gameState.map[x][y].weight = Building.WEIGHT
    gameState.map[x][y].type = 'BUILDING'
  }

  /**
   * Get the upgrade costs for the next level of a building.
   * @param {Building} building - The building instance.
   * @returns {Object|null} The costs for the next upgrade, or null if no more upgrades.
   */
  getUpgradeCosts() {
    const nextLevel = this.level + 1
    if (this.getUpgradeBenefits()) {
      return Object.fromEntries(
        Object.entries(this.type.costs).map(([key, value]) => [key, value * nextLevel | 0])
      )
    }
    return null
  }

  /**
   * Get the upgrade benefits for the next level of a building.
   * @param {Building} building - The building instance.
   * @returns {Object|null} The benefits for the next upgrade, or null if no more upgrades.
   */
  getUpgradeBenefits() {
    return this.type.UPGRADES?.benefits
  }

  /**
   * Apply an upgrade to the building.
   * @param {Building} building - The building instance.
   */
  async applyUpgrade() {
    const nextLevel = this.level + 1
    const benefits = this.getUpgradeBenefits()
    if (benefits) {
      // Apply benefits
      if (benefits.life) {
        this.maxLife += benefits.life
        this.life += benefits.life // Also heal the building
      }
      if (benefits.productionSpeed) {
        this.productionCooldown *= (1 - benefits.productionSpeed / 100)
      }
      if (benefits.maxWorkers) {
        this.maxWorkers += benefits.maxWorkers
      }

      this.level = nextLevel
      return true
    }
    return false
  }


  /**
   * Handle building upgrade logic.
   */
  async handleBuildingUpgrade() {
    const upgradeCosts = this.getUpgradeCosts()
    if (!upgradeCosts) {
      showDebugMessage('No more upgrades available for this building.')
      return
    }

    const canAfford = this.owner.canAffordUpgrade(this)

    if (canAfford) {
      // Deduct costs
      for (const [resource, amount] of Object.entries(upgradeCosts)) {
        this.owner.addResource(resource, -amount)
      }

      // Apply upgrade benefits
      this.applyUpgrade()

      showDebugMessage(`${this.type.name} upgraded to Level ${this.level}!`)
      // displayBuildingInfo(this) // Refresh UI
    } else {
      const costText = Object.entries(upgradeCosts)
        .map(([resource, amount]) => `${resource}: ${amount}`)
        .join(', ')
      showDebugMessage(`Cannot afford upgrade (Needs ${costText})`)
    }
  }

  /**
   * Properly cleanup object
   */
  async destroy() {
    if (indicatorMap?.has(this.uid)) {
      removeProgressIndicator(this.uid)
    }
  }
  
  /**
   * Update building state
   * @param {number} delay - Time elapsed since last update (ms)
   */
  update(delay) {
    if(this.life <= 0) {
      gameState.map[this.x][this.y].uid = null
      gameState.map[this.x][this.y].weight = TERRAIN_TYPES.GRASS.weight
      gameState.map[this.x][this.y].type = TERRAIN_TYPES.GRASS.type
      gameState.map[this.x][this.y].building = undefined
      gameState.map[this.x][this.y].sprite.destroy()
      gameState.map[this.x][this.y].sprite = undefined
      updateMapInWorker()

      // Cleanup
      this.destroy()

      // Create destroyed particles
      createParticleEmitter(ParticleEffect.UNIT_DEATH, {
        x: this.x * getTileSize() + getTileSize()/2,
        y: this.y * getTileSize() + getTileSize()/2,
        duration: 1000
      })

      return
    }
  }

  static create(buildingType, x, y, color, owner) {
    // Store the original terrain sprite as background if it's grass or sand
    if (['GRASS', 'SAND'].includes(gameState.map[x][y].type)) {
      // Save the original sprite as background before replacing it
      gameState.map[x][y].back = gameState.map[x][y].sprite;
    }
    
    let building
    switch (buildingType) {
        case Building.TYPES.LUMBERJACK:
            building = new Lumberjack(x, y, color, owner)
            break
        case Building.TYPES.TENT:
            building = new Tent(x, y, color, owner)
            break
        case Building.TYPES.QUARRY:
          building = new Quarry(x, y, color, owner)
          break
        case Building.TYPES.WELL:
          building = new Well(x, y, color, owner)
          break
        case Building.TYPES.GOLD_MINE:
          building = new GoldMine(x, y, color, owner)
          break
        case Building.TYPES.MARKET:
          building = new Market(x, y, color, owner)
          break
        case Building.TYPES.BARRACKS:
          building = new Barracks(x, y, color, owner)
          break
        case Building.TYPES.ARMORY:
          building = new Armory(x, y, color, owner)
          break
        case Building.TYPES.CITADEL:
          building = new Citadel(x, y, color, owner)
          break
    }

    gameState.map[x][y].type = building.type
    gameState.map[x][y].building = building
    updateMapInWorker()

    // Put the corresponding sprite on the map
    const spriteX = building.type.sprite_coords[color].x
    const spriteY = building.type.sprite_coords[color].y
    gameState.map[x][y].sprite = sprites[`tile_${spriteX}_${spriteY}`]

    // Add building placement particle effect
    createParticleEmitter(ParticleEffect.BUILDING_PLACE, {
      x: x * getTileSize() + getTileSize()/2,
      y: y * getTileSize() + getTileSize()/2,
      duration: 1500
    })

    if(owner === gameState.humanPlayer || isPositionVisible(x, y)) {
      playBuildingSound()
    }
    
    return building
  }
}

/**
 * Building that produces worker units
 */
class WorkerBuilding extends Building {
  constructor(x, y, color, owner) {
    super(x, y, color, owner)
    this.type = 'WORKER_BUILDING'
    this.lastWorkerConversionTime = 0

    this.maxWorkers = 0
    this.assignedWorkers = []

    // Production timer for converting workers
    this.productionTimer = 0
    this.productionCooldown = 1000 // Small delay to convert a worker
    this.convertingWorker = null
  }
  
}

/**
 * Building that produces combat units
 */
class CombatBuilding extends Building {
  constructor(x, y, color, owner) {
    super(x, y, color, owner)
    this.type = 'COMBAT_BUILDING'
    this.productionCooldown = 15000 // 15 seconds by default for combat units
    this.indicatorColor = 0xFF0000 // Red color for combat production
    this.showProgressIndicator = owner === gameState.humanPlayer
  }

  /**
   * Update building state and produce combat units
   * @param {number} delay - Time elapsed since last update (ms)
   */
  update(delay) {
    super.update(delay)
    
    // Update production timer
    this.productionTimer += delay

    // Update progress for indicator
    this.progress = this.productionTimer / this.productionCooldown

    updateProgressIndicator(this, this.progress)
    
    // Check if it's time to produce a combat unit
    if (this.productionTimer >= this.productionCooldown) {
      this.produceWarrior()
      this.productionTimer -= this.productionCooldown
      this.progress = 0 // Reset progress after producing
    }
  }
  
  /**
   * Produce a combat unit (to be overridden by specific combat buildings)
   */
  produceWarrior() {
    // This method will be overridden by Barracks, Armory, Citadel
  }
}

/**
 * Tent is a specialized worker building (the player's base)
 */
class Tent extends WorkerBuilding {
  constructor(x, y, color, owner) {
    super(x, y, color, owner)
    this.type = Building.TYPES.TENT
    this.life = 200
    this.maxLife = 200
    this.productionCooldown = 10000 // 10 seconds
    this.indicatorColor = 0x00FF00 // Green color
    this.showProgressIndicator = owner === gameState.humanPlayer
  }

  /**
   * Update building and produce workers
   * @param {number} delay - Time elapsed since last update (ms)
   */
  update(delay) {
    super.update(delay)
    
    // Update production timer
    this.productionTimer += delay

    // Update progress for indicator
    this.progress = this.productionTimer / this.productionCooldown

    updateProgressIndicator(this, this.progress)
    
    // Check if it's time to produce a worker
    if (this.productionTimer >= this.productionCooldown) {
      this.produceWorker()
      this.productionTimer -= this.productionCooldown
      this.progress = 0 // Reset progress after producing
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
 * Lumberjack building for wood harvesting
 * Converts regular idle workers to specialized lumberjack workers.
 * Identifies harvestable trees in the vicinity and assigns workers to them.
 * Processes harvested wood and transfers it to the player's resources.
 */
class Lumberjack extends WorkerBuilding {
    constructor(x, y, color, owner) {
        super(x, y, color, owner)
        this.type = Building.TYPES.LUMBERJACK
        this.life = 150
        this.maxLife = 150

        this.maxWorkers = 1

        // Add nearby trees array
        this.nearbyTrees = []
        this.treeSearchRadius = 10 // Search within 10 tiles radius

        this.treeProcessingInProgress = false
        this.treeProcessingQueue = []

        // Find and order nearby trees after construction
        this.findAndOrderNearbyTrees()
    }

    /**
     * Update building state and convert workers
     */
    async update(delay) {
        super.update(delay)

        this.assignedWorkers = this.assignedWorkers.filter(unit => unit.life > 0)

        // If we're not at max capacity and not already converting
        if (this.assignedWorkers.filter(unit => unit instanceof LumberjackWorker).length < this.maxWorkers && !this.convertingWorker) {
            // Look for nearby workers to convert
            await this.findWorkerToConvert()
        }

        // If we're converting a worker
        if (this.convertingWorker) {
            this.productionTimer += delay

            // Launch tree ordering before the end of the conversion
            if(this.productionTimer > this.productionCooldown * 0.8) {
              this.findAndOrderNearbyTrees()
            }
            
            // Check if conversion is complete
            if (this.productionTimer >= this.productionCooldown) {
                this.completeWorkerConversion()
                this.productionTimer = 0
                this.convertingWorker = null
            }
        }

        if (Math.random() > 0.999) {
          // Sometimes refresh the tree list
          this.findAndOrderNearbyTrees()
        }
    }

    /**
     * Find and order nearby trees by path distance
     */
    async findAndOrderNearbyTrees() {
        // If already processing, don't start again
        if (this.treeProcessingInProgress) {
            return
        }
        
        this.treeProcessingInProgress = true
        const { width, height } = getMapDimensions()
        this.treeProcessingQueue = []
        
        // First, find all trees within radius
        for (let dx = -this.treeSearchRadius; dx <= this.treeSearchRadius; dx++) {
            for (let dy = -this.treeSearchRadius; dy <= this.treeSearchRadius; dy++) {
                const tileX = this.x + dx
                const tileY = this.y + dy
                
                // Check if coordinates are valid
                if (tileX >= 0 && tileX < width && tileY >= 0 && tileY < height) {
                    const tile = gameState.map[tileX][tileY]
                    
                    // Check if it's a harvestable tree
                    if (tile?.type === 'TREE' && tile?.lifeRemaining > 0) {
                        // Use geometric distance for initial filtering
                        const geoDist = Math.sqrt(dx * dx + dy * dy)
                        if (geoDist <= this.treeSearchRadius) {
                            this.treeProcessingQueue.push({ x: tileX, y: tileY, geoDist })
                        }
                    }
                }
            }
        }

        // Sort by geometric distance
        this.treeProcessingQueue.sort((a, b) => a.geoDist - b.geoDist)

        // Initialize the tree list
        this.nearbyTrees = []

        // Process trees in background
        if (this.treeProcessingQueue.length > 0) {
            this.processNextTreeInQueue()
        } else {
            this.treeProcessingInProgress = false
        }
    }

    /**
     * Sort trees by path quality and limit the number stored
     */
    sortTreesByPathQuality() {
        this.nearbyTrees.sort((a, b) => {
            // First compare by path weight
            if (a.pathWeight !== b.pathWeight) {
                return a.pathWeight - b.pathWeight
            }
            // Then by path distance as a tiebreaker
            return a.pathDistance - b.pathDistance
        });
        
        // Limit to 30 trees max to avoid memory issues
        if (this.nearbyTrees.length > 30) {
            this.nearbyTrees = this.nearbyTrees.slice(0, 30)
        }
    }

    /**
     * Process next tree in the queue without blocking the main thread
     */
    async processNextTreeInQueue() {
        // If building is destroyed or no more trees to process, stop
        if (!this.owner || this.life <= 0 || this.treeProcessingQueue.length === 0) {
            this.treeProcessingInProgress = false
            this.treeProcessingQueue = []
            return
        }
        
        const startX = this.assignedWorkers[0]?.currentNode?.x ?? this.x
        const startY = this.assignedWorkers[0]?.currentNode?.y ?? this.y

        const batchPromises = []
        const treesToProcess = []

        // Process a batch of trees
        for (let i = 0; i < TREE_PROCESSING_BATCH_SIZE && this.treeProcessingQueue.length > 0; i++) {
            const tree = this.treeProcessingQueue.shift()
            treesToProcess.push(tree)
            batchPromises.push(searchPath(startX, startY, tree.x, tree.y))
        }

        const paths = await Promise.all(batchPromises)

        paths.forEach((path, index) => {
            const tree = treesToProcess[index]
            if (path?.length > 0) {
                this.nearbyTrees.push({
                    x: tree.x,
                    y: tree.y,
                    pathDistance: path.length,
                    pathWeight: path.reduce((sum, node) => sum + node.weight, 0)
                })
            }
        })
        
        // Re-sort and trim the list after processing the batch
        this.sortTreesByPathQuality()
        
        // Process next batch after a delay
        setTimeout(() => this.processNextTreeInQueue(), TREE_PROCESSING_DELAY)
    }


    /**
     * Get the next available tree for harvesting
     * @returns {Object|null} The next tree to harvest or null if none available
     */
    getNextHarvestableTree() {
        // Return the first valid tree in the list
        for (let i = 0; i < this.nearbyTrees?.length; i++) {
            const tree = this.nearbyTrees[i]
            // Verify the tree still exists and harvestable
            if (gameState.map[tree.x][tree.y].type === 'TREE' && gameState.map[tree.x][tree.y].lifeRemaining > 0) {
                return tree
            } else {
                this.removeTree(tree)
            }
        }
        
        // No valid trees found
        return null
    }

    /**
     * Remove a tree from the nearbyTrees list
     * @param {Object} tree - The tree to remove
     */
    async removeTree(tree) {
        // Remove from current trees list
        this.nearbyTrees = this.nearbyTrees.filter(t => 
            !(t.x === tree.x && t.y === tree.y)
        )

        // Also remove from processing queue if it's there
        this.treeProcessingQueue = this.treeProcessingQueue.filter(t => 
            !(t.x === tree.x && t.y === tree.y)
        )

        // Update the available trees in background
        setTimeout(() => this.findAndOrderNearbyTrees(), 40)
    }

    /**
     * Find a nearby regular worker to convert
     */
    async findWorkerToConvert() {
        if (!this.owner) return

        const regularWorker = this.assignedWorkers.find(unit => unit instanceof Peon)
        if(regularWorker) {
            const d = distance(
                regularWorker.currentNode, this
            )

            if (d < 2) {
                this.convertingWorker = regularWorker
            } else {
                this.convertingWorker = null
                this.productionTimer = 0
            }
            return
        }

        // Get all the owner's regular workers, and sort by geometric distance for initial filtering
        const regularWorkers = this.owner.getUnits()
            .filter(unit => unit instanceof Peon && unit.task !== 'assigned' && !(unit instanceof LumberjackWorker))
            .map(worker => ({ worker, dist: distance(worker.currentNode, this) }))
            .sort((a, b) => a.dist - b.dist)
            .slice(0, 5) // Consider only the 5 closest peons for pathfinding
            .map(item => item.worker)

        // Find the closest worker
        let closestWorker = null
        let closestDistance = Infinity
        let shortestPath = null

        for (const worker of regularWorkers) {
            const path = await searchPath(
                worker.currentNode.x, 
                worker.currentNode.y,
                this.x,
                this.y
              )
            
            if (path?.length < closestDistance && worker.task !== 'assigned') {
                closestDistance = path.length
                shortestPath = path
                closestWorker = worker
            }
        }

         // If we found a close worker
        if(closestWorker && closestWorker.task !== 'assigned') {
            // Move the worker to the building
            closestWorker.assignPath(shortestPath)
            this.assignedWorkers.push(closestWorker)
        }
    }

    /**
     * Complete worker conversion
     */
    completeWorkerConversion() {
        if (!this.convertingWorker || !this.owner) return

        // Create a lumberjack's worker
        const lumberjackWorker = this.owner.addLumberjackWorker(
            this.convertingWorker.currentNode.x,
            this.convertingWorker.currentNode.y,
            this
        )

        // Remove the regular worker
        const assignedWorkerIndex = this.assignedWorkers.indexOf(this.convertingWorker)
        if (assignedWorkerIndex > -1) {
            this.assignedWorkers.splice(assignedWorkerIndex, 1)
        }
        const workerIndex = this.owner.units.indexOf(this.convertingWorker)
        if (workerIndex > -1) {
            this.owner.units.splice(workerIndex, 1)
        }
    }
}

/**
 * Quarry building for stone extraction
 * Converts regular idle workers to specialized quarry miners
 * Identifies mineable rocks in the vicinity and assigns workers to them
 */
class Quarry extends WorkerBuilding {
  constructor(x, y, color, owner) {
      super(x, y, color, owner)
      this.type = Building.TYPES.QUARRY
      this.life = 150
      this.maxLife = 150

      this.maxWorkers = 1
  }

  /**
   * Update building state and convert workers
   */
  async update(delay) {
      super.update(delay)

      this.assignedWorkers = this.assignedWorkers.filter(unit => unit.life > 0)

      // If we're not at max capacity and not already converting
      if (this.assignedWorkers.filter(unit => unit instanceof QuarryMiner).length < this.maxWorkers && !this.convertingWorker) {
          // Look for nearby workers to convert
          await this.findWorkerToConvert()
      }

      // If we're converting a worker
      if (this.convertingWorker) {
          this.productionTimer += delay
          
          // Check if conversion is complete
          if (this.productionTimer >= this.productionCooldown) {
              this.completeWorkerConversion()
              this.productionTimer = 0
              this.convertingWorker = null
          }
      }
  }

  /**
   * Find a nearby regular worker to convert
   */
  async findWorkerToConvert() {
      if (!this.owner) return

      const regularWorker = this.assignedWorkers.find(unit => unit instanceof Peon)
      if(regularWorker) {
          const d = distance(
              regularWorker.currentNode, this
          )

          if (d < 2) {
              this.convertingWorker = regularWorker
          } else {
              this.convertingWorker = null
              this.productionTimer = 0
          }
          return
      }

      // Get all the owner's regular workers, and sort by geometric distance for initial filtering
      const regularWorkers = this.owner.getUnits()
          .filter(unit => unit instanceof Peon && unit.task !== 'assigned' && !(unit instanceof QuarryMiner))
          .map(worker => ({ worker, dist: distance(worker.currentNode, this) }))
          .sort((a, b) => a.dist - b.dist)
          .slice(0, 5) // Consider only the 5 closest peons for pathfinding
          .map(item => item.worker)

      // Find the closest worker
      let closestWorker = null
      let closestDistance = Infinity
      let shortestPath = null

      for (const worker of regularWorkers) {
          const path = await searchPath(
              worker.currentNode.x, 
              worker.currentNode.y,
              this.x,
              this.y
            )
          
          if (path?.length < closestDistance && worker.task !== 'assigned') {
              closestDistance = path.length
              shortestPath = path
              closestWorker = worker
          }
      }

      // If we found a close worker
      if(closestWorker && closestWorker.task !== 'assigned') {
          // Move the worker to the building
          closestWorker.assignPath(shortestPath)
          this.assignedWorkers.push(closestWorker)
      }
  }

  /**
   * Complete worker conversion
   */
  completeWorkerConversion() {
      if (!this.convertingWorker || !this.owner) return

      // Create a quarry miner
      const quarryMiner = this.owner.addQuarryMiner(
          this.convertingWorker.currentNode.x,
          this.convertingWorker.currentNode.y,
          this
      )

      // Remove the regular worker
      const assignedWorkerIndex = this.assignedWorkers.indexOf(this.convertingWorker)
      if (assignedWorkerIndex > -1) {
          this.assignedWorkers.splice(assignedWorkerIndex, 1)
      }
      const workerIndex = this.owner.units.indexOf(this.convertingWorker)
      if (workerIndex > -1) {
          this.owner.units.splice(workerIndex, 1)
      }
  }
}

/**
 * Well building for water collection
 * Converts regular idle workers to specialized water carriers
 * Identifies water sources in the vicinity and assigns workers to them
 */
class Well extends WorkerBuilding {
  constructor(x, y, color, owner) {
    super(x, y, color, owner)
    this.type = Building.TYPES.WELL
    this.life = 150
    this.maxLife = 150

    this.maxWorkers = 1
  }

  /**
   * Update building state and convert workers
   */
  async update(delay) {
    super.update(delay)

    this.assignedWorkers = this.assignedWorkers.filter(unit => unit.life > 0)

    // If we're not at max capacity and not already converting
    if (this.assignedWorkers.filter(unit => unit instanceof WaterCarrier).length < this.maxWorkers && !this.convertingWorker) {
      // Look for nearby workers to convert
      await this.findWorkerToConvert()
    }

    // If we're converting a worker
    if (this.convertingWorker) {
      this.productionTimer += delay
      
      // Check if conversion is complete
      if (this.productionTimer >= this.productionCooldown) {
        this.completeWorkerConversion()
        this.productionTimer = 0
        this.convertingWorker = null
      }
    }
  }

  /**
   * Find a nearby regular worker to convert
   */
  async findWorkerToConvert() {
    if (!this.owner) return

    const regularWorker = this.assignedWorkers.find(unit => unit instanceof Peon)
    if(regularWorker) {
      const d = distance(
        regularWorker.currentNode, this
      )

      if (d < 2) {
        this.convertingWorker = regularWorker
      } else {
        this.convertingWorker = null
        this.productionTimer = 0
      }
      return
    }

    // Get all the owner's regular workers, and sort by geometric distance for initial filtering
    const regularWorkers = this.owner.getUnits()
        .filter(unit => unit instanceof Peon && unit.task !== 'assigned' && !(unit instanceof WaterCarrier))
        .map(worker => ({ worker, dist: distance(worker.currentNode, this) }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 5) // Consider only the 5 closest peons for pathfinding
        .map(item => item.worker)

    // Find the closest worker
    let closestWorker = null
    let closestDistance = Infinity
    let shortestPath = null

    for (const worker of regularWorkers) {
      const path = await searchPath(
        worker.currentNode.x, 
        worker.currentNode.y,
        this.x,
        this.y
      )
      
      if (path?.length < closestDistance && worker.task !== 'assigned') {
        closestDistance = path.length
        shortestPath = path
        closestWorker = worker
      }
    }

    // If we found a close worker
    if(closestWorker && closestWorker.task !== 'assigned') {
      // Move the worker to the building
      closestWorker.assignPath(shortestPath)
      this.assignedWorkers.push(closestWorker)
    }
  }

  /**
   * Complete worker conversion
   */
  completeWorkerConversion() {
    if (!this.convertingWorker || !this.owner) return

    // Create a water carrier
    const waterCarrier = this.owner.addWaterCarrier(
      this.convertingWorker.currentNode.x,
      this.convertingWorker.currentNode.y,
      this
    )

    // Remove the regular worker
    const assignedWorkerIndex = this.assignedWorkers.indexOf(this.convertingWorker)
    if (assignedWorkerIndex > -1) {
      this.assignedWorkers.splice(assignedWorkerIndex, 1)
    }
    const workerIndex = this.owner.units.indexOf(this.convertingWorker)
    if (workerIndex > -1) {
      this.owner.units.splice(workerIndex, 1)
    }
  }
}

/**
 * Gold mine building for gold extraction
 * Converts regular idle workers to specialized gold miners
 * Identifies gold deposits in the vicinity and assigns workers to them
 */
class GoldMine extends WorkerBuilding {
  constructor(x, y, color, owner) {
    super(x, y, color, owner)
    this.type = Building.TYPES.GOLD_MINE
    this.life = 150
    this.maxLife = 150

    this.maxWorkers = 1
  }

  /**
   * Update building state and convert workers
   */
  async update(delay) {
    super.update(delay)

    this.assignedWorkers = this.assignedWorkers.filter(unit => unit.life > 0)

    // If we're not at max capacity and not already converting
    if (this.assignedWorkers.filter(unit => unit instanceof GoldMiner).length < this.maxWorkers && !this.convertingWorker) {
      // Look for nearby workers to convert
      await this.findWorkerToConvert()
    }

    // If we're converting a worker
    if (this.convertingWorker) {
      this.productionTimer += delay
      
      // Check if conversion is complete
      if (this.productionTimer >= this.productionCooldown) {
        this.completeWorkerConversion()
        this.productionTimer = 0
        this.convertingWorker = null
      }
    }
  }

  /**
   * Find a nearby regular worker to convert
   */
  async findWorkerToConvert() {
    if (!this.owner) return

    const regularWorker = this.assignedWorkers.find(unit => unit instanceof Peon)
    if(regularWorker) {
      const d = distance(
        regularWorker.currentNode, this
      )

      if (d < 2) {
        this.convertingWorker = regularWorker
      } else {
        this.convertingWorker = null
        this.productionTimer = 0
      }
      return
    }

    // Get all the owner's regular workers, and sort by geometric distance for initial filtering
    const regularWorkers = this.owner.getUnits()
        .filter(unit => unit instanceof Peon && unit.task !== 'assigned' && !(unit instanceof GoldMiner))
        .map(worker => ({ worker, dist: distance(worker.currentNode, this) }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 5) // Consider only the 5 closest peons for pathfinding
        .map(item => item.worker)

    // Find the closest worker
    let closestWorker = null
    let closestDistance = Infinity
    let shortestPath = null

    for (const worker of regularWorkers) {
      const path = await searchPath(
        worker.currentNode.x, 
        worker.currentNode.y,
        this.x,
        this.y
      )
      
      if (path?.length < closestDistance && worker.task !== 'assigned') {
        closestDistance = path.length
        shortestPath = path
        closestWorker = worker
      }
    }

    // If we found a close worker
    if(closestWorker && closestWorker.task !== 'assigned') {
      // Move the worker to the building
      closestWorker.assignPath(shortestPath)
      this.assignedWorkers.push(closestWorker)
    }
  }

  /**
   * Complete worker conversion
   */
  completeWorkerConversion() {
    if (!this.convertingWorker || !this.owner) return

    // Create a gold miner
    const goldMiner = this.owner.addGoldMiner(
      this.convertingWorker.currentNode.x,
      this.convertingWorker.currentNode.y,
      this
    )

    // Remove the regular worker
    const assignedWorkerIndex = this.assignedWorkers.indexOf(this.convertingWorker)
    if (assignedWorkerIndex > -1) {
      this.assignedWorkers.splice(assignedWorkerIndex, 1)
    }
    const workerIndex = this.owner.units.indexOf(this.convertingWorker)
    if (workerIndex > -1) {
      this.owner.units.splice(workerIndex, 1)
    }
  }
}

/**
 * Barracks building for training soldiers
 */
class Barracks extends CombatBuilding {
  constructor(x, y, color, owner) {
    super(x, y, color, owner)
    this.type = Building.TYPES.BARRACKS
    this.life = 50
    this.maxLife = 50
    this.productionCooldown = 12000 // 12 seconds to train a soldier
  }

  /**
   * Produce a soldier unit
   */
  produceWarrior() {
    if (this.owner) {
      this.owner.addSoldier(this.x, this.y + 1)
    }
  }
}

/**
 * Armory building for training heavy infantry
 */
class Armory extends CombatBuilding {
  constructor(x, y, color, owner) {
    super(x, y, color, owner)
    this.type = Building.TYPES.ARMORY
    this.life = 150
    this.maxLife = 150
    this.productionCooldown = 20000 // 20 seconds to train heavy infantry
  }

  /**
   * Produce a heavy infantry unit
   */
  produceWarrior() {
    if (this.owner) {
      this.owner.addHeavyInfantry(this.x, this.y + 1)
    }
  }
}

/**
 * Citadel building for training elite warriors
 */
class Citadel extends CombatBuilding {
  constructor(x, y, color, owner) {
    super(x, y, color, owner)
    this.type = Building.TYPES.CITADEL
    this.life = 250
    this.maxLife = 250
    this.productionCooldown = 30000 // 30 seconds to train an elite warrior
  }

  /**
   * Produce an elite warrior unit
   */
  produceWarrior() {
    if (this.owner) {
      this.owner.addEliteWarrior(this.x, this.y + 1)
    }
  }
}

/**
 * Market building for selling resources
 */
class Market extends Building {
  constructor(x, y, color, owner) {
    super(x, y, color, owner)
    this.type = Building.TYPES.MARKET
    this.life = 100
    this.maxLife = 100
    this.productionCooldown = 10000 // Sell every 10 seconds
    this.indicatorColor = 0xFFA500 // Orange color for market
    this.sellingResource = 'wood' // Default resource to sell
    this.sellingPrice = 1 // Default price per unit
    this.showProgressIndicator = owner === gameState.humanPlayer
  }

  /**
   * Update building state and sell resources
   * @param {number} delay - Time elapsed since last update (ms)
   */
  update(delay) {
    super.update(delay)

    // Update production timer
    this.productionTimer += delay

    // Update progress for indicator
    this.progress = this.productionTimer / this.productionCooldown

    updateProgressIndicator(this, this.progress)
    
    // Check if it's time to sell resources
    if (this.productionTimer >= this.productionCooldown) {
      this.sellResources()
      this.productionTimer -= this.productionCooldown
      this.progress = 0 // Reset progress after selling
    }
  }

  /**
   * Sell resources to gain money
   */
  sellResources() {
    if (this.owner) {
      const resourceAmount = 1 // Sell 1 unit of resource at a time
      if (this.owner.getResources()[this.sellingResource] >= resourceAmount) {
        this.owner.addResource(this.sellingResource, -resourceAmount | 0)
        this.owner.addResource('money', this.sellingPrice * resourceAmount | 0)
      }
    }
  }
}