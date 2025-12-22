/**
 * Main Window Management
 *
 * Creates and manages the primary application window.
 */

import { BrowserWindow } from 'electron';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

/**
 * Creates the main application window.
 * Uses vibrancy for macOS transparency effects.
 */
export function createMainWindow(): BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus();
    return mainWindow;
  }

  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    transparent: true,
    vibrancy: 'under-window',
    visualEffectState: 'active',
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
  });

  mainWindow.loadFile(path.join(__dirname, '../../static/index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

/**
 * Returns the main window instance.
 */
export function getMainWindow(): BrowserWindow | null {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
}

/**
 * Shows the settings view in the main window.
 */
export function showSettingsView(): void {
  const win = getMainWindow();
  if (win) {
    win.show();
    win.focus();
    win.webContents.send('show-settings-view');
  }
}

/**
 * Shows the knowledge view in the main window.
 */
export function showKnowledgeView(): void {
  const win = getMainWindow();
  if (win) {
    win.show();
    win.focus();
    win.webContents.send('show-knowledge-view');
  }
}
