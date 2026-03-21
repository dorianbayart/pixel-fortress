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

export { initMapEditor, openMapEditor, closeMapEditor }

'use strict'

import CONSTANTS from 'constants'
import { playClickSound, playCloseSound, playConfirmSound } from 'audio'
import { t } from 'i18n'
import { PerlinNoise } from 'utils'

const TILE_SIZE = 16

// Palette swatch colors (also used as fallback when tileset hasn't loaded)
const TILE_COLORS = {
  GRASS: '#27ae60',
  SAND:  '#f39c12',
  WATER: '#66bce4',
  TREE:  '#1e8449',
  ROCK:  '#7f8c8d',
  GOLD:  '#f1c40f',
}

const PALETTE_TILES = ['GRASS', 'SAND', 'WATER', 'TREE', 'ROCK', 'GOLD']

// Tile types that sit on top of a base terrain (GRASS or SAND)
const OVERLAY_TYPES = new Set(['TREE', 'ROCK', 'GOLD'])

const START_ROLES = [
  { role: 'human', i18nKey: 'mapEditor.p1Start', color: '#4477ff' },
  { role: 'ai_1',  i18nKey: 'mapEditor.ai1',     color: '#ff4444' },
  { role: 'ai_2',  i18nKey: 'mapEditor.ai2',     color: '#aa44ff' },
  { role: 'ai_3',  i18nKey: 'mapEditor.ai3',     color: '#44ffcc' },
]

const BUILDING_DEFS = [
  { type: 'tent',        i18nKey: 'buildings.tent.name',        abbr: 'H',  color: '#888' },
  { type: 'lumberjack',  i18nKey: 'buildings.lumberjack.name',  abbr: 'L',  color: '#8b5e3c' },
  { type: 'goldMine',    i18nKey: 'buildings.goldMine.name',    abbr: 'G',  color: '#f1c40f' },
  { type: 'quarry',      i18nKey: 'buildings.quarry.name',      abbr: 'Q',  color: '#95a5a6' },
  { type: 'well',        i18nKey: 'buildings.well.name',        abbr: 'W',  color: '#3498db' },
  { type: 'barracks',    i18nKey: 'buildings.barracks.name',    abbr: 'B',  color: '#e74c3c' },
  { type: 'armory',      i18nKey: 'buildings.armory.name',      abbr: 'A',  color: '#c0392b' },
  { type: 'citadel',     i18nKey: 'buildings.citadel.name',     abbr: 'C',  color: '#8e44ad' },
  { type: 'market',      i18nKey: 'buildings.market.name',      abbr: 'M',  color: '#27ae60' },
  { type: 'tower',       i18nKey: 'buildings.tower.name',       abbr: 'T',  color: '#7f8c8d' },
  { type: 'bulletTower', i18nKey: 'buildings.bulletTower.name', abbr: 'BT', color: '#555' },
  { type: 'rapidTower',  i18nKey: 'buildings.rapidTower.name',  abbr: 'RT', color: '#444' },
  { type: 'sniperTower', i18nKey: 'buildings.sniperTower.name', abbr: 'ST', color: '#333' },
]

const OWNER_COLORS = {
  human: '#4477ff',
  ai_1:  '#ff4444',
  ai_2:  '#aa44ff',
  ai_3:  '#44ffcc',
}

const BUILDING_SPRITES = {
  tent:        './assets/buildings/tent.png',
  lumberjack:  './assets/buildings/axe.png',
  goldMine:    './assets/buildings/gold-mine.png',
  quarry:      './assets/buildings/pick.png',
  well:        './assets/buildings/well-1.png',
  barracks:    './assets/buildings/crossed-swords.png',
  armory:      './assets/buildings/shield.png',
  citadel:     './assets/buildings/fleur-de-lis.png',
  market:      './assets/buildings/balance.png',
  tower:       './assets/buildings/tower.png',
  bulletTower: './assets/buildings/tower-2.png',
  rapidTower:  './assets/buildings/tower.png',
  sniperTower: './assets/buildings/tower.png',
}

// ── Editor state ───────────────────────────────────────────────────────────────
let editorMap        = null  // editorMap[x][y] = { type: string }
let editorWidth      = 120
let editorHeight     = 60
let selectedTileType = 'GRASS'
let currentMapSize   = 'medium'
let mapName          = 'My Map'

// ── View state ─────────────────────────────────────────────────────────────────
let viewTransform     = { scale: 2, x: 0, y: 0 }
let isPainting        = false
let isPanning         = false
let panStart          = { x: 0, y: 0 }
let panTransformStart = { x: 0, y: 0 }
let lastPaintTile     = { x: -1, y: -1 }

// ── Canvas / rendering ─────────────────────────────────────────────────────────
let editorCanvas  = null
let ctx           = null
let tilesetImage  = null
let tilesetLoaded = false
let isEditorOpen  = false
let renderPending = false
let mapDirty      = false

// ── Overlay layer (start positions + pre-placed buildings) ─────────────────────
let editorOverlays = new Map()   // key: `${x},${y}` → overlay object

// ── Palette mode ───────────────────────────────────────────────────────────────
// paletteMode: 'terrain' | 'start' | 'building' | 'erase_overlay'
let paletteMode          = 'terrain'
let selectedStartRole    = 'human'
let selectedBuildingType = 'tent'
let selectedBuildingOwner = 'human'

// ── Custom confirm dialog ───────────────────────────────────────────────────────
let confirmDialogEl = null   // { overlay, msg }
let confirmCallback = null   // function called on OK

// ── Water animation ─────────────────────────────────────────────────────────────
let waterFrame        = 0
let waterAnimLastTime = 0
let animLoopRunning   = false
let goldTintedCanvas  = null

const buildingImages       = new Map()  // type → HTMLImageElement | null | 'error'
const paletteSwatchCanvases = new Map()  // key → <canvas>

// ─────────────────────────────────────────────────────────────────────────────
// Sprite selection helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Deterministic position-based hash for sprite randomisation */
function tileHash(x, y) {
  return ((x * 31 + y) ^ (x * 17 + y * 5)) & 0xFF
}

/** Random grass sprite: one of 9 variants across cols 0-2, rows 0-2 */
function getGrassSprite(x, y) {
  const h = tileHash(x, y)
  return [h % 3, (h >> 2) % 3]
}

/** Random tree sprite: one of 4 variants across cols 2-3, rows 26-27 */
function getTreeSprite(x, y) {
  const h = tileHash(x + 100, y + 100)
  // bit0 of tileHash is always 0 (parity cancels in XOR), use bits 1 and 2 instead
  return [2 + ((h >> 1) & 1), 26 + ((h >> 2) & 1)]
}

