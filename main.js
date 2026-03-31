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

const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json')

ipcMain.handle('load-settings', async () => {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const raw = fs.readFileSync(SETTINGS_PATH, 'utf8')
      return JSON.parse(raw)
    }
  } catch (e) {
    console.error('Failed to load settings:', e)
  }
  return {}
})

ipcMain.handle('save-settings', async (_event, data) => {
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, 2), 'utf8')
    return true
  } catch (e) {
    console.error('Failed to save settings:', e)
    return false
  }
})

function createWindow () {
  const win = new BrowserWindow({
    width: 1400,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      devTools: !app.isPackaged,
    }
  });

  win.loadFile('play.html'); // Load the game HTML file

  win.on('ready-to-show', () => {
    win.removeMenu()
    win.show()
    win.maximize()
    win.focus()
  })
}

app.whenReady().then(() => {
  createWindow();

  // Prevent page refresh and DevTools shortcuts in production
  if (app.isPackaged) {
    globalShortcut.register('F5', () => {})
    globalShortcut.register('CommandOrControl+R', () => {})
    globalShortcut.register('Shift+CommandOrControl+R', () => {})
    globalShortcut.register('F12', () => {})
    globalShortcut.register('CommandOrControl+Shift+I', () => {})
    globalShortcut.register('CommandOrControl+Shift+J', () => {})
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});


// Steam stuff
// const greenworks = require('greenworks');
// const client = greenworks.init();

// Used to make the steam overlay work
app.commandLine.appendSwitch('in-process-gpu')
app.commandLine.appendSwitch('disable-direct-composition')
