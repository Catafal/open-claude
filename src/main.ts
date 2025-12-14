import { app, BrowserWindow, ipcMain, session, globalShortcut, screen, Tray, Menu, nativeImage, dialog, shell } from 'electron';
import path from 'path';
import crypto from 'crypto';
import { isAuthenticated, getOrgId, makeRequest, streamCompletion, stopResponse, generateTitle, store, BASE_URL, prepareAttachmentPayload } from './api/client';
import { createStreamState, processSSEChunk, type StreamCallbacks } from './streaming/parser';
import type { SettingsSchema, AttachmentPayload, UploadFilePayload, KnowledgeSettingsStore, NotionSettingsStore, TrackedNotionPage } from './types';
import {
  generateEmbedding,
  initQdrantClient,
  ensureCollection,
  upsertVectors,
  searchVectors,
  deleteVectors,
  deleteBySource,
  listItems,
  chunkText,
  parseFile,
  parseUrl,
  initFirecrawl,
  DEFAULT_KNOWLEDGE_SETTINGS,
  DEFAULT_NOTION_SETTINGS,
  initNotionClient,
  testNotionConnection,
  listNotionPages,
  fetchPageContent,
  extractPageIdFromUrl,
  fetchPageMeta,
  fetchChildPages,
  // Knowledge Supabase registry
  initKnowledgeSupabase,
  isKnowledgeSupabaseReady,
  registerDocument,
  unregisterDocument,
  listDocuments,
  type KnowledgeSettings,
  type NotionSettings,
  type KnowledgeItem
} from './knowledge';
import {
  processRagQuery,
  formatContextForClaude,
  initOllamaClient,
  checkOllamaHealth,
  DEFAULT_RAG_SETTINGS,
  type RAGSettings
} from './rag';
import {
  initSupabaseClient,
  testSupabaseConnection,
  initMemoryWorker,
  addConversationPair,
  scheduleProcessing,
  flushBuffer,
  getMemoriesForContext
} from './memory';
import type { MemorySettingsStore } from './types';
import { checkForUpdatesAndNotify } from './updater';
import {
  initSettingsSyncClient,
  loadSettingsFromCloud,
  saveSettingsToCloud,
  hasCloudSettings,
  type CloudSettings
} from './settings';

let mainWindow: BrowserWindow | null = null;
let spotlightWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// Knowledge settings (loaded from store)
let knowledgeSettings: KnowledgeSettings = { ...DEFAULT_KNOWLEDGE_SETTINGS };

// Notion settings (loaded from store)
let notionSettings: NotionSettings = { ...DEFAULT_NOTION_SETTINGS };

// RAG settings (loaded from store)
let ragSettings: RAGSettings = { ...DEFAULT_RAG_SETTINGS };

// Memory settings defaults
const DEFAULT_MEMORY_SETTINGS: MemorySettingsStore = {
  enabled: false,  // Disabled by default until configured
  supabaseUrl: '',
  supabaseAnonKey: ''
};

// Memory settings (loaded from store)
let memorySettings: MemorySettingsStore = { ...DEFAULT_MEMORY_SETTINGS };

// Default settings
const DEFAULT_SETTINGS: SettingsSchema = {
  spotlightKeybind: 'CommandOrControl+Shift+C',
  spotlightPersistHistory: true,
  spotlightSystemPrompt: 'search for real citations that verify your response, if you do some affirmation',
  // TTS defaults - Kokoro is fast & local, VibeVoice needs server
  ttsEngine: 'kokoro',
  vibevoiceModel: '0.5b',
  vibevoiceServerUrl: 'http://localhost:8000',
};

// Get settings with defaults
function getSettings(): SettingsSchema {
  const stored = store.get('settings');
  return { ...DEFAULT_SETTINGS, ...stored };
}

// Save settings
function saveSettings(settings: Partial<SettingsSchema>) {
  const current = getSettings();
  store.set('settings', { ...current, ...settings });
}

// Register spotlight shortcut
function registerSpotlightShortcut() {
  globalShortcut.unregisterAll();
  const settings = getSettings();
  const keybind = settings.spotlightKeybind || DEFAULT_SETTINGS.spotlightKeybind;

  try {
    globalShortcut.register(keybind, () => {
      createSpotlightWindow();
    });
  } catch (e) {
    // Fallback to default if custom keybind fails
    console.error('Failed to register keybind:', keybind, e);
    globalShortcut.register(DEFAULT_SETTINGS.spotlightKeybind, () => {
      createSpotlightWindow();
    });
  }
}

// Create spotlight search window
function createSpotlightWindow() {
  if (spotlightWindow && !spotlightWindow.isDestroyed()) {
    spotlightWindow.focus();
    return;
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
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  spotlightWindow.loadFile(path.join(__dirname, '../static/spotlight.html'));

  // Close on blur (clicking outside)
  spotlightWindow.on('blur', () => {
    if (spotlightWindow && !spotlightWindow.isDestroyed()) {
      spotlightWindow.close();
    }
  });

  spotlightWindow.on('closed', () => {
    spotlightWindow = null;
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    transparent: true,
    vibrancy: 'under-window',
    visualEffectState: 'active',
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
  });

  mainWindow.loadFile(path.join(__dirname, '../static/index.html'));
}

// Show settings view in main window (inline navigation)
function showSettingsView() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('show-settings-view');
  }
}

/**
 * Creates the menu bar tray icon with context menu.
 * macOS only: App runs in menu bar without dock icon.
 */
function createTray() {
  try {
    // Load pre-sized tray icon (22x22) for menu bar
    const iconPath = path.join(__dirname, '../build/trayIcon.png');
    const trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) return;

    // Template image auto-adapts to light/dark menu bar
    trayIcon.setTemplateImage(true);

    tray = new Tray(trayIcon);
    tray.setToolTip('Open Claude');

    // Build context menu for tray
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show Window',
        click: () => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.show();
            mainWindow.focus();
          } else {
            createMainWindow();
          }
        }
      },
      {
        label: 'Spotlight',
        accelerator: getSettings().spotlightKeybind,
        click: () => createSpotlightWindow()
      },
      {
        label: 'Settings',
        click: () => showSettingsView()
      },
      {
        label: 'Knowledge',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
            mainWindow.webContents.send('show-knowledge-view');
          }
        }
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
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.focus();
      } else {
        createMainWindow();
      }
    });
  } catch (error) {
    console.error('[Tray] Failed to create tray:', error);
  }
}

// IPC handlers

// Spotlight window resize
ipcMain.handle('spotlight-resize', async (_event, height: number) => {
  if (spotlightWindow && !spotlightWindow.isDestroyed()) {
    const maxHeight = 700;
    const newHeight = Math.min(height, maxHeight);
    spotlightWindow.setSize(600, newHeight);
  }
});

// Spotlight conversation state
let spotlightConversationId: string | null = null;
let spotlightParentMessageUuid: string | null = null;
let spotlightMessages: Array<{ role: 'user' | 'assistant'; text: string }> = [];

