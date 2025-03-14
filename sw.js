'use strict'

const CACHE_NAME = 'PixelFortress_Cache_0.0.1'

const CACHED_URLS = [
  '',
  'index.html',
  'manifest.json',
  'sw.js',
  'favicon.ico',
  'css/modal.css',
  'js/building.js',
  'js/constants.js',
  'js/dimensions.js',
  'js/game.js',
  'js/global.js',
  'js/index.js',
  'js/init.js',
  'js/maps.js',
  'js/mouse.js',
  'js/pathfinding.js',
  'js/players.js',
  'js/renderer.js',
  'js/sprites.js',
  'js/state.js',
  'js/ui.js',
  'js/unit.js',
  'js/utils.js',
  'js/viewport.js',
  'lib/pixi.mjs',
  'lib/pixi.min.mjs',
  'maps/seeds.json',
  'assets/logo.png',
  'assets/logo.svg',
  'assets/logo_banner.svg',
  'assets/base_192_pixelated.png',
  'assets/punyworld-overworld-tileset.png',
  'assets/unitsSpritesDescription.json',
  'assets/fonts/Jacquarda-Bastarda-9.woff2',
  'assets/units/Character-Base.png',
  'assets/units/Human-Soldier-Cyan.png',
  'assets/units/Human-Soldier-Red.png',
  'assets/units/Human-Soldier-Cyan.png',
  'assets/units/Human-Soldier-Red.png',
  'assets/units/Human-Worker-Cyan.png',
  'assets/units/Human-Worker-Red.png',
  'assets/units/Mage-Cyan.png',
  'assets/units/Mage-Red.png',
  'assets/units/Soldier-Blue.png',
  'assets/units/Soldier-Red.png',
  'assets/units/Warrior-Blue.png',
  'assets/units/Warrior-Red.png',
  'assets/ui/crosshair.png'
]

const self = this // For scope

// Install Service Worker
self.addEventListener('install', event => {
  event.waitUntil(async () => {
    const cache = await caches.open(CACHE_NAME)
    await cache.addAll(CACHED_URLS)
    console.log('Service Worker installed')
  })
})

// Listen for requests - Stale-while-revalidate
self.addEventListener('fetch', event => {
  const { request } = event
  console.log('Fetch event | stale-while-revalidate', request.url)
  const cachedResponsePromise = caches.match(request)
  const fetchedResponsePromise = fetch(request)
  const fetchedClone = fetchedResponsePromise.then(resp => resp.clone())

  event.respondWith(
    Promise.race([fetchedResponsePromise.catch(() => cachedResponsePromise), cachedResponsePromise])
      .then(resp => resp || fetchedResponsePromise || new Response("Offline", { status: 404 }))
      .catch(() => new Response("Error", { status: 404 }))
  )

  if(request.method === "GET" && request.url.startsWith('http'))
    event.waitUntil(
      Promise.all([fetchedClone, caches.open(CACHE_NAME)])
        .then(([response, cache]) => cache.put(request, response))
        .catch(error => console.error('Caching error', event.request.url, error))
    )
})

// Clean up caches other than current
self.addEventListener('activate', event => {
  event.waitUntil(async () => {
    const cacheNames = await caches.keys()
    await Promise.all(cacheNames
      .filter((cacheName) => cacheName !== CACHE_NAME)
      .map(cacheName => caches.delete(cacheName))
    )
  })
})
