import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('claude', {
  getAuthStatus: () => ipcRenderer.invoke('get-auth-status'),
  login: () => ipcRenderer.invoke('login'),
  logout: () => ipcRenderer.invoke('logout'),
  createConversation: (model?: string) => ipcRenderer.invoke('create-conversation', model),
  getConversations: () => ipcRenderer.invoke('get-conversations'),
  loadConversation: (convId: string) => ipcRenderer.invoke('load-conversation', convId),
  deleteConversation: (convId: string) => ipcRenderer.invoke('delete-conversation', convId),
  renameConversation: (convId: string, name: string) => ipcRenderer.invoke('rename-conversation', convId, name),
  starConversation: (convId: string, isStarred: boolean) => ipcRenderer.invoke('star-conversation', convId, isStarred),
  generateTitle: (convId: string, messageContent: string, recentTitles?: string[]) => ipcRenderer.invoke('generate-title', convId, messageContent, recentTitles || []),
  sendMessage: (conversationId: string, message: string, parentMessageUuid: string, attachments?: unknown[]) =>
    ipcRenderer.invoke('send-message', conversationId, message, parentMessageUuid, attachments || []),
  uploadAttachments: (files: Array<{ name: string; size: number; type: string; data: ArrayBuffer | Uint8Array | number[] }>) =>
    ipcRenderer.invoke('upload-attachments', files),
  stopResponse: (conversationId: string) => ipcRenderer.invoke('stop-response', conversationId),

  // Stream listeners
  onMessageStream: (callback: (data: { conversationId: string; text: string; fullText: string }) => void) => {
    ipcRenderer.on('message-stream', (_event, data) => callback(data));
  },
  onMessageComplete: (callback: (data: {
    conversationId: string;
    fullText: string;
    steps?: Array<{
      type: 'thinking' | 'tool';
      index: number;
      thinkingText?: string;
      toolName?: string;
      toolInput?: string;
      toolResult?: unknown;
      isError?: boolean;
    }>;
    messageUuid: string
  }) => void) => {
    ipcRenderer.on('message-complete', (_event, data) => callback(data));
  },
  onMessageThinking: (callback: (data: { conversationId: string; blockIndex: number; isThinking: boolean; thinkingText?: string }) => void) => {
    ipcRenderer.on('message-thinking', (_event, data) => callback(data));
  },
  onMessageThinkingStream: (callback: (data: { conversationId: string; blockIndex: number; thinking: string }) => void) => {
    ipcRenderer.on('message-thinking-stream', (_event, data) => callback(data));
  },
  onMessageToolUse: (callback: (data: { conversationId: string; blockIndex: number; toolName: string; message: string; input?: string; isRunning: boolean }) => void) => {
    ipcRenderer.on('message-tool-use', (_event, data) => callback(data));
  },
  onMessageToolResult: (callback: (data: { conversationId: string; blockIndex: number; toolName: string; result?: unknown; isError: boolean }) => void) => {
    ipcRenderer.on('message-tool-result', (_event, data) => callback(data));
  },
  // Citation events (for inline source citations)
  onMessageCitation: (callback: (data: { conversationId: string; blockIndex: number; citation: { uuid: string; start_index: number; end_index?: number; url?: string; title?: string } }) => void) => {
    ipcRenderer.on('message-citation', (_event, data) => callback(data));
  },
  // Tool approval events (for MCP tools requiring permission)
  onMessageToolApproval: (callback: (data: { conversationId: string; toolName: string; approvalKey: string; input?: unknown }) => void) => {
    ipcRenderer.on('message-tool-approval', (_event, data) => callback(data));
  },
  // Compaction status (conversation compaction)
  onMessageCompaction: (callback: (data: { conversationId: string; status: string; message?: string }) => void) => {
    ipcRenderer.on('message-compaction', (_event, data) => callback(data));
  },
  // RAG status events (for knowledge base retrieval indicators)
  onRagStatus: (callback: (data: {
    conversationId: string;
    status: 'agent_thinking' | 'searching' | 'complete' | 'skipped' | 'error';
    message: string;
    detail?: { queriesGenerated?: number; chunksRetrieved?: number; processingTimeMs?: number };
  }) => void) => {
    ipcRenderer.on('rag-status', (_event, data) => callback(data));
  },
  removeStreamListeners: () => {
    ipcRenderer.removeAllListeners('message-stream');
    ipcRenderer.removeAllListeners('message-complete');
    ipcRenderer.removeAllListeners('message-thinking');
    ipcRenderer.removeAllListeners('message-thinking-stream');
    ipcRenderer.removeAllListeners('message-tool-use');
    ipcRenderer.removeAllListeners('message-tool-result');
    ipcRenderer.removeAllListeners('message-citation');
    ipcRenderer.removeAllListeners('message-tool-approval');
    ipcRenderer.removeAllListeners('message-compaction');
    ipcRenderer.removeAllListeners('rag-status');
  },

  // Spotlight functions
  spotlightResize: (height: number) => ipcRenderer.invoke('spotlight-resize', height),
  spotlightSend: (message: string, model?: string) => ipcRenderer.invoke('spotlight-send', message, model),
  onSpotlightStream: (callback: (data: { text: string; fullText: string }) => void) => {
    ipcRenderer.on('spotlight-stream', (_event, data) => callback(data));
  },
  onSpotlightComplete: (callback: (data: { fullText: string }) => void) => {
    ipcRenderer.on('spotlight-complete', (_event, data) => callback(data));
  },
  onSpotlightThinking: (callback: (data: { isThinking: boolean; thinkingText?: string }) => void) => {
    ipcRenderer.on('spotlight-thinking', (_event, data) => callback(data));
  },
  onSpotlightThinkingStream: (callback: (data: { thinking: string }) => void) => {
    ipcRenderer.on('spotlight-thinking-stream', (_event, data) => callback(data));
  },
  onSpotlightTool: (callback: (data: { toolName: string; isRunning: boolean; message?: string; input?: string }) => void) => {
    ipcRenderer.on('spotlight-tool', (_event, data) => callback(data));
  },
  onSpotlightToolResult: (callback: (data: { toolName: string; isError: boolean; result?: unknown }) => void) => {
    ipcRenderer.on('spotlight-tool-result', (_event, data) => callback(data));
  },
  // Spotlight RAG status (for knowledge retrieval in spotlight)
  onSpotlightRag: (callback: (data: { status: string; message: string }) => void) => {
    ipcRenderer.on('spotlight-rag', (_event, data) => callback(data));
  },
  removeSpotlightListeners: () => {
    ipcRenderer.removeAllListeners('spotlight-stream');
    ipcRenderer.removeAllListeners('spotlight-complete');
    ipcRenderer.removeAllListeners('spotlight-thinking');
    ipcRenderer.removeAllListeners('spotlight-thinking-stream');
    ipcRenderer.removeAllListeners('spotlight-tool');
    ipcRenderer.removeAllListeners('spotlight-tool-result');
    ipcRenderer.removeAllListeners('spotlight-rag');
  },
  spotlightReset: () => ipcRenderer.invoke('spotlight-reset'),
  spotlightGetHistory: () => ipcRenderer.invoke('spotlight-get-history'),
  spotlightNewChat: () => ipcRenderer.invoke('spotlight-new-chat'),

  // TTS (Text-to-Speech) - converts text to audio using Kokoro or VibeVoice
  spotlightSpeak: (text: string): Promise<{ samples: number[]; sampleRate: number }> =>
    ipcRenderer.invoke('spotlight-speak', text),

  // Check if VibeVoice server is running (used in settings UI)
  checkVibeVoiceServer: (serverUrl: string): Promise<boolean> =>
    ipcRenderer.invoke('check-vibevoice-server', serverUrl),

  // Search modal toggle (triggered by global Command+K shortcut)
  onToggleSearchModal: (callback: () => void) => {
    ipcRenderer.on('toggle-search-modal', () => callback());
  },

  // Show knowledge view (triggered by tray menu or IPC)
  onShowKnowledgeView: (callback: () => void) => {
    ipcRenderer.on('show-knowledge-view', () => callback());
  },

  // Show settings view (triggered by tray menu or IPC)
  onShowSettingsView: (callback: () => void) => {
    ipcRenderer.on('show-settings-view', () => callback());
  },

  // Settings functions
  openSettings: () => ipcRenderer.invoke('open-settings'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: { spotlightKeybind?: string; spotlightPersistHistory?: boolean; spotlightSystemPrompt?: string }) =>
    ipcRenderer.invoke('save-settings', settings),

  // Knowledge Management functions
  openKnowledge: () => ipcRenderer.invoke('open-knowledge'),
  knowledgeOpenFileDialog: () => ipcRenderer.invoke('knowledge-open-file-dialog'),
  knowledgeGetSettings: () => ipcRenderer.invoke('knowledge-get-settings'),
  knowledgeSaveSettings: (settings: { qdrantUrl?: string; qdrantApiKey?: string; collectionName?: string; firecrawlApiKey?: string }) =>
    ipcRenderer.invoke('knowledge-save-settings', settings),
  knowledgeTestConnection: () => ipcRenderer.invoke('knowledge-test-connection'),
  knowledgeIngestFile: (filePath: string) => ipcRenderer.invoke('knowledge-ingest-file', filePath),
  knowledgeIngestUrl: (url: string) => ipcRenderer.invoke('knowledge-ingest-url', url),
  knowledgeSearch: (query: string, limit?: number) => ipcRenderer.invoke('knowledge-search', query, limit || 5),
  knowledgeList: () => ipcRenderer.invoke('knowledge-list'),
  knowledgeDelete: (ids: string[]) => ipcRenderer.invoke('knowledge-delete', ids),
  knowledgeDeleteBySource: (source: string) => ipcRenderer.invoke('knowledge-delete-by-source', source),
  // Migrate existing Qdrant documents to Supabase registry
  knowledgeMigrateToSupabase: () => ipcRenderer.invoke('knowledge-migrate-to-supabase'),

  // Open external URL in browser (for URL knowledge cards)
  openExternalUrl: (url: string) => ipcRenderer.invoke('open-external-url', url),

  // Notion Integration functions
  notionGetSettings: () => ipcRenderer.invoke('notion-get-settings'),
  notionSaveSettings: (settings: { notionToken?: string; syncOnStart?: boolean }) =>
    ipcRenderer.invoke('notion-save-settings', settings),
  notionTestConnection: () => ipcRenderer.invoke('notion-test-connection'),
  notionSync: () => ipcRenderer.invoke('notion-sync'),

  // Manual Notion Import functions
  notionImportPage: (urlOrId: string, includeSubpages: boolean) =>
    ipcRenderer.invoke('notion-import-page', urlOrId, includeSubpages),
  notionGetTrackedPages: () => ipcRenderer.invoke('notion-get-tracked-pages'),
  notionRemoveTrackedPage: (pageId: string) =>
    ipcRenderer.invoke('notion-remove-tracked-page', pageId),
  notionCheckUpdates: () => ipcRenderer.invoke('notion-check-updates'),
  notionSyncTrackedPage: (pageId: string) =>
    ipcRenderer.invoke('notion-sync-tracked-page', pageId),

  // RAG Agent Settings (Ollama-powered knowledge retrieval)
  ragGetSettings: () => ipcRenderer.invoke('rag-get-settings'),
  ragSaveSettings: (settings: { enabled?: boolean; ollamaUrl?: string; model?: string; maxQueries?: number; maxContextChunks?: number; minRelevanceScore?: number }) =>
    ipcRenderer.invoke('rag-save-settings', settings),
  ragTestConnection: () => ipcRenderer.invoke('rag-test-connection'),

  // Memory Settings (Conversation memory with Supabase)
  memoryGetSettings: () => ipcRenderer.invoke('memory-get-settings'),
  memorySaveSettings: (settings: { enabled?: boolean; supabaseUrl?: string; supabaseAnonKey?: string }) =>
    ipcRenderer.invoke('memory-save-settings', settings),
  memoryTestConnection: () => ipcRenderer.invoke('memory-test-connection'),

  // Personal Assistant Settings (Google Services)
  assistantGetSettings: () => ipcRenderer.invoke('assistant-get-settings'),
  assistantSaveSettings: (settings: { enabled?: boolean; googleClientId?: string; googleClientSecret?: string }) =>
    ipcRenderer.invoke('assistant-save-settings', settings),
  assistantAddGoogleAccount: () => ipcRenderer.invoke('assistant-add-google-account'),
  assistantRemoveGoogleAccount: (email: string) =>
    ipcRenderer.invoke('assistant-remove-google-account', email),
  assistantToggleAccount: (email: string, enabled: boolean) =>
    ipcRenderer.invoke('assistant-toggle-account', email, enabled),
  assistantTestConnection: (email: string) => ipcRenderer.invoke('assistant-test-connection', email),
  assistantGetAccountsTokenStatus: () => ipcRenderer.invoke('assistant-get-accounts-token-status'),

  // Automation Settings (Morning Email)
  automationGetSettings: () => ipcRenderer.invoke('automation-get-settings'),
  automationSaveSettings: (settings: {
    morningEmailEnabled?: boolean;
    morningEmailTime?: string;
    morningEmailAccount?: string;
    resendApiKey?: string;
    resendFromEmail?: string;
    resendToEmail?: string;
  }) => ipcRenderer.invoke('automation-save-settings', settings),
  automationGetStatus: () => ipcRenderer.invoke('automation-get-status'),
  automationTriggerNow: () => ipcRenderer.invoke('automation-trigger-now'),

  // Settings Sync (Cloud Storage) - LOCAL wins, cloud is backup
  settingsSyncHasCloud: () => ipcRenderer.invoke('settings-sync-has-cloud'),
  settingsSyncPull: () => ipcRenderer.invoke('settings-sync-pull'),
  settingsSyncPush: () => ipcRenderer.invoke('settings-sync-push'),

  // Prompt Base functions (Cmd+Shift+X prompt selector)
  getPrompts: () => ipcRenderer.invoke('prompts-get-all'),
  createPrompt: (input: { name: string; category: string; content: string; variables?: unknown[]; is_favorite?: boolean }) =>
    ipcRenderer.invoke('prompts-create', input),
  updatePrompt: (id: string, updates: { name?: string; category?: string; content?: string; variables?: unknown[]; is_favorite?: boolean }) =>
    ipcRenderer.invoke('prompts-update', id, updates),
  deletePrompt: (id: string) => ipcRenderer.invoke('prompts-delete', id),
  togglePromptFavorite: (id: string) => ipcRenderer.invoke('prompts-toggle-favorite', id),
  incrementPromptUsage: (id: string) => ipcRenderer.invoke('prompts-increment-usage', id),
  analyzePrompt: (content: string) => ipcRenderer.invoke('prompts-analyze', content),
  testPromptsConnection: () => ipcRenderer.invoke('prompts-test-connection'),
  selectPrompt: (content: string) => ipcRenderer.invoke('prompts-select', content),
  closePromptSelector: () => ipcRenderer.invoke('prompts-close-selector'),

  // Prompt improvement with Claude
  improvePromptWithClaude: (content: string) => ipcRenderer.invoke('prompts-improve-with-claude', content),
  onImproveStream: (callback: (data: { text: string }) => void) => {
    ipcRenderer.on('improve-stream', (_event, data) => callback(data));
  },
  onImproveComplete: (callback: (data: { improved: string }) => void) => {
    ipcRenderer.on('improve-complete', (_event, data) => callback(data));
  },
  onImproveError: (callback: (data: { error: string }) => void) => {
    ipcRenderer.on('improve-error', (_event, data) => callback(data));
  },
  removeImproveListeners: () => {
    ipcRenderer.removeAllListeners('improve-stream');
    ipcRenderer.removeAllListeners('improve-complete');
    ipcRenderer.removeAllListeners('improve-error');
  },

  // Prompt selection listener (for main window to receive selected prompt)
  onPromptSelected: (callback: (content: string) => void) => {
    ipcRenderer.on('prompt-selected', (_event, content) => callback(content));
  },
  removePromptSelectedListener: () => {
    ipcRenderer.removeAllListeners('prompt-selected');
  },
});
