export { DEBUG, backDrawn, drawBack, isDrawBackRequested, toggleDebug }

'use strict'

/****************/
/*  DEBUG MODE  */
/****************/
let DEBUG = false
const toggleDebug = () => DEBUG = !DEBUG

let isDrawBackRequested = true

const drawBack = () => isDrawBackRequested = true
const backDrawn = () => isDrawBackRequested = false