/** Water auto-tile – ported from getWaterSpriteCoordinates in mapGeneration.mjs */
function getWaterSpriteCoords(x, y) {
  const isWater = (nx, ny) => {
    if (nx < 0 || nx >= editorWidth || ny < 0 || ny >= editorHeight) return true
    return editorMap[nx]?.[ny]?.type === 'WATER'
  }

  const N = isWater(x, y - 1), S = isWater(x, y + 1)
  const E = isWater(x + 1, y), W = isWater(x - 1, y)
  const NE = isWater(x + 1, y - 1), NW = isWater(x - 1, y - 1)
  const SE = isWater(x + 1, y + 1), SW = isWater(x - 1, y + 1)

  let spriteX = 0, spriteY = 13

  if (N && S && E && W && NE && NW && SE && SW)          { spriteX = 8;  spriteY = 11 }
  else if (N && S && E && W && NW && SW && SE && !NE)    { spriteX = 11; spriteY = 10 }
  else if (N && S && E && W && NE && SE && SW && !NW)    { spriteX = 10; spriteY = 10 }
  else if (N && S && E && W && NE && NW && SW && !SE)    { spriteX = 11; spriteY = 11 }
  else if (N && S && E && W && NE && NW && SE && !SW)    { spriteX = 10; spriteY = 11 }
  else if (N && S && E && W && NE && SW && !NW && !SE)   { spriteX = 11; spriteY = 12 }
  else if (N && S && E && W && NW && SE && !NE && !SW)   { spriteX = 10; spriteY = 12 }
  else if (N && S && E && W && NE && NW && !SW && !SE)   { spriteX = 5;  spriteY = 12 }
  else if (N && S && E && W && NW && SW && !NE && !SE)   { spriteX = 6;  spriteY = 11 }
  else if (N && S && E && W && SE && SW && !NW && !NE)   { spriteX = 5;  spriteY = 10 }
  else if (N && S && E && W && NE && SE && !NW && !SW)   { spriteX = 4;  spriteY = 11 }
  else if (N && S && E && W && !NW && !SW && SE && !NE)  { spriteX = 4;  spriteY = 10 }
  else if (N && S && E && W && !NW && SW && !SE && !NE)  { spriteX = 6;  spriteY = 10 }
  else if (N && S && E && W && !NW && !SW && !SE && NE)  { spriteX = 4;  spriteY = 12 }
  else if (N && S && E && W && NW && !SW && !SE && !NE)  { spriteX = 6;  spriteY = 12 }
  else if (N && E && NE && !S && !W)                     { spriteX = 7;  spriteY = 12 }
  else if (N && W && NW && !S && !E)                     { spriteX = 9;  spriteY = 12 }
  else if (S && E && SE && !N && !W)                     { spriteX = 7;  spriteY = 10 }
  else if (S && W && SW && !N && !E)                     { spriteX = 9;  spriteY = 10 }
  else if (N && S && E && W)                             { spriteX = 2;  spriteY = 11 }
  else if (N && S && E && NE && SE && !W)                { spriteX = 7;  spriteY = 11 }
  else if (E && S && W && SE && SW && !N)                { spriteX = 8;  spriteY = 10 }
  else if (N && S && W && NW && SW && !E)                { spriteX = 9;  spriteY = 11 }
  else if (N && E && W && NE && NW && !S)                { spriteX = 8;  spriteY = 12 }
  else if (N && S && E && !W)                            { spriteX = 1;  spriteY = 11 }
  else if (E && S && W && !N)                            { spriteX = 2;  spriteY = 10 }
  else if (N && S && W && !E)                            { spriteX = 3;  spriteY = 11 }
  else if (N && E && W && !S)                            { spriteX = 2;  spriteY = 12 }
  else if (S && E && !N && !W)                           { spriteX = 1;  spriteY = 10 }
  else if (S && W && !N && !E)                           { spriteX = 3;  spriteY = 10 }
  else if (N && E && !S && !W)                           { spriteX = 1;  spriteY = 12 }
  else if (N && W && !S && !E)                           { spriteX = 3;  spriteY = 12 }
  else if (W && E && !N && !S)                           { spriteX = 2;  spriteY = 13 }
  else if (N && S && !W && !E)                           { spriteX = 0;  spriteY = 11 }
  else if (N && !S && !E && !W)                          { spriteX = 0;  spriteY = 12 }
  else if (S && !N && !E && !W)                          { spriteX = 0;  spriteY = 10 }
  else if (E && !N && !S && !W)                          { spriteX = 1;  spriteY = 13 }
  else if (W && !N && !S && !E)                          { spriteX = 3;  spriteY = 13 }

  return [spriteX, spriteY]
}

/** Sand auto-tile – ported from getSandSpriteCoordinates in mapGeneration.mjs */
function getSandSpriteCoords(x, y) {
  const isSand = (nx, ny) => {
    if (nx < 0 || nx >= editorWidth || ny < 0 || ny >= editorHeight) return true
    const t = editorMap[nx]?.[ny]
    return t?.type === 'SAND' || (OVERLAY_TYPES.has(t?.type) && t?.baseType === 'SAND')
  }

  const N = isSand(x, y - 1), S = isSand(x, y + 1)
  const E = isSand(x + 1, y), W = isSand(x - 1, y)
  const NE = isSand(x + 1, y - 1), NW = isSand(x - 1, y - 1)
  const SE = isSand(x + 1, y + 1), SW = isSand(x - 1, y + 1)

  let spriteX = 3, spriteY = 3

  if (N && S && E && W && NE && NW && SE && SW)          { spriteX = 11; spriteY = 1 }
  else if (N && S && E && W && NW && SW && SE && !NE)    { spriteX = 14; spriteY = 0 }
  else if (N && S && E && W && NE && SE && SW && !NW)    { spriteX = 13; spriteY = 0 }
  else if (N && S && E && W && NE && NW && SW && !SE)    { spriteX = 14; spriteY = 1 }
  else if (N && S && E && W && NE && NW && SE && !SW)    { spriteX = 13; spriteY = 1 }
  else if (N && S && E && W && NE && SW && !NW && !SE)   { spriteX = 14; spriteY = 2 }
  else if (N && S && E && W && NW && SE && !NE && !SW)   { spriteX = 13; spriteY = 2 }
  else if (N && S && E && W && NE && NW && !SW && !SE)   { spriteX = 8;  spriteY = 2 }
  else if (N && S && E && W && NW && SW && !NE && !SE)   { spriteX = 9;  spriteY = 1 }
  else if (N && S && E && W && SE && SW && !NW && !NE)   { spriteX = 8;  spriteY = 0 }
  else if (N && S && E && W && NE && SE && !NW && !SW)   { spriteX = 7;  spriteY = 1 }
  else if (N && E && NE && !S && !W)                     { spriteX = 10; spriteY = 2 }
  else if (N && W && NW && !S && !E)                     { spriteX = 12; spriteY = 2 }
  else if (S && E && SE && !N && !W)                     { spriteX = 10; spriteY = 0 }
  else if (S && W && SW && !N && !E)                     { spriteX = 12; spriteY = 0 }
  else if (N && S && E && W)                             { spriteX = 5;  spriteY = 1 }
  else if (N && S && E && NE && SE && !W)                { spriteX = 10; spriteY = 1 }
  else if (E && S && W && SE && SW && !N)                { spriteX = 11; spriteY = 0 }
  else if (N && S && W && NW && SW && !E)                { spriteX = 12; spriteY = 1 }
  else if (N && E && W && NE && NW && !S)                { spriteX = 11; spriteY = 2 }
  else if (N && S && E && !W)                            { spriteX = 4;  spriteY = 1 }
  else if (E && S && W && !N)                            { spriteX = 5;  spriteY = 0 }
  else if (N && S && W && !E)                            { spriteX = 6;  spriteY = 1 }
  else if (N && E && W && !S)                            { spriteX = 5;  spriteY = 2 }
  else if (S && E && !N && !W)                           { spriteX = 4;  spriteY = 0 }
  else if (S && W && !N && !E)                           { spriteX = 6;  spriteY = 0 }
  else if (N && E && !S && !W)                           { spriteX = 4;  spriteY = 2 }
  else if (N && W && !S && !E)                           { spriteX = 6;  spriteY = 2 }
  else if (W && E && !N && !S)                           { spriteX = 5;  spriteY = 3 }
  else if (N && S && !W && !E)                           { spriteX = 3;  spriteY = 1 }
  else if (N && !S && !E && !W)                          { spriteX = 3;  spriteY = 2 }
  else if (S && !N && !E && !W)                          { spriteX = 3;  spriteY = 0 }
  else if (E && !N && !S && !W)                          { spriteX = 4;  spriteY = 3 }
  else if (W && !N && !S && !E)                          { spriteX = 6;  spriteY = 3 }

  return [spriteX, spriteY]
}

