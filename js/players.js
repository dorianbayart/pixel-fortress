export { Player, PlayerType }

'use strict'

import { MAP_HEIGHT, MAP_WIDTH, MAX_WEIGHT } from 'maps'
import gameState from 'state'
import { HumanSoldier, Worker } from 'unit'

const PlayerType = {
  HUMAN: 'human',
  AI: 'ai'
}

class Player {
  constructor(type = PlayerType.HUMAN) {
    this.type = type
    this.units = new Array()

    if(this.isHuman()) {
      gameState.humanPlayer = this
    } else {
      gameState.addAiPlayer(this)
    }
  }

  getUnits() {
    return this.units
  }

  getColor() {
    return this.isHuman() ? 'cyan' : 'red'
  }

  isHuman() {
    return this.type === PlayerType.HUMAN
  }

  update(delay, map) {
    if(Math.random() > 0.995 || (this.type === PlayerType.AI && this.getUnits().length === 0)) { // create a random unit
      let x = Math.random()*MAP_WIDTH | 0
      const y = this.isHuman() ? MAP_HEIGHT-1 : 0
      while(map[x][y].weight === MAX_WEIGHT) {
        x = Math.random()*MAP_WIDTH | 0
      }
      this.addHumanSoldier(x, y, map)
    }

    const enemies = this.isHuman() ? 
      gameState.aiPlayers.flatMap(ai => ai.getUnits()) : 
      gameState.humanPlayer.getUnits()
    
    for (var i = 0; i < this.getUnits().length; i++) {
      this.units[i].update(delay, map, enemies)
    }
    this.units = this.getUnits().filter(unit => unit.life > 0)
  }

  addWorker(x, y, map) {
    const enemies = this.isHuman() ? 
      gameState.aiPlayers.flatMap(ai => ai.getUnits()) : 
      gameState.humanPlayer.getUnits()
    
    this.units.push(
      new Worker(x, y, this.getColor(), map, enemies)
    )
  }

  addHumanSoldier(x, y, map) {
    const enemies = this.isHuman() ? 
      gameState.aiPlayers.flatMap(ai => ai.getUnits()) : 
      gameState.humanPlayer.getUnits()
    
    this.units.push(
      new HumanSoldier(x, y, this.getColor(), map, enemies)
    )
  }
}