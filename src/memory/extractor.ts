/**
 * Memory Extractor
 *
 * Uses Ollama to extract key memories from conversations.
 * Follows the same pattern as RAG agent for structured JSON output.
 */

import type { ExtractedMemory, MemoryCategory } from '../types';
import { getOllamaUrl } from '../rag/ollama';

// Extraction response from Ollama
interface ExtractionResponse {
  memories: Array<{
    content: string;
    category: 'factual' | 'preference' | 'relationship' | 'temporal';
    importance: number;
  }>;
}

// JSON Schema for Ollama structured output
const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    memories: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: 'The extracted memory - a clear, concise statement'
          },
          category: {
            type: 'string',
            enum: ['factual', 'preference', 'relationship', 'temporal'],
            description: 'Category: factual (facts about user/work), preference (likes/dislikes), relationship (people/orgs), temporal (deadlines/events)'
          },
          importance: {
            type: 'number',
            description: 'Importance score 0.0-1.0 (1.0 = very important to remember)'
          }
        },
        required: ['content', 'category', 'importance']
      },
      description: 'List of extracted memories from the conversation'
    }
  },
  required: ['memories']
} as const;

// System prompt for memory extraction
const EXTRACTION_SYSTEM_PROMPT = `You are a memory extraction agent. Your job is to identify and extract key information from conversations that would be useful to remember for future interactions.

Extract memories in these categories:
- **factual**: Facts about the user, their work, projects, or situation
- **preference**: User preferences, likes, dislikes, preferred ways of working
- **relationship**: People, companies, or relationships the user mentions
- **temporal**: Time-sensitive information (deadlines, upcoming events, schedules)

Guidelines:
- Only extract genuinely useful, specific information
- Skip trivial or generic content
- Write memories as clear, standalone statements
- Assign importance based on how useful it would be to recall later
- If nothing meaningful to extract, return an empty memories array

Examples of good memories:
- "User is a software engineer working on an Electron app" (factual, 0.7)
- "User prefers concise code examples over verbose explanations" (preference, 0.6)
- "User's manager is named Alex" (relationship, 0.5)
- "User has a product demo next Tuesday" (temporal, 0.8)

Examples of things NOT to extract:
- "User said hello" (trivial)
- "User asked about programming" (too generic)
- Technical details of a one-off coding question`;

/**
 * Extract memories from conversation text using Ollama.
 *
 * @param conversationText - Formatted conversation (USER: ... ASSISTANT: ...)
 * @param model - Ollama model name (from RAG settings)
 * @returns Array of extracted memories
 */
export async function extractMemories(
  conversationText: string,
  model: string
): Promise<ExtractedMemory[]> {
  if (!conversationText.trim()) {
    return [];
  }

  const ollamaUrl = getOllamaUrl();

  const request = {
    model,
    messages: [
      { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
      { role: 'user', content: `Extract memories from this conversation:\n\n${conversationText}` }
    ],
    stream: false,
    format: EXTRACTION_SCHEMA,
    options: {
      temperature: 0.1,  // Low temperature for consistent extraction
      num_predict: 1024  // Allow longer response for multiple memories
    }
  };

  // 60s timeout for extraction (may take longer with multiple messages)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`[Memory Extractor] Ollama error (${response.status}): ${errorText}`);
      return [];
    }

    const data = await response.json();

    // Parse structured response
    try {
      const parsed = JSON.parse(data.message.content) as ExtractionResponse;

      // Validate and normalize memories
      const memories: ExtractedMemory[] = (parsed.memories || [])
        .filter(m => m.content && m.category)
        .map(m => ({
          content: m.content.trim(),
          category: validateCategory(m.category),
          importance: Math.max(0, Math.min(1, m.importance || 0.5))
        }));

      console.log(`[Memory Extractor] Extracted ${memories.length} memories`);
      return memories;
    } catch (parseError) {
      console.error('[Memory Extractor] Failed to parse response:', data.message.content);
      return [];
    }
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[Memory Extractor] Timeout (60s)');
      return [];
    }

    console.error('[Memory Extractor] Error:', error);
    return [];
  }
}

/**
 * Validate and normalize category string.
 */
function validateCategory(category: string): MemoryCategory {
  const valid: MemoryCategory[] = ['factual', 'preference', 'relationship', 'temporal'];
  const normalized = category.toLowerCase().trim();
  return valid.includes(normalized as MemoryCategory)
    ? (normalized as MemoryCategory)
    : 'factual';  // Default fallback
}
