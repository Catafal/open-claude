/**
 * Gemini Response Parser
 *
 * Parses Gemini's non-standard response format.
 * NOT SSE - uses )]}' header followed by newline-delimited JSON.
 *
 * Response format:
 * 1. Starts with ")]}'" JSONP protection header
 * 2. Followed by length indicator
 * 3. Then newline-delimited JSON arrays
 * 4. Content is deeply nested in arrays (Protocol Buffer format)
 */

import type { GeminiResponse, GeminiSource, GeminiParserState } from './types';
import { GeminiParseError } from './types';

// =============================================================================
// Parser State
// =============================================================================

/**
 * Create initial parser state.
 * Pattern matches createStreamState() in streaming/parser.ts.
 */
export function createGeminiParserState(): GeminiParserState {
  return {
    buffer: '',
    headerRemoved: false
  };
}

// =============================================================================
// Main Parser
// =============================================================================

/**
 * Parse Gemini's response format.
 *
 * Format explanation:
 * 1. Response starts with ")]}'" header (JSONP XSS protection)
 * 2. Followed by newline-delimited JSON chunks
 * 3. Main content is typically in line 3 (fallback to 2, then 1)
 * 4. Content is deeply nested in arrays (Google's protobuf-to-JSON format)
 *
 * @param rawResponse - Raw response string from Gemini API
 * @returns Parsed GeminiResponse with extracted text
 * @throws GeminiParseError if response cannot be parsed
 */
export function parseGeminiResponse(rawResponse: string): GeminiResponse {
  if (!rawResponse || rawResponse.trim().length === 0) {
    throw new GeminiParseError('Empty response from Gemini');
  }

  // Step 1: Remove )]}' header if present
  let cleaned = rawResponse;
  if (cleaned.startsWith(")]}'")) {
    cleaned = cleaned.slice(4).trim();
  }

  // Step 2: Split into lines and find valid JSON line
  const lines = cleaned.split('\n').filter(line => line.trim());

  if (lines.length === 0) {
    throw new GeminiParseError('No valid lines in Gemini response');
  }

  // Debug: log all lines for YouTube debugging
  console.log('[Gemini Parser] Response has', lines.length, 'lines');
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    console.log(`[Gemini Parser] Line ${i} preview:`, lines[i].substring(0, 200));
  }

  // Try line indices 2, 1, 0 (third line is usually the main data)
  let dataLine: string | null = null;
  let parsedData: unknown = null;

  for (const idx of [2, 1, 0]) {
    if (lines[idx] && lines[idx].trim().startsWith('[')) {
      try {
        parsedData = JSON.parse(lines[idx]);
        dataLine = lines[idx];
        break;
      } catch {
        // Try next line
        continue;
      }
    }
  }

  // Fallback: try all lines
  if (!parsedData) {
    for (const line of lines) {
      if (line.trim().startsWith('[')) {
        try {
          parsedData = JSON.parse(line);
          dataLine = line;
          break;
        } catch {
          continue;
        }
      }
    }
  }

  if (!parsedData || !dataLine) {
    throw new GeminiParseError('Could not find valid JSON in Gemini response');
  }

  // Step 3: Extract text content from nested structure
  const text = extractTextFromNestedArray(parsedData);
  const sources = extractSourcesFromNestedArray(parsedData);

  if (!text) {
    console.warn('[Gemini Parser] No text found in response, returning empty');
    console.warn('[Gemini Parser] Raw lines count:', lines.length);
    console.warn('[Gemini Parser] Parsed data preview:', JSON.stringify(parsedData).substring(0, 500));
  }

  return {
    text: text || '',
    sources,
    conversationId: extractConversationId(parsedData),
    responseId: extractResponseId(parsedData)
  };
}

// =============================================================================
// Text Extraction
// =============================================================================

/**
 * Extract main text content from nested Gemini response.
 *
 * The response structure is deeply nested arrays. We search for the first
 * substantial text string (>50 chars or contains spaces), which is typically
 * the actual response content.
 *
 * Navigation is defensive since structure may vary between Gemini versions.
 *
 * @param data - Parsed JSON data from response
 * @returns Extracted text or empty string
 */
function extractTextFromNestedArray(data: unknown): string {
  try {
    if (!Array.isArray(data)) return '';

    // Recursive search for text content
    const text = findTextInArray(data, 0);
    return text || '';
  } catch (error) {
    console.error('[Gemini Parser] Error extracting text:', error);
    return '';
  }
}

/**
 * Recursively search for text content in nested arrays.
 * Looks for strings that appear to be response content.
 *
 * @param arr - Array to search
 * @param depth - Current recursion depth (max 10 to prevent infinite loops)
 * @returns Found text or null
 */
function findTextInArray(arr: unknown[], depth: number): string | null {
  if (depth > 10) return null;  // Prevent infinite recursion

  for (const item of arr) {
    // Check if this item is response text
    if (typeof item === 'string') {
      // Response text is typically >50 chars or contains spaces
      // Skip short strings that are likely IDs or metadata
      if (item.length > 100 || (item.length > 20 && item.includes(' '))) {
        return item;
      }
    }

    // Recurse into nested arrays
    if (Array.isArray(item)) {
      const found = findTextInArray(item, depth + 1);
      if (found) return found;
    }
  }

  return null;
}

// =============================================================================
// Source Extraction
// =============================================================================

/**
 * Extract source citations from response.
 * Sources are in a different part of the nested structure.
 *
 * For MVP, returns empty array. Can be enhanced later if needed.
 *
 * @param data - Parsed JSON data
 * @returns Array of sources (empty for MVP)
 */
function extractSourcesFromNestedArray(data: unknown): GeminiSource[] {
  // MVP: Skip source extraction - focus on main text
  // TODO: Implement if YouTube agent needs source citations
  return [];
}

// =============================================================================
// ID Extraction
// =============================================================================

/**
 * Extract conversation ID for follow-up messages.
 * Not critical for MVP (single-turn YouTube analysis).
 *
 * @param data - Parsed JSON data
 * @returns Conversation ID or undefined
 */
function extractConversationId(data: unknown): string | undefined {
  // MVP: Not needed for single-turn YouTube processing
  return undefined;
}

/**
 * Extract response ID.
 *
 * @param data - Parsed JSON data
 * @returns Response ID or undefined
 */
function extractResponseId(data: unknown): string | undefined {
  // MVP: Not needed for single-turn YouTube processing
  return undefined;
}
