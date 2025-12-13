/**
 * Memory Retrieval
 *
 * Queries Qdrant for relevant memories and formats them for prompt injection.
 * Returns memories as a separate XML section from knowledge context.
 */

import { generateEmbedding } from '../knowledge/embeddings';
import { searchVectors, getQdrantClient } from '../knowledge/qdrant';
import type { MemoryCategory } from '../types';

// Memory search result
export interface MemorySearchResult {
  id: string;
  content: string;
  category: MemoryCategory;
  importance: number;
  score: number;
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

    // Filter to only memories (type: 'memory' in metadata)
    const memoryResults = results
      .filter(r => {
        const payload = r.metadata as any;
        // Check if this is a memory (has category field or source starts with 'memory:')
        return payload?.category || payload?.source?.startsWith('memory:');
      })
      .filter(r => r.score >= minScore)
      .slice(0, limit)
      .map(r => {
        const payload = r.metadata as any;
        return {
          id: r.id,
          content: r.content,
          category: (payload?.category || 'factual') as MemoryCategory,
          importance: payload?.importance || 0.5,
          score: r.score
        };
      });

    // Sort by combined score (relevance * importance)
    memoryResults.sort((a, b) => {
      const scoreA = a.score * (0.5 + a.importance * 0.5);
      const scoreB = b.score * (0.5 + b.importance * 0.5);
      return scoreB - scoreA;
    });

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
