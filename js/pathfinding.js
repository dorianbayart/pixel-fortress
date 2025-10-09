export { clearPathCache, searchPath }

'use strict'

import { getMapDimensions } from 'dimensions'
import gameState from "state"

const pathfindingWorker = new Worker('./js/worker.js', { type: 'module' })
const pathfindingPromises = new Map()
let nextPathfindingId = 0

/**
 * Sends a pathfinding request to the worker and returns a Promise that resolves with the path.
 * @param {number} startX - Starting X coordinate
 * @param {number} startY - Starting Y coordinate
 * @param {number} endX - Destination X coordinate
 * @param {number} endY - Destination Y coordinate
 * @returns {Promise<Array|null>} Promise that resolves with an array of path nodes or null if no path found
 */
function searchPath(startX, startY, endX, endY) {
  const id = nextPathfindingId++
  return new Promise((resolve) => {
    pathfindingPromises.set(id, resolve)
    pathfindingWorker.postMessage({
      type: 'FIND_PATH',
      id,
      startX,
      startY,
      endX,
      endY,
      map: gameState.map.map(column => column.map(tile => ({ weight: tile.weight }))),
      mapDimensions: getMapDimensions(),
    })
  })
}

/** Clears the path cache in the worker. */
function clearPathCache() {
  const id = nextPathfindingId++
  return new Promise((resolve) => {
    pathfindingPromises.set(id, resolve)
    pathfindingWorker.postMessage({ type: 'CLEAR_CACHE', id })
  })
}

pathfindingWorker.onmessage = (event) => {
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