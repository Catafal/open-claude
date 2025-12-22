/**
 * IPC Channel Constants
 *
 * Centralized definitions for all IPC channel names used between
 * the main process and renderer processes. Organized by feature.
 */

// ============================================
// AUTH CHANNELS
// ============================================
export const AUTH = {
  GET_STATUS: 'get-auth-status',
  LOGIN: 'login',
  LOGOUT: 'logout',
} as const;

// ============================================
// CONVERSATION CHANNELS
// ============================================
export const CONVERSATION = {
  CREATE: 'create-conversation',
  GET_ALL: 'get-conversations',
  LOAD: 'load-conversation',
  DELETE: 'delete-conversation',
  RENAME: 'rename-conversation',
  STAR: 'star-conversation',
} as const;

// ============================================
// MESSAGE CHANNELS
// ============================================
export const MESSAGE = {
  SEND: 'send-message',
  STOP: 'stop-response',
  GENERATE_TITLE: 'generate-title',
  UPLOAD_ATTACHMENTS: 'upload-attachments',
} as const;

// ============================================
// SPOTLIGHT CHANNELS
// ============================================
export const SPOTLIGHT = {
  RESIZE: 'spotlight-resize',
  SEND: 'spotlight-send',
  RESET: 'spotlight-reset',
  GET_HISTORY: 'spotlight-get-history',
  NEW_CHAT: 'spotlight-new-chat',
  SPEAK: 'spotlight-speak',
  CHECK_VIBEVOICE: 'check-vibevoice-server',
} as const;

// ============================================
// SETTINGS CHANNELS
// ============================================
export const SETTINGS = {
  OPEN: 'open-settings',
  GET: 'get-settings',
  SAVE: 'save-settings',
  // Cloud sync
  SYNC_HAS_CLOUD: 'settings-sync-has-cloud',
  SYNC_PULL: 'settings-sync-pull',
  SYNC_PUSH: 'settings-sync-push',
} as const;

// ============================================
// KNOWLEDGE CHANNELS
// ============================================
export const KNOWLEDGE = {
  OPEN: 'open-knowledge',
  OPEN_FILE_DIALOG: 'knowledge-open-file-dialog',
  GET_SETTINGS: 'knowledge-get-settings',
  SAVE_SETTINGS: 'knowledge-save-settings',
  TEST_CONNECTION: 'knowledge-test-connection',
  INGEST_FILE: 'knowledge-ingest-file',
  INGEST_URL: 'knowledge-ingest-url',
  SEARCH: 'knowledge-search',
  LIST: 'knowledge-list',
  DELETE: 'knowledge-delete',
  DELETE_BY_SOURCE: 'knowledge-delete-by-source',
  MIGRATE_TO_SUPABASE: 'knowledge-migrate-to-supabase',
} as const;

// ============================================
// NOTION CHANNELS
// ============================================
export const NOTION = {
  GET_SETTINGS: 'notion-get-settings',
  SAVE_SETTINGS: 'notion-save-settings',
  TEST_CONNECTION: 'notion-test-connection',
  SYNC: 'notion-sync',
  IMPORT_PAGE: 'notion-import-page',
  GET_TRACKED_PAGES: 'notion-get-tracked-pages',
  REMOVE_TRACKED_PAGE: 'notion-remove-tracked-page',
  CHECK_UPDATES: 'notion-check-updates',
  SYNC_TRACKED_PAGE: 'notion-sync-tracked-page',
} as const;

// ============================================
// RAG CHANNELS
// ============================================
export const RAG = {
  GET_SETTINGS: 'rag-get-settings',
  SAVE_SETTINGS: 'rag-save-settings',
  TEST_CONNECTION: 'rag-test-connection',
} as const;

// ============================================
// MEMORY CHANNELS
// ============================================
export const MEMORY = {
  GET_SETTINGS: 'memory-get-settings',
  SAVE_SETTINGS: 'memory-save-settings',
  TEST_CONNECTION: 'memory-test-connection',
} as const;

// ============================================
// ASSISTANT (GOOGLE) CHANNELS
// ============================================
export const ASSISTANT = {
  GET_SETTINGS: 'assistant-get-settings',
  SAVE_SETTINGS: 'assistant-save-settings',
  ADD_ACCOUNT: 'assistant-add-google-account',
  REMOVE_ACCOUNT: 'assistant-remove-google-account',
  TOGGLE_ACCOUNT: 'assistant-toggle-account',
  GET_TOKEN_STATUS: 'assistant-get-accounts-token-status',
  TEST_CONNECTION: 'assistant-test-connection',
} as const;

