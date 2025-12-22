/**
 * Spotlight Window Management
 *
 * Creates and manages the floating spotlight search window.
 * Activated via global shortcut (Cmd+Shift+C).
 */

import { BrowserWindow, screen } from 'electron';
import path from 'path';

let spotlightWindow: BrowserWindow | null = null;

/**
 * Creates or focuses the spotlight search window.
 * Centered at top of screen, closes on blur.
 */
export function createSpotlightWindow(): BrowserWindow {
  if (spotlightWindow && !spotlightWindow.isDestroyed()) {
    spotlightWindow.focus();
    return spotlightWindow;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.workAreaSize;

  spotlightWindow = new BrowserWindow({
    width: 600,
    height: 56,
    x: Math.round((screenWidth - 600) / 2),
    y: 180,
    frame: false,
    transparent: true,
    vibrancy: 'under-window',
    visualEffectState: 'active',
    backgroundColor: '#00000000',
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    closable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  spotlightWindow.loadFile(path.join(__dirname, '../../static/spotlight.html'));

  // Close on blur (clicking outside)
  spotlightWindow.on('blur', () => {
    if (spotlightWindow && !spotlightWindow.isDestroyed()) {
      spotlightWindow.close();
    }
  });

  spotlightWindow.on('closed', () => {
    spotlightWindow = null;
  });

  return spotlightWindow;
}

/**
 * Returns the spotlight window instance.
 */
export function getSpotlightWindow(): BrowserWindow | null {
  return spotlightWindow && !spotlightWindow.isDestroyed() ? spotlightWindow : null;
}

/**
 * Resizes the spotlight window to fit content.
 */
export function resizeSpotlightWindow(height: number): void {
  const win = getSpotlightWindow();
  if (win) {
    const bounds = win.getBounds();
    win.setBounds({ ...bounds, height: Math.max(56, Math.min(height, 700)) });
  }
}
