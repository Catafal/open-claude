/**
 * Gemini Web Client
 *
 * Handles authentication and API requests to Gemini web interface.
 * Uses Electron session cookies (same pattern as src/api/client.ts).
 *
 * Key differences from Claude client:
 * - Cookies: __Secure-1PSID, __Secure-1PSIDTS (not sessionKey)
 * - Requires SNlM0e token extracted from page HTML
 * - Request format: application/x-www-form-urlencoded (not JSON)
 * - Response format: )]}' header + newline-delimited JSON (not SSE)
 */

import { net, session } from 'electron';

import type {
  GeminiCookies,
  GeminiTokens,
  GeminiResponse
} from './types';
import {
  GeminiAuthError,
  GeminiTokenError,
  GeminiRateLimitError
} from './types';
import { parseGeminiResponse } from './parser';

// =============================================================================
// Constants
// =============================================================================

const GEMINI_BASE_URL = 'https://gemini.google.com';
const GEMINI_API_URL = `${GEMINI_BASE_URL}/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate`;

// Token cache duration (25 minutes - tokens expire at ~30 min)
const TOKEN_CACHE_DURATION_MS = 25 * 60 * 1000;

// User agent mimics Chrome browser
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// =============================================================================
// Token Cache
// =============================================================================

// Cached SNlM0e token (cleared on auth errors)
let cachedTokens: GeminiTokens | null = null;

/**
 * Clear cached tokens.
 * Called when authentication fails to force re-extraction.
 */
export function clearTokenCache(): void {
  cachedTokens = null;
  console.log('[Gemini] Token cache cleared');
}

// =============================================================================
// Authentication
// =============================================================================

/**
 * Check if Gemini session cookies exist.
 * Pattern matches isAuthenticated() in api/client.ts.
 *
 * @returns true if both required cookies are present
 */
export async function isGeminiAuthenticated(): Promise<boolean> {
  try {
    const cookies = await session.defaultSession.cookies.get({
      domain: '.google.com'
    });

    const psid = cookies.find(c => c.name === '__Secure-1PSID')?.value;
    const psidts = cookies.find(c => c.name === '__Secure-1PSIDTS')?.value;

    return !!(psid && psidts);
  } catch (error) {
    console.error('[Gemini] Error checking auth:', error);
    return false;
  }
}

/**
 * Get Gemini session cookies.
 *
 * @returns Cookie values or null if not authenticated
 */
export async function getGeminiCookies(): Promise<GeminiCookies | null> {
  const cookies = await session.defaultSession.cookies.get({
    domain: '.google.com'
  });

  const psid = cookies.find(c => c.name === '__Secure-1PSID')?.value;
  const psidts = cookies.find(c => c.name === '__Secure-1PSIDTS')?.value;

  if (!psid || !psidts) return null;

  return {
    __Secure_1PSID: psid,
    __Secure_1PSIDTS: psidts
  };
}

/**
 * Extract SNlM0e token from Gemini page HTML.
 * This token is required for all API requests (CSRF protection).
 *
 * Why this approach:
 * - Token is embedded in page HTML, not in cookies
 * - Must be extracted via regex from page source
 * - Cached for 25 min to avoid unnecessary page fetches
 *
 * @returns SNlM0e token string
 * @throws GeminiTokenError if token cannot be extracted
 */
export async function extractSNlM0eToken(): Promise<string> {
  // Return cached token if still valid
  if (cachedTokens && Date.now() - cachedTokens.extractedAt < TOKEN_CACHE_DURATION_MS) {
    return cachedTokens.SNlM0e;
  }

  return new Promise((resolve, reject) => {
    const request = net.request({
      url: GEMINI_BASE_URL,
      method: 'GET',
      useSessionCookies: true  // Use Electron's session cookies
    });

    request.setHeader('user-agent', USER_AGENT);

    let html = '';

    request.on('response', (response) => {
      if (response.statusCode !== 200) {
        reject(new GeminiTokenError(`Failed to load Gemini page: ${response.statusCode}`));
        return;
      }

      response.on('data', (chunk) => {
        html += chunk.toString();
      });

      response.on('end', () => {
        // Extract SNlM0e token using regex
        // Pattern: "SNlM0e":"<TOKEN_VALUE>"
        const match = html.match(/"SNlM0e":"([^"]+)"/);

        if (!match || !match[1]) {
          reject(new GeminiTokenError('SNlM0e token not found in page. Please log in to gemini.google.com'));
          return;
        }

        // Cache the token
        cachedTokens = {
          SNlM0e: match[1],
          extractedAt: Date.now()
        };

        console.log('[Gemini] SNlM0e token extracted successfully');
        resolve(match[1]);
      });
    });

    request.on('error', (error) => {
      reject(new GeminiTokenError(`Network error: ${error.message}`));
    });

    request.end();
  });
}

