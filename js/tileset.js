'use strict'



import { DEBUG, backDrawn, drawBack, isDrawBackRequested, toggleDebug } from 'globals'
import { MAP_HEIGHT, MAP_WIDTH, MAX_WEIGHT } from 'maps'
import { bestFirstSearch } from 'pathfinding'
import { AIs, Player, PlayerType } from 'players'
import { loadSprites, offscreenSprite, sprites, SPRITE_SIZE, UNIT_SPRITE_SIZE } from 'sprites'
import { PerlinNoise } from 'utils'





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

const ZOOM = {
  FACTOR: 1.1,
  MAX: 1.4,
  MIN: 1,
  current: 1
}

// Worker
//const worker = new Worker("worker.js")
//const canvasWorker = backCanvas.transferControlToOffscreen()
//worker.postMessage({ canvas: canvasWorker }, [canvasWorker])


let mouse

const map = new Array(MAP_WIDTH).fill(null).map(() => new Array(MAP_HEIGHT).fill(null))

let canvasWidth = 0
let canvasHeight = 0
const desiredAspectRatio = MAP_WIDTH / MAP_HEIGHT
let dpr = globalThis.devicePixelRatio || 1

let elapsed = -5000, elapsedBack = -5000, elapsedUI = -5000, fps = new Array(50).fill(100)

let spriteCoords_Start = { x: 21, y: 5 }
let spriteCoords_End = { x: 22, y: 4 }
let spriteCoords_Path = { x: 22, y: 5 }
let spriteCoords_Mouse = { x: 21, y: 4 }


let player
let timings = new Array(50).fill(10), drawMainTimings = new Array(50).fill(10)


// const generateMap = async () => {
//   for (var x = 0; x < MAP_WIDTH; x++) {
//     for (var y= 0; y < MAP_HEIGHT; y++) {
//       const random = Math.random()
//       /*if(y === 0 && random > 0.85) {
//         map[x][y] = { // End
//           weight: -2,
//           sprite: offscreenSprite(sprites[spriteCoords_End.x][spriteCoords_End.y], SPRITE_SIZE),
//           back: offscreenSprite(sprites[Math.random()*3 | 0][Math.random()*3 | 0], SPRITE_SIZE)
//         }
//         enemies.push({x: x, y: y})
//       } else */if(random > 0.25) {
//         map[x][y] = { // Grass
//           weight: 1,
//           sprite: offscreenSprite(sprites[Math.random()*3 | 0][Math.random()*3 | 0], SPRITE_SIZE),
//           back: null
//         }
//       } else if(random < 0.02) {
//         map[x][y] = { // Rock
//           weight: MAX_WEIGHT,
//           sprite: offscreenSprite(sprites[Math.random()*2 | 0][26], SPRITE_SIZE),
//           back: offscreenSprite(sprites[Math.random()*3 | 0][Math.random()*3 | 0], SPRITE_SIZE)
//         }
//       } else {
//         map[x][y] = { // Tree + Grass
//           weight: MAX_WEIGHT,
//           sprite: offscreenSprite(sprites[Math.random()*2+2 | 0][Math.random()*2+26 | 0], SPRITE_SIZE),
//           back: offscreenSprite(sprites[Math.random()*3 | 0][Math.random()*3 | 0], SPRITE_SIZE)
//         }
//       }
//     }
//   }
// }

