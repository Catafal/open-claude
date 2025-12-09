/**
 * Ollama Client
 *
 * HTTP client for Ollama API with structured output support.
 * Uses native fetch for Electron compatibility (no external dependencies).
 */

import type {
  OllamaChatRequest,
  OllamaChatResponse,
  AgentDecision,
  OllamaHealthResult
} from './types';
import { AGENT_DECISION_SCHEMA } from './types';

// Default base URL (can be overridden)
let ollamaBaseUrl = 'http://localhost:11434';

/**
 * Initialize/update the Ollama base URL.
 */
export function initOllamaClient(baseUrl: string): void {
  ollamaBaseUrl = baseUrl.replace(/\/$/, '');  // Remove trailing slash
  console.log(`[Ollama] Client initialized for ${ollamaBaseUrl}`);
}

/**
 * Get current Ollama URL.
 */
export function getOllamaUrl(): string {
  return ollamaBaseUrl;
}

/**
 * Check if Ollama is running and the specified model is available.
 * Uses 5s timeout to avoid blocking if Ollama is not running.
 */
export async function checkOllamaHealth(model: string): Promise<OllamaHealthResult> {
  try {
    // Use AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${ollamaBaseUrl}/api/tags`, {
      method: 'GET',
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        available: false,
        error: `Ollama responded with status ${response.status}`
      };
    }

    const data = await response.json();
    const models: string[] = (data.models || []).map((m: { name: string }) => m.name);

    // Check if the requested model is available (match by prefix, e.g., "ministral-3:3b" matches "ministral-3:3b-latest")
    const modelPrefix = model.split(':')[0];
    const hasModel = models.some(m => m.startsWith(modelPrefix));

    if (!hasModel) {
      return {
        available: false,
        error: `Model "${model}" not found. Available: ${models.slice(0, 5).join(', ')}${models.length > 5 ? '...' : ''}`,
        models
      };
    }

    return { available: true, models };
  } catch (error: unknown) {
    // Handle abort/timeout
    if (error instanceof Error && error.name === 'AbortError') {
      return { available: false, error: 'Ollama connection timeout (5s)' };
    }

    // Handle connection refused
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch failed')) {
      return { available: false, error: 'Ollama not running. Start it with: ollama serve' };
    }

    return { available: false, error: errorMessage };
  }
}

/**
 * Send a chat request to Ollama with structured JSON output.
 * Uses the `format` parameter for guaranteed JSON schema compliance.
 *
 * @param model - Ollama model name (e.g., "ministral-3:3b")
 * @param messages - Chat messages (system + user)
 * @param originalQuery - Original user query (for fallback cleaned_query)
 * @returns Parsed AgentDecision from model response
 */
export async function ollamaChat(
  model: string,
  messages: Array<{ role: string; content: string }>,
  originalQuery: string
): Promise<AgentDecision> {
  const request: OllamaChatRequest = {
    model,
    messages: messages as OllamaChatRequest['messages'],
    stream: false,  // We need complete JSON, not streaming
    format: AGENT_DECISION_SCHEMA,
    options: {
      temperature: 0,      // Deterministic for consistent JSON
      num_predict: 512     // Limit token generation (JSON should be small)
    }
  };

  // Use 30s timeout for inference (small models are fast)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${ollamaBaseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Ollama API error (${response.status}): ${errorText}`);
    }

    const data: OllamaChatResponse = await response.json();

    // Parse the structured JSON response
    try {
      const decision = JSON.parse(data.message.content) as AgentDecision;

      // Validate required fields
      if (typeof decision.needs_retrieval !== 'boolean') {
        throw new Error('Invalid response: missing needs_retrieval');
      }

      return decision;
    } catch (parseError) {
      console.error('[Ollama] Failed to parse response:', data.message.content);
      // Return safe fallback - no retrieval
      return {
        needs_retrieval: false,
        reasoning: 'Failed to parse agent response',
        search_queries: [],
        query_strategy: 'direct',
        cleaned_query: originalQuery  // Pass through original query
      };
    }
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    // Handle timeout
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[Ollama] Request timeout (30s)');
      return {
        needs_retrieval: false,
        reasoning: 'Agent timeout',
        search_queries: [],
        query_strategy: 'direct',
        cleaned_query: originalQuery  // Pass through original query
      };
    }

    // Re-throw other errors
    throw error;
  }
}
