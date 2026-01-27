export { clearPathCache, getPathfindingStats, searchPath, updateMapDimensionsInWorker, updateMapInWorker, getQueueStats }

'use strict'

import CONSTANTS from 'constants'
import { getMapDimensions } from 'dimensions'
import gameState from "state"

const NUM_PATHFINDING_WORKERS = CONSTANTS.PATHFINDING.NUM_WORKERS
const MAX_CONCURRENT_PER_WORKER = CONSTANTS.PATHFINDING.MAX_CONCURRENT_PER_WORKER

// Worker management
const pathfindingWorkers = []
const workerQueues = Array.from({ length: NUM_PATHFINDING_WORKERS }, () => [])
const workerActiveCount = Array.from({ length: NUM_PATHFINDING_WORKERS }, () => 0)
let nextWorkerIndex = 0

// Promise management
const pathfindingPromises = new Map()
let nextPathfindingId = 0

// Stats tracking
const workerCalculations = Array.from({ length: NUM_PATHFINDING_WORKERS }, () => [])

// Request deduplication - track pending requests by coordinate key
const pendingRequests = new Map() // key -> [promise resolvers]

/**
 * Create a unique key for deduplication
 */
function getRequestKey(startX, startY, endX, endY) {
  return `${startX},${startY}->${endX},${endY}`
}

/**
 * Process the next queued request for a worker if it has capacity
 * @param {number} workerIndex - Index of the worker
 */
function processNextQueuedRequest(workerIndex) {
  // If worker has capacity and there are queued requests
  if (workerActiveCount[workerIndex] < MAX_CONCURRENT_PER_WORKER && workerQueues[workerIndex].length > 0) {
    const request = workerQueues[workerIndex].shift()
    workerActiveCount[workerIndex]++
    workerCalculations[workerIndex].push(performance.now())
    pathfindingWorkers[workerIndex].postMessage(request.message)
  }
}


/**
 * Initialize pathfinding workers
 */
for (let i = 0; i < NUM_PATHFINDING_WORKERS; i++) {
  const worker = new Worker('./js/worker.mjs', { type: 'module' })
  pathfindingWorkers.push(worker)

  worker.onmessage = (event) => {
    const { type, id, path } = event.data

    if (type === 'PATH_RESULT') {
      // Get the request key for deduplication
      const resolve = pathfindingPromises.get(id)
      if (resolve) {
        const requestKey = resolve.requestKey

        // Always resolve the primary request
        resolve(path)

        // Also resolve any duplicate requests waiting for the same path
        if (requestKey && pendingRequests.has(requestKey)) {
          const resolvers = pendingRequests.get(requestKey)
          resolvers.forEach(r => r(path))
          pendingRequests.delete(requestKey)
        }

        pathfindingPromises.delete(id)
      }

      // Decrement active count and process next queued request
      workerActiveCount[i]--
      processNextQueuedRequest(i)
    } else if (type === 'CACHE_CLEARED') {
      const resolve = pathfindingPromises.get(id)
      if (resolve) {
        resolve()
        pathfindingPromises.delete(id)
      }
    }
  }
}

/**
 * Sends a pathfinding request to a worker and returns a Promise that resolves with the path.
 * Uses round-robin worker distribution and request deduplication.
 * Requests are queued if workers are at capacity.
 *
 * @param {number} startX - Starting X coordinate
 * @param {number} startY - Starting Y coordinate
 * @param {number} endX - Destination X coordinate
 * @param {number} endY - Destination Y coordinate
 * @returns {Promise<Array|null>} Promise that resolves with an array of path nodes or null if no path found
 */
function searchPath(startX, startY, endX, endY) {
  // Check for duplicate pending requests
  const requestKey = getRequestKey(startX, startY, endX, endY)

  // If this exact path is already being calculated, return a promise that will be resolved
  // when the original request completes (deduplication)
  if (pendingRequests.has(requestKey)) {
    return new Promise((resolve) => {
      pendingRequests.get(requestKey).push(resolve)
    })
  }

  const id = nextPathfindingId++
  const workerIndex = nextWorkerIndex
  nextWorkerIndex = (nextWorkerIndex + 1) % NUM_PATHFINDING_WORKERS

  const message = {
    type: 'FIND_PATH',
    id,
    startX,
    startY,
    endX,
    endY,
  }

  return new Promise((resolve) => {
    // Store resolver with request key for deduplication
    const resolverWithKey = resolve
    resolverWithKey.requestKey = requestKey
    pathfindingPromises.set(id, resolverWithKey)

    // Track this as a pending request for deduplication
    if (!pendingRequests.has(requestKey)) {
      pendingRequests.set(requestKey, [])
    }

    // If worker has capacity, send immediately
    if (workerActiveCount[workerIndex] < MAX_CONCURRENT_PER_WORKER) {
      workerActiveCount[workerIndex]++
      workerCalculations[workerIndex].push(performance.now())
      pathfindingWorkers[workerIndex].postMessage(message)
    } else {
      // Otherwise, queue the request for this worker
      workerQueues[workerIndex].push({ message })
    }
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

/**
 * Get queue statistics for monitoring
 * @returns {Object} Queue stats including per-worker queues and active counts
 */
function getQueueStats() {
  return {
    workerQueueSizes: workerQueues.map(q => q.length),
    workerActiveCounts: [...workerActiveCount],
    pendingRequestCount: pendingRequests.size
  }
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

  // Clear pending requests tracking
  pendingRequests.clear()

  return Promise.all(promises)
}


/**
 * Sends the current map dimensions to the worker.
 * This should be called once at the start of the game or when map dimensions change.
 */
async function updateMapDimensionsInWorker() {
  const mapDimensions = getMapDimensions()
  pathfindingWorkers.forEach(worker => {
    worker.postMessage({
      type: 'UPDATE_MAP_DIMENSIONS',
      mapDimensions,
    })
  })
}

async function updateMapInWorker() {
  // Start with base tile weights
  const mapData = gameState.map.map(column => column.map(tile => ({ weight: tile.weight })))

  // Collect all units from all players
  const allUnits = []
  if (gameState.humanPlayer) {
    allUnits.push(...gameState.humanPlayer.getUnits())
  }
  gameState.aiPlayers.forEach(aiPlayer => {
    allUnits.push(...aiPlayer.getUnits())
  })

  // Add weight for each unit on a tile (2 per unit)
  allUnits.forEach(unit => {
    const x = unit.currentNode?.x !== undefined ? unit.currentNode.x : unit.x
    const y = unit.currentNode?.y !== undefined ? unit.currentNode.y : unit.y

    // Ensure coordinates are valid
    if (x !== undefined && y !== undefined &&
        x >= 0 && x < mapData.length &&
        y >= 0 && y < mapData[0].length) {
      mapData[x][y].weight += 8
    }
  })

  pathfindingWorkers.forEach(worker => {
    worker.postMessage({
      type: 'UPDATE_MAP',
      map: mapData,
    })
  })
}
