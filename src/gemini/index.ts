/**
 * Gemini Web Client Module
 *
 * Provides Gemini API integration via web cookies.
 * Pattern follows src/assistant/index.ts.
 *
 * Main exports:
 * - Authentication: isGeminiAuthenticated, clearTokenCache
 * - API: sendGeminiRequest
 * - Types: All type definitions
 */

// =============================================================================
// Types
// =============================================================================

export type {
  GeminiSettings,
  GeminiCookies,
  GeminiTokens,
  GeminiResponse,
  GeminiSource,
  GeminiParserState
} from './types';

export {
  DEFAULT_GEMINI_SETTINGS,
  GeminiAuthError,
  GeminiTokenError,
  GeminiParseError,
  GeminiRateLimitError
} from './types';

// =============================================================================
// Client (Authentication & API)
// =============================================================================

export {
  isGeminiAuthenticated,
  getGeminiCookies,
  extractSNlM0eToken,
  sendGeminiRequest,
  clearTokenCache
} from './client';

// =============================================================================
// Parser
// =============================================================================

export {
  createGeminiParserState,
  parseGeminiResponse
} from './parser';
