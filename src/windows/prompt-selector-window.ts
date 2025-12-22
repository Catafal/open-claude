/**
 * Prompt Selector Window Management
 *
 * Creates and manages the floating prompt selector window.
 * Activated via global shortcut (Cmd+Shift+X).
 */

import { BrowserWindow, screen } from 'electron';
import path from 'path';

let promptSelectorWindow: BrowserWindow | null = null;

/**
 * Creates or focuses the prompt selector window.
 * Centered at top of screen, closes on blur.
 */
export function createPromptSelectorWindow(): BrowserWindow {
  if (promptSelectorWindow && !promptSelectorWindow.isDestroyed()) {
    promptSelectorWindow.focus();
    return promptSelectorWindow;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.workAreaSize;

  promptSelectorWindow = new BrowserWindow({
    width: 500,
    height: 520,  // Taller for improve mode results
    x: Math.round((screenWidth - 500) / 2),
    y: 150,
    frame: false,
    transparent: true,
    vibrancy: 'under-window',
    visualEffectState: 'active',
    backgroundColor: '#00000000',
    resizable: true,  // Allow resize for large content
    minWidth: 400,
    minHeight: 350,
    maxHeight: 700,
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

  promptSelectorWindow.loadFile(path.join(__dirname, '../../static/prompt-selector.html'));

  // Close on blur (clicking outside)
  promptSelectorWindow.on('blur', () => {
    if (promptSelectorWindow && !promptSelectorWindow.isDestroyed()) {
      promptSelectorWindow.close();
    }
  });

  promptSelectorWindow.on('closed', () => {
    promptSelectorWindow = null;
  });

  return promptSelectorWindow;
}

/**
 * Returns the prompt selector window instance.
 */
export function getPromptSelectorWindow(): BrowserWindow | null {
  return promptSelectorWindow && !promptSelectorWindow.isDestroyed() ? promptSelectorWindow : null;
}

/**
 * Closes the prompt selector window.
 */
export function closePromptSelectorWindow(): void {
  const win = getPromptSelectorWindow();
  if (win) {
    win.close();
  }
}
