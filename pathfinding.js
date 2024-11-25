'use strict'

const bestFirstSearch = (map, startX, startY, endX, endY) => {
  const openList = []
  const closedList = []
  const weights = [1]

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

  const neighbors = (x, y) => {
    let neighbors = [
      { x: x+1, y: y },
      { x: x-1, y: y },
      { x: x, y: y-1 },
      { x: x, y: y+1 }
    ] // E W N S

    if ((x + y) % 2 == 0) neighbors.reverse() // S N W E

    return neighbors.filter(neighbor =>
          isInBounds(neighbor.x, neighbor.y)
      &&  !isWall(neighbor.x, neighbor.y)
      &&  !openList.some(node => node.x === neighbor.x && node.y === neighbor.y)
      &&  !closedList.some(node => node.x === neighbor.x && node.y === neighbor.y)
    )
  }

  let startNode = { x: startX, y: startY }
  let endNode = { x: endX, y: endY }

  openList.push(startNode)

  while (openList.length > 0 && openList.length < map.length * map[0].length) {
    let current = openList[0]

    for (let i = 1; i < openList.length; i++) {
      if (getHeuristic(openList[i], endNode) < getHeuristic(current, endNode)) {
        current = openList[i]
      }
    }

    if (current.x === endX && current.y === endY) {
      let path = [current]

      while (path[0].x !== startX || path[0].y !== startY) {
        const item = closedList.find(i => getHeuristic(i, path[0]) === 1)
        path.unshift({ x: item.x, y: item.y, weight: map[item.x][item.y].weight })
      }

      // console.log(path)
      return path
    }

    openList.splice(openList.indexOf(current), 1)
    closedList.push(current)

    openList.push(...neighbors(current.x, current.y))
  }

  return null
}
