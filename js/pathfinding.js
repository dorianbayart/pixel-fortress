export { bestFirstSearch }

'use strict'

const bestFirstSearch = (map, startX, startY, endX, endY) => {
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

  const isWall = (x, y) => {
    return map[x][y]?.weight === 99999999
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
        !openList.some((n) => n.x === neighbor.x && n.y === neighbor.y) &&
        !closedList.has(getNodeKey(neighbor.x, neighbor.y))
    )
  }

  let startNode = { x: startX, y: startY }
  let endNode = { x: endX, y: endY }

  startNode.h = getHeuristic(startNode, endNode)
  openList.push(startNode)

  while (openList.length > 0 && openList.length < map.length * map[0].length) {
    // Sort only when adding new nodes, keep best node at index 0
    openList.sort((a, b) => a.h - b.h)
    let current = openList[0]

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

    openList.splice(0, 1) // Remove current (always at index 0)
    closedList.set(getNodeKey(current.x, current.y), current)

    // Calculate heuristic when adding neighbors
    const newNeighbors = neighbors(current.x, current.y)
    for (let neighbor of newNeighbors) {
      neighbor.h = getHeuristic(neighbor, endNode)
    }
    openList.push(...newNeighbors)
  }

  console.log("No path found - time spent " + (performance.now() - startTime) + "ms")
  return null
}
