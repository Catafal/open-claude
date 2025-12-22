/**
 * Renderer Utility Functions
 *
 * Shared utilities for all renderer processes (main, spotlight, settings, etc.)
 */

// HTML utilities
export { escapeHtml, escapeHtmlFast } from './html.js';

// Formatting utilities
export { formatFileSize, formatDate, formatTime } from './format.js';

// Keyboard binding utilities
export { isMac, formatKeybind, keyEventToAccelerator, buildAcceleratorFromModifiers } from './keybind.js';
