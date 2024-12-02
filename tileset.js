'use script'

/****************/
/*  DEBUG MODE  */
/****************/
let DEBUG = false

const PI = Math.PI
const SPRITE_SIZE = 16, UNIT_SPRITE_SIZE = 32
const MAP_WIDTH = (globalThis.innerWidth > globalThis.innerHeight ? globalThis.innerWidth / SPRITE_SIZE : globalThis.innerHeight / SPRITE_SIZE) / 2 | 0
const MAP_HEIGHT = MAP_WIDTH * globalThis.innerHeight / globalThis.innerWidth | 0
const MAX_WEIGHT = 99999999

const MAX_SPEED = (globalThis.innerWidth > globalThis.innerHeight ? MAP_HEIGHT : MAP_WIDTH) / SPRITE_SIZE / 4

// Canvas
const backCanvas = document.getElementById('backCanvas')
const backCtx = backCanvas.getContext('2d')
const mainCanvas = document.getElementById('mainCanvas')
const mainCtx = mainCanvas.getContext('2d')
const uiCanvas = document.getElementById('uiCanvas')
const uiCtx = uiCanvas.getContext('2d')

// Off Canvas
const offCanvas1 = document.createElement('canvas')
const offCtx1 = offCanvas1.getContext('2d')
const offCanvas2 = document.createElement('canvas')
const offCtx2 = offCanvas2.getContext('2d')

// Worker
//const worker = new Worker("worker.js")
//const canvasWorker = backCanvas.transferControlToOffscreen()
//worker.postMessage({ canvas: canvasWorker }, [canvasWorker])


const map = new Array(MAP_WIDTH).fill(null).map(() => new Array(MAP_HEIGHT).fill(null))

let canvasWidth = 0
let canvasHeight = 0
const desiredAspectRatio = MAP_WIDTH / MAP_HEIGHT
let dpr = globalThis.devicePixelRatio || 1

let sprites, unitsSprites
let elapsed = elapsedBack = elapsedUI = -5000, fps = new Array(50).fill(100)
let isDrawBackRequested = true

let spriteCoords_Start = { x: 21, y: 5 }
let spriteCoords_End = { x: 22, y: 4 }
let spriteCoords_Path = { x: 22, y: 5 }
let spriteCoords_Mouse = { x: 21, y: 4 }

let units = []
let enemies = []

class Unit {
  constructor(x, y, sprite) {
    if(x >= 0) {
      this.x = x
    } else {
      this.x = Math.random()*MAP_WIDTH | 0
      while(map[this.x][MAP_HEIGHT-1].weight === MAX_WEIGHT) {
        this.x = Math.random()*MAP_WIDTH | 0
      }
    }
    this.x *= SPRITE_SIZE

    this.y = (y ?? MAP_HEIGHT-1) * SPRITE_SIZE
    this.currentNode = { x: this.x/SPRITE_SIZE, y: this.y/SPRITE_SIZE }
    this.nextNode = { x: this.x/SPRITE_SIZE, y: this.y/SPRITE_SIZE }
    this.nextNextNode = { x: this.x/SPRITE_SIZE, y: this.y/SPRITE_SIZE }
    this.spriteName = 'character-base'
    this.spriteTimer = 0
    this.sprite = offscreenSprite(sprite ?? unitsSprites[this.spriteName][unitsSpritesDescription[this.spriteName].static._0.s.x][unitsSpritesDescription[this.spriteName].static._0.s.y], UNIT_SPRITE_SIZE, `${this.spriteName}static_0s`)
    this.path = this.pathToNearestEnemy()
    this.lastMoveUpdate = 0
    this.lastPathUpdate = 0
    this.goal = null
    this.life = 1
    this.speed = 0.25 + (this.x + this.y + elapsed) % MAX_SPEED
  }

