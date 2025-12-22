/**
 * Keyboard Binding Utility Functions
 *
 * Functions for handling Electron keyboard shortcuts.
 * Converts between KeyboardEvents and Electron accelerator format.
 */

// Detect if we're on macOS for platform-specific key symbols
export const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

/**
 * Formats an Electron accelerator string for display.
 * Converts "CommandOrControl+Shift+Space" to "⌘ + ⇧ + Space" on Mac.
 */
export function formatKeybind(keybind: string): string {
  return keybind
    .replace('CommandOrControl', isMac ? '\u2318' : 'Ctrl')
    .replace('Command', '\u2318')
    .replace('Control', 'Ctrl')
    .replace('Shift', '\u21E7')
    .replace('Alt', '\u2325')
    .replace('Option', '\u2325')
    .replace(/\+/g, ' + ');
}

/**
 * Key name mapping for special keys to Electron format.
 */
const SPECIAL_KEY_MAP: Record<string, string> = {
  'ArrowUp': 'Up',
  'ArrowDown': 'Down',
  'ArrowLeft': 'Left',
  'ArrowRight': 'Right',
  'Escape': 'Escape',
  'Enter': 'Return',
  'Backspace': 'Backspace',
  'Delete': 'Delete',
  'Tab': 'Tab',
};

/**
 * Converts a KeyboardEvent to an Electron accelerator string.
 * Returns the accelerator and whether it's complete (has non-modifier key).
 */
export function keyEventToAccelerator(e: KeyboardEvent): { accelerator: string; isComplete: boolean } {
  const parts: string[] = [];

  // Add modifiers
  if (e.metaKey || e.ctrlKey) parts.push('CommandOrControl');
  if (e.shiftKey) parts.push('Shift');
  if (e.altKey) parts.push('Alt');

  let key = e.key;
  const isModifierOnly = ['Meta', 'Control', 'Shift', 'Alt'].includes(key);

  if (!isModifierOnly) {
    // Normalize key names
    if (key === ' ') key = 'Space';
    if (key.length === 1) key = key.toUpperCase();

    // Map special keys to Electron format
    if (SPECIAL_KEY_MAP[key]) key = SPECIAL_KEY_MAP[key];
    parts.push(key);
  }

  return {
    accelerator: parts.join('+'),
    isComplete: !isModifierOnly && parts.length >= 2
  };
}

/**
 * Builds an accelerator string from just modifiers (for live preview).
 */
export function buildAcceleratorFromModifiers(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.metaKey || e.ctrlKey) parts.push('CommandOrControl');
  if (e.shiftKey) parts.push('Shift');
  if (e.altKey) parts.push('Alt');
  return parts.join('+');
}
