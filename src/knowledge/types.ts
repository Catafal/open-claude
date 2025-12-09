/**
 * Knowledge Management Types
 *
 * Type definitions for the local RAG-based knowledge system.
 * Uses Qdrant for vector storage and transformers.js for embeddings.
 */

// Settings for Qdrant connection (stored in electron-store)
export interface KnowledgeSettings {
  qdrantUrl: string;        // Default: "http://localhost:6333"
  qdrantApiKey?: string;    // Optional - for Qdrant Cloud
  collectionName: string;   // Default: "open-claude-knowledge"
}

// Default settings
export const DEFAULT_KNOWLEDGE_SETTINGS: KnowledgeSettings = {
  qdrantUrl: 'http://localhost:6333',
  collectionName: 'open-claude-knowledge'
};

// Metadata for each knowledge item
export interface KnowledgeMetadata {
  source: string;           // File path or URL
  filename: string;         // Display name
  type: 'txt' | 'md' | 'pdf' | 'url';
  chunkIndex: number;       // Position in chunked document
  totalChunks: number;      // Total chunks from source
  dateAdded: string;        // ISO timestamp
}

// A single knowledge item (chunk) with its embedding
export interface KnowledgeItem {
  id: string;               // UUID
  content: string;          // Chunk text
  metadata: KnowledgeMetadata;
  vector?: number[];        // 384-dim embedding (all-MiniLM-L6-v2)
}

// Search result with similarity score
export interface SearchResult {
  id: string;
  content: string;
  metadata: KnowledgeMetadata;
  score: number;            // Cosine similarity (0-1)
}

// Result of file/URL parsing before chunking
export interface ParsedDocument {
  content: string;
  metadata: Partial<KnowledgeMetadata>;
}

// Chunk output from text chunker
export interface Chunk {
  text: string;
  index: number;
}

// Result of ingestion operation
export interface IngestionResult {
  success: boolean;
  chunksIngested: number;
  error?: string;
}

// Connection test result
export interface ConnectionTestResult {
  success: boolean;
  error?: string;
}
