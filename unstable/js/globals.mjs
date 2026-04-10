export { DEBUG, backDrawn, drawBack, isDrawBackRequested, toggleDebug }

'use strict'

import gameState from 'state'

// Temporary: Expose gameState for debugging
// window.gameState = gameState

/****************/
/*  DEBUG MODE  */
/****************/
const DEBUG = () => gameState.debug
const toggleDebug = () => gameState.toggleDebug()

const isDrawBackRequested = () => gameState.isDrawBackRequested
const drawBack = () => gameState.drawBack()
const backDrawn = () => gameState.backDrawn()