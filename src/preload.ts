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
  spotlightSend: (message: string) => ipcRenderer.invoke('spotlight-send', message),
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
});
