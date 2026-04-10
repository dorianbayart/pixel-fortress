// Pixel Fortress - Release Notes Build Script
// Converts RELEASE_NOTES.md into release-notes.html using release-notes.template.html
//
// Usage: node scripts/build-release-notes.js

'use strict'

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const TEMPLATE_PATH = path.join(ROOT, 'release-notes.template.html')
const MARKDOWN_PATH = path.join(ROOT, 'RELEASE_NOTES.md')
const PACKAGE_PATH = path.join(ROOT, 'package.json')
const OUTPUT_PATH = path.join(ROOT, 'release-notes.html')

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Escape HTML special characters in plain text.
 */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Apply inline formatting to a line of text:
 *   **bold**  →  <strong>bold</strong>
 *   _italic_  →  <em>italic</em>
 *   `code`    →  <code>code</code>
 */
function applyInline(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
}

/**
 * Derive a stable anchor ID from a version title.
 * "Version 0.0.4" → "v0.0.4"
 * Falls back to "version-{index}" if no semver found.
 */
function makeVersionId(title, fallbackIndex) {
  const m = title.match(/(\d+\.\d+[\.\d]*)/)
  return m ? 'v' + m[1] : `version-${fallbackIndex}`
}

// ─── Markdown parser ──────────────────────────────────────────────────────────

/**
 * Parse the full markdown string and return an HTML string.
 *
 * Expected structure:
 *   # Title          (ignored — page already has a hero title)
 *   ## Version X.X.X  →  <div class="rn-version">
 *   ### Section name   →  <div class="rn-section">
 *   - item             →  <li> inside current section
 *   ---                →  end of version (visual separator, no extra element needed)
 *   plain paragraph    →  <p>
 */
function parseMarkdown(md) {
  const lines = md.split('\n')

  const versions = []       // array of { title, sections: [{ title, items }], paragraphs }
  let currentVersion = null
  let currentSection = null
  let pendingParagraphLines = []

  function flushParagraph() {
    if (!pendingParagraphLines.length) return
    const text = pendingParagraphLines.join(' ').trim()
    if (text && currentVersion) {
      currentVersion.paragraphs.push(text)
    }
    pendingParagraphLines = []
  }

  function startVersion(title) {
    flushParagraph()
    currentSection = null
    currentVersion = { title, sections: [], paragraphs: [] }
    versions.push(currentVersion)
  }

  function startSection(title) {
    flushParagraph()
    currentSection = { title, items: [] }
    if (currentVersion) currentVersion.sections.push(currentSection)
  }

  for (const raw of lines) {
    const line = raw.trimEnd()

    if (/^#{1}\s/.test(line)) {
      // H1 — top-level title, skip
      continue
    }

    if (/^#{2}\s/.test(line)) {
      startVersion(line.replace(/^#{2}\s*/, '').trim())
      continue
    }

    if (/^#{3}\s/.test(line)) {
      startSection(line.replace(/^#{3}\s*/, '').trim())
      continue
    }

    if (/^-{3,}$/.test(line)) {
      // Horizontal rule — version separator
      flushParagraph()
      continue
    }

    if (/^\s*-\s/.test(line)) {
      // List item
      flushParagraph()
      const itemText = line.replace(/^\s*-\s*/, '').trim()
      if (!currentSection && currentVersion) {
        currentSection = { title: null, items: [] }
        currentVersion.sections.push(currentSection)
      }
      if (currentSection) currentSection.items.push(itemText)
      continue
    }

    if (line.trim() === '') {
      flushParagraph()
      continue
    }

    // Plain text line — accumulate as paragraph
    pendingParagraphLines.push(line.trim())
  }

  flushParagraph()

  // ─── Build Table of Contents ────────────────────────────────────────────────

  const firstStableIndex = versions.findIndex(v => !v.title.includes('-'))
  const latestStableIndex = firstStableIndex === -1 ? 0 : firstStableIndex

  const tocItems = versions.map((v, i) => {
    const id = makeVersionId(v.title, i)
    const label = escapeHtml(v.title)
    return `<li><a href="#${id}">${label}</a></li>`
  })

  // Prepend a "Latest" shortcut pointing to the latest stable version
  const latestId = makeVersionId(versions[latestStableIndex].title, latestStableIndex)
  tocItems.unshift(`<li><a href="#${latestId}" class="rn-toc-latest">⭐ Latest</a></li>`)

  let html = `<nav class="rn-toc" aria-label="Version index">
  <h2>Versions</h2>
  <ul>
        ${tocItems.join('\n        ')}
  </ul>
</nav>\n\n`

  // ─── Build version blocks ────────────────────────────────────────────────────

  versions.forEach((version, i) => {
    const id = makeVersionId(version.title, i)
    const isPreRelease = version.title.includes('-')
    const isLatest = i === latestStableIndex

    html += `<div class="rn-version" id="${id}">\n`
    html += `  <div class="rn-version-header">\n`

    if (isPreRelease) {
      html += `    <span class="rn-version-badge dev">In Development</span>\n`
    } else if (isLatest) {
      html += `    <span class="rn-version-badge latest">Latest</span>\n`
    }
    html += `    <h2 class="rn-version-title">${escapeHtml(version.title)}</h2>\n`
    
    // Anchor link for sharing
    html += `    <a class="rn-anchor-link" href="#${id}" aria-label="Link to this version">#</a>\n`
    html += `  </div>\n`

    // Plain paragraphs (e.g. "This is the first release…")
    for (const para of version.paragraphs) {
      html += `  <p>${applyInline(escapeHtml(para))}</p>\n`
    }

    // Sections
    for (const section of version.sections) {
      html += `  <div class="rn-section">\n`
      if (section.title) {
        html += `    <h3 class="rn-section-title">${escapeHtml(section.title)}</h3>\n`
      }
      if (section.items.length) {
        html += `    <ul class="rn-list">\n`
        for (const item of section.items) {
          html += `      <li><span>${applyInline(escapeHtml(item))}</span></li>\n`
        }
        html += `    </ul>\n`
      }
      html += `  </div>\n`
    }

    html += `</div>\n\n`
  })

  return html.trimEnd()
}

// ─── Build ────────────────────────────────────────────────────────────────────

function build() {
  let template
  try {
    template = fs.readFileSync(TEMPLATE_PATH, 'utf8')
  } catch (e) {
    console.error(`Template not found: ${TEMPLATE_PATH}`)
    process.exit(1)
  }

  let markdown
  try {
    markdown = fs.readFileSync(MARKDOWN_PATH, 'utf8')
  } catch (e) {
    console.error(`RELEASE_NOTES.md not found: ${MARKDOWN_PATH}`)
    process.exit(1)
  }

  // Resolve {{version}} from package.json
  let gameVersion = '0.0.0'
  try {
    const pkg = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8'))
    gameVersion = pkg.version || gameVersion
  } catch (e) {
    console.warn('  [WARN] Could not read version from package.json, using fallback.')
  }
  markdown = markdown.replace(/\{\{version\}\}/g, gameVersion)
  console.log(`  Using version: ${gameVersion}`)

  const releaseNotesHtml = parseMarkdown(markdown)
  const html = template.replace('{{releaseNotesHtml}}', releaseNotesHtml)

  fs.writeFileSync(OUTPUT_PATH, html, 'utf8')

  const relPath = path.relative(ROOT, OUTPUT_PATH)
  console.log(`  ✓  ${relPath}`)
  console.log('\nBuild complete.')
}

console.log('Building release notes page...\n')
build()
