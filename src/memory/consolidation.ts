/**
 * Memory Consolidation
 *
 * Handles deduplication, similarity checking, and contradiction detection.
 * Uses Qdrant for similarity search and Ollama for contradiction resolution.
 */

import { generateEmbedding } from '../knowledge/embeddings';
import { searchVectors, getQdrantClient } from '../knowledge/qdrant';
import { getOllamaUrl } from '../rag/ollama';
import type { ExtractedMemory, MemoryCategory } from '../types';

// Thresholds for similarity detection
const DUPLICATE_THRESHOLD = 0.85;  // Score above this = same memory (skip)
const CONFLICT_THRESHOLD = 0.70;   // Score in 0.70-0.85 range = potential conflict

// Consolidation result
export interface ConsolidationResult {
  action: 'store' | 'skip' | 'supersede';
  existingId?: string;
  reason?: string;
}

// Similar memory found in search
interface SimilarMemory {
  id: string;
  content: string;
  category: MemoryCategory;
  importance: number;
  score: number;
}

/**
 * Check if a new memory should be stored, skipped (duplicate), or supersede existing.
 *
 * Logic:
 * 1. Search Qdrant for similar memories
 * 2. If score > 0.85: duplicate - skip and boost existing
 * 3. If score 0.70-0.85 and same category: check for contradiction
 * 4. If contradiction: supersede old with new
 * 5. Otherwise: store as new memory
 */
export async function consolidateMemory(
  newMemory: ExtractedMemory,
  collectionName: string,
  ollamaModel: string
): Promise<ConsolidationResult> {
  // Check if Qdrant is available
  try {
    getQdrantClient();
  } catch {
    // Qdrant not available, just store
    return { action: 'store', reason: 'Qdrant not available' };
  }

  try {
    // Search for similar memories
    const similarMemories = await findSimilarMemories(newMemory.content, collectionName);

    if (similarMemories.length === 0) {
      return { action: 'store', reason: 'No similar memories found' };
    }

    const topMatch = similarMemories[0];

    // Check for exact/near duplicate (score > 0.85)
    if (topMatch.score >= DUPLICATE_THRESHOLD) {
      console.log(`[Consolidation] Duplicate detected (score: ${topMatch.score.toFixed(2)})`);
      return {
        action: 'skip',
        existingId: topMatch.id,
        reason: `Duplicate of existing memory (similarity: ${(topMatch.score * 100).toFixed(0)}%)`
      };
    }

    // Check for potential conflict (score 0.70-0.85, same category)
    if (topMatch.score >= CONFLICT_THRESHOLD && topMatch.category === newMemory.category) {
      console.log(`[Consolidation] Checking for contradiction (score: ${topMatch.score.toFixed(2)})`);

      const isContradiction = await checkContradiction(
        topMatch.content,
        newMemory.content,
        newMemory.category,
        ollamaModel
      );

      if (isContradiction) {
        console.log(`[Consolidation] Contradiction detected - superseding old memory`);
        return {
          action: 'supersede',
          existingId: topMatch.id,
          reason: 'New memory contradicts existing - superseding'
        };
      }
    }

    // No issues - store as new
    return { action: 'store', reason: 'New distinct memory' };

  } catch (error: unknown) {
    console.error('[Consolidation] Error:', error);
    // On error, default to storing (safer than losing memories)
    return { action: 'store', reason: 'Error during consolidation - storing anyway' };
  }
}

/**
 * Search Qdrant for memories similar to the given content.
 */
async function findSimilarMemories(
  content: string,
  collectionName: string
): Promise<SimilarMemory[]> {
  // Generate embedding for new content
  const embedding = await generateEmbedding(content);

  // Search Qdrant (get more than needed to filter)
  const results = await searchVectors(collectionName, embedding, 5);

  // Filter to only memories and extract relevant data
  return results
    .filter(r => {
      const payload = r.metadata as Record<string, unknown>;
      // Check if this is a memory (has category or source starts with 'memory:')
      return payload?.category || (payload?.source as string)?.startsWith('memory:');
    })
    .filter(r => r.score >= CONFLICT_THRESHOLD)
    .map(r => {
      const payload = r.metadata as Record<string, unknown>;
      return {
        id: r.id,
        content: r.content,
        category: (payload?.category || 'factual') as MemoryCategory,
        importance: (payload?.importance as number) || 0.5,
        score: r.score
      };
    });
}

/**
 * Check if two memories contradict each other using Ollama.
 * Returns true if they contradict, false if compatible.
 */
async function checkContradiction(
  existingContent: string,
  newContent: string,
  category: string,
  model: string
): Promise<boolean> {
  const ollamaUrl = getOllamaUrl();

  const prompt = `You are checking if two user memories contradict each other.

EXISTING MEMORY: "${existingContent}"
NEW MEMORY: "${newContent}"
CATEGORY: ${category}

Do these memories contradict each other? A contradiction means they cannot both be true at the same time.

Examples of contradictions:
- "User prefers React" vs "User prefers Vue" (preference conflict)
- "User works at Google" vs "User works at Apple" (factual conflict)
- "User's manager is John" vs "User's manager is Sarah" (relationship conflict)

Examples of NON-contradictions:
- "User likes TypeScript" vs "User uses TypeScript at work" (compatible)
- "User is a developer" vs "User is a senior developer" (compatible - more specific)
- "User prefers dark mode" vs "User likes minimalist UI" (different aspects)

Respond with ONLY one word: "CONTRADICTION" or "COMPATIBLE"`;

  try {
    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 20
        }
      })
    });

    if (!response.ok) {
      console.error('[Consolidation] Ollama request failed');
      return false;  // Default to no contradiction on error
    }

    const data = await response.json();
    const answer = (data.response || '').trim().toUpperCase();

    return answer.includes('CONTRADICTION');
  } catch (error: unknown) {
    console.error('[Consolidation] Error checking contradiction:', error);
    return false;  // Default to no contradiction on error
  }
}
