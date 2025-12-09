/**
 * Qdrant Client
 *
 * Vector database operations for knowledge storage and retrieval.
 * Supports both local Docker and Qdrant Cloud deployments.
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import { VECTOR_SIZE } from './embeddings';
import type { KnowledgeSettings, KnowledgeItem, SearchResult, KnowledgeMetadata } from './types';

// Singleton client instance
let client: QdrantClient | null = null;

/**
 * Initialize or reinitialize the Qdrant client.
 * Call this when settings change.
 */
export function initQdrantClient(settings: KnowledgeSettings): QdrantClient {
  client = new QdrantClient({
    url: settings.qdrantUrl,
    apiKey: settings.qdrantApiKey || undefined
  });

  console.log(`[Qdrant] Client initialized for ${settings.qdrantUrl}`);
  return client;
}

/**
 * Get the current Qdrant client instance.
 * Throws if not initialized.
 */
export function getQdrantClient(): QdrantClient {
  if (!client) {
    throw new Error('Qdrant client not initialized. Call initQdrantClient first.');
  }
  return client;
}

/**
 * Ensure a collection exists with the correct schema.
 * Creates it if it doesn't exist.
 */
export async function ensureCollection(collectionName: string): Promise<void> {
  const qdrant = getQdrantClient();

  try {
    // Check if collection exists
    const collections = await qdrant.getCollections();
    const exists = collections.collections.some(c => c.name === collectionName);

    if (!exists) {
      console.log(`[Qdrant] Creating collection: ${collectionName}`);

      await qdrant.createCollection(collectionName, {
        vectors: {
          size: VECTOR_SIZE,
          distance: 'Cosine'
        }
      });

      console.log(`[Qdrant] Collection created: ${collectionName}`);
    }
  } catch (error: any) {
    console.error('[Qdrant] Error ensuring collection:', error.message);
    throw error;
  }
}

/**
 * Insert or update vectors in the collection.
 */
export async function upsertVectors(
  collectionName: string,
  items: KnowledgeItem[]
): Promise<void> {
  if (items.length === 0) return;

  const qdrant = getQdrantClient();

  // Prepare points for upsert
  const points = items.map(item => ({
    id: item.id,
    vector: item.vector!,
    payload: {
      content: item.content,
      ...item.metadata
    }
  }));

  await qdrant.upsert(collectionName, {
    wait: true,
    points
  });

  console.log(`[Qdrant] Upserted ${items.length} vectors to ${collectionName}`);
}

/**
 * Search for similar vectors.
 * Returns top matches with content and metadata.
 */
export async function searchVectors(
  collectionName: string,
  queryVector: number[],
  limit: number = 5
): Promise<SearchResult[]> {
  const qdrant = getQdrantClient();

  const results = await qdrant.search(collectionName, {
    vector: queryVector,
    limit,
    with_payload: true
  });

  // Map results to SearchResult format
  return results.map(result => ({
    id: result.id as string,
    content: (result.payload?.content as string) || '',
    metadata: {
      source: (result.payload?.source as string) || '',
      filename: (result.payload?.filename as string) || '',
      type: (result.payload?.type as KnowledgeMetadata['type']) || 'txt',
      chunkIndex: (result.payload?.chunkIndex as number) || 0,
      totalChunks: (result.payload?.totalChunks as number) || 1,
      dateAdded: (result.payload?.dateAdded as string) || ''
    },
    score: result.score
  }));
}

/**
 * Delete vectors by their IDs.
 */
export async function deleteVectors(
  collectionName: string,
  ids: string[]
): Promise<void> {
  if (ids.length === 0) return;

  const qdrant = getQdrantClient();

  await qdrant.delete(collectionName, {
    wait: true,
    points: ids
  });

  console.log(`[Qdrant] Deleted ${ids.length} vectors from ${collectionName}`);
}

/**
 * List all items in the collection.
 * Uses scroll API for pagination.
 */
export async function listItems(
  collectionName: string,
  limit: number = 100
): Promise<KnowledgeItem[]> {
  const qdrant = getQdrantClient();

  const result = await qdrant.scroll(collectionName, {
    limit,
    with_payload: true,
    with_vector: false  // Don't need vectors for listing
  });

  // Map to KnowledgeItem format
  return result.points.map(point => ({
    id: point.id as string,
    content: (point.payload?.content as string) || '',
    metadata: {
      source: (point.payload?.source as string) || '',
      filename: (point.payload?.filename as string) || '',
      type: (point.payload?.type as KnowledgeMetadata['type']) || 'txt',
      chunkIndex: (point.payload?.chunkIndex as number) || 0,
      totalChunks: (point.payload?.totalChunks as number) || 1,
      dateAdded: (point.payload?.dateAdded as string) || ''
    }
  }));
}
