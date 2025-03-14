'use strict'

let canvas = null
let ctx = null

self.onmessage = (event) => {
  if (event.data === "draw") {
    draw()
  } else {
    canvas = event.data.canvas
    ctx = canvas?.getContext("2d")
  }
}

const draw = () => {
  // TODO: Implement drawing logic for the web worker
  // Can be used for offloading rendering tasks from the main thread
}