const generateMap = async () => {
  const noise = new PerlinNoise(Math.random())
  
  const TERRAIN_TYPES = {
    WATER: { type: 'WATER', weight: MAX_WEIGHT, spriteRange: { x: [0, 0], y: [17, 17] } },
    ROCK: { type: 'ROCK', weight: MAX_WEIGHT, spriteRange: { x: [0, 1], y: [26, 26] } },
    TREE: { type: 'TREE', weight: MAX_WEIGHT, spriteRange: { x: [2, 3], y: [26, 27] } },
    GRASS: { type: 'GRASS', weight: 1, spriteRange: { x: [0, 2], y: [0, 2] } },
    SAND: { type: 'SAND', weight: 1, spriteRange: { x: [3, 3], y: [3, 3] } },
  }

  const NOISE_SCALE = 0.175; // Controls terrain smoothness
  const TERRAIN_THRESHOLD = {
    WATER: 0.33,
    ROCK: 0.34,
    TREE_NEXT_TO_WATER: 0.35,
    GRASS_NEXT_TO_WATER: 0.45,
    SAND: 0.47,
    GRASS: 0.56,
    TREE: 1,
  }

  for (let x = 0; x < MAP_WIDTH; x++) {
    for (let y = 0; y < MAP_HEIGHT; y++) {
        const noiseValue = (noise.noise(x * NOISE_SCALE, y * NOISE_SCALE) + 1) / 2
        
        let terrainType = TERRAIN_TYPES.GRASS

        if (noiseValue < TERRAIN_THRESHOLD.WATER) terrainType = TERRAIN_TYPES.WATER
        else if (noiseValue < TERRAIN_THRESHOLD.ROCK) terrainType = TERRAIN_TYPES.ROCK
        else if (noiseValue < TERRAIN_THRESHOLD.TREE_NEXT_TO_WATER) terrainType = TERRAIN_TYPES.TREE
        else if (noiseValue < TERRAIN_THRESHOLD.GRASS_NEXT_TO_WATER) terrainType = TERRAIN_TYPES.GRASS
        else if (noiseValue < TERRAIN_THRESHOLD.SAND) terrainType = TERRAIN_TYPES.SAND
        else if (noiseValue < TERRAIN_THRESHOLD.GRASS) terrainType = TERRAIN_TYPES.GRASS
        else if (noiseValue < TERRAIN_THRESHOLD.TREE) terrainType = TERRAIN_TYPES.TREE

          // Randomize sprite within the terrain type's sprite range
          // const spriteX = Math.floor(Math.random() * 
          //     (terrainType.spriteRange.x[1] - terrainType.spriteRange.x[0] + 1)) + 
          //     terrainType.spriteRange.x[0]
          // const spriteY = Math.floor(Math.random() * 
          //     (terrainType.spriteRange.y[1] - terrainType.spriteRange.y[0] + 1)) + 
          //     terrainType.spriteRange.y[0]

          map[x][y] = {
              type: terrainType.type,
              weight: terrainType.weight,
              // sprite: offscreenSprite(sprites[spriteX][spriteY], SPRITE_SIZE),
              // back: (terrainType !== TERRAIN_TYPES.GRASS) 
              //     ? offscreenSprite(sprites[Math.floor(Math.random() * 3)][Math.floor(Math.random() * 3)], SPRITE_SIZE) 
              //     : null
          }
      }
  }
}

