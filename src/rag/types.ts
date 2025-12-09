/**
 * RAG Agent Types
 *
 * Type definitions for the Agentic RAG system.
 * Uses Ollama for local inference with structured JSON outputs.
 */

// Agent decision - structured output from Ollama
export interface AgentDecision {
  needs_retrieval: boolean;          // Whether to search knowledge base
  reasoning: string;                  // Brief explanation of decision
  search_queries: string[];           // Optimized queries (if needs_retrieval)
  query_strategy: 'direct' | 'multi_perspective' | 'decomposed';
  cleaned_query: string;              // Query with "my files/notes" references removed
}

// JSON Schema for Ollama structured output (matches AgentDecision)
export const AGENT_DECISION_SCHEMA = {
  type: 'object',
  properties: {
    needs_retrieval: {
      type: 'boolean',
      description: 'Whether the query requires knowledge base retrieval'
    },
    reasoning: {
      type: 'string',
      description: 'Brief explanation of the decision'
    },
    search_queries: {
      type: 'array',
      items: { type: 'string' },
      description: 'Optimized search queries for better recall (1-3 queries)'
    },
    query_strategy: {
      type: 'string',
      enum: ['direct', 'multi_perspective', 'decomposed'],
      description: 'Strategy used to generate queries'
    },
    cleaned_query: {
      type: 'string',
      description: 'The user query rewritten to remove references to "my files", "my notes", "my documents" etc. This clean version will be sent to the AI.'
    }
  },
  required: ['needs_retrieval', 'reasoning', 'search_queries', 'query_strategy', 'cleaned_query']
} as const;

// Ollama API types
export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaChatRequest {
  model: string;
  messages: OllamaMessage[];
  stream: boolean;
  format: object;  // JSON schema for structured output
  options?: {
    temperature?: number;
    num_predict?: number;
  };
}

export interface OllamaChatResponse {
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  eval_count?: number;
}

// RAG context chunk from Qdrant search
export interface RAGContext {
  content: string;
  source: string;
  score: number;
}

// RAG processing result
export interface RAGResult {
  decision: AgentDecision;
  contexts: RAGContext[];
  processingTimeMs: number;
  error?: string;
}

// RAG Settings (stored in electron-store)
export interface RAGSettings {
  enabled: boolean;                   // Toggle RAG feature (default: true)
  ollamaUrl: string;                  // Ollama server URL (default: http://localhost:11434)
  model: string;                      // Model name (default: ministral-3:3b)
  maxQueries: number;                 // Max search queries to generate (default: 3)
  maxContextChunks: number;           // Max chunks to retrieve (default: 5)
  minRelevanceScore: number;          // Min score to include chunk (default: 0.5)
}

// Default settings
export const DEFAULT_RAG_SETTINGS: RAGSettings = {
  enabled: true,
  ollamaUrl: 'http://localhost:11434',
  model: 'ministral-3:3b',
  maxQueries: 3,
  maxContextChunks: 5,
  minRelevanceScore: 0.5
};

// Health check result
export interface OllamaHealthResult {
  available: boolean;
  error?: string;
  models?: string[];
}

// IPC event types for UI updates
export type RAGStatus = 'agent_thinking' | 'searching' | 'complete' | 'skipped' | 'error';

export interface RAGStatusEvent {
  conversationId?: string;  // Optional for spotlight
  status: RAGStatus;
  message: string;
  detail?: {
    queriesGenerated?: number;
    chunksRetrieved?: number;
    processingTimeMs?: number;
  };
}
