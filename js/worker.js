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

}