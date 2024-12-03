'use strict'

let canvas = null
let ctx = null

// Waiting to receive the OffScreenCanvas
self.onmessage = (event) => {
  if (event.data === "draw") {
    draw()
  } else {
    canvas = event.data.canvas
    ctx = canvas.getContext("2d")
  }
}

const draw = () => {
  
}