// Spotlight send message (supports Haiku or Opus model)
ipcMain.handle('spotlight-send', async (_event, message: string, model?: string) => {
  const orgId = await getOrgId();
  if (!orgId) throw new Error('Not authenticated');

  // Determine model ID based on selection (default to haiku)
  const modelId = model === 'opus'
    ? 'claude-opus-4-5-20251101'
    : 'claude-haiku-4-5-20251001';

  // Get system prompt from settings and prepend if configured
  const settings = getSettings();
  const systemPrompt = settings.spotlightSystemPrompt?.trim();
  const promptWithSystem = systemPrompt
    ? `[System instruction: ${systemPrompt}]\n\n${message}`
    : message;

  if (!spotlightConversationId) {
    // Create spotlight conversation in incognito mode (is_temporary: true)
    const createResult = await makeRequest(
      `${BASE_URL}/api/organizations/${orgId}/chat_conversations`,
      'POST',
      {
        name: '',
        model: modelId,
        is_temporary: true,
        include_conversation_preferences: true
      }
    );

    if (createResult.status !== 201 && createResult.status !== 200) {
      throw new Error('Failed to create conversation');
    }

    const convData = createResult.data as { uuid: string };
    spotlightConversationId = convData.uuid;
    spotlightParentMessageUuid = null;
  }

  const conversationId = spotlightConversationId;
  const parentMessageUuid = spotlightParentMessageUuid || conversationId;

  // Store user message
  spotlightMessages.push({ role: 'user', text: message });

  const state = createStreamState();

  const callbacks: StreamCallbacks = {
    onTextDelta: (text, fullText) => {
      spotlightWindow?.webContents.send('spotlight-stream', { text, fullText });
    },
    onThinkingStart: () => {
      spotlightWindow?.webContents.send('spotlight-thinking', { isThinking: true });
    },
    onThinkingDelta: (thinking) => {
      spotlightWindow?.webContents.send('spotlight-thinking-stream', { thinking });
    },
    onThinkingStop: (thinkingText) => {
      spotlightWindow?.webContents.send('spotlight-thinking', { isThinking: false, thinkingText });
    },
    onToolStart: (toolName, msg) => {
      spotlightWindow?.webContents.send('spotlight-tool', { toolName, isRunning: true, message: msg });
    },
    onToolStop: (toolName, input) => {
      spotlightWindow?.webContents.send('spotlight-tool', { toolName, isRunning: false, input });
    },
    onToolResult: (toolName, result, isError) => {
      spotlightWindow?.webContents.send('spotlight-tool-result', { toolName, isError, result });
    },
    onComplete: (fullText, _steps, messageUuid) => {
      // Store assistant response
      spotlightMessages.push({ role: 'assistant', text: fullText });
      spotlightWindow?.webContents.send('spotlight-complete', { fullText, messageUuid });

      // Add to memory buffer if enabled (schedule extraction after 10 min)
      if (memorySettings.enabled) {
        addConversationPair(message, fullText, 'spotlight');
        scheduleProcessing();
      }
    }
  };

  // === Memory + RAG Processing for Spotlight ===
  let finalPrompt = promptWithSystem;
  let memoryContext = '';

  // Retrieve relevant memories if enabled
  if (memorySettings.enabled && knowledgeSettings.collectionName) {
    try {
      memoryContext = await getMemoriesForContext(message, knowledgeSettings.collectionName, 5, 0.4);
      if (memoryContext) {
        console.log('[Memory/Spotlight] Retrieved memories for context');
      }
    } catch (memError: unknown) {
      console.error('[Memory/Spotlight] Error retrieving memories:', memError);
    }
  }

  if (ragSettings.enabled && knowledgeSettings.collectionName) {
    try {
      // Notify Spotlight UI: Agent is analyzing
      spotlightWindow?.webContents.send('spotlight-rag', {
        status: 'agent_thinking',
        message: 'Searching knowledge...'
      });

      const ragResult = await processRagQuery(
        message,  // Use original message for RAG decision, not the system-prompted version
        knowledgeSettings.collectionName,
        ragSettings
      );

      // Use cleaned_query to remove "my files/notes" references
      const cleanedQuery = ragResult.decision.cleaned_query || message;
      const cleanedPromptWithSystem = systemPrompt
        ? `[System instruction: ${systemPrompt}]\n\n${cleanedQuery}`
        : cleanedQuery;

      if (ragResult.decision.needs_retrieval && ragResult.contexts.length > 0) {
        // Notify Spotlight UI: Found context
        spotlightWindow?.webContents.send('spotlight-rag', {
          status: 'complete',
          message: `Found ${ragResult.contexts.length} sources`
        });

        // Inject memories + knowledge context + cleaned query
        finalPrompt = memoryContext + formatContextForClaude(ragResult.contexts) + cleanedPromptWithSystem;
        console.log(`[RAG/Spotlight] Injected ${ragResult.contexts.length} context chunks`);
        console.log(`[RAG/Spotlight] Cleaned query: "${cleanedQuery}"`);
      } else if (ragResult.decision.needs_retrieval) {
        // Retrieval was needed but no results found - still use cleaned query
        spotlightWindow?.webContents.send('spotlight-rag', {
          status: 'skipped',
          message: 'No matching content'
        });
        finalPrompt = memoryContext + cleanedPromptWithSystem;
        console.log(`[RAG/Spotlight] No results, using cleaned query: "${cleanedQuery}"`);
      } else {
        // Notify Spotlight UI: No retrieval needed, but still include memories
        spotlightWindow?.webContents.send('spotlight-rag', {
          status: 'skipped',
          message: ''
        });
        finalPrompt = memoryContext + promptWithSystem;
      }
    } catch (ragError: unknown) {
      // Non-blocking error - continue with memories only
      const errorMessage = ragError instanceof Error ? ragError.message : String(ragError);
      console.error('[RAG/Spotlight] Error (continuing):', errorMessage);
      spotlightWindow?.webContents.send('spotlight-rag', {
        status: 'error',
        message: 'RAG unavailable'
      });
      finalPrompt = memoryContext + promptWithSystem;
    }
  } else if (memoryContext) {
    // RAG disabled but we have memories - still inject them
    finalPrompt = memoryContext + promptWithSystem;
  }
  // === End RAG Processing ===

  // Use finalPrompt (includes RAG context + system instruction) for the API call
  await streamCompletion(orgId, conversationId, finalPrompt, parentMessageUuid, (chunk) => {
    processSSEChunk(chunk, state, callbacks);
  });

  if (state.lastMessageUuid) {
    spotlightParentMessageUuid = state.lastMessageUuid;
  }

  return { conversationId, fullText: state.fullResponse, messageUuid: state.lastMessageUuid };
});

// Reset spotlight conversation when window is closed
ipcMain.handle('spotlight-reset', async () => {
  const settings = getSettings();
  // Only reset if persist history is disabled
  if (!settings.spotlightPersistHistory) {
    spotlightConversationId = null;
    spotlightParentMessageUuid = null;
    spotlightMessages = [];
  }
});

// Get spotlight conversation history from local state
ipcMain.handle('spotlight-get-history', async () => {
  const settings = getSettings();
  if (!settings.spotlightPersistHistory || spotlightMessages.length === 0) {
    return { hasHistory: false, messages: [] };
  }

  return { hasHistory: true, messages: spotlightMessages };
});

// Force new spotlight conversation
ipcMain.handle('spotlight-new-chat', async () => {
  spotlightConversationId = null;
  spotlightParentMessageUuid = null;
  spotlightMessages = [];
});

// ============================================================================
// TTS (Text-to-Speech) using Kokoro-82M
// ============================================================================

// Lazy-loaded Kokoro TTS instance (stays in memory after first use)
let kokoroTTS: any = null;

/**
 * Get or initialize the Kokoro TTS model.
 * Uses lazy loading to avoid slow startup - model loads on first TTS request.
 * Includes retry logic for network failures during model download.
 */
