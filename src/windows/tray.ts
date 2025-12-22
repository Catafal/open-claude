/**
 * System Tray Management
 *
 * Creates and manages the menu bar tray icon.
 * macOS only: App runs in menu bar without dock icon.
 */

import { app, Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import { createMainWindow, getMainWindow, showSettingsView, showKnowledgeView } from './main-window.js';
import { createSpotlightWindow } from './spotlight-window.js';

let tray: Tray | null = null;

export interface TrayConfig {
  spotlightKeybind: string;
}

/**
 * Creates the menu bar tray icon with context menu.
 */
export function createTray(config: TrayConfig): Tray | null {
  try {
    // Load pre-sized tray icon (22x22) for menu bar
    const iconPath = path.join(__dirname, '../../build/trayIcon.png');
    const trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) {
      console.warn('[Tray] Icon not found at:', iconPath);
      return null;
    }

    // Template image auto-adapts to light/dark menu bar
    trayIcon.setTemplateImage(true);

    tray = new Tray(trayIcon);
    tray.setToolTip('Open Claude');

    // Build context menu for tray
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show Window',
        click: () => {
          const win = getMainWindow();
          if (win) {
            win.show();
            win.focus();
          } else {
            createMainWindow();
          }
        }
      },
      {
        label: 'Spotlight',
        accelerator: config.spotlightKeybind,
        click: () => createSpotlightWindow()
      },
      {
        label: 'Settings',
        click: () => showSettingsView()
      },
      {
        label: 'Knowledge',
        click: () => showKnowledgeView()
      },
      { type: 'separator' },
      {
        label: 'Quit',
        accelerator: 'CommandOrControl+Q',
        click: () => app.quit()
      }
    ]);

    tray.setContextMenu(contextMenu);

    // Click on tray icon shows main window (macOS standard behavior)
    tray.on('click', () => {
      const win = getMainWindow();
      if (win) {
        win.show();
        win.focus();
      } else {
        createMainWindow();
      }
    });

    return tray;
  } catch (error) {
    console.error('[Tray] Failed to create tray:', error);
    return null;
  }
}

/**
 * Returns the tray instance.
 */
export function getTray(): Tray | null {
  return tray;
}

/**
 * Updates the tray menu (e.g., when keybind changes).
 */
export function updateTrayMenu(config: TrayConfig): void {
  if (!tray) return;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Window',
      click: () => {
        const win = getMainWindow();
        if (win) {
          win.show();
          win.focus();
        } else {
          createMainWindow();
        }
      }
    },
    {
      label: 'Spotlight',
      accelerator: config.spotlightKeybind,
      click: () => createSpotlightWindow()
    },
    {
      label: 'Settings',
      click: () => showSettingsView()
    },
    {
      label: 'Knowledge',
      click: () => showKnowledgeView()
    },
    { type: 'separator' },
    {
      label: 'Quit',
      accelerator: 'CommandOrControl+Q',
      click: () => app.quit()
    }
  ]);

  tray.setContextMenu(contextMenu);
}