/**
 * Returns [col, row] in the tileset for the given tile type and position.
 * Grass and tree are randomised by position; water and sand use auto-tiling.
 * Tree, rock, gold callers must draw a grass background first.
 */
function getTileSprite(type, x, y) {
  switch (type) {
    case 'GRASS': return getGrassSprite(x, y)
    case 'SAND':  return getSandSpriteCoords(x, y)
    case 'WATER': return getWaterSpriteCoords(x, y)
    case 'TREE':  return getTreeSprite(x, y)
    case 'ROCK':  return [0, 26]
    case 'GOLD':  return [1, 26]
    default:      return [0, 0]
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Gold tint helper
// ─────────────────────────────────────────────────────────────────────────────

function createGoldTintedSprite() {
  // Step 1: draw gold ore sprite to result canvas
  const oc = document.createElement('canvas')
  oc.width = TILE_SIZE
  oc.height = TILE_SIZE
  const octx = oc.getContext('2d')
  octx.imageSmoothingEnabled = false
  octx.drawImage(tilesetImage, 1 * TILE_SIZE, 26 * TILE_SIZE, TILE_SIZE, TILE_SIZE, 0, 0, TILE_SIZE, TILE_SIZE)

  // Step 2: tint canvas = solid yellow, clipped to sprite's opaque pixels only
  const tc = document.createElement('canvas')
  tc.width = TILE_SIZE
  tc.height = TILE_SIZE
  const tctx = tc.getContext('2d')
  tctx.fillStyle = '#FFEA7D'
  tctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE)
  tctx.globalCompositeOperation = 'destination-in'
  tctx.drawImage(tilesetImage, 1 * TILE_SIZE, 26 * TILE_SIZE, TILE_SIZE, TILE_SIZE, 0, 0, TILE_SIZE, TILE_SIZE)

  // Step 3: multiply clipped tint onto sprite (transparent areas unaffected)
  octx.globalCompositeOperation = 'multiply'
  octx.drawImage(tc, 0, 0)
  goldTintedCanvas = oc
}

/** Redraw terrain swatches in the palette using the loaded tileset */
function updateTerrainSwatches() {
  if (!tilesetLoaded) return
  const SW = 28
  const SWATCH_SPRITES = {
    GRASS: [0, 0], SAND: [5, 1], WATER: [8, 11],
    TREE: [2, 26], ROCK: [0, 26], GOLD: [1, 26],
  }
  PALETTE_TILES.forEach(type => {
    const canvas = paletteSwatchCanvases.get(`terrain_${type}`)
    if (!canvas) return
    const c = canvas.getContext('2d')
    c.imageSmoothingEnabled = false
    c.clearRect(0, 0, SW, SW)
    if (type === 'TREE' || type === 'ROCK' || type === 'GOLD') {
      c.drawImage(tilesetImage, 0, 0, TILE_SIZE, TILE_SIZE, 0, 0, SW, SW)
    }
    if (type === 'GOLD' && goldTintedCanvas) {
      c.drawImage(goldTintedCanvas, 0, 0, TILE_SIZE, TILE_SIZE, 0, 0, SW, SW)
    } else {
      const [sc, sr] = SWATCH_SPRITES[type] || [0, 0]
      c.drawImage(tilesetImage, sc * TILE_SIZE, sr * TILE_SIZE, TILE_SIZE, TILE_SIZE, 0, 0, SW, SW)
    }
  })
}

/** Redraw a single building swatch once its image has loaded */
function updateBuildingSwatch(type) {
  const canvas = paletteSwatchCanvases.get(`building_${type}`)
  if (!canvas) return
  const img = buildingImages.get(type)
  if (!img || img === 'error') return
  const c = canvas.getContext('2d')
  c.imageSmoothingEnabled = false
  c.clearRect(0, 0, canvas.width, canvas.height)
  c.drawImage(img, 0, 0, canvas.width, canvas.height)
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom confirm dialog (replaces browser confirm() to avoid popup blocking)
// ─────────────────────────────────────────────────────────────────────────────

function createConfirmDialog() {
  const overlay = document.createElement('div')
  overlay.className = 'editor-confirm-overlay'

  const box = document.createElement('div')
  box.className = 'editor-confirm-box'

  const msg = document.createElement('p')
  msg.className = 'editor-confirm-msg'

  const btns = document.createElement('div')
  btns.className = 'editor-confirm-btns'

  const okBtn = document.createElement('button')
  okBtn.className = 'editor-btn editor-btn-primary'
  okBtn.setAttribute('data-i18n', 'mapEditor.confirmOk')
  okBtn.textContent = t('mapEditor.confirmOk')
  okBtn.addEventListener('click', () => {
    hideConfirmDialog()
    const cb = confirmCallback
    confirmCallback = null
    cb?.()
  })

  const cancelBtn = document.createElement('button')
  cancelBtn.className = 'editor-btn'
  cancelBtn.setAttribute('data-i18n', 'mapEditor.confirmCancel')
  cancelBtn.textContent = t('mapEditor.confirmCancel')
  cancelBtn.addEventListener('click', () => {
    playClickSound()
    hideConfirmDialog()
    confirmCallback = null
  })

  btns.append(okBtn, cancelBtn)
  box.append(msg, btns)
  overlay.appendChild(box)

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      playClickSound()
      hideConfirmDialog()
      confirmCallback = null
    }
  })

  document.getElementById('mapEditorSection')?.appendChild(overlay)
  confirmDialogEl = { overlay, msg }
}

