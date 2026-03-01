'use strict'

const CACHE_NAME = 'PixelFortress_Cache_0.0.1'

const CACHED_URLS = [
  '',
  'index.html',
  'play.html',
  'manifest.json',
  'sw.js',
  'favicon.ico',

  // Styles
  'css/landing.css',
  'css/menu.css',
  'css/modal.css',

  // JavaScript modules
  'js/audio.mjs',
  'js/building.mjs',
  'js/constants.mjs',
  'js/dimensions.mjs',
  'js/fogBitmaps.mjs',
  'js/fogOfWar.mjs',
  'js/game.mjs',
  'js/globals.mjs',
  'js/i18n.mjs',
  'js/index.mjs',
  'js/init.mjs',
  'js/map-preview.mjs',
  'js/mapGeneration.mjs',
  'js/maps.mjs',
  'js/menu.mjs',
  'js/minimap.mjs',
  'js/mouse.mjs',
  'js/particles.mjs',
  'js/pathfinding.mjs',
  'js/playerColorFilter.mjs',
  'js/players.mjs',
  'js/projectile.mjs',
  'js/renderer.mjs',
  'js/sprites.mjs',
  'js/state.mjs',
  'js/terrainBitmaps.mjs',
  'js/ui.mjs',
  'js/unit.mjs',
  'js/utils.mjs',
  'js/viewport.mjs',
  'js/worker.mjs',

  // Libraries
  'lib/pixi.mjs',
  'lib/pixi.min.mjs',

  // Locales
  'locales/de.json',
  'locales/en.json',
  'locales/es.json',
  'locales/fr.json',

  // Map data
  'maps/seeds.json',

  // Assets - General
  'assets/logo.png',
  'assets/logo.svg',
  'assets/logo_banner.svg',
  'assets/base_512_pixelated.png',
  'assets/punyworld-overworld-tileset.png',
  'assets/punyworld-overworld-tileset-Mask.png',
  'assets/unitsSpritesDescription.json',

  // Assets - Screenshots
  'assets/screenshots/wallpaper.png',

  // Assets - Fonts
  'assets/fonts/Jacquarda-Bastarda-9.woff2',

  // Assets - Icons
  'assets/icons/external-link.svg',
  'assets/icons/github.svg',
  'assets/icons/music.svg',
  'assets/icons/music-solid.svg',
  'assets/icons/pause.svg',
  'assets/icons/play.svg',
  'assets/icons/shuffle.svg',
  'assets/icons/sound-mute.svg',
  'assets/icons/sound-mute-solid.svg',
  'assets/icons/sound-on.svg',
  'assets/icons/sound-on-solid.svg',

  // Assets - Unit sprites
  'assets/units/Archer-Green.png',
  'assets/units/Archer-Mask.png',
  'assets/units/Archer-Purple.png',
  'assets/units/Character-Base.png',
  'assets/units/Character-Base-Mask.png',
  'assets/units/Human-Soldier-Cyan.png',
  'assets/units/Human-Soldier-Red.png',
  'assets/units/Human-Soldier-Mask.png',
  'assets/units/Human-Worker-Cyan.png',
  'assets/units/Human-Worker-Red.png',
  'assets/units/Human-Worker-Mask.png',
  'assets/units/Mage-Cyan.png',
  'assets/units/Mage-Red.png',
  'assets/units/Mage-Mask.png',
  'assets/units/Orc-Grunt.png',
  'assets/units/Orc-Grunt-Mask.png',
  'assets/units/Orc-Peon-Cyan.png',
  'assets/units/Orc-Peon-Red.png',
  'assets/units/Orc-Peon-Mask.png',
  'assets/units/Orc-Soldier-Cyan.png',
  'assets/units/Orc-Soldier-Red.png',
  'assets/units/Orc-Soldier-Mask.png',
  'assets/units/Slime.png',
  'assets/units/Slime-Mask.png',
  'assets/units/Soldier-Blue.png',
  'assets/units/Soldier-Red.png',
  'assets/units/Soldier-Mask.png',
  'assets/units/Soldier-Yellow.png',
  'assets/units/Warrior-Blue.png',
  'assets/units/Warrior-Red.png',
  'assets/units/Warrior-Mask.png',

  // Assets - UI
  'assets/ui/crosshair.png',
]

const self = this // For scope

// Install Service Worker
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    await cache.addAll(CACHED_URLS)
    console.log('Service Worker installed')
  })())
})

// Listen for requests - Stale-while-revalidate
self.addEventListener('fetch', event => {
  const { request } = event
  const cachedResponsePromise = caches.match(request)
  const fetchedResponsePromise = fetch(request)
  const fetchedClone = fetchedResponsePromise.then(resp => resp.clone())

  event.respondWith(
    Promise.race([fetchedResponsePromise.catch(() => cachedResponsePromise), cachedResponsePromise])
      .then(resp => resp || fetchedResponsePromise || new Response('Offline', { status: 404 }))
      .catch(() => new Response('Error', { status: 404 }))
  )

  if (request.method === 'GET' && request.url.startsWith('http'))
    event.waitUntil(
      Promise.all([fetchedClone, caches.open(CACHE_NAME)])
        .then(([response, cache]) => cache.put(request, response))
        .catch(error => console.error('Caching error', event.request.url, error))
    )
})

// Clean up caches other than current
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys()
    await Promise.all(cacheNames
      .filter((cacheName) => cacheName !== CACHE_NAME)
      .map(cacheName => caches.delete(cacheName))
    )
  })())
})