// ============================================
// GEMINI CHANNELS
// ============================================
export const GEMINI = {
  IS_AUTHENTICATED: 'gemini:is-authenticated',
  LOGIN: 'gemini:login',
  GET_SETTINGS: 'gemini:get-settings',
  SAVE_SETTINGS: 'gemini:save-settings',
  CLEAR_CACHE: 'gemini:clear-cache',
} as const;

// ============================================
// AUTOMATION CHANNELS
// ============================================
export const AUTOMATION = {
  GET_SETTINGS: 'automation-get-settings',
  SAVE_SETTINGS: 'automation-save-settings',
  GET_STATUS: 'automation-get-status',
  TRIGGER_NOW: 'automation-trigger-now',
} as const;

// ============================================
// PROMPTS CHANNELS
// ============================================
export const PROMPTS = {
  GET_ALL: 'prompts-get-all',
  CREATE: 'prompts-create',
  UPDATE: 'prompts-update',
  DELETE: 'prompts-delete',
  TOGGLE_FAVORITE: 'prompts-toggle-favorite',
  INCREMENT_USAGE: 'prompts-increment-usage',
  ANALYZE: 'prompts-analyze',
  TEST_CONNECTION: 'prompts-test-connection',
  SELECT: 'prompts-select',
  CLOSE_SELECTOR: 'prompts-close-selector',
  IMPROVE_WITH_CLAUDE: 'prompts-improve-with-claude',
} as const;

// ============================================
// UI/NAVIGATION CHANNELS
// ============================================
export const UI = {
  OPEN_EXTERNAL_URL: 'open-external-url',
} as const;

// ============================================
// EVENT CHANNELS (Main -> Renderer)
// ============================================
export const EVENTS = {
  // Message streaming events
  MESSAGE_STREAM: 'message-stream',
  MESSAGE_COMPLETE: 'message-complete',
  MESSAGE_THINKING: 'message-thinking',
  MESSAGE_THINKING_STREAM: 'message-thinking-stream',
  MESSAGE_TOOL_USE: 'message-tool-use',
  MESSAGE_TOOL_RESULT: 'message-tool-result',
  MESSAGE_CITATION: 'message-citation',
  // RAG events
  RAG_STATUS: 'rag-status',
  // Spotlight events
  SPOTLIGHT_STREAM: 'spotlight-stream',
  SPOTLIGHT_COMPLETE: 'spotlight-complete',
  SPOTLIGHT_THINKING: 'spotlight-thinking',
  SPOTLIGHT_TOOL: 'spotlight-tool',
  SPOTLIGHT_RAG: 'spotlight-rag',
  SPOTLIGHT_TTS_AUDIO: 'spotlight-tts-audio',
  // UI events
  TOGGLE_SEARCH_MODAL: 'toggle-search-modal',
  SHOW_KNOWLEDGE_VIEW: 'show-knowledge-view',
  SHOW_SETTINGS_VIEW: 'show-settings-view',
  // Prompts events
  PROMPT_SELECTED: 'prompt-selected',
  IMPROVE_STREAM: 'improve-stream',
  IMPROVE_COMPLETE: 'improve-complete',
} as const;

// Type helpers for channel values
export type AuthChannel = typeof AUTH[keyof typeof AUTH];
export type ConversationChannel = typeof CONVERSATION[keyof typeof CONVERSATION];
export type MessageChannel = typeof MESSAGE[keyof typeof MESSAGE];
export type SpotlightChannel = typeof SPOTLIGHT[keyof typeof SPOTLIGHT];
export type SettingsChannel = typeof SETTINGS[keyof typeof SETTINGS];
export type KnowledgeChannel = typeof KNOWLEDGE[keyof typeof KNOWLEDGE];
export type NotionChannel = typeof NOTION[keyof typeof NOTION];
export type RagChannel = typeof RAG[keyof typeof RAG];
export type MemoryChannel = typeof MEMORY[keyof typeof MEMORY];
export type AssistantChannel = typeof ASSISTANT[keyof typeof ASSISTANT];
export type GeminiChannel = typeof GEMINI[keyof typeof GEMINI];
export type AutomationChannel = typeof AUTOMATION[keyof typeof AUTOMATION];
export type PromptsChannel = typeof PROMPTS[keyof typeof PROMPTS];
export type UiChannel = typeof UI[keyof typeof UI];
export type EventChannel = typeof EVENTS[keyof typeof EVENTS];

// All IPC channels union type
export type IpcChannel =
  | AuthChannel
  | ConversationChannel
  | MessageChannel
  | SpotlightChannel
  | SettingsChannel
  | KnowledgeChannel
  | NotionChannel
  | RagChannel
  | MemoryChannel
  | AssistantChannel
  | GeminiChannel
  | AutomationChannel
  | PromptsChannel
  | UiChannel
  | EventChannel;