function editorConfirm(message, onConfirm) {
  if (!confirmDialogEl) { onConfirm?.(); return }
  confirmDialogEl.msg.textContent = message
  confirmDialogEl.overlay.style.display = 'flex'
  confirmCallback = onConfirm
}

function hideConfirmDialog() {
  if (confirmDialogEl) confirmDialogEl.overlay.style.display = 'none'
}

// ─────────────────────────────────────────────────────────────────────────────
// Init (called once at app startup)
// ─────────────────────────────────────────────────────────────────────────────

function initMapEditor() {
  // Load the tileset image used by the game
  tilesetImage = new Image()
  tilesetImage.onload = () => {
    tilesetLoaded = true
    createGoldTintedSprite()
    updateTerrainSwatches()
    scheduleRender()
  }
  tilesetImage.src = './assets/punyworld-overworld-tileset.png'

  // Pre-load all building images (browser caches duplicates automatically)
  const loadedSrcs = new Map()
  Object.entries(BUILDING_SPRITES).forEach(([type, src]) => {
    if (loadedSrcs.has(src)) {
      // Reuse the same Image for identical src
      const existing = loadedSrcs.get(src)
      if (existing.complete && existing.naturalWidth > 0) {
        buildingImages.set(type, existing)
      } else {
        existing.addEventListener('load', () => { buildingImages.set(type, existing); updateBuildingSwatch(type) })
      }
      return
    }
    buildingImages.set(type, null)
    const img = new Image()
    loadedSrcs.set(src, img)
    img.onload = () => {
      // Set for all types sharing this src
      Object.entries(BUILDING_SPRITES).forEach(([t, s]) => { if (s === src) buildingImages.set(t, img) })
      Object.entries(BUILDING_SPRITES).forEach(([t, s]) => { if (s === src) updateBuildingSwatch(t) })
      scheduleRender()
    }
    img.onerror = () => {
      Object.entries(BUILDING_SPRITES).forEach(([t, s]) => { if (s === src) buildingImages.set(t, 'error') })
    }
    img.src = src
  })

  editorCanvas = document.getElementById('mapEditorCanvas')
  ctx = editorCanvas.getContext('2d')
  ctx.imageSmoothingEnabled = false

  setupPalette()
  setupSizeButtons()
  setupToolbar()
  setupEditorEvents()
  createConfirmDialog()

  // Keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    if (!isEditorOpen) return
    if (e.key === 'Escape') {
      closeMapEditor()
      return
    }
    const PAN_TILES = Math.max(1, Math.round(5 / viewTransform.scale))
    const PAN_STEP = PAN_TILES * TILE_SIZE
    if      (e.key === 'ArrowLeft')  viewTransform.x -= PAN_STEP
    else if (e.key === 'ArrowRight') viewTransform.x += PAN_STEP
    else if (e.key === 'ArrowUp')    viewTransform.y -= PAN_STEP
    else if (e.key === 'ArrowDown')  viewTransform.y += PAN_STEP
    else return
    e.preventDefault()
    applyBoundaryConstraints()
    scheduleRender()
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Open / Close
// ─────────────────────────────────────────────────────────────────────────────

function openMapEditor() {
  document.getElementById('homeMenu').style.display = 'none'
  document.getElementById('mapEditorSection').style.display = 'flex'
  isEditorOpen = true

  // Defer createNewMap until browser has laid out the canvas
  requestAnimationFrame(() => {
    createNewMap('medium')
    startWaterAnim()
  })
}

function closeMapEditor() {
  const doClose = () => {
    playCloseSound()
    isEditorOpen = false
    document.getElementById('mapEditorSection').style.display = 'none'
    document.getElementById('homeMenu').style.display = 'block'
  }
  if (mapDirty) {
    editorConfirm(t('mapEditor.backConfirm'), doClose)
  } else {
    doClose()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Map creation / loading
// ─────────────────────────────────────────────────────────────────────────────

function createNewMap(size) {
  const cfg = CONSTANTS.MAP_SIZES.getById(size)
  if (!cfg) return

  currentMapSize = size
  editorWidth    = cfg.width
  editorHeight   = cfg.height
  mapName        = 'My Map'

  editorMap = Array.from({ length: editorWidth }, () =>
    Array.from({ length: editorHeight }, () => ({ type: 'GRASS' }))
  )
  mapDirty = false
  editorOverlays.clear()

  // Update size button selection
  document.querySelectorAll('.editor-size-btn').forEach(b => {
    b.classList.toggle('selected', b.dataset.sizeId === size)
  })
  syncSizeInputs()

  resetView()
  scheduleRender()
}

function loadMapFromData(data) {
  try {
    const w = data.mapSize?.width
    const h = data.mapSize?.height
    if (!w || !h || !data.terrain) throw new Error('Missing width, height or terrain')

    editorWidth  = w
    editorHeight = h
    mapName = data.name || 'My Map'

    const sizeEntry = CONSTANTS.MAP_SIZES.getAll().find(s => s.width === w && s.height === h)
    currentMapSize = sizeEntry?.id || 'medium'

    editorMap = Array.from({ length: w }, (_, x) =>
      Array.from({ length: h }, (_, y) => ({
        type: data.terrain[x]?.[y] || 'GRASS'
      }))
    )

    mapDirty = false
    editorOverlays.clear()
    for (const sp of data.startingPositions || []) {
      editorOverlays.set(`${sp.x},${sp.y}`, { kind: 'start', role: sp.player, x: sp.x, y: sp.y })
    }
    for (const b of data.buildings || []) {
      editorOverlays.set(`${b.x},${b.y}`, { kind: 'building', buildingType: b.type, owner: b.owner, x: b.x, y: b.y })
    }
    document.querySelectorAll('.editor-size-btn').forEach(b => {
      b.classList.toggle('selected', b.dataset.sizeId === currentMapSize)
    })
    syncSizeInputs()

    resetView()
    scheduleRender()
    console.log(`✓ Map loaded: ${mapName} (${w}×${h})`)
  } catch (err) {
    console.error('Failed to load map:', err)
    alert('Failed to load map: ' + err.message)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// View helpers
// ─────────────────────────────────────────────────────────────────────────────

function resetView() {
  const cw = editorCanvas.clientWidth  || 800
  const ch = editorCanvas.clientHeight || 600
  const mapPixW = editorWidth  * TILE_SIZE
  const mapPixH = editorHeight * TILE_SIZE
  viewTransform.scale = Math.min(cw / mapPixW, ch / mapPixH) * 0.9
  viewTransform.x = 0
  viewTransform.y = 0
  applyBoundaryConstraints()
}

function applyBoundaryConstraints() {
  const cw = editorCanvas.clientWidth  || 800
  const ch = editorCanvas.clientHeight || 600
  const mapPixW = editorWidth  * TILE_SIZE
  const mapPixH = editorHeight * TILE_SIZE
  const vw = cw / viewTransform.scale
  const vh = ch / viewTransform.scale

  viewTransform.x = (vw >= mapPixW)
    ? (mapPixW - vw) / 2
    : Math.max(0, Math.min(viewTransform.x, mapPixW - vw))

  viewTransform.y = (vh >= mapPixH)
    ? (mapPixH - vh) / 2
    : Math.max(0, Math.min(viewTransform.y, mapPixH - vh))
}

function getMinZoom() {
  const cw = editorCanvas.clientWidth  || 800
  const ch = editorCanvas.clientHeight || 600
  return Math.min(cw / (editorWidth * TILE_SIZE), ch / (editorHeight * TILE_SIZE)) * 0.85
}

// ─────────────────────────────────────────────────────────────────────────────
// Water animation loop
// ─────────────────────────────────────────────────────────────────────────────

function startWaterAnim() {
  if (!animLoopRunning) {
    animLoopRunning = true
    requestAnimationFrame(waterAnimLoop)
  }
}

function waterAnimLoop(timestamp) {
  if (!isEditorOpen) {
    animLoopRunning = false
    return
  }
  if (timestamp - waterAnimLastTime >= 300) {
    waterAnimLastTime = timestamp
    waterFrame = (waterFrame + 1) % 4
    scheduleRender()
  }
  requestAnimationFrame(waterAnimLoop)
}

// ─────────────────────────────────────────────────────────────────────────────
// Rendering (on-demand via scheduleRender)
// ─────────────────────────────────────────────────────────────────────────────

function scheduleRender() {
  if (renderPending || !isEditorOpen) return
  renderPending = true
  requestAnimationFrame(() => {
    renderPending = false
    if (isEditorOpen) render()
  })
}

function render() {
  if (!editorCanvas || !ctx) return

  const dpr = window.devicePixelRatio || 1
  const dw  = editorCanvas.clientWidth
  const dh  = editorCanvas.clientHeight
  if (!dw || !dh) return

  // Sync backing store resolution
  if (editorCanvas.width  !== Math.round(dw * dpr) ||
      editorCanvas.height !== Math.round(dh * dpr)) {
    editorCanvas.width  = Math.round(dw * dpr)
    editorCanvas.height = Math.round(dh * dpr)
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.scale(dpr, dpr)
  ctx.imageSmoothingEnabled = false

  // Dark background
  ctx.fillStyle = '#1a1a1a'
  ctx.fillRect(0, 0, dw, dh)

  if (!editorMap) return

  const { scale, x: ox, y: oy } = viewTransform
  const startX = Math.max(0, Math.floor(ox / TILE_SIZE))
  const startY = Math.max(0, Math.floor(oy / TILE_SIZE))
  const endX   = Math.min(editorWidth,  Math.ceil((ox + dw / scale) / TILE_SIZE) + 1)
  const endY   = Math.min(editorHeight, Math.ceil((oy + dh / scale) / TILE_SIZE) + 1)

  ctx.save()
  ctx.scale(scale, scale)
  ctx.translate(-ox, -oy)
  ctx.imageSmoothingEnabled = false

  for (let x = startX; x < endX; x++) {
    for (let y = startY; y < endY; y++) {
      const tile = editorMap[x]?.[y]
      if (!tile) continue
      const type = tile.type
      const px = x * TILE_SIZE
      const py = y * TILE_SIZE

      if (tilesetLoaded) {
        // Tree, rock and gold sit on a base terrain (grass or sand, never water)
        if (type === 'TREE' || type === 'ROCK' || type === 'GOLD') {
          if (tile.baseType === 'SAND') {
            const [sc, sr] = getSandSpriteCoords(x, y)
            ctx.drawImage(tilesetImage, sc * TILE_SIZE, sr * TILE_SIZE, TILE_SIZE, TILE_SIZE, px, py, TILE_SIZE, TILE_SIZE)
          } else {
            const [gc, gr] = getGrassSprite(x, y)
            ctx.drawImage(tilesetImage, gc * TILE_SIZE, gr * TILE_SIZE, TILE_SIZE, TILE_SIZE, px, py, TILE_SIZE, TILE_SIZE)
          }
        }
        if (type === 'GOLD' && goldTintedCanvas) {
          ctx.drawImage(goldTintedCanvas, 0, 0, TILE_SIZE, TILE_SIZE, px, py, TILE_SIZE, TILE_SIZE)
        } else {
          const [sc, sr] = getTileSprite(type, x, y)
          const animRow = type === 'WATER' ? sr + waterFrame * (sc <= 3 ? 4 : 3) : sr
          ctx.drawImage(tilesetImage, sc * TILE_SIZE, animRow * TILE_SIZE, TILE_SIZE, TILE_SIZE, px, py, TILE_SIZE, TILE_SIZE)
        }
      } else {
        // Fallback: solid color squares
        if (type === 'TREE' || type === 'ROCK' || type === 'GOLD') {
          ctx.fillStyle = tile.baseType === 'SAND' ? TILE_COLORS.SAND : TILE_COLORS.GRASS
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE)
        }
        ctx.fillStyle = TILE_COLORS[type] ?? TILE_COLORS.GRASS
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE)
      }
    }
  }

  // Draw overlays (start positions and buildings)
  ctx.font = `bold ${Math.ceil(TILE_SIZE * 0.65)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const [, overlay] of editorOverlays) {
    const ox = overlay.x
    const oy = overlay.y
    if (ox < startX || ox >= endX || oy < startY || oy >= endY) continue
    const px = ox * TILE_SIZE
    const py = oy * TILE_SIZE

    if (overlay.kind === 'start') {
      const color = OWNER_COLORS[overlay.role] || '#ffffff'
      ctx.save()
      ctx.globalAlpha = 0.85
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(px + TILE_SIZE / 2, py + TILE_SIZE / 2, TILE_SIZE / 2 - 0.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.fillStyle = '#fff'
      ctx.fillText(overlay.role === 'human' ? 'P' : overlay.role.slice(-1), px + TILE_SIZE / 2, py + TILE_SIZE / 2 + 0.5)
      ctx.restore()
    } else if (overlay.kind === 'building') {
      const img = buildingImages.get(overlay.buildingType)
      const ownerColor = OWNER_COLORS[overlay.owner] || '#888'
      ctx.save()
      if (img && img !== 'error') {
        ctx.drawImage(img, px, py, TILE_SIZE, TILE_SIZE)
      } else {
        const bdef = BUILDING_DEFS.find(b => b.type === overlay.buildingType)
        ctx.globalAlpha = 0.85
        ctx.fillStyle = ownerColor
        ctx.fillRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2)
        ctx.globalAlpha = 1
        ctx.fillStyle = '#fff'
        ctx.fillText(bdef?.abbr ?? '?', px + TILE_SIZE / 2, py + TILE_SIZE / 2 + 0.5)
      }
      // Owner-colored border to indicate which player owns it
      ctx.strokeStyle = ownerColor
      ctx.lineWidth = 1
      ctx.strokeRect(px + 0.5, py + 0.5, TILE_SIZE - 1, TILE_SIZE - 1)
      ctx.restore()
    }
  }

  // Grid overlay when zoomed in enough
  if (scale >= 2) {
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'
    ctx.lineWidth = 0.5 / scale
    ctx.beginPath()
    for (let x = startX; x <= endX; x++) {
      ctx.moveTo(x * TILE_SIZE, startY * TILE_SIZE)
      ctx.lineTo(x * TILE_SIZE, endY   * TILE_SIZE)
    }
    for (let y = startY; y <= endY; y++) {
      ctx.moveTo(startX * TILE_SIZE, y * TILE_SIZE)
      ctx.lineTo(endX   * TILE_SIZE, y * TILE_SIZE)
    }
    ctx.stroke()
  }

  ctx.restore()
}

// ─────────────────────────────────────────────────────────────────────────────
// Painting
// ─────────────────────────────────────────────────────────────────────────────

function canvasToTile(clientX, clientY) {
  const rect = editorCanvas.getBoundingClientRect()
  const wx = (clientX - rect.left) / viewTransform.scale + viewTransform.x
  const wy = (clientY - rect.top)  / viewTransform.scale + viewTransform.y
  return { x: Math.floor(wx / TILE_SIZE), y: Math.floor(wy / TILE_SIZE) }
}

function paintAt(clientX, clientY) {
  if (!editorMap) return
  const { x, y } = canvasToTile(clientX, clientY)
  if (x < 0 || x >= editorWidth || y < 0 || y >= editorHeight) return
  if (lastPaintTile.x === x && lastPaintTile.y === y) return
  lastPaintTile = { x, y }

  if (paletteMode === 'terrain') {
    const tile = editorMap[x][y]
    const isOverlay = OVERLAY_TYPES.has(selectedTileType)
    // For TREE/ROCK/GOLD: preserve GRASS or SAND base; convert WATER → GRASS
    const newBase = isOverlay
      ? (tile.type === 'SAND' || tile.baseType === 'SAND' ? 'SAND' : 'GRASS')
      : undefined
    if (tile.type !== selectedTileType || tile.baseType !== newBase) {
      tile.type = selectedTileType
      tile.baseType = newBase
      mapDirty = true
      scheduleRender()
    }
  } else if (paletteMode === 'start') {
    const key = `${x},${y}`
    const existing = editorOverlays.get(key)
    if (!existing || existing.kind !== 'start' || existing.role !== selectedStartRole) {
      editorOverlays.set(key, { kind: 'start', role: selectedStartRole, x, y })
      mapDirty = true
      scheduleRender()
    }
  } else if (paletteMode === 'building') {
    const key = `${x},${y}`
    const existing = editorOverlays.get(key)
    if (!existing || existing.kind !== 'building' || existing.buildingType !== selectedBuildingType || existing.owner !== selectedBuildingOwner) {
      editorOverlays.set(key, { kind: 'building', buildingType: selectedBuildingType, owner: selectedBuildingOwner, x, y })
      mapDirty = true
      scheduleRender()
    }
  } else if (paletteMode === 'erase_overlay') {
    const key = `${x},${y}`
    if (editorOverlays.has(key)) {
      editorOverlays.delete(key)
      mapDirty = true
      scheduleRender()
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Canvas events
// ─────────────────────────────────────────────────────────────────────────────

function setupEditorEvents() {
  editorCanvas.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    editorCanvas.setPointerCapture(e.pointerId)
    if (e.button === 1 || e.button === 2) {
      isPanning = true
      panStart = { x: e.clientX, y: e.clientY }
      panTransformStart = { x: viewTransform.x, y: viewTransform.y }
      editorCanvas.style.cursor = 'grabbing'
    } else {
      isPainting = true
      lastPaintTile = { x: -1, y: -1 }
      paintAt(e.clientX, e.clientY)
    }
  })

  editorCanvas.addEventListener('pointermove', (e) => {
    if (isPainting) {
      paintAt(e.clientX, e.clientY)
    }
    if (isPanning) {
      const dx = (e.clientX - panStart.x) / viewTransform.scale
      const dy = (e.clientY - panStart.y) / viewTransform.scale
      viewTransform.x = panTransformStart.x - dx
      viewTransform.y = panTransformStart.y - dy
      applyBoundaryConstraints()
      scheduleRender()
    }
  })

  const endInteraction = () => {
    isPainting = false
    isPanning  = false
    editorCanvas.style.cursor = 'crosshair'
  }
  editorCanvas.addEventListener('pointerup',     endInteraction)
  editorCanvas.addEventListener('pointercancel', endInteraction)

  editorCanvas.addEventListener('wheel', (e) => {
    e.preventDefault()
    const rect = editorCanvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const wx = mx / viewTransform.scale + viewTransform.x
    const wy = my / viewTransform.scale + viewTransform.y
    const factor   = e.deltaY < 0 ? 1.1 : 1 / 1.1
    const newScale = Math.max(getMinZoom(), Math.min(8, viewTransform.scale * factor))
    viewTransform.scale = newScale
    viewTransform.x = wx - mx / newScale
    viewTransform.y = wy - my / newScale
    applyBoundaryConstraints()
    scheduleRender()
  }, { passive: false })

  editorCanvas.addEventListener('contextmenu', (e) => e.preventDefault())
}

// ─────────────────────────────────────────────────────────────────────────────
// Palette (built dynamically)
// ─────────────────────────────────────────────────────────────────────────────

function setupPalette() {
  const palette = document.getElementById('mapEditorPalette')
  if (!palette) return
  palette.innerHTML = ''
  paletteSwatchCanvases.clear()

  const SW = 28

  const makeHeader = (i18nKey) => {
    const h = document.createElement('div')
    h.className = 'palette-section-header'
    h.setAttribute('data-i18n', i18nKey)
    h.textContent = t(i18nKey)
    return h
  }
  const makeGrid = () => {
    const g = document.createElement('div')
    g.className = 'palette-items-grid'
    return g
  }
  const makeItem = (kind, onClick) => {
    const el = document.createElement('div')
    el.className = 'editor-palette-item'
    el.dataset.paletteKind = kind
    el.addEventListener('click', () => { playClickSound(); onClick(el) })
    return el
  }
  const makeSwatchCanvas = () => {
    const c = document.createElement('canvas')
    c.width = SW
    c.height = SW
    c.className = 'editor-tile-swatch'
    return c
  }

  // ── Group 1: Terrain ──────────────────────────────────────────────────────
  palette.appendChild(makeHeader('mapEditor.terrain'))
  const terrainGrid = makeGrid()

  PALETTE_TILES.forEach(type => {
    const item = makeItem('terrain', el => {
      paletteMode = 'terrain'
      selectedTileType = type
      updatePaletteSelection(el)
    })
    if (type === 'GRASS') item.classList.add('selected')
    item.dataset.tileType = type

    const swatch = makeSwatchCanvas()
    const sc = swatch.getContext('2d')
    sc.fillStyle = TILE_COLORS[type] || '#888'  // color fallback until tileset loads
    sc.fillRect(0, 0, SW, SW)
    paletteSwatchCanvases.set(`terrain_${type}`, swatch)

    const label = document.createElement('span')
    label.setAttribute('data-i18n', `mapEditor.tiles.${type.toLowerCase()}`)
    label.textContent = t(`mapEditor.tiles.${type.toLowerCase()}`)

    item.append(swatch, label)
    terrainGrid.appendChild(item)
  })
  palette.appendChild(terrainGrid)

  // ── Group 2: Start Positions ──────────────────────────────────────────────
  palette.appendChild(makeHeader('mapEditor.startPositions'))
  const startGrid = makeGrid()

  START_ROLES.forEach(({ role, i18nKey, color }) => {
    const item = makeItem('start', el => {
      paletteMode = 'start'
      selectedStartRole = role
      updatePaletteSelection(el)
    })
    item.dataset.startRole = role

    const swatch = makeSwatchCanvas()
    const sc = swatch.getContext('2d')
    sc.fillStyle = color
    sc.beginPath()
    sc.arc(SW / 2, SW / 2, SW / 2 - 1, 0, Math.PI * 2)
    sc.fill()
    sc.fillStyle = '#fff'
    sc.font = `bold ${Math.ceil(SW * 0.45)}px sans-serif`
    sc.textAlign = 'center'
    sc.textBaseline = 'middle'
    sc.fillText(role === 'human' ? 'P' : role.slice(-1), SW / 2, SW / 2 + 1)

    const lbl = document.createElement('span')
    lbl.setAttribute('data-i18n', i18nKey)
    lbl.textContent = t(i18nKey)

    item.append(swatch, lbl)
    startGrid.appendChild(item)
  })

  // Erase overlay item
  const eraseItem = makeItem('erase_overlay', el => {
    paletteMode = 'erase_overlay'
    updatePaletteSelection(el)
  })
  const eraseSwatch = makeSwatchCanvas()
  const ec = eraseSwatch.getContext('2d')
  ec.fillStyle = '#333'
  ec.fillRect(0, 0, SW, SW)
  ec.strokeStyle = '#888'
  ec.setLineDash([2, 2])
  ec.strokeRect(2, 2, SW - 4, SW - 4)
  ec.setLineDash([])
  ec.fillStyle = '#888'
  ec.font = `bold ${Math.ceil(SW * 0.55)}px sans-serif`
  ec.textAlign = 'center'
  ec.textBaseline = 'middle'
  ec.fillText('✕', SW / 2, SW / 2)
  const eraseLabel = document.createElement('span')
  eraseLabel.setAttribute('data-i18n', 'mapEditor.erase')
  eraseLabel.textContent = t('mapEditor.erase')
  eraseItem.append(eraseSwatch, eraseLabel)
  startGrid.appendChild(eraseItem)

  palette.appendChild(startGrid)

  // ── Group 3: Buildings ────────────────────────────────────────────────────
  palette.appendChild(makeHeader('mapEditor.buildings'))

  const ownerSelector = document.createElement('div')
  ownerSelector.className = 'palette-owner-selector'
  ;[
    { owner: 'human', i18nKey: 'mapEditor.owner.p1',  color: OWNER_COLORS.human },
    { owner: 'ai_1',  i18nKey: 'mapEditor.owner.ai1', color: OWNER_COLORS.ai_1  },
    { owner: 'ai_2',  i18nKey: 'mapEditor.owner.ai2', color: OWNER_COLORS.ai_2  },
    { owner: 'ai_3',  i18nKey: 'mapEditor.owner.ai3', color: OWNER_COLORS.ai_3  },
  ].forEach(({ owner, i18nKey, color }) => {
    const btn = document.createElement('button')
    btn.className = 'palette-owner-btn'
    if (owner === 'human') btn.classList.add('selected')
    btn.dataset.owner = owner
    btn.setAttribute('data-i18n', i18nKey)
    btn.textContent = t(i18nKey)
    btn.style.setProperty('--owner-color', color)
    btn.addEventListener('click', () => {
      selectedBuildingOwner = owner
      ownerSelector.querySelectorAll('.palette-owner-btn').forEach(b => b.classList.toggle('selected', b.dataset.owner === owner))
      if (paletteMode === 'building') scheduleRender()
    })
    ownerSelector.appendChild(btn)
  })
  palette.appendChild(ownerSelector)

  const buildingGrid = makeGrid()
  BUILDING_DEFS.forEach(({ type, i18nKey, abbr, color }) => {
    const item = makeItem('building', el => {
      paletteMode = 'building'
      selectedBuildingType = type
      updatePaletteSelection(el)
    })
    item.dataset.buildingType = type

    const swatch = makeSwatchCanvas()
    const sc = swatch.getContext('2d')
    // Color fallback until image loads
    sc.fillStyle = color
    sc.fillRect(0, 0, SW, SW)
    sc.fillStyle = '#fff'
    sc.font = `bold ${Math.ceil(SW * 0.45)}px sans-serif`
    sc.textAlign = 'center'
    sc.textBaseline = 'middle'
    sc.fillText(abbr, SW / 2, SW / 2)
    paletteSwatchCanvases.set(`building_${type}`, swatch)

    const lbl = document.createElement('span')
    lbl.setAttribute('data-i18n', i18nKey)
    lbl.textContent = t(i18nKey)

    item.append(swatch, lbl)
    buildingGrid.appendChild(item)
  })
  palette.appendChild(buildingGrid)

  // Draw sprites if already loaded when palette is rebuilt
  if (tilesetLoaded) updateTerrainSwatches()
  BUILDING_DEFS.forEach(({ type }) => { if (buildingImages.get(type)) updateBuildingSwatch(type) })
}

/** Update the visual selection state in the palette */
function updatePaletteSelection(activeItem) {
  document.querySelectorAll('.editor-palette-item').forEach(el => {
    el.classList.toggle('selected', el === activeItem)
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Size buttons (generated from CONSTANTS)
// ─────────────────────────────────────────────────────────────────────────────

function setupSizeButtons() {
  const container = document.getElementById('mapEditorSizeButtons')
  if (!container) return

  CONSTANTS.MAP_SIZES.getAll().forEach(size => {
    const btn = document.createElement('button')
    btn.className = 'editor-size-btn'
    if (size.id === 'medium') btn.classList.add('selected')
    btn.dataset.sizeId = size.id
    btn.setAttribute('data-i18n', `mapEditor.size.${size.id}`)
    btn.textContent = t(`mapEditor.size.${size.id}`)
    btn.addEventListener('click', () => {
      playClickSound()
      if (editorMap) {
        editorConfirm(t('mapEditor.newMapConfirm'), () => createNewMap(size.id))
      } else {
        createNewMap(size.id)
      }
    })
    container.appendChild(btn)
  })
}

/** Sync the custom width/height inputs to reflect the current map size */
function syncSizeInputs() {
  const wEl = document.getElementById('mapEditorWidthInput')
  const hEl = document.getElementById('mapEditorHeightInput')
  if (wEl) wEl.value = editorWidth
  if (hEl) hEl.value = editorHeight
}

/** Create a blank map with explicit tile dimensions (custom size) */
function createCustomMap(w, h) {
  editorWidth  = w
  editorHeight = h
  currentMapSize = null
  mapName = 'My Map'

  editorMap = Array.from({ length: w }, () =>
    Array.from({ length: h }, () => ({ type: 'GRASS' }))
  )
  mapDirty = false

  // Deselect all preset size buttons
  document.querySelectorAll('.editor-size-btn').forEach(b => b.classList.remove('selected'))

  resetView()
  scheduleRender()
}

// ─────────────────────────────────────────────────────────────────────────────
// Procedural terrain generation (same Perlin noise logic as mapGeneration.mjs)
// ─────────────────────────────────────────────────────────────────────────────

function generateProceduralTerrain() {
  if (!editorMap) return
  editorConfirm(t('mapEditor.generateConfirm'), () => {
    const seed = Math.floor(Math.random() * 1000000)
    const noise = new PerlinNoise(seed)
    const NOISE_SCALE = CONSTANTS.TERRAIN.NOISE_SCALE
    const T = CONSTANTS.TERRAIN.THRESHOLD

    for (let x = 0; x < editorWidth; x++) {
      for (let y = 0; y < editorHeight; y++) {
        const noiseValue = (noise.noise(x * NOISE_SCALE, y * NOISE_SCALE) + 1) / 2

        let type = 'GRASS'
        let baseType

        if (noiseValue < T.WATER) {
          type = 'WATER'
        } else if (noiseValue < T.ROCK) {
          type = 'ROCK'
          baseType = 'GRASS'
        } else if (noiseValue < T.TREE_NEXT_TO_WATER) {
          type = 'TREE'
          baseType = 'GRASS'
        } else if (noiseValue < T.GRASS_NEXT_TO_WATER) {
          type = 'GRASS'
        } else if (noiseValue < T.SAND) {
          type = 'SAND'
        } else if (noiseValue < T.GRASS) {
          type = 'GRASS'
        } else {
          type = 'TREE'
          baseType = 'GRASS'
        }

        // Gold: only placed on GRASS tiles via secondary noise
        if (type === 'GRASS') {
          const goldNoise = (noise.noise((x + 500) * NOISE_SCALE * 3, (y + 500) * NOISE_SCALE * 3) + 1) / 2
          if (goldNoise > T.GOLD) {
            type = 'GOLD'
            baseType = 'GRASS'
          }
        }

        editorMap[x][y] = baseType ? { type, baseType } : { type }
      }
    }

    editorOverlays.clear()
    mapDirty = true
    scheduleRender()
    playConfirmSound()
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Toolbar
// ─────────────────────────────────────────────────────────────────────────────

function setupToolbar() {
  document.getElementById('mapEditorBack')?.addEventListener('click', closeMapEditor)

  document.getElementById('mapEditorNew')?.addEventListener('click', () => {
    playClickSound()
    const doNew = () => {
      const selected = document.querySelector('.editor-size-btn.selected')
      createNewMap(selected?.dataset.sizeId || 'medium')
    }
    if (editorMap) {
      editorConfirm(t('mapEditor.newMapConfirm'), doNew)
    } else {
      doNew()
    }
  })

  document.getElementById('mapEditorGenerate')?.addEventListener('click', () => {
    playClickSound()
    generateProceduralTerrain()
  })

  document.getElementById('mapEditorExport')?.addEventListener('click', exportEditorMap)

  document.getElementById('mapEditorLoad')?.addEventListener('click', () => {
    playClickSound()
    document.getElementById('mapEditorFileInput')?.click()
  })

  document.getElementById('mapEditorFileInput')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        loadMapFromData(JSON.parse(ev.target.result))
      } catch (err) {
        console.error('Invalid map file:', err)
        alert('Invalid map file')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  })

  // Custom size apply
  document.getElementById('mapEditorApplySize')?.addEventListener('click', () => {
    playClickSound()
    const w = parseInt(document.getElementById('mapEditorWidthInput')?.value, 10)
    const h = parseInt(document.getElementById('mapEditorHeightInput')?.value, 10)
    if (!w || !h || w < 20 || h < 20 || w > 400 || h > 400) return
    if (editorMap) {
      editorConfirm(t('mapEditor.newMapConfirm'), () => createCustomMap(w, h))
    } else {
      createCustomMap(w, h)
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

function exportEditorMap() {
  if (!editorMap) return
  playConfirmSound()

  const name = prompt(t('mapEditor.exportNamePrompt'), mapName) || mapName
  mapName = name

  // Build 2D terrain array matching the format used by maps.mjs / applyCustomMap
  const terrain = Array.from({ length: editorWidth }, (_, x) =>
    Array.from({ length: editorHeight }, (_, y) => editorMap[x][y]?.type || 'GRASS')
  )

  const startingPositions = []
  const buildings = []
  for (const [, overlay] of editorOverlays) {
    if (overlay.kind === 'start') {
      startingPositions.push({ player: overlay.role, x: overlay.x, y: overlay.y })
    } else if (overlay.kind === 'building') {
      buildings.push({ type: overlay.buildingType, owner: overlay.owner, x: overlay.x, y: overlay.y })
    }
  }

  const cfg = currentMapSize ? CONSTANTS.MAP_SIZES.getById(currentMapSize) : null
  const mapData = {
    id:               `editor_${Date.now()}`,
    version:          '1.0',
    name,
    description:      'Created with Map Editor',
    category:         'custom',
    difficulty:       'medium',
    size:             cfg?.label?.toLowerCase() || `${editorWidth}x${editorHeight}`,
    mapSize:          { width: editorWidth, height: editorHeight },
    seed:             null,
    terrain,
    startingPositions,
    buildings,
    exportDate:       new Date().toISOString(),
  }

  const blob = new Blob([JSON.stringify(mapData, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href     = url
  link.download = `${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  console.log(`Map exported: ${link.download}`)
}
