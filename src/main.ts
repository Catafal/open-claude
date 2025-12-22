/**
 * Open Claude - Main Process Entry Point
 *
 * This is the Electron main process that handles:
 * - App lifecycle and initialization
 * - IPC handlers for all features
 * - Integration with external services
 *
 * FILE ORGANIZATION:
 * 1. Imports (external, internal modules)
 * 2. Settings state and configuration
 * 3. Global shortcuts registration
 * 4. IPC Handlers:
 *    - Spotlight (quick AI chat)
 *    - Auth (login, logout)
 *    - Conversations (CRUD)
 *    - Messages (send, stream)
 *    - Knowledge (Qdrant, Firecrawl)
 *    - Notion (sync, import)
 *    - RAG (Ollama integration)
 *    - Memory (Supabase)
 *    - Assistant (Google services)
 *    - Gemini (future features)
 *    - Automation (morning email)
 *    - Settings sync (cloud backup)
 *    - Prompts (prompt base)
 * 5. App lifecycle (ready, activate, quit)
 */

import { app, BrowserWindow, ipcMain, session, globalShortcut, dialog, shell } from 'electron';
import crypto from 'crypto';
import {
  createMainWindow,
  getMainWindow,
  showSettingsView,
  showKnowledgeView,
  createSpotlightWindow,
  getSpotlightWindow,
  resizeSpotlightWindow,
  createPromptSelectorWindow,
  getPromptSelectorWindow,
  closePromptSelectorWindow,
  createTray,
} from './windows';
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
  getMemoriesForContext,
  runMaintenance
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
import {
  initPromptsSupabaseClient,
  testPromptsConnection,
  getPrompts,
  createPrompt,
  updatePrompt,
  deletePrompt,
  toggleFavorite,
  incrementUsageCount,
  analyzePrompt,
  initImprover,
  type StoredPrompt,
  type CreatePromptInput,
  type UpdatePromptInput
} from './prompts';
import {
  getAssistantSettings,
  saveAssistantSettings,
  startOAuthFlow,
  removeGoogleAccount,
  toggleAccountEnabled,
  testAccountConnection,
  isAssistantReady,
  processAssistantQuery,
  formatAssistantContext,
  getAccountsTokenStatus,
  getEnabledAccounts,
  type AssistantSettingsStore
} from './assistant';
import {
  initMorningEmailScheduler,
  stopMorningEmailScheduler,
  updateSchedulerSettings,
  triggerMorningEmailNow,
  getSchedulerStatus,
  DEFAULT_AUTOMATION_SETTINGS,
  type AutomationSettings
} from './automation';
import type { AutomationSettingsStore } from './types';
import {
  isGeminiAuthenticated,
  clearTokenCache,
  DEFAULT_GEMINI_SETTINGS,
  type GeminiSettings
} from './gemini';

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

// Assistant settings defaults (Google services)
const DEFAULT_ASSISTANT_SETTINGS: AssistantSettingsStore = {
  enabled: false,
  googleAccounts: []
};
let assistantSettings: AssistantSettingsStore = { ...DEFAULT_ASSISTANT_SETTINGS };

// Automation settings (morning email)
let automationSettings: AutomationSettings = { ...DEFAULT_AUTOMATION_SETTINGS };

// Gemini settings (YouTube Knowledge Agent)
let geminiSettings: GeminiSettings = { ...DEFAULT_GEMINI_SETTINGS };

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

// Register spotlight and prompt selector shortcuts
function registerSpotlightShortcut() {
  globalShortcut.unregisterAll();
  const settings = getSettings();
  const keybind = settings.spotlightKeybind || DEFAULT_SETTINGS.spotlightKeybind;

  // Register spotlight shortcut (Cmd+Shift+C by default)
  try {
    globalShortcut.register(keybind, () => {
      createSpotlightWindow();
    });
  } catch (e) {
    console.error('Failed to register spotlight keybind:', keybind, e);
    globalShortcut.register(DEFAULT_SETTINGS.spotlightKeybind, () => {
      createSpotlightWindow();
    });
  }

  // Register prompt selector shortcut (Cmd+Shift+X)
  try {
    globalShortcut.register('CommandOrControl+Shift+X', () => {
      createPromptSelectorWindow();
    });
  } catch (e) {
    console.error('Failed to register prompt selector keybind:', e);
  }
}

// ============================================================================
// IPC HANDLERS
// ============================================================================

