import { app, BrowserWindow, ipcMain, session, globalShortcut, screen, Tray, Menu, nativeImage, dialog } from 'electron';
import path from 'path';
import crypto from 'crypto';
import { isAuthenticated, getOrgId, makeRequest, streamCompletion, stopResponse, generateTitle, store, BASE_URL, prepareAttachmentPayload } from './api/client';
import { createStreamState, processSSEChunk, type StreamCallbacks } from './streaming/parser';
import type { SettingsSchema, AttachmentPayload, UploadFilePayload, KnowledgeSettingsStore } from './types';
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
  DEFAULT_KNOWLEDGE_SETTINGS,
  type KnowledgeSettings,
  type KnowledgeItem
} from './knowledge';

let mainWindow: BrowserWindow | null = null;
let spotlightWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let knowledgeWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// Knowledge settings (loaded from store)
let knowledgeSettings: KnowledgeSettings = { ...DEFAULT_KNOWLEDGE_SETTINGS };

// Default settings
const DEFAULT_SETTINGS: SettingsSchema = {
  spotlightKeybind: 'CommandOrControl+Shift+C',
  spotlightPersistHistory: true,
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

// Create settings window
function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 480,
    height: 520,
    minWidth: 400,
    minHeight: 400,
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

  settingsWindow.loadFile(path.join(__dirname, '../static/settings.html'));

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

// Create knowledge management window
function createKnowledgeWindow() {
  if (knowledgeWindow && !knowledgeWindow.isDestroyed()) {
    knowledgeWindow.focus();
    return;
  }

  knowledgeWindow = new BrowserWindow({
    width: 700,
    height: 600,
    minWidth: 500,
    minHeight: 450,
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

  knowledgeWindow.loadFile(path.join(__dirname, '../static/knowledge.html'));

  knowledgeWindow.on('closed', () => {
    knowledgeWindow = null;
  });
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
        click: () => createSettingsWindow()
      },
      {
        label: 'Knowledge',
        click: () => createKnowledgeWindow()
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

// Spotlight send message (uses Haiku)
ipcMain.handle('spotlight-send', async (_event, message: string) => {
  const orgId = await getOrgId();
  if (!orgId) throw new Error('Not authenticated');

  if (!spotlightConversationId) {
    // Create spotlight conversation in incognito mode (is_temporary: true)
    const createResult = await makeRequest(
      `${BASE_URL}/api/organizations/${orgId}/chat_conversations`,
      'POST',
      {
        name: '',
        model: 'claude-haiku-4-5-20251001',
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
    }
  };

  await streamCompletion(orgId, conversationId, message, parentMessageUuid, (chunk) => {
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
 * TTS IPC handler - converts text to speech using Kokoro.
 * Returns audio samples for playback in the renderer process.
 */
ipcMain.handle('spotlight-speak', async (_event, text: string) => {
  try {
    const tts = await getKokoroTTS();
    const audio = await tts.generate(text, { voice: 'af_heart' });

    // Return audio data for Web Audio API playback in renderer
    return {
      samples: Array.from(audio.audio as Float32Array),
      sampleRate: audio.sampling_rate || 24000
    };
  } catch (error) {
    console.error('[TTS] Error generating speech:', error);
    throw error;
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
    }
  };

  // Send Claude the uploaded file UUIDs (metadata stays client-side for display)
  const fileIds = attachments?.map(a => a.document_id).filter(Boolean) || [];

  await streamCompletion(orgId, conversationId, message, parentMessageUuid, (chunk) => {
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
  createSettingsWindow();
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

// Open knowledge window
ipcMain.handle('open-knowledge', async () => {
  createKnowledgeWindow();
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

  return knowledgeSettings;
});

// Save knowledge settings
ipcMain.handle('knowledge-save-settings', async (_event, settings: Partial<KnowledgeSettings>) => {
  knowledgeSettings = { ...knowledgeSettings, ...settings };
  store.set('knowledgeSettings', knowledgeSettings);
  // Reinitialize client with new settings
  initQdrantClient(knowledgeSettings);
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
    const items = await listItems(knowledgeSettings.collectionName);
    console.log(`[Knowledge] IPC: knowledge-list returning ${items.length} items`);
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
    const deletedCount = await deleteBySource(knowledgeSettings.collectionName, source);
    console.log(`[Knowledge] Deleted ${deletedCount} items with source: ${source}`);
    return { success: true, deletedCount };
  } catch (error: any) {
    console.error('[Knowledge] Delete by source error:', error.message);
    console.error('[Knowledge] Full error:', error);
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

  // Register spotlight shortcut from settings
  registerSpotlightShortcut();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

// Unregister shortcuts when app quits
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  // Menu bar app: Don't quit when windows closed on macOS, app stays in tray
  // On other platforms, quit (standard behavior)
  if (process.platform !== 'darwin') {
    app.quit();
  }
  // On macOS: do nothing - app remains in menu bar, user can reopen via tray
});
