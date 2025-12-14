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
  deleteBySource,
  listItems
} from './qdrant';

// Text chunking
export { chunkText } from './chunker';

// File/URL parsing + Firecrawl client
export { parseFile, parseUrl, initFirecrawl } from './ingestion';

// Notion client operations
export {
  initNotionClient,
  getNotionClient,
  testNotionConnection,
  listNotionPages,
  fetchPageContent,
  extractPageIdFromUrl,
  fetchPageMeta,
  fetchChildPages
} from './notion';

// Knowledge Supabase registry (document metadata storage)
export {
  initKnowledgeSupabase,
  isKnowledgeSupabaseReady,
  registerDocument,
  unregisterDocument,
  listDocuments,
  updateDocumentChunkCount,
  testKnowledgeTable,
  clearAllDocuments,
  type KnowledgeDocument
} from './knowledge-supabase';
