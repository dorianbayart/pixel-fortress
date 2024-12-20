export { searchPath }

'use strict'

// Choose the pathfinding algorithm: [aStar, bestFirstSearch]
const searchPath = aStar

function bestFirstSearch(map, startX, startY, endX, endY) {
  const startTime = performance.now()
  const openList = []
  const closedList = new Map()

  const getHeuristic = (a, b) => {
    // Manhattan distance heuristic
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
  }

  const isInBounds = (x, y) => {
    return x >= 0 && x < map.length && y >= 0 && y < map[0].length
  }
  if(!isInBounds(startX, startY) || !isInBounds(endX, endY)) return

  const isWall = (x, y) => {
    return map[x][y]?.weight === 99999999
  }
  if(isWall(startX, startY) || isWall(endX, endY)) return

  // Binary heap helper functions
  const heapPush = (heap, node) => {
    heap.push(node)
    let current = heap.length - 1

    while (current > 0) {
      const parent = Math.floor((current - 1) / 2)
      if (heap[parent].h <= heap[current].h) break
      [heap[parent], heap[current]] = [heap[current], heap[parent]]
      current = parent
    }
  }

  const heapPop = (heap) => {
    const result = heap[0]
    const last = heap.pop()
    if (heap.length === 0) return result

    heap[0] = last
    let current = 0

    while (true) {
      let smallest = current
      const left = 2 * current + 1
      const right = 2 * current + 2

      if (left < heap.length && heap[left].h < heap[smallest].h) smallest = left
      if (right < heap.length && heap[right].h < heap[smallest].h) smallest = right

      if (smallest === current) break
      [heap[current], heap[smallest]] = [heap[smallest], heap[current]]
      current = smallest
    }

    return result
  }

  const getNodeKey = (x, y) => `${x},${y}`

  const neighbors = (x, y) => {
    let neighbors = [
      { x: x + 1, y: y },
      { x: x - 1, y: y },
      { x: x, y: y - 1 },
      { x: x, y: y + 1 },
    ] // E W N S

    if ((x + y) % 2 == 0) neighbors.reverse() // S N W E

    return neighbors.filter(
      (neighbor) =>
        isInBounds(neighbor.x, neighbor.y) &&
        !isWall(neighbor.x, neighbor.y) &&
        !closedList.has(getNodeKey(neighbor.x, neighbor.y))
    )
  }

  let startNode = { x: startX, y: startY }
  let endNode = { x: endX, y: endY }
  startNode.h = getHeuristic(startNode, endNode)
  heapPush(openList, startNode)

  while (openList.length > 0 && openList.length < map.length * map[0].length) {
    const current = heapPop(openList)

    if (current.x === endX && current.y === endY) {
      let path = [current]

      while (path[0].x !== startX || path[0].y !== startY) {
        for (let [_, node] of closedList) {
          if (getHeuristic(node, path[0]) === 1) {
            path.unshift({ x: node.x, y: node.y, weight: map[node.x][node.y].weight })
            break
          }
        }
      }

      return path
    }

    closedList.set(getNodeKey(current.x, current.y), current)

    // Calculate heuristic when adding neighbors
    const newNeighbors = neighbors(current.x, current.y)
    for (let neighbor of newNeighbors) {
      neighbor.h = getHeuristic(neighbor, endNode)
      heapPush(openList, neighbor)
    }
  }

  console.log("No path found - time spent " + (performance.now() - startTime) + "ms")
  return null
}

function aStar(map, startX, startY, endX, endY) {
  const startTime = performance.now()
  const openList = []
  const closedList = new Map()
  const gScores = new Map()

  const getHeuristic = (a, b) => {
    // Manhattan distance heuristic
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
  }

  const isInBounds = (x, y) => {
    return x >= 0 && x < map.length && y >= 0 && y < map[0].length
  }
  if(!isInBounds(startX, startY) || !isInBounds(endX, endY)) return

  const isWall = (x, y) => {
    return map[x][y]?.weight === 99999999
  }
  if(isWall(startX, startY) || isWall(endX, endY)) return

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
    const result = heap[0]
    const last = heap.pop()
    if (heap.length === 0) return result

    heap[0] = last
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

  const getNodeKey = (x, y) => `${x},${y}`

  const neighbors = (x, y) => {
    let neighbors = [
      { x: x + 1, y: y },
      { x: x - 1, y: y },
      { x: x, y: y - 1 },
      { x: x, y: y + 1 },
    ] // E W N S

    if ((x + y) % 2 == 0) neighbors.reverse() // S N W E

    return neighbors.filter(
      (neighbor) =>
        isInBounds(neighbor.x, neighbor.y) &&
        !isWall(neighbor.x, neighbor.y) &&
        !closedList.has(getNodeKey(neighbor.x, neighbor.y))
    )
  }

  let startNode = { x: startX, y: startY }
  let endNode = { x: endX, y: endY }
  startNode.g = 0
  startNode.h = getHeuristic(startNode, endNode)
  startNode.f = startNode.g + startNode.h
  heapPush(openList, startNode)
  gScores.set(getNodeKey(startX, startY), startNode.g)

  while (openList.length > 0 && openList.length < map.length * map[0].length) {
    const current = heapPop(openList)

    if (current.x === endX && current.y === endY) {
      let path = []
      let node = current

      while (node) {
        path.unshift({ x: node.x, y: node.y, weight: map[node.x][node.y].weight })
        node = node.parent
      }

      return path
    }

    closedList.set(getNodeKey(current.x, current.y), current)

    // Calculate heuristic when adding neighbors
    const newNeighbors = neighbors(current.x, current.y)
    for (let neighbor of newNeighbors) {
        const gScore = current.g + (map[neighbor.x][neighbor.y]?.weight || 1)
        const nodeKey = getNodeKey(neighbor.x, neighbor.y)

        if (!gScores.has(nodeKey) || gScore < gScores.get(nodeKey)) {
            gScores.set(nodeKey, gScore)
            neighbor.g = gScore
            neighbor.h = getHeuristic(neighbor, endNode)
            neighbor.f = neighbor.g + neighbor.h
            neighbor.parent = current
            heapPush(openList, neighbor)
        }
    }
  }

  console.log("No path found - time spent " + (performance.now() - startTime) + "ms")
  return null
}