  update(delay) {
    const time = performance.now() | 0

    // Update Path
    if((this.currentNode.x === this.nextNode.x && this.currentNode.y === this.nextNode.y)) {
      if(time - this.lastPathUpdate > 4000) {
        this.lastPathUpdate = time

        this.path = this.pathToNearestEnemy()


      } else if(this.path?.length > 1) {
          this.path.splice(0, 1)
      }

      if(!this.path || this.path.length === 1) {
        this.life = 0
        isDrawBackRequested = true
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

      isDrawBackRequested ||= DEBUG
    }

    this.lastMoveUpdate = time
    this.move(Math.min(delay, 40))
  }

  pathToNearestEnemy() {
    let path, pathLength = MAP_WIDTH * MAP_HEIGHT
    enemies.forEach((enemy, i) => {
      const temp = bestFirstSearch(map, this.currentNode.x, this.currentNode.y, enemy.x, enemy.y)
      if(temp?.length < pathLength) {
        path = temp
        pathLength = path.length
        this.goal = enemy
      }
    })
    return path
  }

  move(delay) {
    const devX = ((this.nextNode.x * SPRITE_SIZE - this.x) * 2 + (this.nextNextNode.x * SPRITE_SIZE - this.x)) / 3
    const devY = ((this.nextNode.y * SPRITE_SIZE - this.y) * 2 + (this.nextNextNode.y * SPRITE_SIZE - this.y)) / 3
    const theta = Math.atan2(devY, devX)
    const vx = this.speed * (delay/1000) * Math.cos(theta)
    const vy = this.speed * (delay/1000) * Math.sin(theta)
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

const generateMap = () => {
  for (var x = 0; x < MAP_WIDTH; x++) {
    for (var y= 0; y < MAP_HEIGHT; y++) {
      const random = Math.random()
      if(y === 0 && random > 0.85) {
        map[x][y] = { // End
          weight: -2,
          sprite: offscreenSprite(sprites[spriteCoords_End.x][spriteCoords_End.y], SPRITE_SIZE),
          back: offscreenSprite(sprites[Math.random()*3 | 0][Math.random()*3 | 0], SPRITE_SIZE)
        }
        enemies.push({x: x, y: y})
      } else if(random > 0.25) {
        map[x][y] = { // Grass
          weight: 1,
          sprite: offscreenSprite(sprites[Math.random()*3 | 0][Math.random()*3 | 0], SPRITE_SIZE),
          back: null
        }
      } else if(random < 0.02) {
        map[x][y] = { // Rock
          weight: MAX_WEIGHT,
          sprite: offscreenSprite(sprites[Math.random()*2 | 0][26], SPRITE_SIZE),
          back: offscreenSprite(sprites[Math.random()*3 | 0][Math.random()*3 | 0], SPRITE_SIZE)
        }
      } else {
        map[x][y] = { // Tree + Grass
          weight: MAX_WEIGHT,
          sprite: offscreenSprite(sprites[Math.random()*2+2 | 0][Math.random()*2+26 | 0], SPRITE_SIZE),
          back: offscreenSprite(sprites[Math.random()*3 | 0][Math.random()*3 | 0], SPRITE_SIZE)
        }
      }
    }
  }
}

const drawMain = async () => {
  offCtx1.clearRect(0, 0, mainCanvas.width, mainCanvas.height)
  units.forEach((unit, i) => {
    // Display the unit
    offCtx1.drawImage(unit.sprite, Math.round(unit.x - UNIT_SPRITE_SIZE/4), Math.round(unit.y - UNIT_SPRITE_SIZE/4))
  })
  mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height)
  mainCtx.drawImage(offCanvas1, 0, 0, mainCanvas.width, mainCanvas.height)
}


const drawBack = async () => {
  offCtx1.clearRect(0, 0, mainCanvas.width, mainCanvas.height)
  offCtx2.clearRect(0, 0, mainCanvas.width, mainCanvas.height)

  for (let x = 0; x < MAP_WIDTH; x++) {
    for (let y = 0; y < MAP_HEIGHT; y++) {
      if(map[x][y].back) offCtx2.drawImage(map[x][y].back, x * SPRITE_SIZE, y * SPRITE_SIZE)
      offCtx1.drawImage(map[x][y].sprite, x * SPRITE_SIZE, y * SPRITE_SIZE)
    }
  }

  backCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height)
  backCtx.drawImage(offCanvas2, 0, 0, mainCanvas.width, mainCanvas.height)
  backCtx.drawImage(offCanvas1, 0, 0, mainCanvas.width, mainCanvas.height)

  if(DEBUG) { // Display paths of the all units
    offCtx1.clearRect(0, 0, mainCanvas.width, mainCanvas.height)
    units.forEach((unit, i) => {
      for (var i = 1; i < (unit.path || []).length; i++) {
        offCtx1.drawImage(offscreenSprite(sprites[spriteCoords_Path.x][spriteCoords_Path.y], SPRITE_SIZE), unit.path[i].x * SPRITE_SIZE, unit.path[i].y * SPRITE_SIZE)
      }
    })
    backCtx.drawImage(offCanvas1, 0, 0, mainCanvas.width, mainCanvas.height)
  }
}

const ui = async () => {
  offCtx1.clearRect(0, 0, uiCanvas.width, uiCanvas.height)
  offCtx1.drawImage(mouse.sprite, mouse.x * SPRITE_SIZE, mouse.y * SPRITE_SIZE)
  uiCtx.clearRect(0, 0, uiCanvas.width, uiCanvas.height)
  uiCtx.drawImage(offCanvas1, 0, 0, uiCanvas.width, uiCanvas.height)

  if(DEBUG) {
    document.getElementById('stats').innerHTML = null
    let div = document.createElement('div')
    div.innerHTML = `FPS: ${(1000 * fps.length / fps.reduce((res, curr) => res + curr, 0)).toFixed(1)}`
    document.getElementById('stats').appendChild(div)
    div = document.createElement('div')
    div.innerHTML = `Mouse: ${mouse.x}x${mouse.y}${mouse.isDragging ? ' | clic' : ''}`
    document.getElementById('stats').appendChild(div)
  }

  mouse.needUpdate = false
}

const gameLoop = () => {


  const now = performance.now() | 0
  const delay = now - elapsed
  elapsed = now


  // Back Map
  if(isDrawBackRequested && now - elapsedBack > 500) {
    isDrawBackRequested = false
    elapsedBack = now
    drawBack()
  }



 // UI
  if(mouse.clicked) {
    mouse.clicked = false
    if(map[mouse.x] && map[mouse.x][mouse.y]?.weight < 10) {
      units.push(new Unit(mouse.x, mouse.y))
    }
  }

  if(mouse.needUpdate || (DEBUG && now - elapsedUI > 500)) {
    ui()
    elapsedUI = now
  }

  if(delay) {
    fps.push(delay)
    fps.shift()
  }


  // Game
  // Update units
  for (var i = 0; i < units.length; i++) {
    units[i].update(delay)
  }
  units = units.filter(unit => unit.life)

  // Create new units if needed
  if(Math.random() > 0.985 || units.length === 0) {
    units.push(new Unit())
  }

  drawMain()

  requestAnimationFrame(gameLoop)
}


document.getElementById('debugButton').addEventListener('click', () => {
  DEBUG = !DEBUG
  isDrawBackRequested = true

  if(!DEBUG) document.getElementById('stats').innerHTML = null
})

// the real "main" of the game
onload = async (e) => {
  await onresize()

  sprites = await loadAndSplitImage('./assets/punyworld-overworld-tileset.png', SPRITE_SIZE)

  unitsSpritesDescription = await (await fetch('./assets/units/spriteDescription.json')).json()
  unitsSprites = {}
  let spritesToLoad = ['character-base']
  for(let sprite of spritesToLoad) {
    unitsSprites[sprite] = await loadAndSplitImage(unitsSpritesDescription[sprite]['relativeToRoot'], UNIT_SPRITE_SIZE)
  }


  // mouse = new Mouse()

  initMouseEvents(uiCanvas, SPRITE_SIZE)

  generateMap()

  // Smoothly remove the splashscreen and launch the game
  setTimeout(() => {
    document.getElementById('gameName').style.opacity = 0
    document.getElementById('progressBar').style.opacity = 0
  }, 2500)
  setTimeout(() => {
    gameLoop()
    document.getElementById('gameName').style.display = 'none'
    document.getElementById('progressBar').style.display = 'none'
  }, 2500 + 850)
}



onresize = onrotate = async () => {
  // Calculate new dimensions while maintaining aspect ratio
  const screenWidth = globalThis.innerWidth || 800
  const screenHeight = globalThis.innerHeight || 800
  const screenAspectRatio = screenWidth / screenHeight

  if (screenAspectRatio > desiredAspectRatio) {
      // Screen is wider than our aspect ratio, set height to match screen and calculate width
      canvasHeight = screenHeight
      canvasWidth = canvasHeight * desiredAspectRatio
  } else {
      // Screen is taller than our aspect ratio, set width to match screen and calculate height
      canvasWidth = screenWidth
      canvasHeight = canvasWidth / desiredAspectRatio
  }

  // Account for Device Pixel Ratio (DPR)
  dpr = globalThis.devicePixelRatio || 1; // Fallback for older browsers
  mainCanvas.width = backCanvas.width = uiCanvas.width = offCanvas1.width = offCanvas2.width = MAP_WIDTH * SPRITE_SIZE // * dpr
  mainCanvas.height = backCanvas.height = uiCanvas.height = offCanvas1.height = offCanvas2.height = MAP_HEIGHT * SPRITE_SIZE // * dpr

  // To ensure proper scaling (no blurriness), scale the context
  // mainCtx.scale(dpr, dpr)
  // backCtx.scale(dpr, dpr)
  // uiCtx.scale(dpr, dpr)
  // offCtx1.scale(dpr, dpr)
  // offCtx2.scale(dpr, dpr)

  // Now, update your canvas to fit the screen visually (CSS pixels)
  mainCanvas.style.width = backCanvas.style.width = uiCanvas.style.width = `${canvasWidth}px`
  mainCanvas.style.height = backCanvas.style.height = uiCanvas.style.height = `${canvasHeight}px`

  // disable smoothing on image scaling
  mainCtx.imageSmoothingEnabled = backCtx.imageSmoothingEnabled = uiCtx.imageSmoothingEnabled = offCtx1.imageSmoothingEnabled = offCtx2.imageSmoothingEnabled = false

  isDrawBackRequested = true

  // fix key events not received on itch.io when game loads in full screen
  window.focus()
};
