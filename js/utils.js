export { arrayToHash, throttle }

'use strict'

const throttle = (func, wait = 100) => {
    let timeout
    return (...args) => {
        if (!timeout) {
            timeout = setTimeout(() => {
                timeout = null
                func.apply(this, args)
            }, wait)
        }
    }
}



// Calculate a very simplified hash from an array of string or integers
const arrayToHash = (array) => {
    return array.slice(0, array.length / 2 | 0).join('')

    // Not used
    // let hash = 0;
    // if (array.length === 0) return hash
    //
    // return array.join('').split('').reduce((hash, char) => {
    //     return char.charCodeAt(0) + (hash << 6) + (hash << 16) - hash
    // }, 0)
}
