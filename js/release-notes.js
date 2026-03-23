// Pixel Fortress — Release Notes Page JavaScript

'use strict'

const GITHUB_REPO = 'dorianbayart/pixel-fortress'

// ============================================
// Hero Particles
// ============================================
function initHeroParticles() {
  const hero = document.querySelector('.rn-hero')
  if (!hero || window.innerWidth <= 768) return

  const container = document.createElement('div')
  container.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:hidden;z-index:0;'
  hero.appendChild(container)

  const emojis = ['🌲', '⚔️', '🏰', '✨', '🗡️', '🛡️']
  for (let i = 0; i < 18; i++) {
    createParticle(container, emojis)
  }
}

function createParticle(container, emojis) {
  const particle = document.createElement('div')
  particle.textContent = emojis[Math.floor(Math.random() * emojis.length)]
  particle.style.cssText = `
    position: absolute;
    font-size: ${Math.random() * 20 + 10}px;
    opacity: ${Math.random() * 0.3 + 0.05};
    left: ${Math.random() * 100}%;
    top: ${Math.random() * 100}%;
    filter: drop-shadow(0 0 5px rgba(255, 215, 0, 0.3));
    pointer-events: none;
  `
  container.appendChild(particle)

  const duration = Math.random() * 12 + 10
  const distance = Math.random() * 120 + 40
  const delay = Math.random() * -duration

  particle.animate(
    [
      { transform: 'translateY(0px) rotate(0deg)', opacity: particle.style.opacity },
      { transform: `translateY(-${distance}px) rotate(360deg)`, opacity: 0 }
    ],
    {
      duration: duration * 1000,
      delay: delay * 1000,
      iterations: Infinity,
      easing: 'ease-in-out'
    }
  )
}

// ============================================
// Dynamic #latest anchor
// Adds id="latest" to the first .rn-version so that
// release-notes.html#latest always scrolls to the newest version,
// regardless of which version number is first.
// ============================================
function initLatestAnchor() {
  const first = document.querySelector('.rn-version')
  if (!first) return

  // Create a zero-height anchor that sits at the top of the block
  const anchor = document.createElement('div')
  anchor.id = 'latest'
  anchor.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;'
  first.style.position = 'relative'
  first.prepend(anchor)

  // If the page loaded with #latest, scroll now that the anchor exists
  if (window.location.hash === '#latest') {
    requestAnimationFrame(() => {
      const navbar = document.querySelector('.navbar')
      const offset = navbar ? navbar.offsetHeight + 20 : 20
      const top = first.getBoundingClientRect().top + window.pageYOffset - offset
      window.scrollTo({ top, behavior: 'smooth' })
    })
  }
}

// ============================================
// GitHub Releases
// Fetches the GitHub releases API and injects a
// "↗ GitHub Release" link into matching version blocks.
// Matching is done by normalizing the tag name to the
// same "vX.Y.Z" format used as block IDs by the build script.
// ============================================
function initGithubReleases() {
  fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases`)
    .then(res => {
      if (!res.ok) throw new Error(`GitHub API ${res.status}`)
      return res.json()
    })
    .then(releases => {
      releases.forEach(release => {
        // Normalize tag to "vX.Y.Z" to match block IDs
        const tag = release.tag_name.startsWith('v')
          ? release.tag_name
          : 'v' + release.tag_name

        const block = document.getElementById(tag)
        if (!block) return

        const header = block.querySelector('.rn-version-header')
        if (!header) return

        const link = document.createElement('a')
        link.href = release.html_url
        link.className = 'rn-github-release'
        link.target = '_blank'
        link.rel = 'noopener noreferrer'
        link.textContent = '↗ GitHub Release'
        // Insert before the anchor # link
        const anchorLink = header.querySelector('.rn-anchor-link')
        header.insertBefore(link, anchorLink)
      })
    })
    .catch(() => {
      // GitHub API unavailable — page still works without release links
    })
}

// ============================================
// Scroll Reveal for version blocks
// ============================================
function initScrollReveal() {
  const blocks = document.querySelectorAll('.rn-version')

  const reveal = () => {
    const windowHeight = window.innerHeight
    blocks.forEach(el => {
      if (el.getBoundingClientRect().top < windowHeight - 80) {
        el.style.opacity = '1'
        el.style.transform = 'translateY(0)'
      }
    })
  }

  blocks.forEach(el => {
    el.style.opacity = '0'
    el.style.transform = 'translateY(24px)'
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease'
  })

  window.addEventListener('scroll', reveal, { passive: true })
  reveal() // Run immediately for content already in view
}

// ============================================
// Localised Home link
// Reads the language saved by landing.js and rewrites the Home
// navbar link to the matching locale sub-path.
// The static href="index.html" in the source is left untouched for
// search-engine crawlers — only real users see the JS override.
// ============================================
const LANG_HOME_PATHS = {
  'en': 'index.html',
  'fr': 'fr/index.html',
  'de': 'de/index.html',
  'es': 'es/index.html'
}

function initLocalisedHomeLink() {
  try {
    const lang = localStorage.getItem('pixelFortress.language')
    if (!lang) return
    const path = LANG_HOME_PATHS[lang]
    if (!path) return
    const homeLink = document.querySelector('.nav-links a[href="index.html"]')
    if (homeLink) homeLink.setAttribute('href', path)
  } catch (e) {
    // localStorage unavailable — keep the default href
  }
}

// ============================================
// Init
// ============================================
function init() {
  initHeroParticles()
  initLatestAnchor()
  initScrollReveal()
  initGithubReleases()
  initLocalisedHomeLink()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