// =============================================================================
// Request Building
// =============================================================================

/**
 * Build the f.req parameter for Gemini API.
 *
 * Why this complex structure:
 * Gemini uses Protocol Buffers internally, exposed as deeply nested JSON arrays.
 * This minimal structure is reverse-engineered from the web client.
 *
 * @param prompt - User prompt text
 * @returns JSON string for f.req parameter
 */
function buildFreqPayload(prompt: string): string {
  // Gemini's request format: nested arrays matching internal protobuf structure
  // This is the minimal structure for a new conversation request
  const innerPayload = [
    [prompt],           // User prompt
    null,               // Image data (not used)
    null                // Conversation context (new conversation)
  ];

  const outerPayload = [
    null,
    JSON.stringify(innerPayload)
  ];

  return JSON.stringify(outerPayload);
}

/**
 * Set common headers for Gemini requests.
 * Mimics browser behavior for the web client.
 */
function setGeminiHeaders(request: Electron.ClientRequest): void {
  request.setHeader('content-type', 'application/x-www-form-urlencoded');
  request.setHeader('origin', GEMINI_BASE_URL);
  request.setHeader('referer', `${GEMINI_BASE_URL}/app`);
  request.setHeader('user-agent', USER_AGENT);
  request.setHeader('x-same-domain', '1');
}

// =============================================================================
// API Request
// =============================================================================

/**
 * Send request to Gemini API.
 *
 * Key differences from Claude client:
 * - Content-Type: application/x-www-form-urlencoded (not JSON)
 * - Body: f.req=<NESTED_JSON>&at=<SNlM0e> (URL encoded)
 * - Response: Not SSE, uses custom format with )]}' header
 *
 * @param prompt - User prompt to send
 * @param onData - Optional callback for streaming chunks
 * @returns Parsed Gemini response
 * @throws GeminiAuthError, GeminiRateLimitError, or Error
 */
export async function sendGeminiRequest(
  prompt: string,
  onData?: (chunk: string) => void
): Promise<GeminiResponse> {
  // Validate authentication first
  const isAuth = await isGeminiAuthenticated();
  if (!isAuth) {
    throw new GeminiAuthError('Not authenticated with Gemini. Please log in to gemini.google.com');
  }

  // Get SNlM0e token (extracted or cached)
  const snlm0e = await extractSNlM0eToken();

  return new Promise((resolve, reject) => {
    const request = net.request({
      url: GEMINI_API_URL,
      method: 'POST',
      useSessionCookies: true  // Use Electron session cookies
    });

    setGeminiHeaders(request);

    // Build URL-encoded body: f.req=<payload>&at=<token>
    const freqPayload = buildFreqPayload(prompt);
    const body = `f.req=${encodeURIComponent(freqPayload)}&at=${encodeURIComponent(snlm0e)}`;

    let responseData = '';

    request.on('response', (response) => {
      const statusCode = response.statusCode;

      // Handle error status codes
      if (statusCode === 401 || statusCode === 403) {
        clearTokenCache();  // Force token refresh on next request
        reject(new GeminiAuthError('Session expired. Please log in again.'));
        return;
      }

      if (statusCode === 429) {
        reject(new GeminiRateLimitError('Rate limited by Gemini. Please wait before trying again.'));
        return;
      }

      if (statusCode >= 500) {
        reject(new Error(`Gemini server error: ${statusCode}`));
        return;
      }

      if (statusCode !== 200) {
        let errorData = '';
        response.on('data', (chunk) => { errorData += chunk.toString(); });
        response.on('end', () => {
          reject(new Error(`Gemini request failed: ${statusCode} - ${errorData}`));
        });
        return;
      }

      // Collect response data
      response.on('data', (chunk) => {
        const chunkStr = chunk.toString();
        responseData += chunkStr;
        onData?.(chunkStr);  // Streaming callback if provided
      });

      response.on('end', () => {
        try {
          const parsed = parseGeminiResponse(responseData);
          resolve(parsed);
        } catch (error) {
          console.error('[Gemini] Parse error:', error);
          reject(error);
        }
      });
    });

    request.on('error', (error) => {
      console.error('[Gemini] Request error:', error);
      reject(error);
    });

    request.write(body);
    request.end();
  });
}