const assignSpritesOnMap = async () => {
  // Terrain type parameters
  const TERRAIN_TYPES = {
    WATER: { type: 'WATER', spriteRange: { x: [0, 0], y: [17, 17] } },
    ROCK: { type: 'ROCK', spriteRange: { x: [0, 1], y: [26, 26] } },
    TREE: { type: 'TREE', spriteRange: { x: [2, 3], y: [26, 27] } },
    GRASS: { type: 'GRASS', spriteRange: { x: [0, 2], y: [0, 2] } },
    SAND: { type: 'SAND', spriteRange: { x: [3, 3], y: [3, 3] } },
  }

  for (let x = 0; x < MAP_WIDTH; x++) {
    for (let y = 0; y < MAP_HEIGHT; y++) {
      const terrainType = TERRAIN_TYPES[map[x][y].type]
      const grassSprite =
        sprites[
          Math.floor(Math.random() * (TERRAIN_TYPES.GRASS.spriteRange.x[1] - TERRAIN_TYPES.GRASS.spriteRange.x[0] + 1)) +
            TERRAIN_TYPES.GRASS.spriteRange.x[0]
        ][
          Math.floor(Math.random() * (TERRAIN_TYPES.GRASS.spriteRange.y[1] - TERRAIN_TYPES.GRASS.spriteRange.y[0] + 1)) +
            TERRAIN_TYPES.GRASS.spriteRange.y[0]
        ]
      let spriteX, spriteY
      switch (map[x][y].type) {
        case TERRAIN_TYPES.GRASS.type:
          spriteX = Math.floor(Math.random() * 
              (terrainType.spriteRange.x[1] - terrainType.spriteRange.x[0] + 1)) + 
              terrainType.spriteRange.x[0]
          spriteY = Math.floor(Math.random() * 
              (terrainType.spriteRange.y[1] - terrainType.spriteRange.y[0] + 1)) + 
              terrainType.spriteRange.y[0]
          map[x][y].sprite = offscreenSprite(sprites[spriteX][spriteY], SPRITE_SIZE)
          break;
        case TERRAIN_TYPES.TREE.type:
          spriteX = Math.floor(Math.random() * 
              (terrainType.spriteRange.x[1] - terrainType.spriteRange.x[0] + 1)) + 
              terrainType.spriteRange.x[0]
          spriteY = Math.floor(Math.random() * 
              (terrainType.spriteRange.y[1] - terrainType.spriteRange.y[0] + 1)) + 
              terrainType.spriteRange.y[0]
          map[x][y].sprite = offscreenSprite(sprites[spriteX][spriteY], SPRITE_SIZE)
          map[x][y].back = offscreenSprite(grassSprite, SPRITE_SIZE)
          break;
        case TERRAIN_TYPES.ROCK.type:
          spriteX = Math.floor(Math.random() * 
              (terrainType.spriteRange.x[1] - terrainType.spriteRange.x[0] + 1)) + 
              terrainType.spriteRange.x[0]
          spriteY = Math.floor(Math.random() * 
              (terrainType.spriteRange.y[1] - terrainType.spriteRange.y[0] + 1)) + 
              terrainType.spriteRange.y[0]
          map[x][y].sprite = offscreenSprite(sprites[spriteX][spriteY], SPRITE_SIZE)
          map[x][y].back = offscreenSprite(grassSprite, SPRITE_SIZE)
          break;
        case TERRAIN_TYPES.SAND.type:
          spriteX = Math.floor(Math.random() * 
              (terrainType.spriteRange.x[1] - terrainType.spriteRange.x[0] + 1)) + 
              terrainType.spriteRange.x[0]
          spriteY = Math.floor(Math.random() * 
              (terrainType.spriteRange.y[1] - terrainType.spriteRange.y[0] + 1)) + 
              terrainType.spriteRange.y[0]
          map[x][y].sprite = offscreenSprite(sprites[spriteX][spriteY], SPRITE_SIZE)
          break;
        case TERRAIN_TYPES.WATER.type:
          spriteX = Math.floor(Math.random() * 
              (terrainType.spriteRange.x[1] - terrainType.spriteRange.x[0] + 1)) + 
              terrainType.spriteRange.x[0]
          spriteY = Math.floor(Math.random() * 
              (terrainType.spriteRange.y[1] - terrainType.spriteRange.y[0] + 1)) + 
              terrainType.spriteRange.y[0]
          map[x][y].sprite = offscreenSprite(sprites[spriteX][spriteY], SPRITE_SIZE)
          break;
        default:
          break;
      }
    }
  }
}

const isMapCorrect = () => {
  let isValid = true
  for (let i = 0; i < MAP_WIDTH; i++) {
    if(map[i][MAP_HEIGHT-1].weight < MAX_WEIGHT) {
      for (let j = 0; j < MAP_WIDTH; j++) {
        if(map[j][0].weight < MAX_WEIGHT) {
          isValid = bestFirstSearch(map, i, MAP_HEIGHT-1, j, 0)?.length > 0
          if(isValid === false) return isValid
        }
      }
    }
  }
  return isValid
}

