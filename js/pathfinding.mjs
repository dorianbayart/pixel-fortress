export { clearPathCache, getPathfindingStats, searchPath, updateMapDimensionsInWorker, updateMapInWorker }

'use strict'

import { getMapDimensions } from 'dimensions'
import gameState from "state"

const NUM_PATHFINDING_WORKERS = 4
const pathfindingWorkers = []
let nextWorkerIndex = 0
const pathfindingPromises = new Map()
let nextPathfindingId = 0
const workerCalculations = Array.from({ length: NUM_PATHFINDING_WORKERS }, () => [])

/**
 * Sends a pathfinding request to the worker and returns a Promise that resolves with the path.
 * @param {number} startX - Starting X coordinate
 * @param {number} startY - Starting Y coordinate
 * @param {number} endX - Destination X coordinate
 * @param {number} endY - Destination Y coordinate
 * @returns {Promise<Array|null>} Promise that resolves with an array of path nodes or null if no path found
 */
for (let i = 0; i < NUM_PATHFINDING_WORKERS; i++) {
  const worker = new Worker('./js/worker.mjs', { type: 'module' })
  pathfindingWorkers.push(worker)

  worker.onmessage = (event) => {
    const { type, id, path } = event.data
    const resolve = pathfindingPromises.get(id)
    if (resolve) {
      if (type === 'PATH_RESULT') {
        resolve(path)
      } else if (type === 'CACHE_CLEARED') {
        resolve()
      }
      pathfindingPromises.delete(id)
    }
  }
}

/**
 * Sends a pathfinding request to a worker and returns a Promise that resolves with the path.
 * Uses a round-robin approach to distribute requests among workers.
 * @param {number} startX - Starting X coordinate
 * @param {number} startY - Starting Y coordinate
 * @param {number} endX - Destination X coordinate
 * @param {number} endY - Destination Y coordinate
 * @returns {Promise<Array|null>} Promise that resolves with an array of path nodes or null if no path found
 */
function searchPath(startX, startY, endX, endY) {
  const id = nextPathfindingId++
  const worker = pathfindingWorkers[nextWorkerIndex]
  workerCalculations[nextWorkerIndex].push(performance.now())
  nextWorkerIndex = (nextWorkerIndex + 1) % NUM_PATHFINDING_WORKERS

  return new Promise((resolve) => {
    pathfindingPromises.set(id, resolve)
    worker.postMessage({
      type: 'FIND_PATH',
      id,
      startX,
      startY,
      endX,
      endY,
    })
  })
}

/**
 * Returns the number of pathfinding calculations per second for each worker calculated over the last 10 seconds.
 * @returns {Array<number>} An array where each element is the number of calculations for a worker.
 */
function getPathfindingStats() {
  const tenSecondsAgo = performance.now() - 10000
  return workerCalculations.map(calculations => {
    // Filter out old timestamps and return the count
    return calculations.filter(timestamp => timestamp > tenSecondsAgo).length / 10
  })
}

/** Clears the path cache in all workers. */
function clearPathCache() {
  const id = nextPathfindingId++
  const promises = pathfindingWorkers.map(worker => {
    return new Promise((resolve) => {
      pathfindingPromises.set(id, resolve)
      worker.postMessage({ type: 'CLEAR_CACHE', id })
    })
  })
  return Promise.all(promises)
}


/**
 * Sends the current map dimensions to the worker.
 * This should be called once at the start of the game or when map dimensions change.
 */
function updateMapDimensionsInWorker() {
  const mapDimensions = getMapDimensions()
  pathfindingWorkers.forEach(worker => {
    worker.postMessage({
      type: 'UPDATE_MAP_DIMENSIONS',
      mapDimensions,
    })
  })
}

function updateMapInWorker() {
  const mapData = gameState.map.map(column => column.map(tile => ({ weight: tile.weight })))
  pathfindingWorkers.forEach(worker => {
    worker.postMessage({
      type: 'UPDATE_MAP',
      map: mapData,
    })
  })
}
