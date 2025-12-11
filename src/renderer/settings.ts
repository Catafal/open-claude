// Settings renderer

const claude = (window as any).claude;

interface Settings {
  spotlightKeybind: string;
  spotlightPersistHistory: boolean;
  spotlightSystemPrompt: string;
  // TTS settings
  ttsEngine: 'kokoro' | 'vibevoice';
  vibevoiceModel: '0.5b' | '1.5b';
  vibevoiceServerUrl: string;
}

// DOM Elements
const keybindInput = document.getElementById('keybind-input') as HTMLElement;
const keybindDisplay = document.getElementById('keybind-display') as HTMLElement;
const persistHistoryCheckbox = document.getElementById('persist-history') as HTMLInputElement;
const systemPromptTextarea = document.getElementById('spotlight-system-prompt') as HTMLTextAreaElement;

// TTS DOM elements
const ttsEngineSelect = document.getElementById('tts-engine-select') as HTMLSelectElement;
const vibevoiceOptions = document.getElementById('vibevoice-options') as HTMLElement;
const vibevoiceModelSelect = document.getElementById('vibevoice-model-select') as HTMLSelectElement;
const vibevoiceUrlInput = document.getElementById('vibevoice-url-input') as HTMLInputElement;

// VibeVoice server status elements
const vibevoiceStatusIndicator = document.getElementById('vibevoice-status-indicator') as HTMLElement;
const vibevoiceStatusText = document.getElementById('vibevoice-status-text') as HTMLElement;
const vibevoiceCheckBtn = document.getElementById('vibevoice-check-btn') as HTMLButtonElement;

let isRecordingKeybind = false;
let currentSettings: Settings | null = null;
let pendingKeybind: string | null = null;

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

// Build accelerator string from current modifier state
function buildAcceleratorFromModifiers(e: KeyboardEvent): string {
  const parts: string[] = [];

  if (e.metaKey || e.ctrlKey) {
    parts.push('CommandOrControl');
  }
  if (e.shiftKey) {
    parts.push('Shift');
  }
  if (e.altKey) {
    parts.push('Alt');
  }

  return parts.join('+');
}

// Convert key event to Electron accelerator format
function keyEventToAccelerator(e: KeyboardEvent): { accelerator: string; isComplete: boolean } {
  const parts: string[] = [];

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

  // Check if this is a modifier-only press
  const isModifierOnly = ['Meta', 'Control', 'Shift', 'Alt'].includes(key);

  if (!isModifierOnly) {
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
  }

  return {
    accelerator: parts.join('+'),
    isComplete: !isModifierOnly && parts.length >= 2 // Need at least one modifier + one key
  };
}

