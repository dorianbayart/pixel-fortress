/*
 * Pixel Fortress - A 2D real-time strategy game
 * Copyright (C) 2026 Dorian Bayart
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

export { init, t, setLanguage, getLanguage, getSupportedLanguages }

'use strict'

import gameState from 'state'

const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
]

let currentLocale = {}
let currentLanguage = 'en'

/**
 * Returns the list of supported languages
 */
function getSupportedLanguages() {
  return SUPPORTED_LANGUAGES
}

/**
 * Returns the current language code
 */
function getLanguage() {
  return currentLanguage
}

/**
 * Load a locale JSON file
 */
async function loadLocale(lang) {
  try {
    const response = await fetch(`./locales/${lang}.json`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.json()
  } catch (e) {
    console.warn(`[i18n] Failed to load locale '${lang}':`, e)
    return null
  }
}

/**
 * Persist the language preference
 */
async function saveLanguagePreference(lang) {
  if (window.electronAPI) {
    try {
      const existing = await window.electronAPI.loadSettings()
      await window.electronAPI.saveSettings({ ...existing, language: lang })
    } catch (e) {
      console.warn('[i18n] Failed to save language via electronAPI:', e)
    }
  } else {
    try {
      localStorage.setItem('pixelFortress.language', lang)
    } catch (e) {
      console.warn('[i18n] Failed to save language to localStorage:', e)
    }
  }
}

/**
 * Load the saved language preference
 */
async function loadLanguagePreference() {
  if (window.electronAPI) {
    try {
      const settings = await window.electronAPI.loadSettings()
      if (settings && settings.language) return settings.language
    } catch (e) {
      // fallthrough
    }
  }
  try {
    const saved = localStorage.getItem('pixelFortress.language')
    if (saved) return saved
  } catch (e) {
    // fallthrough
  }
  return null
}

/**
 * Detect the best matching language from navigator.language
 */
function detectBrowserLanguage() {
  const nav = navigator.language || ''
  const prefix = nav.split('-')[0].toLowerCase()
  const match = SUPPORTED_LANGUAGES.find(l => l.code === prefix)
  return match ? match.code : 'en'
}

/**
 * Initialize the i18n module
 * Detects language: saved pref → browser language → 'en'
 */
async function init() {
  let lang = await loadLanguagePreference()
  if (!lang || !SUPPORTED_LANGUAGES.find(l => l.code === lang)) {
    lang = detectBrowserLanguage()
  }

  const locale = await loadLocale(lang)
  if (locale) {
    currentLocale = locale
    currentLanguage = lang
  } else {
    // Fall back to English
    const fallback = await loadLocale('en')
    currentLocale = fallback || {}
    currentLanguage = 'en'
  }

  // Update state
  gameState.updateSettings({ language: currentLanguage })
}

/**
 * Set a new language, load its locale, persist the preference,
 * and emit a 'language-changed' event
 */
async function setLanguage(lang) {
  if (!SUPPORTED_LANGUAGES.find(l => l.code === lang)) {
    console.warn(`[i18n] Unsupported language: ${lang}`)
    return
  }

  const locale = await loadLocale(lang)
  if (!locale) return

  currentLocale = locale
  currentLanguage = lang

  await saveLanguagePreference(lang)
  gameState.updateSettings({ language: lang })
  gameState.events.emit('language-changed', lang)
}

/**
 * Resolve a dot-separated key in the locale object, with optional variable interpolation.
 * Falls back to the key string if not found.
 *
 * @param {string} key - Dot-separated path, e.g. 'menu.play'
 * @param {Object} [vars] - Variables to interpolate, e.g. { name: 'Wood Hut' }
 * @returns {string}
 */
function t(key, vars = null) {
  const parts = key.split('.')
  let value = currentLocale
  for (const part of parts) {
    if (value && typeof value === 'object' && part in value) {
      value = value[part]
    } else {
      // Key not found — return the last segment as fallback
      return key.split('.').pop()
    }
  }

  if (typeof value !== 'string') return key.split('.').pop()

  if (vars) {
    return value.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`))
  }

  return value
}
