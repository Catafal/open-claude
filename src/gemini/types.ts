/**
 * Gemini Client Types
 *
 * Type definitions for Gemini web client integration.
 * Used specifically for YouTube Knowledge Agent.
 *
 * Architecture: Follows same patterns as src/knowledge/types.ts
 */

// =============================================================================
// Settings Types (stored in electron-store)
// =============================================================================

/**
 * Gemini settings stored in StoreSchema.
 * Minimal for MVP - just enable/disable flag.
 */
export interface GeminiSettings {
  enabled: boolean;
}

/**
 * Default Gemini settings.
 */
export const DEFAULT_GEMINI_SETTINGS: GeminiSettings = {
  enabled: false
};

// =============================================================================
// Authentication Types
// =============================================================================

/**
 * Required cookies for Gemini authentication.
 * Extracted from gemini.google.com session via Electron cookies API.
 *
 * Why these cookies:
 * - __Secure-1PSID: Primary Google session identifier
 * - __Secure-1PSIDTS: Session timestamp for validation
 */
export interface GeminiCookies {
  __Secure_1PSID: string;
  __Secure_1PSIDTS: string;
}

/**
 * SNlM0e token extracted from Gemini page HTML.
 * Required for all API requests (CSRF-like protection).
 *
 * Why cached with timestamp:
 * - Token expires after ~30 minutes
 * - We cache for 25 min to avoid unnecessary page fetches
 */
export interface GeminiTokens {
  SNlM0e: string;
  extractedAt: number;  // Date.now() when extracted
}

// =============================================================================
// Request/Response Types
// =============================================================================

/**
 * Parsed Gemini response content.
 * Extracted from deeply nested JSON arrays.
 */
export interface GeminiResponse {
  text: string;                   // Main response text
  conversationId?: string;        // For follow-up (not used in MVP)
  responseId?: string;            // Response identifier
  sources?: GeminiSource[];       // Cited sources if any
}

/**
 * Source citation from Gemini response.
 */
export interface GeminiSource {
  title: string;
  url: string;
}

/**
 * State for parsing Gemini's response format.
 * Tracks buffer and header removal status.
 */
export interface GeminiParserState {
  buffer: string;
  headerRemoved: boolean;
}

// =============================================================================
// Error Types
// =============================================================================

/**
 * Gemini authentication error.
 * Thrown when session cookies are missing or invalid.
 */
export class GeminiAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiAuthError';
  }
}

/**
 * Gemini token extraction error.
 * Thrown when SNlM0e token cannot be extracted from page.
 */
export class GeminiTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiTokenError';
  }
}

/**
 * Gemini response parse error.
 * Thrown when response format is unexpected.
 */
export class GeminiParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiParseError';
  }
}

/**
 * Gemini rate limit error.
 * Thrown when receiving 429 status.
 */
export class GeminiRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeminiRateLimitError';
  }
}
