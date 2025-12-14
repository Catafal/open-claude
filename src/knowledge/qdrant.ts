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
 * Delete all vectors matching a source.
 * Scrolls ALL items (no filter), filters locally by source, then deletes.
 */
export async function deleteBySource(
  collectionName: string,
  source: string
): Promise<number> {
  const qdrant = getQdrantClient();

  // Scroll ALL items and filter locally (filter in scroll can cause issues)
  const pointIds: string[] = [];
  let nextOffset: string | number | null | undefined = undefined;

  console.log(`[Qdrant] deleteBySource: looking for source="${source}"`);

  do {
    // Build scroll params - only include offset if defined
    const scrollParams: Record<string, unknown> = {
      limit: 100,
      with_payload: true,
      with_vector: false
    };
    if (nextOffset !== undefined && nextOffset !== null) {
      scrollParams.offset = nextOffset;
    }

    const result = await qdrant.scroll(collectionName, scrollParams);

    console.log(`[Qdrant] Scroll returned ${result.points.length} points`);

    // Filter locally by source and collect IDs
    for (const point of result.points) {
      const pointSource = point.payload?.source as string;
      if (pointSource === source) {
        pointIds.push(point.id as string);
      }
    }

    // Get next offset for pagination
    const rawOffset = result.next_page_offset;
    nextOffset = (typeof rawOffset === 'string' || typeof rawOffset === 'number') ? rawOffset : null;
  } while (nextOffset !== null && nextOffset !== undefined);

  console.log(`[Qdrant] Found ${pointIds.length} vectors with source: ${source}`);

  // Delete collected point IDs in batches
  if (pointIds.length > 0) {
    const BATCH_SIZE = 100;
    for (let i = 0; i < pointIds.length; i += BATCH_SIZE) {
      const batch = pointIds.slice(i, i + BATCH_SIZE);
      await qdrant.delete(collectionName, {
        wait: true,
        points: batch
      });
      console.log(`[Qdrant] Deleted batch ${Math.floor(i / BATCH_SIZE) + 1}`);
    }
    console.log(`[Qdrant] Deleted ${pointIds.length} vectors with source: ${source}`);
  } else {
    console.log(`[Qdrant] No vectors found with source: ${source}`);
  }

  return pointIds.length;
}

/**
 * List all items in the collection.
 * Paginates through ALL items using scroll API.
 */
export async function listItems(collectionName: string): Promise<KnowledgeItem[]> {
  const qdrant = getQdrantClient();
  const items: KnowledgeItem[] = [];
  let nextOffset: string | number | null | undefined = undefined;

  console.log(`[Qdrant] listItems: fetching ALL items from "${collectionName}"`);

  do {
    // Build scroll params - only include offset if defined
    const scrollParams: Record<string, unknown> = {
      limit: 100,
      with_payload: true,
      with_vector: false
    };
    if (nextOffset !== undefined && nextOffset !== null) {
      scrollParams.offset = nextOffset;
    }

    const result = await qdrant.scroll(collectionName, scrollParams);

    // Map points to KnowledgeItem format
    for (const point of result.points) {
      items.push({
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
      });
    }

    // Get next offset for pagination
    const rawOffset = result.next_page_offset;
    nextOffset = (typeof rawOffset === 'string' || typeof rawOffset === 'number') ? rawOffset : null;
  } while (nextOffset !== null && nextOffset !== undefined);

  // Log summary
  const sources = [...new Set(items.map(i => i.metadata.source))];
  console.log(`[Qdrant] listItems: ${items.length} chunks from ${sources.length} sources`);

  return items;
}
