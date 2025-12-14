/**
 * Memory Retrieval
 *
 * Queries Qdrant for relevant memories and formats them for prompt injection.
 * Returns memories as a separate XML section from knowledge context.
 * Includes recency boost and access tracking for memory improvements.
 */

import { generateEmbedding } from '../knowledge/embeddings';
import { searchVectors, getQdrantClient } from '../knowledge/qdrant';
import { trackMemoryAccess } from './supabase';
import type { MemoryCategory } from '../types';

// Memory search result
export interface MemorySearchResult {
  id: string;
  content: string;
  category: MemoryCategory;
  importance: number;
  score: number;  // Combined score (semantic + importance + recency)
  createdAt?: string;
}

/**
 * Calculate recency factor (0.5 to 1.0 based on age).
 * Newer memories get higher scores.
 */
function getRecencyFactor(createdAt?: string): number {
  if (!createdAt) return 0.7; // Default for unknown dates

  const ageInDays = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
  // 1.0 for today, decays to 0.5 for 30+ days old
  return Math.max(0.5, 1 - (ageInDays / 60));
}

/**
 * Search for relevant memories based on query.
 *
 * @param query - User query to find relevant memories for
 * @param collectionName - Qdrant collection name
 * @param limit - Max memories to return
 * @param minScore - Minimum relevance score (0-1)
 * @returns Sorted list of relevant memories
 */
export async function searchMemories(
  query: string,
  collectionName: string,
  limit: number = 5,
  minScore: number = 0.4
): Promise<MemorySearchResult[]> {
  try {
    // Check if Qdrant is available
    getQdrantClient();
  } catch {
    console.log('[Memory Retrieval] Qdrant not available');
    return [];
  }

  try {
    // Generate query embedding
    const queryVector = await generateEmbedding(query);

    // Search in Qdrant - get more than limit to filter memories
    const results = await searchVectors(collectionName, queryVector, limit * 3);

    // Filter to only memories and calculate combined scores
    const memoryResults = results
      .filter(r => {
        const payload = r.metadata as Record<string, unknown>;
        // Check if this is a memory (has category field or source starts with 'memory:')
        return payload?.category || (payload?.source as string)?.startsWith('memory:');
      })
      .filter(r => r.score >= minScore)
      .map(r => {
        const payload = r.metadata as Record<string, unknown>;
        const semanticScore = r.score;
        const importance = (payload?.importance as number) || 0.5;
        const createdAt = payload?.created_at as string | undefined;
        const recencyFactor = getRecencyFactor(createdAt);

        // Combined score: semantic 50%, importance 25%, recency 25%
        const combinedScore = semanticScore * 0.5 + importance * 0.25 + recencyFactor * 0.25;

        return {
          id: r.id,
          content: r.content,
          category: (payload?.category || 'factual') as MemoryCategory,
          importance,
          score: combinedScore,
          createdAt
        };
      })
      // Sort by combined score (highest first)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // Track access for retrieved memories (async, don't wait)
    if (memoryResults.length > 0) {
      const ids = memoryResults.map(m => m.id);
      trackMemoryAccess(ids).catch(err => {
        console.error('[Memory Retrieval] Failed to track access:', err);
      });
    }

    console.log(`[Memory Retrieval] Found ${memoryResults.length} relevant memories`);
    return memoryResults;
  } catch (error: unknown) {
    console.error('[Memory Retrieval] Error searching memories:', error);
    return [];
  }
}

/**
 * Format memories for injection into Claude prompt.
 * Returns XML-formatted section separate from knowledge context.
 */
export function formatMemoriesForPrompt(memories: MemorySearchResult[]): string {
  if (memories.length === 0) return '';

  const formattedMemories = memories
    .map(m => `- [${m.category}] ${m.content}`)
    .join('\n');

  return `<user_memories>
The following memories are relevant to this conversation:

${formattedMemories}
</user_memories>

`;
}

/**
 * Get memories and format them for prompt injection.
 * Convenience function that combines search and formatting.
 */
export async function getMemoriesForContext(
  query: string,
  collectionName: string,
  limit: number = 5,
  minScore: number = 0.4
): Promise<string> {
  const memories = await searchMemories(query, collectionName, limit, minScore);
  return formatMemoriesForPrompt(memories);
}
