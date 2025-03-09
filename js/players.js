export { Player, PlayerType }

'use strict'

import gameState, { EventSystem } from 'state'
import { HumanSoldier, Worker } from 'unit'

const PlayerType = {
  HUMAN: 'human',
  AI: 'ai'
}

class Player {
  constructor(type = PlayerType.HUMAN) {

    this.type = type
    this.units = new Array()
    this.buildings = new Array()

    this.resources = {
      wood: 10,
      water: 0,
      gold: 0,
      money: 0,
      stone: 0,
      population: 0
    }

    if(this.isHuman()) {
      gameState.humanPlayer = this
    } else {
      gameState.addAiPlayer(this)
    }

    this.events = new EventSystem()
  }

  getUnits() {
    return this.units
  }

  getBuildings() {
    return this.buildings
  }

  getColor() {
    return this.isHuman() ? 'cyan' : 'red'
  }

  isHuman() {
    return this.type === PlayerType.HUMAN
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

  update(delay) {
    // Update all buildings
    for (let i = 0; i < this.getBuildings().length; i++) {
      this.buildings[i].update(delay)
    }

    const enemies = this.isHuman() ? 
      gameState.aiPlayers.flatMap(ai => ai.getUnits()) : 
      gameState.humanPlayer.getUnits()
    
    for (let i = 0; i < this.getUnits().length; i++) {
      this.units[i].update(delay, enemies)
    }

    this.units = this.getUnits().filter(unit => unit.life > 0)
    this.buildings = this.getBuildings().filter(building => building.health > 0)
  }

  addWorker(x, y) {
    const enemies = this.isHuman() ? 
      gameState.aiPlayers.flatMap(ai => ai.getUnits()) : 
      gameState.humanPlayer.getUnits()
    
    this.units.push(
      new Worker(x, y, this.getColor(), enemies)
    )
  }

  addHumanSoldier(x, y) {
    const enemies = this.isHuman() ? 
      gameState.aiPlayers.flatMap(ai => ai.getUnits()) : 
      gameState.humanPlayer.getUnits()
    
    this.units.push(
      new HumanSoldier(x, y, this.getColor(), enemies)
    )
  }
}