async function getKokoroTTS(retries = 3): Promise<any> {
  if (kokoroTTS) return kokoroTTS;

  const { KokoroTTS } = await import('kokoro-js');

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[TTS] Loading Kokoro model (attempt ${attempt}/${retries})...`);
      kokoroTTS = await KokoroTTS.from_pretrained(
        'onnx-community/Kokoro-82M-v1.0-ONNX',
        { dtype: 'q8', device: 'cpu' }
      );
      console.log('[TTS] Kokoro model loaded successfully');
      return kokoroTTS;
    } catch (err: any) {
      console.error(`[TTS] Attempt ${attempt} failed:`, err.message || err);
      if (attempt === retries) throw err;
      // Wait before retrying (1s, 2s, 3s...)
      await new Promise(r => setTimeout(r, attempt * 1000));
    }
  }
  throw new Error('Failed to load Kokoro model after retries');
}

/**
 * Generate speech using local VibeVoice server.
 * Server must be running: python -m vibevoice_api.server --port 8000
 * Uses OpenAI-compatible /v1/audio/speech endpoint.
 */
async function generateVibeVoiceSpeech(
  text: string,
  serverUrl: string
): Promise<{ samples: number[]; sampleRate: number }> {
  const response = await fetch(`${serverUrl}/v1/audio/speech`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: text,
      voice: 'af_heart',
      response_format: 'pcm'
    })
  });

  if (!response.ok) {
    throw new Error(`VibeVoice server error: ${response.status}`);
  }

  // Convert audio buffer to Float32Array samples
  const audioBuffer = await response.arrayBuffer();
  const samples = new Float32Array(audioBuffer);

  return {
    samples: Array.from(samples),
    sampleRate: 24000
  };
}

/**
 * TTS IPC handler - converts text to speech.
 * Routes to Kokoro (local) or VibeVoice (server) based on settings.
 */
ipcMain.handle('spotlight-speak', async (_event, text: string) => {
  try {
    const settings = getSettings();

    // Route to VibeVoice if selected and server URL configured
    if (settings.ttsEngine === 'vibevoice') {
      console.log('[TTS] Using VibeVoice server:', settings.vibevoiceServerUrl);
      return generateVibeVoiceSpeech(text, settings.vibevoiceServerUrl);
    }

    // Default: Use Kokoro (fast, local)
    const tts = await getKokoroTTS();
    const audio = await tts.generate(text, { voice: 'af_heart' });

    return {
      samples: Array.from(audio.audio as Float32Array),
      sampleRate: audio.sampling_rate || 24000
    };
  } catch (error) {
    console.error('[TTS] Error generating speech:', error);
    throw error;
  }
});

/**
 * Check if VibeVoice server is running by pinging its health endpoint.
 * Returns true if server responds, false otherwise.
 */
ipcMain.handle('check-vibevoice-server', async (_event, serverUrl: string) => {
  try {
    // Try to reach the server's root or models endpoint
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000); // 3s timeout

    const response = await fetch(`${serverUrl}/v1/models`, {
      method: 'GET',
      signal: controller.signal
    });

    clearTimeout(timeout);
    return response.ok;
  } catch (error) {
    // Server not running or network error
    return false;
  }
});

ipcMain.handle('get-auth-status', async () => {
  return isAuthenticated();
});

ipcMain.handle('login', async () => {
  const authWindow = new BrowserWindow({
    width: 500,
    height: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: 'Sign in to Claude',
  });

  authWindow.loadURL(`${BASE_URL}/login`);

  const checkCookies = async (): Promise<{ success: boolean; error?: string } | null> => {
    const cookies = await session.defaultSession.cookies.get({ domain: '.claude.ai' });
    const sessionKey = cookies.find(c => c.name === 'sessionKey')?.value;
    const orgId = cookies.find(c => c.name === 'lastActiveOrg')?.value;

    if (sessionKey && orgId) {
      console.log('[Auth] Got cookies from webview!');
      authWindow.close();
      store.set('orgId', orgId);
      return { success: true };
    }
    return null;
  };

  return new Promise((resolve) => {
    authWindow.webContents.on('did-finish-load', async () => {
      const result = await checkCookies();
      if (result) resolve(result);
    });

    const interval = setInterval(async () => {
      if (authWindow.isDestroyed()) {
        clearInterval(interval);
        return;
      }
      const result = await checkCookies();
      if (result) {
        clearInterval(interval);
        resolve(result);
      }
    }, 1000);

    authWindow.on('closed', () => {
      clearInterval(interval);
      resolve({ success: false, error: 'Window closed' });
    });
  });
});

ipcMain.handle('logout', async () => {
  store.clear();
  await session.defaultSession.clearStorageData({ storages: ['cookies'] });
  return { success: true };
});

// Create a new conversation
ipcMain.handle('create-conversation', async (_event, model?: string) => {
  const orgId = await getOrgId();
  if (!orgId) throw new Error('Not authenticated');

  const conversationId = crypto.randomUUID();
  const url = `${BASE_URL}/api/organizations/${orgId}/chat_conversations`;

  console.log('[API] Creating conversation:', conversationId, 'with model:', model || 'claude-opus-4-5-20251101');
  console.log('[API] URL:', url);

  // Create conversation in incognito mode (is_temporary: true)
  // Incognito chats aren't saved, added to memory, or used to train models
  const result = await makeRequest(url, 'POST', {
    uuid: conversationId,
    name: '',
    model: model || 'claude-opus-4-5-20251101',
    is_temporary: true,
    include_conversation_preferences: true
  });

  console.log('[API] Create conversation response:', result.status, JSON.stringify(result.data));

  if (result.status !== 200 && result.status !== 201) {
    throw new Error(`Failed to create conversation: ${result.status} - ${JSON.stringify(result.data)}`);
  }

  // The response includes the conversation data with uuid
  const data = result.data as { uuid?: string };
  return { conversationId, parentMessageUuid: data.uuid || conversationId, ...(result.data as object) };
});

// Get list of conversations
ipcMain.handle('get-conversations', async () => {
  const orgId = await getOrgId();
  if (!orgId) throw new Error('Not authenticated');

  const url = `${BASE_URL}/api/organizations/${orgId}/chat_conversations?limit=30&starred=false&consistency=eventual`;
  const result = await makeRequest(url, 'GET');

  if (result.status !== 200) {
    throw new Error(`Failed to get conversations: ${result.status}`);
  }

  return result.data;
});

// Load a specific conversation with messages
ipcMain.handle('load-conversation', async (_event, convId: string) => {
  const orgId = await getOrgId();
  if (!orgId) throw new Error('Not authenticated');

  const url = `${BASE_URL}/api/organizations/${orgId}/chat_conversations/${convId}?tree=True&rendering_mode=messages&render_all_tools=true&consistency=eventual`;
  const result = await makeRequest(url, 'GET');

  if (result.status !== 200) {
    throw new Error(`Failed to load conversation: ${result.status}`);
  }

  return result.data;
});

// Delete a conversation
ipcMain.handle('delete-conversation', async (_event, convId: string) => {
  const orgId = await getOrgId();
  if (!orgId) throw new Error('Not authenticated');

  const url = `${BASE_URL}/api/organizations/${orgId}/chat_conversations/${convId}`;
  const result = await makeRequest(url, 'DELETE');

  if (result.status !== 200 && result.status !== 204) {
    throw new Error(`Failed to delete conversation: ${result.status}`);
  }

  return { success: true };
});

// Rename a conversation
ipcMain.handle('rename-conversation', async (_event, convId: string, name: string) => {
  const orgId = await getOrgId();
  if (!orgId) throw new Error('Not authenticated');

  const url = `${BASE_URL}/api/organizations/${orgId}/chat_conversations/${convId}`;
  const result = await makeRequest(url, 'PUT', { name });

  if (result.status !== 200) {
    throw new Error(`Failed to rename conversation: ${result.status}`);
  }

  return result.data;
});

// Star/unstar a conversation
ipcMain.handle('star-conversation', async (_event, convId: string, isStarred: boolean) => {
  const orgId = await getOrgId();
  if (!orgId) throw new Error('Not authenticated');

  const url = `${BASE_URL}/api/organizations/${orgId}/chat_conversations/${convId}?rendering_mode=raw`;
  const result = await makeRequest(url, 'PUT', { is_starred: isStarred });

  if (result.status !== 200) {
    throw new Error(`Failed to star conversation: ${result.status}`);
  }

  return result.data;
});

// Upload file attachments (prepare metadata only)
ipcMain.handle('upload-attachments', async (_event, files: UploadFilePayload[]) => {
  const uploads: AttachmentPayload[] = [];
  for (const file of files || []) {
    const attachment = await prepareAttachmentPayload(file);
    uploads.push(attachment);
  }

  return uploads;
});

// Send a message and stream response
ipcMain.handle('send-message', async (_event, conversationId: string, message: string, parentMessageUuid: string, attachments: AttachmentPayload[] = []) => {
  const orgId = await getOrgId();
  if (!orgId) throw new Error('Not authenticated');

  console.log('[API] Sending message to conversation:', conversationId);
  console.log('[API] Parent message UUID:', parentMessageUuid);
  console.log('[API] Message:', message.substring(0, 50) + '...');
  if (attachments?.length) {
    console.log('[API] Attachments:', attachments.map(a => `${a.file_name} (${a.file_size})`).join(', '));
    console.log('[API] File IDs:', attachments.map(a => a.document_id).join(', '));
  }

  const state = createStreamState();

  const callbacks: StreamCallbacks = {
    onTextDelta: (text, fullText, blockIndex) => {
      mainWindow?.webContents.send('message-stream', { conversationId, blockIndex, text, fullText });
    },
    onThinkingStart: (blockIndex) => {
      mainWindow?.webContents.send('message-thinking', { conversationId, blockIndex, isThinking: true });
    },
    onThinkingDelta: (thinking, blockIndex) => {
      const block = state.contentBlocks.get(blockIndex);
      mainWindow?.webContents.send('message-thinking-stream', {
        conversationId,
        blockIndex,
        thinking,
        summaries: block?.summaries
      });
    },
    onThinkingStop: (thinkingText, summaries, blockIndex) => {
      mainWindow?.webContents.send('message-thinking', {
        conversationId,
        blockIndex,
        isThinking: false,
        thinkingText,
        summaries
      });
    },
    onToolStart: (toolName, toolMessage, blockIndex) => {
      mainWindow?.webContents.send('message-tool-use', {
        conversationId,
        blockIndex,
        toolName,
        message: toolMessage,
        isRunning: true
      });
    },
    onToolStop: (toolName, input, blockIndex) => {
      const block = state.contentBlocks.get(blockIndex);
      mainWindow?.webContents.send('message-tool-use', {
        conversationId,
        blockIndex,
        toolName,
        message: block?.toolMessage,
        input,
        isRunning: false
      });
    },
    onToolResult: (toolName, result, isError, blockIndex) => {
      mainWindow?.webContents.send('message-tool-result', {
        conversationId,
        blockIndex,
        toolName,
        result,
        isError
      });
    },
    onCitation: (citation, blockIndex) => {
      mainWindow?.webContents.send('message-citation', { conversationId, blockIndex, citation });
    },
    onToolApproval: (toolName, approvalKey, input) => {
      mainWindow?.webContents.send('message-tool-approval', { conversationId, toolName, approvalKey, input });
    },
    onCompaction: (status, compactionMessage) => {
      mainWindow?.webContents.send('message-compaction', { conversationId, status, message: compactionMessage });
    },
    onComplete: (fullText, steps, messageUuid) => {
      mainWindow?.webContents.send('message-complete', { conversationId, fullText, steps, messageUuid });

      // Add to memory buffer if enabled (schedule extraction after 10 min)
      if (memorySettings.enabled) {
        addConversationPair(message, fullText, 'main_chat');
        scheduleProcessing();
      }
    }
  };

  // Send Claude the uploaded file UUIDs (metadata stays client-side for display)
  const fileIds = attachments?.map(a => a.document_id).filter(Boolean) || [];

  // === Memory + RAG Processing ===
  // Retrieve relevant memories and knowledge context
  let augmentedMessage = message;
  let memoryContext = '';

  // Retrieve relevant memories if enabled
  if (memorySettings.enabled && knowledgeSettings.collectionName) {
    try {
      memoryContext = await getMemoriesForContext(message, knowledgeSettings.collectionName, 5, 0.4);
      if (memoryContext) {
        console.log('[Memory] Retrieved memories for context');
      }
    } catch (memError: unknown) {
      console.error('[Memory] Error retrieving memories:', memError);
    }
  }

  // RAG processing for knowledge base retrieval
  if (ragSettings.enabled && knowledgeSettings.collectionName) {
    try {
      // Notify UI: Agent is analyzing the query
      mainWindow?.webContents.send('rag-status', {
        conversationId,
        status: 'agent_thinking',
        message: 'Analyzing query...'
      });

      const ragResult = await processRagQuery(
        message,
        knowledgeSettings.collectionName,
        ragSettings
      );

      // Use cleaned_query to remove "my files/notes" references (prevents Claude from searching again)
      const cleanedQuery = ragResult.decision.cleaned_query || message;

      if (ragResult.decision.needs_retrieval && ragResult.contexts.length > 0) {
        // Notify UI: Found relevant context
        mainWindow?.webContents.send('rag-status', {
          conversationId,
          status: 'complete',
          message: `Found ${ragResult.contexts.length} relevant sources`,
          detail: {
            queriesGenerated: ragResult.decision.search_queries.length,
            chunksRetrieved: ragResult.contexts.length,
            processingTimeMs: ragResult.processingTimeMs
          }
        });

        // Inject memories + knowledge context + cleaned query
        augmentedMessage = memoryContext + formatContextForClaude(ragResult.contexts) + cleanedQuery;
        console.log(`[RAG] Injected ${ragResult.contexts.length} context chunks (${ragResult.processingTimeMs}ms)`);
        console.log(`[RAG] Cleaned query: "${cleanedQuery}"`);
      } else if (ragResult.decision.needs_retrieval) {
        // Retrieval was needed but no results found - still use cleaned query
        mainWindow?.webContents.send('rag-status', {
          conversationId,
          status: 'skipped',
          message: 'No matching content found'
        });
        augmentedMessage = memoryContext + cleanedQuery;
        console.log(`[RAG] No results, using cleaned query: "${cleanedQuery}"`);
      } else {
        // Notify UI: No retrieval needed, but still include memories
        mainWindow?.webContents.send('rag-status', {
          conversationId,
          status: 'skipped',
          message: ragResult.decision.reasoning || 'No retrieval needed'
        });
        augmentedMessage = memoryContext + message;
        console.log(`[RAG] Skipped: ${ragResult.decision.reasoning}`);
      }
    } catch (ragError: unknown) {
      // RAG errors are non-blocking - log and continue with memories only
      const errorMessage = ragError instanceof Error ? ragError.message : String(ragError);
      console.error('[RAG] Processing error (continuing without RAG):', errorMessage);
      mainWindow?.webContents.send('rag-status', {
        conversationId,
        status: 'error',
        message: 'RAG unavailable'
      });
      augmentedMessage = memoryContext + message;
    }
  } else if (memoryContext) {
    // RAG disabled but we have memories - still inject them
    augmentedMessage = memoryContext + message;
  }
  // === End Memory + RAG Processing ===

  await streamCompletion(orgId, conversationId, augmentedMessage, parentMessageUuid, (chunk) => {
    processSSEChunk(chunk, state, callbacks);
  }, { attachments: [], files: fileIds });

  return { text: state.fullResponse, messageUuid: state.lastMessageUuid };
});

// Stop a streaming response
ipcMain.handle('stop-response', async (_event, conversationId: string) => {
  const orgId = await getOrgId();
  if (!orgId) throw new Error('Not authenticated');

  console.log('[API] Stopping response for conversation:', conversationId);
  await stopResponse(orgId, conversationId);
  return { success: true };
});

// Generate title for a conversation
ipcMain.handle('generate-title', async (_event, conversationId: string, messageContent: string, recentTitles: string[] = []) => {
  const orgId = await getOrgId();
  if (!orgId) throw new Error('Not authenticated');

  console.log('[API] Generating title for conversation:', conversationId);
  const result = await generateTitle(orgId, conversationId, messageContent, recentTitles);
  return result;
});

// Settings IPC handlers
ipcMain.handle('open-settings', async () => {
  showSettingsView();
});

ipcMain.handle('get-settings', async () => {
  return getSettings();
});

ipcMain.handle('save-settings', async (_event, settings: Partial<SettingsSchema>) => {
  saveSettings(settings);
  // Re-register shortcut if keybind changed
  if (settings.spotlightKeybind !== undefined) {
    registerSpotlightShortcut();
  }
  return getSettings();
});

// ============================================================================
// Knowledge Management IPC Handlers
// ============================================================================

// Open knowledge view in main window
ipcMain.handle('open-knowledge', async () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('show-knowledge-view');
  }
});

// Open external URL in default browser
ipcMain.handle('open-external-url', async (_event, url: string) => {
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    await shell.openExternal(url);
  }
});

// Open file dialog for knowledge files
ipcMain.handle('knowledge-open-file-dialog', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Documents', extensions: ['txt', 'md', 'pdf'] }
    ]
  });
  return result.canceled ? [] : result.filePaths;
});

// Get knowledge settings
ipcMain.handle('knowledge-get-settings', async () => {
  const stored = store.get('knowledgeSettings') as KnowledgeSettingsStore | undefined;
  knowledgeSettings = { ...DEFAULT_KNOWLEDGE_SETTINGS, ...stored };

  // Auto-initialize Qdrant client if URL is configured (persist connection like Claude session)
  if (knowledgeSettings.qdrantUrl && knowledgeSettings.qdrantUrl !== DEFAULT_KNOWLEDGE_SETTINGS.qdrantUrl) {
    try {
      initQdrantClient(knowledgeSettings);
    } catch (error) {
      console.error('[Knowledge] Failed to auto-initialize Qdrant client:', error);
    }
  }

  // Initialize Firecrawl if API key is configured
  if (knowledgeSettings.firecrawlApiKey) {
    initFirecrawl(knowledgeSettings.firecrawlApiKey);
  }

  return knowledgeSettings;
});

// Save knowledge settings
ipcMain.handle('knowledge-save-settings', async (_event, settings: Partial<KnowledgeSettings>) => {
  knowledgeSettings = { ...knowledgeSettings, ...settings };
  store.set('knowledgeSettings', knowledgeSettings);
  // Reinitialize clients with new settings
  initQdrantClient(knowledgeSettings);
  if (knowledgeSettings.firecrawlApiKey) {
    initFirecrawl(knowledgeSettings.firecrawlApiKey);
  }
  return knowledgeSettings;
});

// Test Qdrant connection
ipcMain.handle('knowledge-test-connection', async () => {
  try {
    initQdrantClient(knowledgeSettings);
    await ensureCollection(knowledgeSettings.collectionName);
    return { success: true };
  } catch (error: any) {
    console.error('[Knowledge] Connection test failed:', error.message);
    return { success: false, error: error.message };
  }
});

// ============================================================================
// RAG Settings (Agentic RAG with Ollama)
// ============================================================================

// Get RAG settings
ipcMain.handle('rag-get-settings', async () => {
  const stored = store.get('ragSettings') as RAGSettings | undefined;
  ragSettings = { ...DEFAULT_RAG_SETTINGS, ...stored };

  // Initialize Ollama client with stored URL
  if (ragSettings.ollamaUrl) {
    initOllamaClient(ragSettings.ollamaUrl);
  }

  return ragSettings;
});

// Save RAG settings
ipcMain.handle('rag-save-settings', async (_event, settings: Partial<RAGSettings>) => {
  ragSettings = { ...ragSettings, ...settings };
  store.set('ragSettings', ragSettings);

  // Reinitialize Ollama client if URL changed
  if (settings.ollamaUrl) {
    initOllamaClient(ragSettings.ollamaUrl);
  }

  console.log('[RAG] Settings saved:', ragSettings);
  return ragSettings;
});

// Test Ollama connection
ipcMain.handle('rag-test-connection', async () => {
  try {
    initOllamaClient(ragSettings.ollamaUrl);
    const health = await checkOllamaHealth(ragSettings.model);

    if (health.available) {
      return { success: true, models: health.models };
    } else {
      return { success: false, error: health.error };
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[RAG] Connection test failed:', errorMessage);
    return { success: false, error: errorMessage };
  }
});

// ============================================================================
// Memory Settings (Conversation Memory with Supabase)
// ============================================================================

// Get memory settings
ipcMain.handle('memory-get-settings', async () => {
  const stored = store.get('memorySettings') as MemorySettingsStore | undefined;
  memorySettings = { ...DEFAULT_MEMORY_SETTINGS, ...stored };

  // Initialize Supabase client if configured
  if (memorySettings.supabaseUrl && memorySettings.supabaseAnonKey) {
    initSupabaseClient(memorySettings.supabaseUrl, memorySettings.supabaseAnonKey);

    // Initialize memory worker with current settings
    initMemoryWorker({
      enabled: memorySettings.enabled,
      ollamaModel: ragSettings.model,
      collectionName: knowledgeSettings.collectionName
    });
  }

  return memorySettings;
});

// Save memory settings
ipcMain.handle('memory-save-settings', async (_event, settings: Partial<MemorySettingsStore>) => {
  memorySettings = { ...memorySettings, ...settings };
  store.set('memorySettings', memorySettings);

  // Reinitialize Supabase client if credentials changed
  if (settings.supabaseUrl || settings.supabaseAnonKey) {
    if (memorySettings.supabaseUrl && memorySettings.supabaseAnonKey) {
      initSupabaseClient(memorySettings.supabaseUrl, memorySettings.supabaseAnonKey);
      // Also init Knowledge Supabase registry (uses same credentials)
      initKnowledgeSupabase(memorySettings.supabaseUrl, memorySettings.supabaseAnonKey);
    }
  }

  // Reinitialize worker with updated settings
  initMemoryWorker({
    enabled: memorySettings.enabled,
    ollamaModel: ragSettings.model,
    collectionName: knowledgeSettings.collectionName
  });

  console.log('[Memory] Settings saved:', { ...memorySettings, supabaseAnonKey: '***' });
  return memorySettings;
});

// Test Supabase connection
ipcMain.handle('memory-test-connection', async () => {
  try {
    if (!memorySettings.supabaseUrl || !memorySettings.supabaseAnonKey) {
      return { success: false, error: 'Supabase URL and Anon Key are required' };
    }

    initSupabaseClient(memorySettings.supabaseUrl, memorySettings.supabaseAnonKey);
    const result = await testSupabaseConnection();

    if (result.success) {
      return { success: true };
    } else {
      return { success: false, error: result.error };
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Memory] Connection test failed:', errorMessage);
    return { success: false, error: errorMessage };
  }
});

// ============================================================================
// Settings Sync (Cloud Storage)
// ============================================================================

// Check if cloud has settings stored
ipcMain.handle('settings-sync-has-cloud', async () => {
  try {
    if (!memorySettings.supabaseUrl || !memorySettings.supabaseAnonKey) {
      return { hasCloud: false, error: 'Supabase not configured' };
    }
    initSettingsSyncClient(memorySettings.supabaseUrl, memorySettings.supabaseAnonKey);
    const hasSettings = await hasCloudSettings();
    return { hasCloud: hasSettings };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { hasCloud: false, error: msg };
  }
});

// Pull settings from cloud (only if local is empty/default)
ipcMain.handle('settings-sync-pull', async () => {
  try {
    if (!memorySettings.supabaseUrl || !memorySettings.supabaseAnonKey) {
      return { success: false, error: 'Supabase not configured' };
    }

    initSettingsSyncClient(memorySettings.supabaseUrl, memorySettings.supabaseAnonKey);
    const cloudSettings = await loadSettingsFromCloud();

    if (!cloudSettings) {
      return { success: false, error: 'No settings found in cloud' };
    }

    // Apply cloud settings to local store (LOCAL wins, but this is explicit pull)
    if (cloudSettings.settings && Object.keys(cloudSettings.settings).length > 0) {
      const current = store.get('settings') || {};
      store.set('settings', { ...DEFAULT_SETTINGS, ...cloudSettings.settings });
    }

    if (cloudSettings.knowledge_settings && Object.keys(cloudSettings.knowledge_settings).length > 0) {
      // Merge with defaults to ensure full object
      const merged = { ...DEFAULT_KNOWLEDGE_SETTINGS, ...cloudSettings.knowledge_settings };
      store.set('knowledgeSettings', merged);
      knowledgeSettings = merged as KnowledgeSettings;
      // Reinitialize Qdrant
      if (knowledgeSettings.qdrantUrl) {
        initQdrantClient(knowledgeSettings);
      }
    }

    if (cloudSettings.notion_settings && Object.keys(cloudSettings.notion_settings).length > 0) {
      // Merge with defaults to ensure full object
      const merged = { ...DEFAULT_NOTION_SETTINGS, ...cloudSettings.notion_settings };
      store.set('notionSettings', merged);
      notionSettings = merged as NotionSettings;
      // Reinitialize Notion
      if (notionSettings.notionToken) {
        initNotionClient(notionSettings.notionToken);
      }
    }

    if (cloudSettings.rag_settings && Object.keys(cloudSettings.rag_settings).length > 0) {
      // Merge with defaults to ensure full object
      const merged = { ...DEFAULT_RAG_SETTINGS, ...cloudSettings.rag_settings };
      store.set('ragSettings', merged);
      ragSettings = merged as RAGSettings;
      // Reinitialize Ollama
      if (ragSettings.ollamaUrl) {
        initOllamaClient(ragSettings.ollamaUrl);
      }
    }

    console.log('[SettingsSync] Pulled settings from cloud');
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[SettingsSync] Pull failed:', msg);
    return { success: false, error: msg };
  }
});

// Push local settings to cloud (overwrites cloud)
ipcMain.handle('settings-sync-push', async () => {
  try {
    if (!memorySettings.supabaseUrl || !memorySettings.supabaseAnonKey) {
      return { success: false, error: 'Supabase not configured' };
    }

    initSettingsSyncClient(memorySettings.supabaseUrl, memorySettings.supabaseAnonKey);

    // Gather all current settings (exclude memorySettings - chicken/egg)
    const cloudSettings: CloudSettings = {
      settings: store.get('settings') || {},
      knowledge_settings: store.get('knowledgeSettings') || {},
      notion_settings: store.get('notionSettings') || {},
      rag_settings: store.get('ragSettings') || {}
    };

    const success = await saveSettingsToCloud(cloudSettings);

    if (success) {
      console.log('[SettingsSync] Pushed settings to cloud');
      return { success: true };
    } else {
      return { success: false, error: 'Failed to save to cloud' };
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[SettingsSync] Push failed:', msg);
    return { success: false, error: msg };
  }
});

// ============================================================================

// Ingest a file into knowledge base
ipcMain.handle('knowledge-ingest-file', async (_event, filePath: string) => {
  try {
    console.log('[Knowledge] Ingesting file:', filePath);

    // Parse file content
    const doc = await parseFile(filePath);
    const chunks = chunkText(doc.content);

    console.log(`[Knowledge] File parsed: ${chunks.length} chunks`);

    // Generate embeddings and create items
    const items: KnowledgeItem[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const vector = await generateEmbedding(chunk.text);

      items.push({
        id: crypto.randomUUID(),
        content: chunk.text,
        metadata: {
          source: doc.metadata.source!,
          filename: doc.metadata.filename!,
          type: doc.metadata.type!,
          chunkIndex: i,
          totalChunks: chunks.length,
          dateAdded: new Date().toISOString()
        },
        vector
      });
    }

    // Upsert to Qdrant in batches (Qdrant Cloud has request size limits)
    await ensureCollection(knowledgeSettings.collectionName);
    const BATCH_SIZE = 100;
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      await upsertVectors(knowledgeSettings.collectionName, batch);
      console.log(`[Knowledge] Upserted batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(items.length / BATCH_SIZE)}`);
    }

    // Register document in Supabase registry (if connected)
    if (isKnowledgeSupabaseReady()) {
      await registerDocument(
        doc.metadata.source!,
        doc.metadata.filename!,
        doc.metadata.type! as 'txt' | 'md' | 'pdf' | 'url' | 'notion',
        items.length
      );
    }

    console.log(`[Knowledge] Ingested ${items.length} chunks from ${filePath}`);
    return { success: true, chunksIngested: items.length };
  } catch (error: any) {
    console.error('[Knowledge] Ingest file error:', error.message);
    return { success: false, chunksIngested: 0, error: error.message };
  }
});

// Ingest a URL into knowledge base
ipcMain.handle('knowledge-ingest-url', async (_event, url: string) => {
  try {
    console.log('[Knowledge] Ingesting URL:', url);

    // Parse URL content
    const doc = await parseUrl(url);
    const chunks = chunkText(doc.content);

    console.log(`[Knowledge] URL parsed: ${chunks.length} chunks`);

    // Generate embeddings and create items
    const items: KnowledgeItem[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const vector = await generateEmbedding(chunk.text);

      items.push({
        id: crypto.randomUUID(),
        content: chunk.text,
        metadata: {
          source: doc.metadata.source!,
          filename: doc.metadata.filename!,
          type: doc.metadata.type!,
          chunkIndex: i,
          totalChunks: chunks.length,
          dateAdded: new Date().toISOString()
        },
        vector
      });
    }

    // Upsert to Qdrant in batches (Qdrant Cloud has request size limits)
    await ensureCollection(knowledgeSettings.collectionName);
    const BATCH_SIZE = 100;
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      await upsertVectors(knowledgeSettings.collectionName, batch);
      console.log(`[Knowledge] Upserted batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(items.length / BATCH_SIZE)}`);
    }

    // Register document in Supabase registry (if connected)
    if (isKnowledgeSupabaseReady()) {
      await registerDocument(
        doc.metadata.source!,
        doc.metadata.filename!,
        doc.metadata.type! as 'txt' | 'md' | 'pdf' | 'url' | 'notion',
        items.length
      );
    }

    console.log(`[Knowledge] Ingested ${items.length} chunks from ${url}`);
    return { success: true, chunksIngested: items.length };
  } catch (error: any) {
    console.error('[Knowledge] Ingest URL error:', error.message);
    return { success: false, chunksIngested: 0, error: error.message };
  }
});

// Search knowledge base
ipcMain.handle('knowledge-search', async (_event, query: string, limit: number = 5) => {
  try {
    console.log('[Knowledge] Searching for:', query);

    const queryVector = await generateEmbedding(query);
    const results = await searchVectors(knowledgeSettings.collectionName, queryVector, limit);

    console.log(`[Knowledge] Found ${results.length} results`);
    return results;
  } catch (error: any) {
    console.error('[Knowledge] Search error:', error.message);
    return [];
  }
});

// List all knowledge items
ipcMain.handle('knowledge-list', async () => {
  console.log('[Knowledge] IPC: knowledge-list called');
  try {
    // Prefer Supabase registry (faster, cross-device sync)
    if (isKnowledgeSupabaseReady()) {
      const docs = await listDocuments();
      console.log(`[Knowledge] IPC: knowledge-list returning ${docs.length} documents from Supabase`);
      // Transform to format expected by UI (KnowledgeItem-like)
      return docs.map(doc => ({
        id: doc.id,
        content: '',  // UI only needs metadata for card display
        metadata: {
          source: doc.source,
          filename: doc.title,
          type: doc.type,
          chunkIndex: 0,
          totalChunks: doc.chunk_count,
          dateAdded: doc.date_added
        }
      }));
    }

    // Fallback: scroll Qdrant (slower, but works without Supabase)
    const items = await listItems(knowledgeSettings.collectionName);
    console.log(`[Knowledge] IPC: knowledge-list returning ${items.length} items from Qdrant`);
    return items;
  } catch (error: any) {
    console.error('[Knowledge] List error:', error.message);
    return [];
  }
});

// Delete knowledge items by ID
ipcMain.handle('knowledge-delete', async (_event, ids: string[]) => {
  try {
    await deleteVectors(knowledgeSettings.collectionName, ids);
    console.log(`[Knowledge] Deleted ${ids.length} items`);
    return { success: true };
  } catch (error: any) {
    console.error('[Knowledge] Delete error:', error.message);
    return { success: false, error: error.message };
  }
});

// Delete all knowledge items by source (deletes ALL chunks from a file/URL)
ipcMain.handle('knowledge-delete-by-source', async (_event, source: string) => {
  console.log(`[Knowledge] IPC: knowledge-delete-by-source called with source="${source}"`);
  try {
    // Delete chunks from Qdrant
    const deletedCount = await deleteBySource(knowledgeSettings.collectionName, source);
    console.log(`[Knowledge] Deleted ${deletedCount} items with source: ${source}`);

    // Unregister from Supabase registry (if connected)
    if (isKnowledgeSupabaseReady()) {
      await unregisterDocument(source);
    }

    return { success: true, deletedCount };
  } catch (error: any) {
    console.error('[Knowledge] Delete by source error:', error.message);
    console.error('[Knowledge] Full error:', error);
    return { success: false, error: error.message };
  }
});

// Migrate existing Qdrant documents to Supabase registry
ipcMain.handle('knowledge-migrate-to-supabase', async () => {
  console.log('[Knowledge] Starting migration to Supabase...');
  try {
    if (!isKnowledgeSupabaseReady()) {
      return { success: false, error: 'Supabase not connected' };
    }

    // Get all items from Qdrant
    const items = await listItems(knowledgeSettings.collectionName);
    console.log(`[Knowledge] Found ${items.length} items in Qdrant`);

    // Group by source to derive unique documents
    const bySource = new Map<string, { title: string; type: string; count: number; dateAdded: string }>();
    for (const item of items) {
      const source = item.metadata?.source || 'Unknown';
      if (!bySource.has(source)) {
        bySource.set(source, {
          title: item.metadata?.filename || 'Unknown',
          type: item.metadata?.type || 'txt',
          count: 0,
          dateAdded: item.metadata?.dateAdded || new Date().toISOString()
        });
      }
      bySource.get(source)!.count++;
    }

    console.log(`[Knowledge] Migrating ${bySource.size} documents...`);

    // Register each document in Supabase
    let migrated = 0;
    for (const [source, doc] of bySource) {
      const result = await registerDocument(
        source,
        doc.title,
        doc.type as 'txt' | 'md' | 'pdf' | 'url' | 'notion',
        doc.count
      );
      if (result.success) migrated++;
    }

    console.log(`[Knowledge] Migration complete: ${migrated}/${bySource.size} documents`);
    return { success: true, documentsMigrated: migrated, totalDocuments: bySource.size };
  } catch (error: any) {
    console.error('[Knowledge] Migration error:', error.message);
    return { success: false, error: error.message };
  }
});

// ============================================================================
// Notion Integration IPC Handlers
// ============================================================================

// Get Notion settings
ipcMain.handle('notion-get-settings', async () => {
  const stored = store.get('notionSettings') as NotionSettingsStore | undefined;
  notionSettings = { ...DEFAULT_NOTION_SETTINGS, ...stored };
  return notionSettings;
});

// Save Notion settings
ipcMain.handle('notion-save-settings', async (_event, settings: Partial<NotionSettings>) => {
  notionSettings = { ...notionSettings, ...settings };
  store.set('notionSettings', notionSettings as NotionSettingsStore);

  // Initialize client if token provided
  if (settings.notionToken) {
    try {
      initNotionClient(settings.notionToken);
    } catch (error) {
      console.error('[Notion] Failed to initialize client:', error);
    }
  }

  return notionSettings;
});

// Test Notion connection
ipcMain.handle('notion-test-connection', async () => {
  try {
    if (!notionSettings.notionToken) {
      return { success: false, error: 'No token configured' };
    }

    initNotionClient(notionSettings.notionToken);
    await testNotionConnection();
    return { success: true };
  } catch (error: any) {
    console.error('[Notion] Connection test failed:', error.message);
    return { success: false, error: error.message };
  }
});

// Sync all Notion pages to Qdrant
ipcMain.handle('notion-sync', async () => {
  try {
    if (!notionSettings.notionToken) {
      return { success: false, error: 'No token configured' };
    }

    // Initialize clients
    initNotionClient(notionSettings.notionToken);
    initQdrantClient(knowledgeSettings);
    await ensureCollection(knowledgeSettings.collectionName);

    console.log('[Notion] Starting sync...');

    // Get all accessible pages
    const pages = await listNotionPages();
    console.log(`[Notion] Found ${pages.length} pages to sync`);

    let totalChunks = 0;

    // Process each page
    for (const page of pages) {
      try {
        console.log(`[Notion] Processing: ${page.title}`);

        // Fetch page content
        const content = await fetchPageContent(page.id);
        if (!content.trim()) {
          console.log(`[Notion] Skipping empty page: ${page.title}`);
          continue;
        }

        // Delete existing chunks for this page (re-sync)
        await deleteBySource(knowledgeSettings.collectionName, page.url);

        // Chunk the content
        const chunks = chunkText(content);
        console.log(`[Notion] ${page.title}: ${chunks.length} chunks`);

        // Generate embeddings and prepare items
        const items: KnowledgeItem[] = [];
        for (const chunk of chunks) {
          const vector = await generateEmbedding(chunk.text);
          items.push({
            id: crypto.randomUUID(),
            content: chunk.text,
            metadata: {
              source: page.url,
              filename: page.title,
              type: 'notion',
              chunkIndex: chunk.index,
              totalChunks: chunks.length,
              dateAdded: new Date().toISOString()
            },
            vector
          });
        }

        // Upsert in batches
        const BATCH_SIZE = 100;
        for (let i = 0; i < items.length; i += BATCH_SIZE) {
          const batch = items.slice(i, i + BATCH_SIZE);
          await upsertVectors(knowledgeSettings.collectionName, batch);
        }

        totalChunks += items.length;

        // Small delay to respect rate limits (3 req/sec)
        await new Promise(resolve => setTimeout(resolve, 350));

      } catch (pageError: any) {
        console.error(`[Notion] Error processing page ${page.title}:`, pageError.message);
        // Continue with next page
      }
    }

    // Update last sync timestamp
    notionSettings.lastSync = new Date().toISOString();
    store.set('notionSettings', notionSettings as NotionSettingsStore);

    console.log(`[Notion] Sync complete: ${pages.length} pages, ${totalChunks} chunks`);

    return {
      success: true,
      pagesCount: pages.length,
      chunksCount: totalChunks,
      lastSync: notionSettings.lastSync
    };

  } catch (error: any) {
    console.error('[Notion] Sync failed:', error.message);
    return { success: false, error: error.message };
  }
});

// ============================================================================
// Manual Notion Page Import IPC Handlers
// ============================================================================

/**
 * Helper: Sync a single page to Qdrant.
 * Shared logic for import and re-sync operations.
 */
async function syncSinglePage(
  pageId: string,
  pageUrl: string,
  pageTitle: string
): Promise<{ chunksCount: number }> {
  // Fetch page content
  const content = await fetchPageContent(pageId);
  if (!content.trim()) {
    console.log(`[Notion] Page is empty: ${pageTitle}`);
    return { chunksCount: 0 };
  }

  // Delete existing chunks (for re-sync)
  await deleteBySource(knowledgeSettings.collectionName, pageUrl);

  // Chunk the content
  const chunks = chunkText(content);
  console.log(`[Notion] ${pageTitle}: ${chunks.length} chunks`);

  // Generate embeddings and prepare items
  const items: KnowledgeItem[] = [];
  for (const chunk of chunks) {
    const vector = await generateEmbedding(chunk.text);
    items.push({
      id: crypto.randomUUID(),
      content: chunk.text,
      metadata: {
        source: pageUrl,
        filename: pageTitle,
        type: 'notion',
        chunkIndex: chunk.index,
        totalChunks: chunks.length,
        dateAdded: new Date().toISOString()
      },
      vector
    });
  }

  // Upsert in batches (respect Qdrant Cloud limits)
  const BATCH_SIZE = 100;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    await upsertVectors(knowledgeSettings.collectionName, batch);
  }

  return { chunksCount: items.length };
}

// Import a specific Notion page by URL or ID
ipcMain.handle('notion-import-page', async (_event, urlOrId: string, includeSubpages: boolean) => {
  try {
    if (!notionSettings.notionToken) {
      return { success: false, error: 'No Notion token configured' };
    }

    // Initialize clients
    initNotionClient(notionSettings.notionToken);
    initQdrantClient(knowledgeSettings);
    await ensureCollection(knowledgeSettings.collectionName);

    // Extract page ID and fetch metadata
    const pageId = extractPageIdFromUrl(urlOrId);
    console.log(`[Notion] Importing page: ${pageId}`);

    const pageMeta = await fetchPageMeta(pageId);
    let totalChunks = 0;
    const importedPages: TrackedNotionPage[] = [];

    // Sync the main page
    const result = await syncSinglePage(pageMeta.id, pageMeta.url, pageMeta.title);
    totalChunks += result.chunksCount;

    // Track the main page
    const trackedPage: TrackedNotionPage = {
      id: pageMeta.id,
      url: pageMeta.url,
      title: pageMeta.title,
      lastSynced: new Date().toISOString(),
      lastEditedTime: pageMeta.lastEditedTime,
      includeSubpages
    };
    importedPages.push(trackedPage);

    // Import subpages if requested
    if (includeSubpages) {
      await new Promise(r => setTimeout(r, 350)); // Rate limit
      const childPages = await fetchChildPages(pageId);

      for (const child of childPages) {
        await new Promise(r => setTimeout(r, 350)); // Rate limit
        const childResult = await syncSinglePage(child.id, child.url, child.title);
        totalChunks += childResult.chunksCount;

        // Track each subpage
        importedPages.push({
          id: child.id,
          url: child.url,
          title: child.title,
          lastSynced: new Date().toISOString(),
          lastEditedTime: child.lastEditedTime,
          includeSubpages: false // Subpages don't recurse further
        });
      }
    }

    // Update tracked pages in settings (merge with existing, replace duplicates)
    const existingTracked = notionSettings.trackedPages || [];
    const existingIds = new Set(existingTracked.map(p => p.id));
    const newPages = importedPages.filter(p => !existingIds.has(p.id));
    const updatedExisting = existingTracked.map(p => {
      const updated = importedPages.find(ip => ip.id === p.id);
      return updated || p;
    });
    notionSettings.trackedPages = [...updatedExisting, ...newPages];
    store.set('notionSettings', notionSettings as NotionSettingsStore);

    console.log(`[Notion] Import complete: ${importedPages.length} pages, ${totalChunks} chunks`);

    return {
      success: true,
      pagesCount: importedPages.length,
      chunksCount: totalChunks,
      pages: importedPages
    };

  } catch (error: any) {
    console.error('[Notion] Import failed:', error.message);
    return { success: false, error: error.message };
  }
});

// Get list of tracked pages
ipcMain.handle('notion-get-tracked-pages', async () => {
  return notionSettings.trackedPages || [];
});

// Remove a tracked page (also deletes from Qdrant)
ipcMain.handle('notion-remove-tracked-page', async (_event, pageId: string) => {
  try {
    const trackedPages = notionSettings.trackedPages || [];
    const page = trackedPages.find(p => p.id === pageId);

    if (!page) {
      return { success: false, error: 'Page not found in tracked pages' };
    }

    // Delete chunks from Qdrant
    initQdrantClient(knowledgeSettings);
    await deleteBySource(knowledgeSettings.collectionName, page.url);
    console.log(`[Notion] Deleted chunks for: ${page.title}`);

    // Remove from tracked list
    notionSettings.trackedPages = trackedPages.filter(p => p.id !== pageId);
    store.set('notionSettings', notionSettings as NotionSettingsStore);

    return { success: true, title: page.title };

  } catch (error: any) {
    console.error('[Notion] Remove failed:', error.message);
    return { success: false, error: error.message };
  }
});

// Check tracked pages for updates
ipcMain.handle('notion-check-updates', async () => {
  try {
    if (!notionSettings.notionToken) {
      return { success: false, error: 'No token configured' };
    }

    initNotionClient(notionSettings.notionToken);
    const trackedPages = notionSettings.trackedPages || [];
    const pagesWithUpdates: Array<{ id: string; title: string; lastEditedTime: string }> = [];

    for (const page of trackedPages) {
      await new Promise(r => setTimeout(r, 350)); // Rate limit
      try {
        const meta = await fetchPageMeta(page.id);
        // Compare timestamps: if Notion's lastEditedTime > our stored time, update available
        if (new Date(meta.lastEditedTime) > new Date(page.lastEditedTime)) {
          pagesWithUpdates.push({
            id: page.id,
            title: page.title,
            lastEditedTime: meta.lastEditedTime
          });
        }
      } catch (err: any) {
        console.warn(`[Notion] Could not check page ${page.id}:`, err.message);
      }
    }

    console.log(`[Notion] ${pagesWithUpdates.length}/${trackedPages.length} pages have updates`);
    return { success: true, updates: pagesWithUpdates };

  } catch (error: any) {
    console.error('[Notion] Check updates failed:', error.message);
    return { success: false, error: error.message };
  }
});

// Re-sync a single tracked page
ipcMain.handle('notion-sync-tracked-page', async (_event, pageId: string) => {
  try {
    if (!notionSettings.notionToken) {
      return { success: false, error: 'No token configured' };
    }

    const trackedPages = notionSettings.trackedPages || [];
    const pageIndex = trackedPages.findIndex(p => p.id === pageId);

    if (pageIndex === -1) {
      return { success: false, error: 'Page not found in tracked pages' };
    }

    // Initialize clients
    initNotionClient(notionSettings.notionToken);
    initQdrantClient(knowledgeSettings);
    await ensureCollection(knowledgeSettings.collectionName);

    // Fetch fresh metadata
    const meta = await fetchPageMeta(pageId);
    const result = await syncSinglePage(meta.id, meta.url, meta.title);

    // Update tracked page info
    trackedPages[pageIndex] = {
      ...trackedPages[pageIndex],
      title: meta.title,
      lastSynced: new Date().toISOString(),
      lastEditedTime: meta.lastEditedTime
    };
    notionSettings.trackedPages = trackedPages;
    store.set('notionSettings', notionSettings as NotionSettingsStore);

    console.log(`[Notion] Re-synced: ${meta.title} (${result.chunksCount} chunks)`);

    return {
      success: true,
      chunksCount: result.chunksCount,
      page: trackedPages[pageIndex]
    };

  } catch (error: any) {
    console.error('[Notion] Re-sync failed:', error.message);
    return { success: false, error: error.message };
  }
});

// Handle deep link on Windows (single instance)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(() => {
  // Hide dock icon on macOS - app lives in menu bar only
  if (process.platform === 'darwin' && app.dock) {
    app.dock.hide();
  }

  createMainWindow();
  createTray();

  // Check for updates on startup (non-blocking)
  checkForUpdatesAndNotify();

  // Register spotlight shortcut from settings
  registerSpotlightShortcut();

  // Initialize memory system if configured (non-blocking)
  const memoryStored = store.get('memorySettings') as MemorySettingsStore | undefined;
  if (memoryStored?.enabled && memoryStored?.supabaseUrl && memoryStored?.supabaseAnonKey) {
    console.log('[Memory] Initializing memory system...');
    memorySettings = { ...DEFAULT_MEMORY_SETTINGS, ...memoryStored };
    initSupabaseClient(memorySettings.supabaseUrl, memorySettings.supabaseAnonKey);

    // Initialize Knowledge Supabase registry (uses same Supabase credentials)
    initKnowledgeSupabase(memorySettings.supabaseUrl, memorySettings.supabaseAnonKey);
    console.log('[Knowledge] Knowledge Supabase registry initialized');

    // Initialize RAG settings for memory worker (needs Ollama model)
    const ragStored = store.get('ragSettings') as RAGSettings | undefined;
    const currentRagSettings = { ...DEFAULT_RAG_SETTINGS, ...ragStored };
    const qdrantStored = store.get('knowledgeSettings') as KnowledgeSettingsStore | undefined;
    const currentKnowledgeSettings = { ...DEFAULT_KNOWLEDGE_SETTINGS, ...qdrantStored };

    initMemoryWorker({
      enabled: memorySettings.enabled,
      ollamaModel: currentRagSettings.model,
      collectionName: currentKnowledgeSettings.collectionName
    });
    console.log('[Memory] Memory system initialized');
  }

  // Auto-sync Notion on startup if configured
  const notionStored = store.get('notionSettings') as NotionSettingsStore | undefined;
  if (notionStored?.notionToken && notionStored?.syncOnStart) {
    console.log('[Notion] Auto-sync enabled, starting background sync...');
    // Run sync in background (don't await, don't block startup)
    (async () => {
      try {
        notionSettings = { ...DEFAULT_NOTION_SETTINGS, ...notionStored };
        initNotionClient(notionSettings.notionToken!);

        // Also init Qdrant
        const qdrantStored = store.get('knowledgeSettings') as KnowledgeSettingsStore | undefined;
        knowledgeSettings = { ...DEFAULT_KNOWLEDGE_SETTINGS, ...qdrantStored };
        initQdrantClient(knowledgeSettings);

        // Trigger sync (reuse the IPC handler logic would be complex, so inline simplified version)
        await ensureCollection(knowledgeSettings.collectionName);
        const pages = await listNotionPages();
        console.log(`[Notion] Auto-sync: Found ${pages.length} pages`);

        for (const page of pages) {
          try {
            const content = await fetchPageContent(page.id);
            if (!content.trim()) continue;

            await deleteBySource(knowledgeSettings.collectionName, page.url);
            const chunks = chunkText(content);

            const items: KnowledgeItem[] = [];
            for (const chunk of chunks) {
              const vector = await generateEmbedding(chunk.text);
              items.push({
                id: crypto.randomUUID(),
                content: chunk.text,
                metadata: {
                  source: page.url,
                  filename: page.title,
                  type: 'notion',
                  chunkIndex: chunk.index,
                  totalChunks: chunks.length,
                  dateAdded: new Date().toISOString()
                },
                vector
              });
            }

            const BATCH_SIZE = 100;
            for (let i = 0; i < items.length; i += BATCH_SIZE) {
              await upsertVectors(knowledgeSettings.collectionName, items.slice(i, i + BATCH_SIZE));
            }

            await new Promise(resolve => setTimeout(resolve, 350));
          } catch (e) {
            console.error(`[Notion] Auto-sync error on ${page.title}:`, e);
          }
        }

        notionSettings.lastSync = new Date().toISOString();
        store.set('notionSettings', notionSettings as NotionSettingsStore);
        console.log('[Notion] Auto-sync complete');
      } catch (err) {
        console.error('[Notion] Auto-sync failed:', err);
      }
    })();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

// Unregister shortcuts and flush memory buffer when app quits
app.on('will-quit', async () => {
  globalShortcut.unregisterAll();

  // Flush memory buffer before quitting (process any pending messages)
  if (memorySettings.enabled) {
    console.log('[Memory] Flushing buffer before quit...');
    await flushBuffer();
  }
});

app.on('window-all-closed', () => {
  // Menu bar app: Don't quit when windows closed on macOS, app stays in tray
  // On other platforms, quit (standard behavior)
  if (process.platform !== 'darwin') {
    app.quit();
  }
  // On macOS: do nothing - app remains in menu bar, user can reopen via tray
});