// Load settings
async function loadSettings() {
  currentSettings = await claude.getSettings();

  if (currentSettings) {
    keybindDisplay.textContent = formatKeybind(currentSettings.spotlightKeybind);
    persistHistoryCheckbox.checked = currentSettings.spotlightPersistHistory;
    systemPromptTextarea.value = currentSettings.spotlightSystemPrompt || '';

    // TTS settings
    if (ttsEngineSelect) {
      ttsEngineSelect.value = currentSettings.ttsEngine || 'kokoro';
    }
    if (vibevoiceModelSelect) {
      vibevoiceModelSelect.value = currentSettings.vibevoiceModel || '0.5b';
    }
    if (vibevoiceUrlInput) {
      vibevoiceUrlInput.value = currentSettings.vibevoiceServerUrl || 'http://localhost:8000';
    }
    // Show/hide VibeVoice options based on engine
    if (vibevoiceOptions) {
      vibevoiceOptions.style.display = currentSettings.ttsEngine === 'vibevoice' ? 'block' : 'none';
      // Auto-check server status if VibeVoice is selected
      if (currentSettings.ttsEngine === 'vibevoice') {
        checkVibeVoiceServer();
      }
    }
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

// Stop recording and save if we have a valid keybind
function stopRecording(save: boolean) {
  if (!isRecordingKeybind) return;

  isRecordingKeybind = false;
  keybindInput.classList.remove('recording');

  if (save && pendingKeybind) {
    saveKeybind(pendingKeybind);
  } else if (currentSettings) {
    keybindDisplay.textContent = formatKeybind(currentSettings.spotlightKeybind);
  }

  pendingKeybind = null;
}

// Keybind recording
keybindInput.addEventListener('click', () => {
  if (!isRecordingKeybind) {
    isRecordingKeybind = true;
    pendingKeybind = null;
    keybindInput.classList.add('recording');
    keybindDisplay.textContent = 'Press keys...';
    keybindInput.focus();
  }
});

keybindInput.addEventListener('keydown', (e) => {
  if (!isRecordingKeybind) return;

  e.preventDefault();
  e.stopPropagation();

  // Handle Escape to cancel
  if (e.key === 'Escape') {
    stopRecording(false);
    return;
  }

  // Handle Enter to confirm
  if (e.key === 'Enter' && pendingKeybind) {
    stopRecording(true);
    return;
  }

  const result = keyEventToAccelerator(e);

  // Update display to show current keys being pressed
  if (result.accelerator) {
    keybindDisplay.textContent = formatKeybind(result.accelerator);

    // If we have a complete combo (modifier + key), store it as pending
    if (result.isComplete) {
      pendingKeybind = result.accelerator;
    }
  }
});

keybindInput.addEventListener('blur', () => {
  // Save pending keybind on blur (clicking away)
  stopRecording(!!pendingKeybind);
});

// Persist history toggle
persistHistoryCheckbox.addEventListener('change', () => {
  savePersistHistory(persistHistoryCheckbox.checked);
});

// System prompt textarea - save on blur (when user clicks away)
systemPromptTextarea.addEventListener('blur', async () => {
  if (!currentSettings) return;
  currentSettings = await claude.saveSettings({ spotlightSystemPrompt: systemPromptTextarea.value });
});

// TTS engine select - show/hide vibevoice options and save
ttsEngineSelect?.addEventListener('change', async () => {
  if (!currentSettings) return;
  const engine = ttsEngineSelect.value as 'kokoro' | 'vibevoice';
  // Show/hide VibeVoice-specific options
  if (vibevoiceOptions) {
    vibevoiceOptions.style.display = engine === 'vibevoice' ? 'block' : 'none';
  }
  currentSettings = await claude.saveSettings({ ttsEngine: engine });
  // Auto-check server when switching to VibeVoice
  if (engine === 'vibevoice') {
    checkVibeVoiceServer();
  }
});

// VibeVoice model select
vibevoiceModelSelect?.addEventListener('change', async () => {
  if (!currentSettings) return;
  currentSettings = await claude.saveSettings({
    vibevoiceModel: vibevoiceModelSelect.value as '0.5b' | '1.5b'
  });
});

// VibeVoice server URL - save on blur and recheck status
vibevoiceUrlInput?.addEventListener('blur', async () => {
  if (!currentSettings) return;
  currentSettings = await claude.saveSettings({ vibevoiceServerUrl: vibevoiceUrlInput.value });
  // Recheck server status with new URL
  checkVibeVoiceServer();
});

/**
 * Check if VibeVoice server is running and update status indicator.
 * Pings the server's health endpoint to verify connection.
 */
async function checkVibeVoiceServer() {
  if (!vibevoiceStatusIndicator || !vibevoiceStatusText) return;

  const serverUrl = vibevoiceUrlInput?.value || 'http://localhost:8000';

  // Set checking state
  vibevoiceStatusIndicator.className = 'status-indicator status-checking';
  vibevoiceStatusText.textContent = 'Checking...';

  try {
    // Use IPC to check server (avoids CORS issues in renderer)
    const isConnected = await claude.checkVibeVoiceServer(serverUrl);

    if (isConnected) {
      vibevoiceStatusIndicator.className = 'status-indicator status-connected';
      vibevoiceStatusText.textContent = 'Connected';
    } else {
      vibevoiceStatusIndicator.className = 'status-indicator status-disconnected';
      vibevoiceStatusText.textContent = 'Not running';
    }
  } catch (error) {
    vibevoiceStatusIndicator.className = 'status-indicator status-disconnected';
    vibevoiceStatusText.textContent = 'Not running';
  }
}

// VibeVoice check button click handler
vibevoiceCheckBtn?.addEventListener('click', () => {
  checkVibeVoiceServer();
});

// Load settings on page load
window.addEventListener('load', loadSettings);