const drawMain = async () => {
  const start = performance.now()
  offCtx1.clearRect(0, 0, mainCanvas.width, mainCanvas.height)
  AIs.flatMap(ai => ai.getUnits()).forEach((unit) => {
    // Display the unit
    offCtx1.drawImage(unit.sprite, Math.round(unit.x - UNIT_SPRITE_SIZE/4), Math.round(unit.y - UNIT_SPRITE_SIZE/4 - 2))
  })
  player.getUnits().forEach((unit) => {
    // Display the unit
    offCtx1.drawImage(unit.sprite, Math.round(unit.x - UNIT_SPRITE_SIZE/4), Math.round(unit.y - UNIT_SPRITE_SIZE/4 - 2))
  })
  mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height)
  mainCtx.drawImage(offCanvas1, 0, 0, mainCanvas.width, mainCanvas.height)

  drawMainTimings.push((performance.now() - start) | 0)
  drawMainTimings.shift()
  if(Math.random() > 0.99) console.log(`DrawMainTiming: ${(drawMainTimings.reduce((res, curr) => res + curr, 0) / drawMainTimings.length).toFixed(1)}ms`)
}


const drawBackground = async () => {
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
    player.getUnits().forEach((unit, i) => {
      for (var i = 1; i < (unit.path || []).length; i++) {
        offCtx1.drawImage(offscreenSprite(sprites[spriteCoords_Path.x][spriteCoords_Path.y], SPRITE_SIZE), unit.path[i].x * SPRITE_SIZE, unit.path[i].y * SPRITE_SIZE)
      }
    })
    backCtx.drawImage(offCanvas1, 0, 0, mainCanvas.width, mainCanvas.height)
  }

  backDrawn()
}

const ui = async () => {
  // Draw a sprite following mouse position
  offCtx1.clearRect(0, 0, uiCanvas.width, uiCanvas.height)
  //offCtx1.drawImage(mouse.sprite, mouse.x * SPRITE_SIZE, mouse.y * SPRITE_SIZE)
  offCtx1.drawImage(mouse.sprite, mouse.xPixels - 9/2, mouse.yPixels - 9/2)
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


  const now = performance.now()
  const delay = now - elapsed
  elapsed = now


  // Back Map
  if(isDrawBackRequested && now - elapsedBack > 50) {
    elapsedBack = now
    drawBackground()
  }



  // UI
  if(mouse?.clicked) {
    mouse.clicked = false
    if(map[mouse.x] && map[mouse.x][mouse.y]?.weight < 10) {
      player.addWorker(mouse.x, mouse.y, map)
    }
  }

  if(mouse?.zoomChanged) {
    updateZoom()
  }

  if(mouse?.needUpdate || (DEBUG && now - elapsedUI > 500)) {
    ui()
    elapsedUI = now
  }

  if(delay) {
    fps.push(delay)
    fps.shift()
  }


  // Game
  // Update units
  player.update(delay, map)
  for (const ai of AIs) {
    ai.update(delay, map)
  }
  

  drawMain()

  
  requestAnimationFrame(gameLoop)
  timings.push((performance.now() - elapsed) | 0)
  timings.shift()
  if(Math.random() > 0.99) console.log(`GameLoopTiming: ${(timings.reduce((res, curr) => res + curr, 0) / timings.length).toFixed(1)}ms`)
}

const updateZoom = () => {
  let scale = 1 + mouse.scaleFactor - ZOOM.current

  if(mouse.scaleFactor === ZOOM.MIN) {
    mainCtx.resetTransform()
    backCtx.resetTransform()
    uiCtx.resetTransform()
    offCtx1.resetTransform()
    offCtx2.resetTransform()

    // mouse.offsetX = 0
    // mouse.offsetY = 0
  } else {
    mainCtx.setTransform(mouse.scaleFactor, 0, 0, mouse.scaleFactor, mouse.offsetX, mouse.offsetY)
    backCtx.setTransform(mouse.scaleFactor, 0, 0, mouse.scaleFactor, mouse.offsetX, mouse.offsetY)
    uiCtx.setTransform(mouse.scaleFactor, 0, 0, mouse.scaleFactor, mouse.offsetX, mouse.offsetY)
    offCtx1.setTransform(mouse.scaleFactor, 0, 0, mouse.scaleFactor, mouse.offsetX, mouse.offsetY)
    offCtx2.setTransform(mouse.scaleFactor, 0, 0, mouse.scaleFactor, mouse.offsetX, mouse.offsetY)
  }
  
  drawBack()
  mouse.zoomChanged = false
  ZOOM.current = mouse.scaleFactor
  console.log(scale, mouse.scaleFactor)
}

