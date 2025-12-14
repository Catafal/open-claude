/**
 * Personal Assistant Agent Types
 *
 * Type definitions for Google services integration.
 * Follows same pattern as RAG types (src/rag/types.ts).
 */

// Import and re-export from main types to avoid duplication
import type { GoogleAccount as GA, AssistantSettingsStore as ASS } from '../types';
export type GoogleAccount = GA;
export type AssistantSettingsStore = ASS;

// =============================================================================
// Agent Decision Types (Ollama-based)
// =============================================================================

/** Services the agent can request data from */
export type GoogleService = 'calendar' | 'email' | 'tasks';

/**
 * Agent decision result from Ollama analysis.
 * Similar to AgentDecision in RAG (src/rag/types.ts).
 */
export interface AssistantDecision {
  needs_google: boolean;               // Whether query needs Google data
  services: GoogleService[];           // Which services to query
  reasoning: string;                   // Brief explanation of decision
  time_range?: {                       // For calendar queries
    start: string;                     // ISO date string
    end: string;                       // ISO date string
  };
  search_query?: string;               // For email/event search
  cleaned_query: string;               // Query with assistant references removed
}

// =============================================================================
// Calendar Types
// =============================================================================

/**
 * Simplified calendar event for context injection.
 * Only includes fields needed for Claude's context.
 */
export interface CalendarEvent {
  id: string;
  summary: string;           // Event title
  description?: string;      // Event description (truncated if long)
  start: string;             // ISO datetime or date
  end: string;               // ISO datetime or date
  location?: string;         // Event location
  isAllDay: boolean;         // All-day event flag
  attendees?: string[];      // List of attendee emails (limited)
}

// =============================================================================
// Gmail Types
// =============================================================================

/**
 * Simplified email summary for context injection.
 * Only includes metadata, not full body (privacy + context size).
 */
export interface EmailSummary {
  id: string;
  threadId: string;
  from: string;              // Sender email
  to: string[];              // Recipients
  subject: string;           // Email subject
  snippet: string;           // Short preview (first ~100 chars)
  date: string;              // ISO datetime
  isUnread: boolean;         // Unread flag
  hasAttachments: boolean;   // Has attachments flag
  labels: string[];          // Gmail labels (INBOX, IMPORTANT, etc.)
}

// =============================================================================
// Tasks Types
// =============================================================================

/**
 * Task list metadata.
 */
export interface TaskList {
  id: string;
  title: string;
}

/**
 * Individual task item.
 */
export interface TaskItem {
  id: string;
  listId: string;            // Parent task list ID
  listTitle: string;         // Parent task list title
  title: string;             // Task title
  notes?: string;            // Task notes/description
  due?: string;              // Due date (ISO date)
  status: 'needsAction' | 'completed';
  completed?: string;        // Completion date (ISO datetime)
}

// =============================================================================
// Context Types (for Claude injection)
// =============================================================================

/**
 * Context from a single Google service.
 */
export interface AssistantContext {
  type: GoogleService;
  account: string;           // Google account email
  data: CalendarEvent[] | EmailSummary[] | TaskItem[];
}

/**
 * Result from the assistant agent pipeline.
 * Similar to RAGResult in src/rag/types.ts.
 */
export interface AssistantResult {
  decision: AssistantDecision;
  contexts: AssistantContext[];
  processingTimeMs: number;
  error?: string;
}

// =============================================================================
// OAuth Types
// =============================================================================

/**
 * OAuth2 token response from Google.
 */
export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
  token_type: string;
  scope: string;
}

/**
 * Result of OAuth flow.
 */
export interface OAuthResult {
  success: boolean;
  account?: GoogleAccount;
  error?: string;
}
