// Settings renderer

const claude = (window as any).claude;

interface Settings {
  spotlightKeybind: string;
  spotlightPersistHistory: boolean;
}

// DOM Elements
const keybindInput = document.getElementById('keybind-input') as HTMLElement;
const keybindDisplay = document.getElementById('keybind-display') as HTMLElement;
const persistHistoryCheckbox = document.getElementById('persist-history') as HTMLInputElement;

let isRecordingKeybind = false;
let currentSettings: Settings | null = null;

// Detect if we're on macOS
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

// Format keybind for display
function formatKeybind(keybind: string): string {
  return keybind
    .replace('CommandOrControl', isMac ? '\u2318' : 'Ctrl')
    .replace('Command', '\u2318')
    .replace('Control', 'Ctrl')
    .replace('Shift', '\u21E7')
    .replace('Alt', '\u2325')
    .replace('Option', '\u2325')
    .replace(/\+/g, ' + ');
}

// Convert key event to Electron accelerator format
function keyEventToAccelerator(e: KeyboardEvent): string | null {
  const parts: string[] = [];

  // Must have at least one modifier
  if (!e.metaKey && !e.ctrlKey && !e.altKey) {
    return null;
  }

  if (e.metaKey || e.ctrlKey) {
    parts.push('CommandOrControl');
  }
  if (e.shiftKey) {
    parts.push('Shift');
  }
  if (e.altKey) {
    parts.push('Alt');
  }

  // Get the key
  let key = e.key;

  // Ignore modifier-only presses
  if (['Meta', 'Control', 'Shift', 'Alt'].includes(key)) {
    return null;
  }

  // Normalize key names
  if (key === ' ') key = 'Space';
  if (key.length === 1) key = key.toUpperCase();

  // Map special keys
  const keyMap: Record<string, string> = {
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

  if (keyMap[key]) {
    key = keyMap[key];
  }

  parts.push(key);

  return parts.join('+');
}

// Load settings
async function loadSettings() {
  currentSettings = await claude.getSettings();

  if (currentSettings) {
    keybindDisplay.textContent = formatKeybind(currentSettings.spotlightKeybind);
    persistHistoryCheckbox.checked = currentSettings.spotlightPersistHistory;
  }
}

// Save keybind
async function saveKeybind(keybind: string) {
  if (!currentSettings) return;

  currentSettings = await claude.saveSettings({ spotlightKeybind: keybind });
  keybindDisplay.textContent = formatKeybind(keybind);
}

// Save persist history
async function savePersistHistory(value: boolean) {
  if (!currentSettings) return;

  currentSettings = await claude.saveSettings({ spotlightPersistHistory: value });
}

// Keybind recording
keybindInput.addEventListener('click', () => {
  if (!isRecordingKeybind) {
    isRecordingKeybind = true;
    keybindInput.classList.add('recording');
    keybindDisplay.textContent = 'Press keys...';
    keybindInput.focus();
  }
});

keybindInput.addEventListener('keydown', (e) => {
  if (!isRecordingKeybind) return;

  e.preventDefault();
  e.stopPropagation();

  const accelerator = keyEventToAccelerator(e);

  if (accelerator) {
    isRecordingKeybind = false;
    keybindInput.classList.remove('recording');
    saveKeybind(accelerator);
  }
});

keybindInput.addEventListener('blur', () => {
  if (isRecordingKeybind) {
    isRecordingKeybind = false;
    keybindInput.classList.remove('recording');
    // Restore current keybind display
    if (currentSettings) {
      keybindDisplay.textContent = formatKeybind(currentSettings.spotlightKeybind);
    }
  }
});

// Escape to cancel recording
keybindInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isRecordingKeybind) {
    isRecordingKeybind = false;
    keybindInput.classList.remove('recording');
    if (currentSettings) {
      keybindDisplay.textContent = formatKeybind(currentSettings.spotlightKeybind);
    }
  }
});

// Persist history toggle
persistHistoryCheckbox.addEventListener('change', () => {
  savePersistHistory(persistHistoryCheckbox.checked);
});

// Load settings on page load
window.addEventListener('load', loadSettings);