document.getElementById('debugButton').addEventListener('click', () => {
  toggleDebug()
  drawBack()

  if(!DEBUG) document.getElementById('stats').innerHTML = null
})

// the real "main" of the game
onload = async (e) => {
  await onresize()

  const font = new FontFace('Jacquarda-Bastarda-9', `url('assets/fonts/Jacquarda-Bastarda-9.woff2')`)
  console.log('Loading font: ' + font.family)
  const fontLoaded = await font.load()
  console.log('Font loaded !')
  document.fonts.add(font)
  console.log('Display elements ...')
  for (let i = 0; i < document.querySelectorAll('.font-to-load').length; i++) {
    const element = document.querySelectorAll('.font-to-load')[i];
    setTimeout(() => element.classList.remove('font-to-load'), i * 750 + 250)
  }
  //document.querySelectorAll('.font-to-load').forEach((element, i) => setTimeout(() => element.classList.remove('font-to-load'), i * 400 + 200))

  // Load all the stuff
  await loadSprites()

  

  const mouseModule = await import('mouse')
  mouse = new mouseModule.Mouse()
  await mouse.initMouse(uiCanvas, SPRITE_SIZE)

  player = new Player(PlayerType.HUMAN)
  new Player(PlayerType.AI)
  

  do {
    await generateMap()
  } while(isMapCorrect() === false)
  
  assignSpritesOnMap()

  // Smoothly remove the splashscreen and launch the game
  setTimeout(() => {
    document.getElementById('gameName').style.opacity = 0
    document.getElementById('progressBar').style.opacity = 0
  }, 1000)
  setTimeout(() => {
    gameLoop()
    document.getElementById('gameName').style.display = 'none'
    document.getElementById('progressBar').style.display = 'none'
    document.getElementById('debugButton').style.display = 'block'
  }, 1500)
}



window.onrotate = window.onresize = async () => {
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

  // Device Pixel Ratio (DPR)
  dpr = globalThis.devicePixelRatio || 1; // Fallback for older browsers
  mainCanvas.width = backCanvas.width = uiCanvas.width = offCanvas1.width = offCanvas2.width = MAP_WIDTH * SPRITE_SIZE // * dpr
  mainCanvas.height = backCanvas.height = uiCanvas.height = offCanvas1.height = offCanvas2.height = MAP_HEIGHT * SPRITE_SIZE //  * dpr

  // To ensure proper scaling (no blurriness), scale the context
  // mainCtx.scale(dpr, dpr)
  // backCtx.scale(dpr, dpr)
  // uiCtx.scale(dpr, dpr)
  // offCtx1.scale(dpr, dpr)
  // offCtx2.scale(dpr, dpr)

  console.log('DPR: ' + dpr)

  // Now, update your canvas to fit the screen visually (CSS pixels)
  mainCanvas.style.width = backCanvas.style.width = uiCanvas.style.width = `${canvasWidth}px`
  mainCanvas.style.height = backCanvas.style.height = uiCanvas.style.height = `${canvasHeight}px`

  // disable smoothing on image scaling
  mainCtx.imageSmoothingEnabled = backCtx.imageSmoothingEnabled = uiCtx.imageSmoothingEnabled = offCtx1.imageSmoothingEnabled = offCtx2.imageSmoothingEnabled = false

  drawBack()

  // fix key events not received on itch.io when game loads in full screen
  window.focus()
}
