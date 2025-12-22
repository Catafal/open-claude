/**
 * Renderer Types
 *
 * Shared type definitions for the renderer process.
 * These types define the shape of data flowing between
 * the main process and renderer views.
 */

// ============================================================================
// Conversation Types
// ============================================================================

export interface Conversation {
  uuid: string;
  name?: string;
  summary?: string;
  is_starred?: boolean;
  updated_at: string;
}

export interface ConversationData {
  chat_messages?: Message[];
}

export interface Message {
  uuid?: string;
  sender: string;
  content?: ContentBlock[];
  text?: string;
}

// ============================================================================
// Message Content Types
// ============================================================================

export interface ContentBlock {
  type: string;
  text?: string;
  thinking?: string;
  summaries?: { summary: string }[];
  name?: string;
  message?: string;
  display_content?: { text?: string };
  input?: unknown;
  content?: unknown[];
  is_error?: boolean;
  citations?: Citation[];
}

export interface Citation {
  url?: string;
  title?: string;
  start_index?: number;
  end_index?: number;
}

// ============================================================================
// Attachment Types
// ============================================================================

export interface AttachmentPayload {
  document_id: string;
  file_name: string;
  file_size: number;
  file_type: string;
  file_url?: string;
  extracted_content?: string;
}

export interface UploadedAttachmentPayload extends AttachmentPayload {}

export interface UploadedAttachment extends AttachmentPayload {
  id: string;
  previewUrl?: string;
}

// ============================================================================
// Streaming Event Types
// ============================================================================

export interface ThinkingData {
  conversationId: string;
  blockIndex: number;
  isThinking: boolean;
  thinkingText?: string;
}

export interface ThinkingStreamData {
  conversationId: string;
  blockIndex: number;
  thinking: string;
  summary?: string;
}

export interface ToolUseData {
  conversationId: string;
  blockIndex: number;
  toolName: string;
  message?: string;
  input?: unknown;
  isRunning: boolean;
}

export interface ToolResultData {
  conversationId: string;
  blockIndex: number;
  toolName: string;
  result: unknown;
  isError: boolean;
}

export interface StreamData {
  conversationId: string;
  blockIndex?: number;
  fullText: string;
}

export interface CompleteData {
  conversationId: string;
  fullText: string;
  steps: Step[];
  messageUuid: string;
}

// ============================================================================
// Step Types (for message rendering)
// ============================================================================

export interface Step {
  type: string;
  text?: string;
  thinkingText?: string;
  thinkingSummary?: string;
  summary?: string;
  toolName?: string;
  toolMessage?: string;
  message?: string;
  toolResult?: unknown;
  toolInput?: unknown;
  isError?: boolean;
  isActive?: boolean;
  index?: number;
  citations?: Citation[];
  ragMessage?: string;
}

export interface StreamingBlock {
  text?: string;
  summary?: string;
  isActive?: boolean;
  name?: string;
  message?: string;
  input?: unknown;
  result?: unknown;
  isRunning?: boolean;
  isError?: boolean;
}

// ============================================================================
// Knowledge Types
// ============================================================================

export interface KnowledgeMetadata {
  source: string;
  filename: string;
  type: 'txt' | 'md' | 'pdf' | 'url';
  chunkIndex: number;
  totalChunks: number;
  dateAdded: string;
}

export interface KnowledgeItem {
  id: string;
  content: string;
  metadata: KnowledgeMetadata;
}

export interface KnowledgeSearchResult extends KnowledgeItem {
  score: number;
}

// ============================================================================
// Prompts Types
// ============================================================================

export interface StoredPrompt {
  id: string;
  name: string;
  category: string;
  content: string;
  variables: Array<{ name: string; defaultValue: string; description: string }>;
  is_favorite: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Notion Types
// ============================================================================

export interface TrackedPage {
  id: string;
  url: string;
  title: string;
  lastSynced: string;
  lastEditedTime: string;
  includeSubpages: boolean;
}
