// Pixel Fortress - Sitemap Build Script
// Generates sitemap.xml with hreflang alternates, accurate lastmod dates,
// changefreq and priority hints for all public pages.
//
// lastmod is derived from the most recent git commit touching the page's
// source files, so it reflects actual content changes rather than CI timestamps.
//
// Output: sitemap.xml
//
// Usage: node scripts/build-sitemap.js

'use strict'

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// ─── Configuration ────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '..')
const OUTPUT_PATH = path.join(ROOT, 'sitemap.xml')
const BASE_URL = 'https://dorianbayart.github.io/pixel-fortress'

const TEMPLATE     = path.join(ROOT, 'index.template.html')
const LOCALE_EN    = path.join(ROOT, 'locales', 'landing', 'en.json')
const LOCALE_FR    = path.join(ROOT, 'locales', 'landing', 'fr.json')
const LOCALE_DE    = path.join(ROOT, 'locales', 'landing', 'de.json')
const LOCALE_ES    = path.join(ROOT, 'locales', 'landing', 'es.json')
const RELEASE_NOTES_MD = path.join(ROOT, 'RELEASE_NOTES.md')
const PLAY_HTML        = path.join(ROOT, 'play.html')

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Return the ISO date (YYYY-MM-DD) of the most recent git commit that touched
 * any of the given files. Falls back to today's date if git is unavailable or
 * the files have never been committed.
 */
function gitLastMod(...filePaths) {
  let latest = new Date(0)

  for (const filePath of filePaths) {
    try {
      const raw = execSync(
        `git log -1 --format="%cI" -- "${path.relative(ROOT, filePath)}"`,
        { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
      ).trim()

      if (raw) {
        const d = new Date(raw)
        if (d > latest) latest = d
      }
    } catch {
      // git not available or file not tracked — continue
    }
  }

  const date = latest.getTime() ? latest : new Date()
  return date.toISOString().split('T')[0]
}

/**
 * Build a single <url> block.
 */
function buildUrlBlock(loc, lastmod, changefreq, priority, alternates) {
  const lines = [
    '  <url>',
    `    <loc>${loc}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
  ]

  for (const { lang, href } of alternates) {
    lines.push(`    <xhtml:link rel="alternate" hreflang="${lang}" href="${href}"/>`)
  }

  lines.push('  </url>')
  return lines.join('\n')
}

// ─── Page definitions ─────────────────────────────────────────────────────────

// All landing pages share the same hreflang group
const LANDING_ALTERNATES = [
  { lang: 'en',        href: `${BASE_URL}/` },
  { lang: 'fr',        href: `${BASE_URL}/fr/` },
  { lang: 'de',        href: `${BASE_URL}/de/` },
  { lang: 'es',        href: `${BASE_URL}/es/` },
  { lang: 'x-default', href: `${BASE_URL}/` },
]

const PAGES = [
  {
    loc: `${BASE_URL}/`,
    sources:     [TEMPLATE, LOCALE_EN],
    changefreq:  'weekly',
    priority:    '1.0',
    alternates:  LANDING_ALTERNATES,
  },
  {
    loc: `${BASE_URL}/fr/`,
    sources:     [TEMPLATE, LOCALE_FR],
    changefreq:  'weekly',
    priority:    '0.9',
    alternates:  LANDING_ALTERNATES,
  },
  {
    loc: `${BASE_URL}/de/`,
    sources:     [TEMPLATE, LOCALE_DE],
    changefreq:  'weekly',
    priority:    '0.9',
    alternates:  LANDING_ALTERNATES,
  },
  {
    loc: `${BASE_URL}/es/`,
    sources:     [TEMPLATE, LOCALE_ES],
    changefreq:  'weekly',
    priority:    '0.9',
    alternates:  LANDING_ALTERNATES,
  },
  {
    loc: `${BASE_URL}/play.html`,
    // play.html is a shell — actual game content lives in JS modules.
    // RELEASE_NOTES.md is updated on every release and is the best proxy
    // for when the game itself last changed.
    sources:     [RELEASE_NOTES_MD, PLAY_HTML],
    changefreq:  'weekly',
    priority:    '0.8',
    alternates:  [],
  },
  {
    loc: `${BASE_URL}/release-notes.html`,
    sources:     [RELEASE_NOTES_MD],
    changefreq:  'weekly',
    priority:    '0.7',
    alternates:  [],
  },
]

// ─── Build ────────────────────────────────────────────────────────────────────

function build() {
  const urlBlocks = PAGES.map(p => {
    const lastmod = gitLastMod(...p.sources)
    console.log(`  ${p.loc}  →  lastmod ${lastmod}`)
    return buildUrlBlock(p.loc, lastmod, p.changefreq, p.priority, p.alternates)
  })

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset',
    '  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '  xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    '',
    urlBlocks.join('\n\n'),
    '',
    '</urlset>',
    '',
  ].join('\n')

  fs.writeFileSync(OUTPUT_PATH, xml, 'utf8')

  const relPath = path.relative(ROOT, OUTPUT_PATH)
  console.log(`\n  ✓  ${relPath}  (${PAGES.length} URL${PAGES.length !== 1 ? 's' : ''})`)
  console.log('\nBuild complete.')
}

console.log('Building sitemap.xml...\n')
build()