// Spotlight window resize
ipcMain.handle('spotlight-resize', async (_event, height: number) => {
  resizeSpotlightWindow(height);
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
      getSpotlightWindow()?.webContents.send('spotlight-stream', { text, fullText });
    },
    onThinkingStart: () => {
      getSpotlightWindow()?.webContents.send('spotlight-thinking', { isThinking: true });
    },
    onThinkingDelta: (thinking) => {
      getSpotlightWindow()?.webContents.send('spotlight-thinking-stream', { thinking });
    },
    onThinkingStop: (thinkingText) => {
      getSpotlightWindow()?.webContents.send('spotlight-thinking', { isThinking: false, thinkingText });
    },
    onToolStart: (toolName, msg) => {
      getSpotlightWindow()?.webContents.send('spotlight-tool', { toolName, isRunning: true, message: msg });
    },
    onToolStop: (toolName, input) => {
      getSpotlightWindow()?.webContents.send('spotlight-tool', { toolName, isRunning: false, input });
    },
    onToolResult: (toolName, result, isError) => {
      getSpotlightWindow()?.webContents.send('spotlight-tool-result', { toolName, isError, result });
    },
    onComplete: (fullText, _steps, messageUuid) => {
      // Store assistant response
      spotlightMessages.push({ role: 'assistant', text: fullText });
      getSpotlightWindow()?.webContents.send('spotlight-complete', { fullText, messageUuid });

      // Add to memory buffer if enabled (schedule extraction after 10 min)
      if (memorySettings.enabled) {
        addConversationPair(message, fullText, 'spotlight');
        scheduleProcessing();
      }
    }
  };

  // === Memory + Assistant + RAG Processing for Spotlight ===
  let finalPrompt = promptWithSystem;
  let memoryContext = '';
  let assistantContext = '';

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

  // Personal Assistant: Check if query needs Google data (calendar, email, tasks)
  if (assistantSettings.enabled && isAssistantReady()) {
    try {
      getSpotlightWindow()?.webContents.send('spotlight-assistant', {
        status: 'analyzing',
        message: 'Checking personal data...'
      });

      const assistantResult = await processAssistantQuery(
        message,
        ragSettings.model  // Use same Ollama model as RAG
      );

      if (assistantResult.decision.needs_google && assistantResult.contexts.length > 0) {
        getSpotlightWindow()?.webContents.send('spotlight-assistant', {
          status: 'complete',
          message: `Found ${assistantResult.contexts.length} data sources`
        });

        assistantContext = formatAssistantContext(assistantResult.contexts);
        console.log(`[Assistant/Spotlight] Injected context from services: ${assistantResult.decision.services?.join(', ')}`);
      } else {
        getSpotlightWindow()?.webContents.send('spotlight-assistant', {
          status: 'skipped',
          message: ''
        });
      }
    } catch (assistantError: unknown) {
      const errorMessage = assistantError instanceof Error ? assistantError.message : String(assistantError);
      console.error('[Assistant/Spotlight] Error (continuing):', errorMessage);
      getSpotlightWindow()?.webContents.send('spotlight-assistant', {
        status: 'error',
        message: 'Assistant unavailable'
      });
    }
  }

  if (ragSettings.enabled && knowledgeSettings.collectionName) {
    try {
      // Notify Spotlight UI: Agent is analyzing
      getSpotlightWindow()?.webContents.send('spotlight-rag', {
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
        getSpotlightWindow()?.webContents.send('spotlight-rag', {
          status: 'complete',
          message: `Found ${ragResult.contexts.length} sources`
        });

        // Inject memories + knowledge context + cleaned query
        finalPrompt = memoryContext + assistantContext + formatContextForClaude(ragResult.contexts) + cleanedPromptWithSystem;
        console.log(`[RAG/Spotlight] Injected ${ragResult.contexts.length} context chunks`);
        console.log(`[RAG/Spotlight] Cleaned query: "${cleanedQuery}"`);
      } else if (ragResult.decision.needs_retrieval) {
        // Retrieval was needed but no results found - still use cleaned query
        getSpotlightWindow()?.webContents.send('spotlight-rag', {
          status: 'skipped',
          message: 'No matching content'
        });
        finalPrompt = memoryContext + assistantContext + cleanedPromptWithSystem;
        console.log(`[RAG/Spotlight] No results, using cleaned query: "${cleanedQuery}"`);
      } else {
        // Notify Spotlight UI: No retrieval needed, but still include memories
        getSpotlightWindow()?.webContents.send('spotlight-rag', {
          status: 'skipped',
          message: ''
        });
        finalPrompt = memoryContext + assistantContext + promptWithSystem;
      }
    } catch (ragError: unknown) {
      // Non-blocking error - continue with memories + assistant only
      const errorMessage = ragError instanceof Error ? ragError.message : String(ragError);
      console.error('[RAG/Spotlight] Error (continuing):', errorMessage);
      getSpotlightWindow()?.webContents.send('spotlight-rag', {
        status: 'error',
        message: 'RAG unavailable'
      });
      finalPrompt = memoryContext + assistantContext + promptWithSystem;
    }
  } else if (memoryContext || assistantContext) {
    // RAG disabled but we have memories/assistant - still inject them
    finalPrompt = memoryContext + assistantContext + promptWithSystem;
  }
  // === End RAG + Assistant Processing ===

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
// Prompt Improver (uses Claude API)
// ============================================================================

// Dedicated conversation for prompt improvement
let improverConversationId: string | null = null;
let improverParentMessageUuid: string | null = null;

const IMPROVER_SYSTEM_PROMPT = `You are an expert prompt engineer. Your task is to improve the given prompt.

Improve it by:
1. Adding a clear role/persona if missing (e.g., "You are a...")
2. Making requirements specific and measurable
3. Adding output format specifications if helpful
4. Removing vague language ("maybe", "try to", "could")
5. Structuring with clear sections if the prompt is complex
6. Adding constraints or boundaries where appropriate

Return ONLY the improved prompt text. Do not include explanations, commentary, or markdown formatting around it.`;

// Improve a prompt using Claude API
ipcMain.handle('prompts-improve-with-claude', async (_event, promptContent: string) => {
  const orgId = await getOrgId();
  if (!orgId) throw new Error('Not authenticated');

  // Create dedicated improver conversation if needed
  if (!improverConversationId) {
    const createResult = await makeRequest(
      `${BASE_URL}/api/organizations/${orgId}/chat_conversations`,
      'POST',
      {
        name: 'Prompt Improver',
        model: 'claude-sonnet-4-20250514',
        is_temporary: true,
        include_conversation_preferences: true
      }
    );

    if (createResult.status !== 201 && createResult.status !== 200) {
      throw new Error('Failed to create improver conversation');
    }

    const convData = createResult.data as { uuid: string };
    improverConversationId = convData.uuid;
    improverParentMessageUuid = null;
  }

  const conversationId = improverConversationId;
  const parentMessageUuid = improverParentMessageUuid || conversationId;

  // Combine system prompt with user's prompt
  const fullPrompt = `${IMPROVER_SYSTEM_PROMPT}\n\n---\n\nPrompt to improve:\n${promptContent}`;

  const state = createStreamState();
  let improvedText = '';

  const callbacks: StreamCallbacks = {
    onTextDelta: (_text, fullText, _blockIndex) => {
      improvedText = fullText;  // Use fullText from parser (already accumulated)
      // Stream to prompt selector window
      getPromptSelectorWindow()?.webContents.send('improve-stream', { text: fullText });
    },
    onComplete: (fullText, _steps, messageUuid) => {
      improverParentMessageUuid = messageUuid;
      getPromptSelectorWindow()?.webContents.send('improve-complete', { improved: fullText });
    }
  };

  try {
    await streamCompletion(
      orgId,
      conversationId,
      fullPrompt,
      parentMessageUuid,
      (chunk) => processSSEChunk(chunk, state, callbacks)
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    getPromptSelectorWindow()?.webContents.send('improve-error', { error: errorMessage });
    throw error;
  }

  return { improved: improvedText };
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
  // Only clear Claude.ai session data, preserve user settings
  // Keep persisted: deviceId, anonymousId, settings, knowledgeSettings, notionSettings,
  // ragSettings, memorySettings, assistantSettings, automationSettings
  store.delete('orgId');
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
      getMainWindow()?.webContents.send('message-stream', { conversationId, blockIndex, text, fullText });
    },
    onThinkingStart: (blockIndex) => {
      getMainWindow()?.webContents.send('message-thinking', { conversationId, blockIndex, isThinking: true });
    },
    onThinkingDelta: (thinking, blockIndex) => {
      const block = state.contentBlocks.get(blockIndex);
      getMainWindow()?.webContents.send('message-thinking-stream', {
        conversationId,
        blockIndex,
        thinking,
        summaries: block?.summaries
      });
    },
    onThinkingStop: (thinkingText, summaries, blockIndex) => {
      getMainWindow()?.webContents.send('message-thinking', {
        conversationId,
        blockIndex,
        isThinking: false,
        thinkingText,
        summaries
      });
    },
    onToolStart: (toolName, toolMessage, blockIndex) => {
      getMainWindow()?.webContents.send('message-tool-use', {
        conversationId,
        blockIndex,
        toolName,
        message: toolMessage,
        isRunning: true
      });
    },
    onToolStop: (toolName, input, blockIndex) => {
      const block = state.contentBlocks.get(blockIndex);
      getMainWindow()?.webContents.send('message-tool-use', {
        conversationId,
        blockIndex,
        toolName,
        message: block?.toolMessage,
        input,
        isRunning: false
      });
    },
    onToolResult: (toolName, result, isError, blockIndex) => {
      getMainWindow()?.webContents.send('message-tool-result', {
        conversationId,
        blockIndex,
        toolName,
        result,
        isError
      });
    },
    onCitation: (citation, blockIndex) => {
      getMainWindow()?.webContents.send('message-citation', { conversationId, blockIndex, citation });
    },
    onToolApproval: (toolName, approvalKey, input) => {
      getMainWindow()?.webContents.send('message-tool-approval', { conversationId, toolName, approvalKey, input });
    },
    onCompaction: (status, compactionMessage) => {
      getMainWindow()?.webContents.send('message-compaction', { conversationId, status, message: compactionMessage });
    },
    onComplete: (fullText, steps, messageUuid) => {
      getMainWindow()?.webContents.send('message-complete', { conversationId, fullText, steps, messageUuid });

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
      getMainWindow()?.webContents.send('rag-status', {
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
        getMainWindow()?.webContents.send('rag-status', {
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
        getMainWindow()?.webContents.send('rag-status', {
          conversationId,
          status: 'skipped',
          message: 'No matching content found'
        });
        augmentedMessage = memoryContext + cleanedQuery;
        console.log(`[RAG] No results, using cleaned query: "${cleanedQuery}"`);
      } else {
        // Notify UI: No retrieval needed, but still include memories
        getMainWindow()?.webContents.send('rag-status', {
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
      getMainWindow()?.webContents.send('rag-status', {
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

  // === Personal Assistant Processing (Google Services) ===
  // Fetch calendar, email, tasks context if needed
  if (assistantSettings.enabled && isAssistantReady()) {
    try {
      // Notify UI: Assistant is analyzing
      getMainWindow()?.webContents.send('assistant-status', {
        conversationId,
        status: 'analyzing',
        message: 'Checking personal data...'
      });

      const assistantResult = await processAssistantQuery(
        message,  // Original message for assistant decision
        ragSettings.model  // Use same Ollama model as RAG
      );

      if (assistantResult.decision.needs_google && assistantResult.contexts.length > 0) {
        // Notify UI: Found personal data
        getMainWindow()?.webContents.send('assistant-status', {
          conversationId,
          status: 'complete',
          message: `Found ${assistantResult.contexts.length} data sources`,
          detail: {
            services: assistantResult.decision.services,
            processingTimeMs: assistantResult.processingTimeMs
          }
        });

        // Prepend assistant context to augmented message
        const assistantContext = formatAssistantContext(assistantResult.contexts);
        augmentedMessage = assistantContext + augmentedMessage;
        console.log(`[Assistant] Injected context from ${assistantResult.decision.services.join(', ')} (${assistantResult.processingTimeMs}ms)`);
      } else {
        getMainWindow()?.webContents.send('assistant-status', {
          conversationId,
          status: 'skipped',
          message: assistantResult.decision.reasoning || 'No personal data needed'
        });
        console.log(`[Assistant] Skipped: ${assistantResult.decision.reasoning}`);
      }
    } catch (assistantError: unknown) {
      // Assistant errors are non-blocking
      const errorMessage = assistantError instanceof Error ? assistantError.message : String(assistantError);
      console.error('[Assistant] Processing error (continuing without assistant):', errorMessage);
      getMainWindow()?.webContents.send('assistant-status', {
        conversationId,
        status: 'error',
        message: 'Assistant unavailable'
      });
    }
  }
  // === End Personal Assistant Processing ===

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
  showKnowledgeView();
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
  if (knowledgeSettings.qdrantUrl) {
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
// Personal Assistant (Google Services)
// ============================================================================

// Get assistant settings
ipcMain.handle('assistant-get-settings', async () => {
  assistantSettings = getAssistantSettings();
  return assistantSettings;
});

// Save assistant settings
ipcMain.handle('assistant-save-settings', async (_event, settings: Partial<AssistantSettingsStore>) => {
  assistantSettings = { ...assistantSettings, ...settings };
  saveAssistantSettings(assistantSettings);
  return { success: true };
});

// Add Google account (triggers OAuth flow)
ipcMain.handle('assistant-add-google-account', async () => {
  try {
    const result = await startOAuthFlow();
    if (result.success) {
      // Reload settings after successful auth
      assistantSettings = getAssistantSettings();
    }
    return result;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Assistant] OAuth flow error:', errorMessage);
    return { success: false, error: errorMessage };
  }
});

// Remove Google account
ipcMain.handle('assistant-remove-google-account', async (_event, email: string) => {
  try {
    const removed = removeGoogleAccount(email);
    if (removed) {
      assistantSettings = getAssistantSettings();
    }
    return { success: removed };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
});

// Toggle Google account enabled/disabled
ipcMain.handle('assistant-toggle-account', async (_event, email: string, enabled: boolean) => {
  try {
    const toggled = toggleAccountEnabled(email, enabled);
    if (toggled) {
      assistantSettings = getAssistantSettings();
    }
    return { success: toggled };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
});

// Get token status for all accounts (for UI to show Reconnect button)
ipcMain.handle('assistant-get-accounts-token-status', async () => {
  return getAccountsTokenStatus();
});

// Test Google account connection
ipcMain.handle('assistant-test-connection', async (_event, email: string) => {
  try {
    return await testAccountConnection(email);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
});

// ============================================================================
// Gemini YouTube Knowledge Agent
// ============================================================================

// Check Gemini authentication status
ipcMain.handle('gemini:is-authenticated', async () => {
  return isGeminiAuthenticated();
});

// Open Gemini login window
ipcMain.handle('gemini:login', async () => {
  // Open Gemini in a browser window for login
  // User logs in, cookies are stored in Electron session
  const loginWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    title: 'Sign in to Gemini'
  });

  await loginWindow.loadURL('https://gemini.google.com');

  return new Promise<{ success: boolean; error?: string }>((resolve) => {
    // Poll for authentication cookies
    const checkAuth = setInterval(async () => {
      const isAuth = await isGeminiAuthenticated();
      if (isAuth) {
        clearInterval(checkAuth);
        loginWindow.close();
        console.log('[Gemini] Login successful');
        resolve({ success: true });
      }
    }, 1000);

    // Handle window close without auth
    loginWindow.on('closed', () => {
      clearInterval(checkAuth);
      resolve({ success: false, error: 'Login window closed' });
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      clearInterval(checkAuth);
      if (!loginWindow.isDestroyed()) {
        loginWindow.close();
      }
      resolve({ success: false, error: 'Login timed out' });
    }, 5 * 60 * 1000);
  });
});

// Get Gemini settings
ipcMain.handle('gemini:get-settings', async () => {
  return geminiSettings;
});

// Save Gemini settings
ipcMain.handle('gemini:save-settings', async (_event, settings: Partial<GeminiSettings>) => {
  geminiSettings = { ...geminiSettings, ...settings };
  store.set('geminiSettings', geminiSettings);
  console.log(`[Gemini] Settings saved (enabled: ${geminiSettings.enabled})`);
  return { success: true };
});

// Clear Gemini token cache (for troubleshooting)
ipcMain.handle('gemini:clear-cache', async () => {
  clearTokenCache();
  return { success: true };
});

// ============================================================================
// Automation Settings (Morning Email)
// ============================================================================

// Get automation settings
ipcMain.handle('automation-get-settings', async () => {
  return automationSettings;
});

// Save automation settings
ipcMain.handle('automation-save-settings', async (_event, settings: Partial<AutomationSettings>) => {
  automationSettings = { ...automationSettings, ...settings };
  store.set('automationSettings', automationSettings as AutomationSettingsStore);
  console.log(`[Automation] Settings saved (enabled: ${automationSettings.morningEmailEnabled})`);

  // Update scheduler with new settings
  const getAccountByEmail = (email: string) =>
    assistantSettings.googleAccounts.find(a => a.email === email && a.enabled);

  // Check if Resend is configured (required for sending)
  const hasResendConfig = automationSettings.resendApiKey &&
                          automationSettings.resendFromEmail &&
                          automationSettings.resendToEmail;

  if (automationSettings.morningEmailEnabled && hasResendConfig) {
    initMorningEmailScheduler(
      automationSettings,
      getAccountByEmail,
      ragSettings,
      knowledgeSettings.collectionName,
      {
        url: memorySettings.supabaseUrl,
        anonKey: memorySettings.supabaseAnonKey,
        deviceId: store.get('deviceId') || crypto.randomUUID()
      }
    );
  } else {
    stopMorningEmailScheduler();
  }

  return { success: true };
});

// Get scheduler status
ipcMain.handle('automation-get-status', async () => {
  return getSchedulerStatus();
});

// Manually trigger morning email (for testing)
ipcMain.handle('automation-trigger-now', async () => {
  try {
    return await triggerMorningEmailNow();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
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

    // Pull assistant settings (credentials only, NOT account tokens)
    if (cloudSettings.assistant_settings && Object.keys(cloudSettings.assistant_settings).length > 0) {
      const merged = { ...DEFAULT_ASSISTANT_SETTINGS, ...cloudSettings.assistant_settings };
      store.set('assistantSettings', merged);
      assistantSettings = merged as AssistantSettingsStore;
    }

    // Pull automation settings (morning email config)
    if (cloudSettings.automation_settings && Object.keys(cloudSettings.automation_settings).length > 0) {
      const merged = { ...DEFAULT_AUTOMATION_SETTINGS, ...cloudSettings.automation_settings };
      store.set('automationSettings', merged);
      automationSettings = merged as AutomationSettings;
      // Reschedule if enabled
      const hasResendConfig = automationSettings.resendApiKey &&
                              automationSettings.resendFromEmail &&
                              automationSettings.resendToEmail;
      if (automationSettings.morningEmailEnabled && hasResendConfig) {
        const getAccountByEmail = (email: string) =>
          assistantSettings.googleAccounts.find(a => a.email === email && a.enabled);
        initMorningEmailScheduler(
          automationSettings,
          getAccountByEmail,
          ragSettings,
          knowledgeSettings.collectionName,
          {
            url: memorySettings.supabaseUrl,
            anonKey: memorySettings.supabaseAnonKey,
            deviceId: store.get('deviceId') || crypto.randomUUID()
          }
        );
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
    // For assistant: only sync credentials, NOT Google account tokens (security)
    const assistantStore = store.get('assistantSettings');
    const automationStore = store.get('automationSettings');
    const cloudSettings: CloudSettings = {
      settings: store.get('settings') || {},
      knowledge_settings: store.get('knowledgeSettings') || {},
      notion_settings: store.get('notionSettings') || {},
      rag_settings: store.get('ragSettings') || {},
      assistant_settings: assistantStore ? {
        enabled: assistantStore.enabled,
        googleClientId: assistantStore.googleClientId,
        googleClientSecret: assistantStore.googleClientSecret
        // NOTE: googleAccounts[] excluded - tokens stay local
      } : undefined,
      automation_settings: automationStore || undefined
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
// Prompt Base IPC Handlers
// ============================================================================

// Initialize prompts Supabase client when memory settings are available
function initPromptsClient() {
  if (memorySettings.supabaseUrl && memorySettings.supabaseAnonKey) {
    initPromptsSupabaseClient(memorySettings.supabaseUrl, memorySettings.supabaseAnonKey);
    // Also init improver with RAG settings if available
    if (ragSettings.ollamaUrl && ragSettings.model) {
      initImprover(ragSettings.ollamaUrl, ragSettings.model);
    }
  }
}

// Get all prompts
ipcMain.handle('prompts-get-all', async () => {
  try {
    initPromptsClient();
    return await getPrompts();
  } catch (error: unknown) {
    console.error('[Prompts] Failed to get prompts:', error);
    return [];
  }
});

// Create a new prompt
ipcMain.handle('prompts-create', async (_event, input: CreatePromptInput) => {
  try {
    initPromptsClient();
    return await createPrompt(input);
  } catch (error: unknown) {
    console.error('[Prompts] Failed to create prompt:', error);
    return null;
  }
});

// Update a prompt
ipcMain.handle('prompts-update', async (_event, id: string, updates: UpdatePromptInput) => {
  try {
    initPromptsClient();
    return await updatePrompt(id, updates);
  } catch (error: unknown) {
    console.error('[Prompts] Failed to update prompt:', error);
    return null;
  }
});

// Delete a prompt
ipcMain.handle('prompts-delete', async (_event, id: string) => {
  try {
    initPromptsClient();
    return await deletePrompt(id);
  } catch (error: unknown) {
    console.error('[Prompts] Failed to delete prompt:', error);
    return false;
  }
});

// Toggle prompt favorite
ipcMain.handle('prompts-toggle-favorite', async (_event, id: string) => {
  try {
    initPromptsClient();
    return await toggleFavorite(id);
  } catch (error: unknown) {
    console.error('[Prompts] Failed to toggle favorite:', error);
    return null;
  }
});

// Increment prompt usage count
ipcMain.handle('prompts-increment-usage', async (_event, id: string) => {
  try {
    initPromptsClient();
    return await incrementUsageCount(id);
  } catch (error: unknown) {
    console.error('[Prompts] Failed to increment usage:', error);
    return false;
  }
});

// Analyze and improve a prompt
ipcMain.handle('prompts-analyze', async (_event, content: string) => {
  try {
    initPromptsClient();
    return await analyzePrompt(content);
  } catch (error: unknown) {
    console.error('[Prompts] Failed to analyze prompt:', error);
    return null;
  }
});

// Test prompts connection
ipcMain.handle('prompts-test-connection', async () => {
  try {
    initPromptsClient();
    return await testPromptsConnection();
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg };
  }
});

// Select prompt (send to main window chat input)
ipcMain.handle('prompts-select', async (_event, promptContent: string) => {
  const win = getMainWindow();
  if (win) {
    win.webContents.send('prompt-selected', promptContent);
  }
});

// Close prompt selector window
ipcMain.handle('prompts-close-selector', async () => {
  closePromptSelectorWindow();
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

// List all knowledge items (from Qdrant - source of truth for vectors)
ipcMain.handle('knowledge-list', async () => {
  console.log('[Knowledge] IPC: knowledge-list called');
  try {
    // Fetch from Qdrant (has actual content for previews + all chunk metadata)
    const items = await listItems(knowledgeSettings.collectionName);
    console.log(`[Knowledge] IPC: knowledge-list returning ${items.length} chunks from Qdrant`);
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

  // Register document in Supabase registry (if connected)
  if (isKnowledgeSupabaseReady()) {
    await registerDocument(pageUrl, pageTitle, 'notion', items.length);
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

    // Unregister from Supabase registry (if connected)
    if (isKnowledgeSupabaseReady()) {
      await unregisterDocument(page.url);
    }

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
    const win = getMainWindow();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

app.whenReady().then(() => {
  // Hide dock icon on macOS - app lives in menu bar only
  if (process.platform === 'darwin' && app.dock) {
    app.dock.hide();
  }

  createMainWindow();
  createTray({ spotlightKeybind: getSettings().spotlightKeybind });

  // Check for updates on startup (non-blocking)
  checkForUpdatesAndNotify();

  // Register spotlight shortcut from settings
  registerSpotlightShortcut();

  // Initialize Qdrant client at startup (needed for knowledge-list)
  const qdrantStored = store.get('knowledgeSettings') as KnowledgeSettingsStore | undefined;
  knowledgeSettings = { ...DEFAULT_KNOWLEDGE_SETTINGS, ...qdrantStored };
  if (knowledgeSettings.qdrantUrl) {
    try {
      initQdrantClient(knowledgeSettings);
      console.log('[Knowledge] Qdrant client initialized at startup');
    } catch (error) {
      console.error('[Knowledge] Failed to initialize Qdrant at startup:', error);
    }
  }

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

    initMemoryWorker({
      enabled: memorySettings.enabled,
      ollamaModel: currentRagSettings.model,
      collectionName: knowledgeSettings.collectionName
    });
    console.log('[Memory] Memory system initialized');

    // Schedule daily maintenance (decay + pruning)
    const MAINTENANCE_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
    setInterval(async () => {
      if (memorySettings.enabled) {
        const result = await runMaintenance();
        console.log(`[Memory Maintenance] Daily run - Decayed: ${result.decayed}, Pruned: ${result.pruned}`);
      }
    }, MAINTENANCE_INTERVAL);

    // Run maintenance on startup (after 5 minute delay, non-blocking)
    setTimeout(async () => {
      if (memorySettings.enabled) {
        console.log('[Memory Maintenance] Running startup maintenance...');
        await runMaintenance();
      }
    }, 5 * 60 * 1000);
  }

  // Auto-sync settings from cloud on startup (if Supabase configured)
  if (memorySettings.supabaseUrl && memorySettings.supabaseAnonKey) {
    (async () => {
      try {
        initSettingsSyncClient(memorySettings.supabaseUrl, memorySettings.supabaseAnonKey);
        const hasCloud = await hasCloudSettings();

        if (hasCloud) {
          console.log('[SettingsSync] Cloud settings found, checking for auto-pull...');

          // Auto-pull if local settings appear to be default/empty
          const localKnowledge = store.get('knowledgeSettings') as KnowledgeSettingsStore | undefined;
          const localAssistant = store.get('assistantSettings') as AssistantSettingsStore | undefined;

          const isLocalEmpty = !localKnowledge?.qdrantUrl && !localAssistant?.googleAccounts?.length;

          if (isLocalEmpty) {
            console.log('[SettingsSync] Local settings empty, auto-pulling from cloud...');
            const cloudSettings = await loadSettingsFromCloud();

            if (cloudSettings) {
              // Apply cloud settings to local store
              if (cloudSettings.settings) {
                store.set('settings', { ...DEFAULT_SETTINGS, ...cloudSettings.settings });
              }
              if (cloudSettings.knowledge_settings) {
                const merged = { ...DEFAULT_KNOWLEDGE_SETTINGS, ...cloudSettings.knowledge_settings };
                store.set('knowledgeSettings', merged);
                knowledgeSettings = merged;
                if (knowledgeSettings.qdrantUrl) {
                  initQdrantClient(knowledgeSettings);
                }
              }
              if (cloudSettings.notion_settings) {
                const merged = { ...DEFAULT_NOTION_SETTINGS, ...cloudSettings.notion_settings };
                store.set('notionSettings', merged);
                notionSettings = merged;
              }
              if (cloudSettings.rag_settings) {
                const merged = { ...DEFAULT_RAG_SETTINGS, ...cloudSettings.rag_settings };
                store.set('ragSettings', merged);
                ragSettings = merged;
              }
              if (cloudSettings.assistant_settings) {
                // Merge cloud credentials with local tokens (cloud doesn't have tokens)
                const localAssistantSettings = store.get('assistantSettings') as AssistantSettingsStore | undefined;
                const merged = {
                  ...DEFAULT_ASSISTANT_SETTINGS,
                  ...cloudSettings.assistant_settings,
                  googleAccounts: localAssistantSettings?.googleAccounts || []
                };
                store.set('assistantSettings', merged);
                assistantSettings = merged;
              }

              console.log('[SettingsSync] Auto-pull complete');
            }
          } else {
            console.log('[SettingsSync] Local settings exist, skipping auto-pull');
          }
        }
      } catch (err) {
        console.error('[SettingsSync] Auto-sync failed:', err);
      }
    })();
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

  // Load Assistant settings at startup
  const assistantStored = store.get('assistantSettings') as AssistantSettingsStore | undefined;
  if (assistantStored) {
    assistantSettings = { ...DEFAULT_ASSISTANT_SETTINGS, ...assistantStored };
    console.log(`[Assistant] Settings loaded (enabled: ${assistantSettings.enabled}, accounts: ${assistantSettings.googleAccounts?.length || 0})`);
  }

  // Load Automation settings and initialize scheduler
  const automationStored = store.get('automationSettings') as AutomationSettingsStore | undefined;
  if (automationStored) {
    automationSettings = { ...DEFAULT_AUTOMATION_SETTINGS, ...automationStored };
    console.log(`[Automation] Settings loaded (enabled: ${automationSettings.morningEmailEnabled}, time: ${automationSettings.morningEmailTime})`);
  }

  // Initialize morning email scheduler (if enabled and Resend is configured)
  const hasResendConfig = automationSettings.resendApiKey &&
                          automationSettings.resendFromEmail &&
                          automationSettings.resendToEmail;

  if (automationSettings.morningEmailEnabled && hasResendConfig) {
    const getAccountByEmail = (email: string) =>
      assistantSettings.googleAccounts.find(a => a.email === email && a.enabled);

    initMorningEmailScheduler(
      automationSettings,
      getAccountByEmail,
      ragSettings,
      knowledgeSettings.collectionName,
      {
        url: memorySettings.supabaseUrl,
        anonKey: memorySettings.supabaseAnonKey,
        deviceId: store.get('deviceId') || crypto.randomUUID()
      }
    );
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
