export { clearPathCache, pathCache, searchPath }

'use strict'

import { getMapDimensions } from 'dimensions'
import gameState from "state"

/**
 * Choose the pathfinding algorithm: [aStar, bestFirstSearch]
 * The searchPath function is a proxy to the real pathfinding algorithm
 */
const searchPath = aStar

const pathCache = new Map()
const PATH_CACHE_MAX_SIZE = 2500
const DX = [1, -1, 0, 0] // East, West, North, South
const DY = [0, 0, -1, 1] // East, West, North, South
let mapDimensions = getMapDimensions()

/**
 * Function to create a unique cache key from start and end points
 * This key is used to store complete paths in a cache
 */
const getCacheKey = (startX, startY, endX, endY) => {
  return `${startX},${startY}-${endX},${endY}`;
}

/** Clean the paths cache stored in a Map */
function clearPathCache() {
  pathCache.clear();
}

/** Returns a unique cache key for the specified coordinates */
const getNodeKey = (x, y) => y * mapDimensions.width + x | 0

/** Simple Manhattan distance heuristic */
const getHeuristic = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y)

/** Check if coords are in bounds */
const isInBounds = (x, y) => x >= 0 && x < mapDimensions.width && y >= 0 && y < mapDimensions.height

/** Check if a cell is a wall */
const isWall = (x, y) => {
  if (!isInBounds(x, y)) return true

  // Only consider maximum weight as walls, not buildings (2047) or trees (255)
  return (gameState.map[x][y]?.weight || 0) === mapDimensions.maxWeight
}

/**
 * Returns an array of valid neighbors for a given coordinate.
 * Optimized to prevent excessive object creation and garbage collection.
 * 
 * @param {number} currentX - The X coordinate of the current node.
 * @param {number} currentY - The Y coordinate of the current node.
 * @param {Uint8Array} closedList - The closed list (Uint8Array) for A* search.
 * @param {function} isWallFn - Reference to the isWall function.
 * @param {function} getNodeKeyFn - Reference to the getNodeKey function.
 * @returns {Array<Object>} An array of neighbor objects {x, y}.
 */
const getNeighbors = (currentX, currentY, closedList, isWallFn, getNodeKeyFn) => {
  const neighbors = []
  for (let i = 0; i < 4; i++) {
    const nx = currentX + DX[i]
    const ny = currentY + DY[i]

    if (!isWallFn(nx, ny) && !closedList[getNodeKeyFn(nx, ny)]) {
      neighbors.push({ x: nx, y: ny })
    }
  }
  return neighbors
}

/**
 * A* pathfinding algorithm implementation
 * Finds the shortest path between two points on the map accounting for obstacles and terrain costs.
 * Uses a binary heap for performance optimization and caches results for repeated queries.
 * 
 * @param {number} startX - Starting X coordinate
 * @param {number} startY - Starting Y coordinate
 * @param {number} endX - Destination X coordinate
 * @param {number} endY - Destination Y coordinate
 * @returns {Array|null} Array of path nodes or null if no path found
 */
function aStar(startX, startY, endX, endY) {
  // Check cache first
  const cacheKey = getCacheKey(startX, startY, endX, endY);
  if (pathCache.has(cacheKey)) {
    return [...pathCache.get(cacheKey)]; // Return a copy to prevent modification
  }

  mapDimensions = getMapDimensions()

  // Early exit
  if(isWall(startX, startY) || isWall(endX, endY)) return

  // // For straight line paths, try to use direct path
  // if (startX === endX || startY === endY) {
  //   // Check if there are any obstacles between start and end
  //   let hasObstacle = false

  //   // Check points along the line between start and end
  //   const dx = endX - startX
  //   const dy = endY - startY
  //   const steps = Math.max(Math.abs(dx), Math.abs(dy))
    
  //   if (steps > 1) {
  //     for (let i = 1; i < steps; i++) {
  //       const x = Math.floor(startX + dx * (i / steps))
  //       const y = Math.floor(startY + dy * (i / steps))
        
  //       if ((gameState.map[x][y]?.weight || 0) > 10) {
  //         hasObstacle = true
  //         break
  //       }
  //     }
  //   }
    
  //   // Only use direct path if there are no obstacles
  //   if (!hasObstacle) {
  //     return [
  //       { x: startX, y: startY, weight: gameState.map[startX][startY].weight },
  //       { x: endX, y: endY, weight: gameState.map[endX][endY].weight }
  //     ]
  //   }
  // }
  
  // Binary heap helper functions
  const heapPush = (heap, node) => {
    heap.push(node)
    let current = heap.length - 1

    while (current > 0) {
      const parent = Math.floor((current - 1) / 2)
      if (heap[parent].f <= heap[current].f) break
      [heap[parent], heap[current]] = [heap[current], heap[parent]]
      current = parent
    }
  }

  const heapPop = (heap) => {
    if (heap.length === 0) return

    const result = heap[0]
    heap[0] = heap.pop()
    let current = 0

    while (true) {
      let smallest = current
      const left = 2 * current + 1
      const right = 2 * current + 2

      if (left < heap.length && heap[left].f < heap[smallest].f) smallest = left
      if (right < heap.length && heap[right].f < heap[smallest].f) smallest = right

      if (smallest === current) break
      [heap[current], heap[smallest]] = [heap[smallest], heap[current]]
      current = smallest
    }

    return result
  }

  

  const mapSize = mapDimensions.width * mapDimensions.height
  const openList = []
  const closedList = new Uint8Array(mapSize)
  const gScores = new Uint32Array(mapSize)
  gScores.fill(mapDimensions.maxWeight) // Max value for Uint32Array represents "infinity"

  let startNode = { x: startX, y: startY }
  let endNode = { x: endX, y: endY }
  startNode.g = 0
  startNode.h = getHeuristic(startNode, endNode)
  startNode.f = startNode.g + startNode.h

  // Initialize search
  heapPush(openList, startNode)
  gScores[getNodeKey(startX, startY)] = startNode.g

  while (openList.length > 0 && openList.length < mapSize) {
    const current = heapPop(openList)

    if (current.x === endX && current.y === endY) {
      let path = []
      let node = current

      while (node) {
        path.unshift({ x: node.x, y: node.y, weight: gameState.map[node.x][node.y].weight })
        node = node.parent
      }

      // If a path is found, cache it before returning
      if (path) {
        // Manage cache size
        if (pathCache.size >= PATH_CACHE_MAX_SIZE) {
          // Remove oldest entry
          const firstKey = pathCache.keys().next().value;
          pathCache.delete(firstKey);
        }
        
        pathCache.set(cacheKey, [...path]); // Store a copy
      }

      return path
    }
    
    const currentKey = getNodeKey(current.x, current.y)

    // If already processed, skip
    if (closedList[currentKey]) continue

    // Mark as closed
    closedList[currentKey] = 1

    // Calculate heuristic when adding neighbors
    const currentNeighbors = getNeighbors(current.x, current.y, closedList, isWall, getNodeKey)
    for (let neighbor of currentNeighbors) {
        const gScore = current.g + (gameState.map[neighbor.x][neighbor.y]?.weight || 1) | 0
        const nodeKey = getNodeKey(neighbor.x, neighbor.y)

        if (gScore < gScores[nodeKey]) {
            gScores[nodeKey] = gScore

            // Update neighbor node
            neighbor.g = gScore
            neighbor.h = getHeuristic(neighbor, endNode)
            neighbor.f = neighbor.g + neighbor.h
            neighbor.parent = current

            // Add to open list
            heapPush(openList, neighbor)
        }
    }
  }

  return null // no path found
}
