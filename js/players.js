export { AIs, Player, PlayerType }

'use strict'

import { MAP_HEIGHT, MAP_WIDTH, MAX_WEIGHT } from 'maps'
import { Unit } from 'unit'

const PlayerType = {
  HUMAN: 'human',
  AI: 'ai'
}

let AIs = []
let player

class Player {

  constructor(type = PlayerType.HUMAN) {
    this.type = type
    this.units = new Array()

    if(this.type === PlayerType.AI) {
      AIs.push(this)
      console.log(this)
    } else {
      player = this
    }
  }

  getUnits() {
    return this.units
  }

  update(delay, map) {
    if(Math.random() > 0.995 || (this.type === PlayerType.AI && this.getUnits().length === 0)) { // create a random unit
      let x = Math.random()*MAP_WIDTH | 0
      const y = this.type === PlayerType.HUMAN ? MAP_HEIGHT-1 : 0
      while(map[x][y].weight === MAX_WEIGHT) {
        x = Math.random()*MAP_WIDTH | 0
      }
      this.addUnit(x, y, map)
    }

    const enemies = this.type === PlayerType.HUMAN ? AIs.flatMap(ai => ai.getUnits()) : player.getUnits()
    
    for (var i = 0; i < this.getUnits().length; i++) {
      this.units[i].update(delay, enemies)
    }
    this.units = this.getUnits().filter(unit => unit.life > 0)

  }

  addUnit(x, y, map) {
    const enemies = this.type === PlayerType.HUMAN ? AIs.flatMap(ai => ai.getUnits()) : player.getUnits()
    this.units.push(
      new Unit(x, y, null, map, enemies)
    )
  }
}
