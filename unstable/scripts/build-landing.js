// Pixel Fortress - Landing Page Build Script
// Generates static localized HTML files from index.template.html + locales/landing/*.json
//
// Output:
//   index.html          → English (canonical)
//   fr/index.html       → French
//   de/index.html       → German
//   es/index.html       → Spanish
//
// Usage: node scripts/build-landing.js

'use strict'

const fs = require('fs')
const path = require('path')

// ─── Configuration ────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '..')
const TEMPLATE_PATH = path.join(ROOT, 'index.template.html')
const LOCALES_DIR = path.join(ROOT, 'locales', 'landing')
const BASE_URL = 'https://dorianbayart.github.io/pixel-fortress'

const LANGUAGES = [
  { code: 'en', outDir: ROOT,                  root: '',    canonical: `${BASE_URL}/`,     ogLocale: 'en_US' },
  { code: 'fr', outDir: path.join(ROOT, 'fr'), root: '../', canonical: `${BASE_URL}/fr/`,  ogLocale: 'fr_FR' },
  { code: 'de', outDir: path.join(ROOT, 'de'), root: '../', canonical: `${BASE_URL}/de/`,  ogLocale: 'de_DE' },
  { code: 'es', outDir: path.join(ROOT, 'es'), root: '../', canonical: `${BASE_URL}/es/`,  ogLocale: 'es_ES' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Flatten a nested object into dot-separated keys.
 * { meta: { title: 'Foo' } } → { 'meta.title': 'Foo' }
 */
function flattenObject(obj, prefix = '') {
  return Object.entries(obj).reduce((acc, [key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(acc, flattenObject(value, fullKey))
    } else {
      acc[fullKey] = String(value)
    }
    return acc
  }, {})
}

/**
 * Replace all {{key}} placeholders in a template string.
 * Warns if a placeholder has no matching translation.
 */
function applyTranslations(template, translations, langCode) {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(translations, key)) {
      return translations[key]
    }
    console.warn(`  [WARN] Missing translation key "${key}" for lang "${langCode}"`)
    return match
  })
}

// ─── Build ────────────────────────────────────────────────────────────────────

function build() {
  // Read template
  let template
  try {
    template = fs.readFileSync(TEMPLATE_PATH, 'utf8')
  } catch (e) {
    console.error(`Template not found: ${TEMPLATE_PATH}`)
    process.exit(1)
  }

  let built = 0
  let errors = 0

  for (const lang of LANGUAGES) {
    const localePath = path.join(LOCALES_DIR, `${lang.code}.json`)

    let locale
    try {
      locale = JSON.parse(fs.readFileSync(localePath, 'utf8'))
    } catch (e) {
      const msg = e.code === 'ENOENT' ? `Locale file not found: ${localePath}` : `Failed to parse ${localePath}: ${e.message}`
      console.error(`  [ERROR] ${msg}`)
      errors++
      continue
    }

    // Flatten nested locale keys + add build-time variables
    const translations = flattenObject(locale)
    translations['root'] = lang.root
    translations['canonical'] = lang.canonical
    translations['ogLocale'] = lang.ogLocale

    // Apply all substitutions
    const html = applyTranslations(template, translations, lang.code)

    // Ensure output directory exists
    fs.mkdirSync(lang.outDir, { recursive: true })

    const outPath = path.join(lang.outDir, 'index.html')
    fs.writeFileSync(outPath, html, 'utf8')

    const relPath = path.relative(ROOT, outPath)
    console.log(`  ✓  ${relPath}  (${lang.code})`)
    built++
  }

  console.log(`\nBuild complete: ${built} file(s) generated${errors ? `, ${errors} error(s)` : ''}.`)
  if (errors) process.exit(1)
}

console.log('Building localized landing pages...\n')
build()
