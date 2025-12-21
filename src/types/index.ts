// Settings schema
export interface SettingsSchema {
  spotlightKeybind: string;
  spotlightPersistHistory: boolean;
  spotlightSystemPrompt: string; // Instructions prepended to all spotlight messages
  // TTS (Text-to-Speech) settings
  ttsEngine: 'kokoro' | 'vibevoice';   // Which TTS engine to use
  vibevoiceModel: '0.5b' | '1.5b';     // VibeVoice model (must match local server)
  vibevoiceServerUrl: string;          // Local VibeVoice server URL
}

// Knowledge settings (re-exported for StoreSchema compatibility)
export interface KnowledgeSettingsStore {
  qdrantUrl: string;
  qdrantApiKey?: string;
  collectionName: string;
}

// Tracked Notion page for manual import with update detection
export interface TrackedNotionPage {
  id: string;              // Notion page ID (32-char hex)
  url: string;             // Page URL (used as source in Qdrant)
  title: string;           // Page title for display
  lastSynced: string;      // ISO timestamp when we last synced
  lastEditedTime: string;  // Notion's last_edited_time for update detection
  includeSubpages: boolean; // Whether subpages were imported
}

// Notion settings (for StoreSchema)
export interface NotionSettingsStore {
  notionToken?: string;
  lastSync?: string;
  syncOnStart: boolean;
  trackedPages?: TrackedNotionPage[]; // Manually imported pages
}

// RAG settings (for StoreSchema)
export interface RAGSettingsStore {
  enabled: boolean;
  ollamaUrl: string;
  model: string;
  maxQueries: number;
  maxContextChunks: number;
  minRelevanceScore: number;
}

// Memory settings (for StoreSchema)
export interface MemorySettingsStore {
  enabled: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

// Assistant settings (for StoreSchema) - Google services integration
export interface GoogleAccount {
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  enabled: boolean;
}

export interface AssistantSettingsStore {
  enabled: boolean;
  googleAccounts: GoogleAccount[];
  googleClientId?: string;
  googleClientSecret?: string;
}

// Automation settings (for morning email and future automations)
export interface AutomationSettingsStore {
  morningEmailEnabled: boolean;
  morningEmailTime: string; // "HH:MM" format (24h), e.g., "07:30"
  morningEmailAccount: string; // Google account email for calendar/tasks/gmail reading
  // Resend email sending
  resendApiKey?: string; // Resend API key
  resendFromEmail?: string; // Email to send from (must be from verified domain)
  resendToEmail?: string; // Email to send to (can be any email)
}

// Gemini settings (for YouTube Knowledge Agent)
export interface GeminiSettingsStore {
  enabled: boolean;
}

// Memory types for extraction and storage
export type MemoryCategory = 'factual' | 'preference' | 'relationship' | 'temporal';

export interface ExtractedMemory {
  content: string;
  category: MemoryCategory;
  importance: number;  // 0.0 - 1.0
}

export interface StoredMemory extends ExtractedMemory {
  id: string;
  source_type: 'spotlight' | 'main_chat';
  created_at: string;
  expires_at?: string;  // For temporal memories
}

// Store schema for electron-store
export interface StoreSchema {
  orgId?: string;
  deviceId?: string;
  anonymousId?: string;
  settings: SettingsSchema;
  knowledgeSettings?: KnowledgeSettingsStore;
  notionSettings?: NotionSettingsStore;
  ragSettings?: RAGSettingsStore;
  memorySettings?: MemorySettingsStore;
  assistantSettings?: AssistantSettingsStore;  // Google services integration
  automationSettings?: AutomationSettingsStore;  // Morning email and future automations
  geminiSettings?: GeminiSettingsStore;  // YouTube Knowledge Agent
}

// File attachment payloads
export interface AttachmentPayload {
  document_id: string;
  file_name: string;
  file_size: number;
  file_type: string;
  file_url?: string;
  extracted_content?: string;
}

export interface UploadFilePayload {
  name: string;
  size: number;
  type: string;
  data: ArrayBuffer | Buffer | Uint8Array | number[];
}

// Citation tracking (matches Claude's citation_start_delta/citation_end_delta)
export interface Citation {
  uuid: string;
  start_index: number;
  end_index?: number;
  url?: string;
  title?: string;
  source_type?: string;
}

// Content block state tracking - matches Claude's block types exactly
export interface ContentBlock {
  type: 'text' | 'thinking' | 'tool_use' | 'tool_result';
  index: number;
  // Text blocks
  text?: string;
  citations?: Citation[];
  flags?: string[];
  // Thinking blocks
  thinking?: string;
  summaries?: Array<{ summary: string } | string>;
  cut_off?: boolean;
  start_timestamp?: string;
  stop_timestamp?: string;
  // Tool use blocks
  name?: string;
  partial_json?: string;
  buffered_input?: string;
  approval_key?: string;
  // Tool result blocks
  tool_use_id?: string;
  is_error?: boolean;
  content?: unknown;
  // Legacy compatibility
  toolName?: string;
  toolInput?: string;
  toolMessage?: string;
  toolResult?: unknown;
  isError?: boolean;
  thinkingText?: string;
  thinkingSummary?: string;
}

// Step type for message-complete event timeline
export interface Step {
  type: 'thinking' | 'tool' | 'text';
  index: number;
  // Thinking
  thinkingText?: string;
  thinkingSummary?: string;
  summaries?: Array<{ summary: string } | string>;
  cut_off?: boolean;
  start_timestamp?: string;
  stop_timestamp?: string;
  // Tool
  toolName?: string;
  toolInput?: string;
  toolMessage?: string;
  toolResult?: unknown;
  isError?: boolean;
  // Text
  text?: string;
  citations?: Citation[];
  flags?: string[];
}

// Web search result from tool_result display_content
export interface WebSearchResult {
  type: string;
  title: string;
  url: string;
  metadata?: {
    site_domain?: string;
    favicon_url?: string;
    site_name?: string;
  };
}

// API response types
export interface ApiResponse<T = unknown> {
  status: number;
  data: T;
  stream?: NodeJS.ReadableStream;
}

export interface ConversationData {
  uuid: string;
  name?: string;
  model?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateConversationResponse extends ConversationData {
  conversationId: string;
  parentMessageUuid: string;
}
