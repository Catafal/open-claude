/**
 * Window Management Module
 *
 * Centralized exports for all window-related functionality.
 * Use this module to create, access, and manage application windows.
 */

// Main window
export {
  createMainWindow,
  getMainWindow,
  showSettingsView,
  showKnowledgeView
} from './main-window.js';

// Spotlight window
export {
  createSpotlightWindow,
  getSpotlightWindow,
  resizeSpotlightWindow
} from './spotlight-window.js';

// Prompt selector window
export {
  createPromptSelectorWindow,
  getPromptSelectorWindow,
  closePromptSelectorWindow
} from './prompt-selector-window.js';

// System tray
export {
  createTray,
  getTray,
  updateTrayMenu,
  type TrayConfig
} from './tray.js';
