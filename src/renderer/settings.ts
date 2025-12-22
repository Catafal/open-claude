// Settings renderer

import { isMac, formatKeybind, keyEventToAccelerator, buildAcceleratorFromModifiers } from './utils/index.js';

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

// ============================================================================
// Memory Settings
// ============================================================================

// Memory DOM elements
const memoryEnabledCheckbox = document.getElementById('memory-enabled') as HTMLInputElement;
const memoryOptions = document.getElementById('memory-options') as HTMLElement;
const memorySupabaseUrl = document.getElementById('memory-supabase-url') as HTMLInputElement;
const memorySupabaseKey = document.getElementById('memory-supabase-key') as HTMLInputElement;
const memoryStatusIndicator = document.getElementById('memory-status-indicator') as HTMLElement;
const memoryStatusText = document.getElementById('memory-status-text') as HTMLElement;
const memoryTestBtn = document.getElementById('memory-test-btn') as HTMLButtonElement;

// Memory settings state
interface MemorySettings {
  enabled: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

let memorySettings: MemorySettings | null = null;

/**
 * Load memory settings from backend.
 */
async function loadMemorySettings() {
  try {
    memorySettings = await claude.memoryGetSettings();

    if (memorySettings && memoryEnabledCheckbox) {
      memoryEnabledCheckbox.checked = memorySettings.enabled;
    }
    if (memorySettings && memorySupabaseUrl) {
      memorySupabaseUrl.value = memorySettings.supabaseUrl || '';
    }
    if (memorySettings && memorySupabaseKey) {
      memorySupabaseKey.value = memorySettings.supabaseAnonKey || '';
    }

    // Update status indicator based on config
    updateMemoryStatusDisplay();
  } catch (error) {
    console.error('Failed to load memory settings:', error);
  }
}

/**
 * Update memory status indicator display.
 */
function updateMemoryStatusDisplay() {
  if (!memoryStatusIndicator || !memoryStatusText) return;

  if (!memorySettings?.supabaseUrl || !memorySettings?.supabaseAnonKey) {
    memoryStatusIndicator.className = 'status-indicator status-unknown';
    memoryStatusText.textContent = 'Not configured';
  } else if (!memorySettings.enabled) {
    memoryStatusIndicator.className = 'status-indicator status-unknown';
    memoryStatusText.textContent = 'Disabled';
  }
}

/**
 * Test memory (Supabase) connection.
 */
async function testMemoryConnection() {
  if (!memoryStatusIndicator || !memoryStatusText) return;

  // Set checking state
  memoryStatusIndicator.className = 'status-indicator status-checking';
  memoryStatusText.textContent = 'Testing...';

  try {
    const result = await claude.memoryTestConnection();

    if (result.success) {
      memoryStatusIndicator.className = 'status-indicator status-connected';
      memoryStatusText.textContent = 'Connected';
    } else {
      memoryStatusIndicator.className = 'status-indicator status-disconnected';
      memoryStatusText.textContent = result.error || 'Connection failed';
    }
  } catch (error) {
    memoryStatusIndicator.className = 'status-indicator status-disconnected';
    memoryStatusText.textContent = 'Connection failed';
  }
}

// Memory enabled toggle
memoryEnabledCheckbox?.addEventListener('change', async () => {
  if (!memorySettings) return;
  memorySettings = await claude.memorySaveSettings({ enabled: memoryEnabledCheckbox.checked });
  updateMemoryStatusDisplay();
});

// Memory Supabase URL - save on blur
memorySupabaseUrl?.addEventListener('blur', async () => {
  if (!memorySettings) return;
  memorySettings = await claude.memorySaveSettings({ supabaseUrl: memorySupabaseUrl.value });
  updateMemoryStatusDisplay();
});

// Memory Supabase Key - save on blur
memorySupabaseKey?.addEventListener('blur', async () => {
  if (!memorySettings) return;
  memorySettings = await claude.memorySaveSettings({ supabaseAnonKey: memorySupabaseKey.value });
  updateMemoryStatusDisplay();
});

// Memory test connection button
memoryTestBtn?.addEventListener('click', async () => {
  await testMemoryConnection();
  // After successful connection, check cloud status for sync
  if (memoryStatusIndicator?.classList.contains('status-connected')) {
    await checkCloudSyncStatus();
  }
});

// ============================================================================
// Personal Assistant Settings (Google Services)
// ============================================================================

// Assistant DOM elements
const assistantEnabledCheckbox = document.getElementById('assistant-enabled') as HTMLInputElement;
const assistantOptions = document.getElementById('assistant-options') as HTMLElement;
const assistantClientId = document.getElementById('assistant-client-id') as HTMLInputElement;
const assistantClientSecret = document.getElementById('assistant-client-secret') as HTMLInputElement;
const assistantAccountsList = document.getElementById('assistant-accounts-list') as HTMLElement;
const assistantAddAccountBtn = document.getElementById('assistant-add-account-btn') as HTMLButtonElement;

// Assistant settings state
interface GoogleAccount {
  email: string;
  enabled: boolean;
}

interface AssistantSettings {
  enabled: boolean;
  googleAccounts: GoogleAccount[];
  googleClientId?: string;
  googleClientSecret?: string;
}

let assistantSettings: AssistantSettings | null = null;

/**
 * Load assistant settings from backend.
 */
async function loadAssistantSettings() {
  try {
    assistantSettings = await claude.assistantGetSettings();

    if (assistantSettings && assistantEnabledCheckbox) {
      assistantEnabledCheckbox.checked = assistantSettings.enabled;
    }
    if (assistantSettings && assistantClientId) {
      assistantClientId.value = assistantSettings.googleClientId || '';
    }
    if (assistantSettings && assistantClientSecret) {
      assistantClientSecret.value = assistantSettings.googleClientSecret || '';
    }

    renderAssistantAccounts();
  } catch (error) {
    console.error('Failed to load assistant settings:', error);
  }
}

/**
 * Render the list of connected Google accounts.
 */
function renderAssistantAccounts() {
  if (!assistantAccountsList || !assistantSettings) return;

  const accounts = assistantSettings.googleAccounts || [];

  if (accounts.length === 0) {
    assistantAccountsList.innerHTML = '<div class="no-accounts">No Google accounts connected</div>';
    return;
  }

  assistantAccountsList.innerHTML = accounts.map(account => `
    <div class="account-item" data-email="${account.email}">
      <div class="account-info">
        <span class="account-email">${account.email}</span>
        <span class="account-status ${account.enabled ? 'enabled' : 'disabled'}">
          ${account.enabled ? 'Active' : 'Disabled'}
        </span>
      </div>
      <div class="account-actions">
        <button class="btn-small account-toggle" data-email="${account.email}" data-enabled="${account.enabled}">
          ${account.enabled ? 'Disable' : 'Enable'}
        </button>
        <button class="btn-small btn-danger account-remove" data-email="${account.email}">
          Remove
        </button>
      </div>
    </div>
  `).join('');

  // Add event listeners to account buttons
  assistantAccountsList.querySelectorAll('.account-toggle').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const email = (e.target as HTMLElement).dataset.email;
      const enabled = (e.target as HTMLElement).dataset.enabled === 'true';
      if (email) {
        await claude.assistantToggleAccount(email, !enabled);
        await loadAssistantSettings();
      }
    });
  });

  assistantAccountsList.querySelectorAll('.account-remove').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const email = (e.target as HTMLElement).dataset.email;
      if (email && confirm(`Remove Google account ${email}?`)) {
        await claude.assistantRemoveGoogleAccount(email);
        await loadAssistantSettings();
      }
    });
  });
}

