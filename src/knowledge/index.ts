/**
 * Knowledge Module
 *
 * Local RAG-based knowledge management system.
 * Uses Qdrant for vector storage and transformers.js for embeddings.
 *
 * Usage:
 *   import { generateEmbedding, searchVectors, ... } from './knowledge';
 */

// Types
export * from './types';

// Embeddings (lazy-loaded transformers.js)
export { generateEmbedding, generateEmbeddings, VECTOR_SIZE } from './embeddings';

// Qdrant client operations
export {
  initQdrantClient,
  getQdrantClient,
  ensureCollection,
  upsertVectors,
  searchVectors,
  deleteVectors,
  listItems
} from './qdrant';

// Text chunking
export { chunkText } from './chunker';

// File/URL parsing
export { parseFile, parseUrl } from './ingestion';