// Assistant enabled toggle
assistantEnabledCheckbox?.addEventListener('change', async () => {
  if (!assistantSettings) return;
  await claude.assistantSaveSettings({ enabled: assistantEnabledCheckbox.checked });
  assistantSettings.enabled = assistantEnabledCheckbox.checked;
});

// Assistant Client ID - save on blur
assistantClientId?.addEventListener('blur', async () => {
  if (!assistantSettings) return;
  await claude.assistantSaveSettings({ googleClientId: assistantClientId.value });
  assistantSettings.googleClientId = assistantClientId.value;
});

// Assistant Client Secret - save on blur
assistantClientSecret?.addEventListener('blur', async () => {
  if (!assistantSettings) return;
  await claude.assistantSaveSettings({ googleClientSecret: assistantClientSecret.value });
  assistantSettings.googleClientSecret = assistantClientSecret.value;
});

// Add Google Account button
assistantAddAccountBtn?.addEventListener('click', async () => {
  assistantAddAccountBtn.disabled = true;
  assistantAddAccountBtn.textContent = 'Connecting...';

  try {
    const result = await claude.assistantAddGoogleAccount();

    if (result.success) {
      await loadAssistantSettings();
    } else {
      alert(`Failed to add account: ${result.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Failed to add Google account:', error);
    alert('Failed to add Google account. Check console for details.');
  } finally {
    assistantAddAccountBtn.disabled = false;
    assistantAddAccountBtn.innerHTML = '<span class="btn-icon">+</span> Add Google Account';
  }
});

// ============================================================================
// Gemini YouTube Agent Settings
// ============================================================================

// Gemini DOM elements
const geminiEnabledCheckbox = document.getElementById('gemini-enabled') as HTMLInputElement;
const geminiOptions = document.getElementById('gemini-options') as HTMLElement;
const geminiStatusIndicator = document.getElementById('gemini-status-indicator') as HTMLElement;
const geminiStatusText = document.getElementById('gemini-status-text') as HTMLElement;
const geminiLoginBtn = document.getElementById('gemini-login-btn') as HTMLButtonElement;

// Gemini settings state
interface GeminiSettings {
  enabled: boolean;
}

let geminiSettings: GeminiSettings | null = null;

/**
 * Load Gemini settings and check authentication status.
 */
async function loadGeminiSettings() {
  try {
    geminiSettings = await claude.geminiGetSettings();

    if (geminiSettings && geminiEnabledCheckbox) {
      geminiEnabledCheckbox.checked = geminiSettings.enabled;
    }

    // Check authentication status
    await checkGeminiAuthStatus();
  } catch (error) {
    console.error('Failed to load Gemini settings:', error);
  }
}

/**
 * Check if user is authenticated with Gemini and update status indicator.
 */
async function checkGeminiAuthStatus() {
  if (!geminiStatusIndicator || !geminiStatusText) return;

  geminiStatusIndicator.className = 'status-indicator status-checking';
  geminiStatusText.textContent = 'Checking...';

  try {
    const isAuthenticated = await claude.geminiIsAuthenticated();

    if (isAuthenticated) {
      geminiStatusIndicator.className = 'status-indicator status-connected';
      geminiStatusText.textContent = 'Logged in';
      updateGeminiLoginButton(true);
    } else {
      geminiStatusIndicator.className = 'status-indicator status-disconnected';
      geminiStatusText.textContent = 'Not logged in';
      updateGeminiLoginButton(false);
    }
  } catch (error) {
    geminiStatusIndicator.className = 'status-indicator status-disconnected';
    geminiStatusText.textContent = 'Error checking status';
  }
}

/**
 * Update Gemini login button appearance based on auth state.
 * Uses safe DOM manipulation instead of innerHTML.
 */
function updateGeminiLoginButton(isLoggedIn: boolean) {
  if (!geminiLoginBtn) return;

  // Clear existing content
  geminiLoginBtn.textContent = '';

  // Create icon span
  const iconSpan = document.createElement('span');
  iconSpan.className = 'btn-icon';
  iconSpan.textContent = isLoggedIn ? '✓' : '🔑';

  // Add icon and text
  geminiLoginBtn.appendChild(iconSpan);
  geminiLoginBtn.appendChild(document.createTextNode(isLoggedIn ? ' Logged in to Gemini' : ' Login to Gemini'));

  // Update button class
  if (isLoggedIn) {
    geminiLoginBtn.classList.add('btn-success');
  } else {
    geminiLoginBtn.classList.remove('btn-success');
  }
}

// Gemini enabled toggle
geminiEnabledCheckbox?.addEventListener('change', async () => {
  if (!geminiSettings) return;
  geminiSettings = await claude.geminiSaveSettings({ enabled: geminiEnabledCheckbox.checked });
});

// Gemini login button - opens Gemini web login window
geminiLoginBtn?.addEventListener('click', async () => {
  geminiLoginBtn.disabled = true;
  geminiLoginBtn.textContent = '⏳ Opening login...';

  try {
    const result = await claude.geminiLogin();

    if (result.success) {
      await checkGeminiAuthStatus();
    } else {
      alert(`Login failed: ${result.error || 'Unknown error'}`);
      await checkGeminiAuthStatus();
    }
  } catch (error) {
    console.error('Gemini login failed:', error);
    alert('Failed to open Gemini login. Check console for details.');
    await checkGeminiAuthStatus();
  } finally {
    geminiLoginBtn.disabled = false;
  }
});

// ============================================================================
// Settings Sync (Cloud Storage)
// ============================================================================

// Sync DOM elements
const syncStatusText = document.getElementById('sync-status-text') as HTMLElement;
const syncPullBtn = document.getElementById('sync-pull-btn') as HTMLButtonElement;
const syncPushBtn = document.getElementById('sync-push-btn') as HTMLButtonElement;
const settingsSyncSection = document.getElementById('settings-sync-section') as HTMLElement;

/**
 * Check if cloud has settings and update sync UI.
 * Called after successful Supabase connection.
 */
async function checkCloudSyncStatus() {
  if (!syncStatusText || !syncPullBtn || !syncPushBtn) return;

  syncStatusText.textContent = 'Checking cloud...';
  syncPullBtn.disabled = true;
  syncPushBtn.disabled = true;

  try {
    const result = await claude.settingsSyncHasCloud();

    if (result.error) {
      syncStatusText.textContent = 'Sync unavailable';
      return;
    }

    if (result.hasCloud) {
      syncStatusText.textContent = 'Cloud has settings';
      syncStatusText.classList.add('has-cloud');
      syncPullBtn.disabled = false;  // Allow pull from cloud
    } else {
      syncStatusText.textContent = 'No cloud settings';
      syncStatusText.classList.remove('has-cloud');
    }

    // Always allow push (to save local to cloud)
    syncPushBtn.disabled = false;
  } catch (error) {
    syncStatusText.textContent = 'Sync error';
    console.error('Failed to check cloud sync status:', error);
  }
}

/**
 * Pull settings from cloud and apply locally.
 * Overwrites local settings with cloud values.
 */
async function pullFromCloud() {
  if (!syncStatusText || !syncPullBtn) return;

  const originalText = syncPullBtn.textContent;
  syncPullBtn.textContent = 'Pulling...';
  syncPullBtn.disabled = true;

  try {
    const result = await claude.settingsSyncPull();

    if (result.success) {
      syncStatusText.textContent = 'Settings pulled!';
      // Reload all settings to reflect changes
      await loadSettings();
      await loadMemorySettings();
      await loadAssistantSettings();
      // Re-check status
      setTimeout(() => checkCloudSyncStatus(), 1000);
    } else {
      syncStatusText.textContent = result.error || 'Pull failed';
    }
  } catch (error) {
    syncStatusText.textContent = 'Pull failed';
    console.error('Failed to pull settings from cloud:', error);
  } finally {
    syncPullBtn.innerHTML = '<span class="btn-icon">↓</span> Pull from Cloud';
    syncPullBtn.disabled = false;
  }
}

/**
 * Push local settings to cloud.
 * Overwrites cloud settings with local values.
 */
async function pushToCloud() {
  if (!syncStatusText || !syncPushBtn) return;

  const originalText = syncPushBtn.textContent;
  syncPushBtn.textContent = 'Pushing...';
  syncPushBtn.disabled = true;

  try {
    const result = await claude.settingsSyncPush();

    if (result.success) {
      syncStatusText.textContent = 'Settings saved to cloud!';
      syncStatusText.classList.add('has-cloud');
      // Re-check status
      setTimeout(() => checkCloudSyncStatus(), 1000);
    } else {
      syncStatusText.textContent = result.error || 'Push failed';
    }
  } catch (error) {
    syncStatusText.textContent = 'Push failed';
    console.error('Failed to push settings to cloud:', error);
  } finally {
    syncPushBtn.innerHTML = '<span class="btn-icon">↑</span> Push to Cloud';
    syncPushBtn.disabled = false;
  }
}

// Sync button event listeners
syncPullBtn?.addEventListener('click', pullFromCloud);
syncPushBtn?.addEventListener('click', pushToCloud);

// Load settings on page load
window.addEventListener('load', () => {
  loadSettings();
  loadMemorySettings();
  loadAssistantSettings();
  loadGeminiSettings();
});
