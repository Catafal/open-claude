/**
 * RAG Module
 *
 * Agentic RAG (Retrieval-Augmented Generation) system.
 * Uses Ollama for local inference to decide when and how to search
 * the knowledge base, then injects relevant context into Claude prompts.
 *
 * Usage:
 *   import { processRagQuery, formatContextForClaude } from './rag';
 */

// Types
export * from './types';

// Ollama client
export {
  initOllamaClient,
  getOllamaUrl,
  checkOllamaHealth,
  ollamaChat
} from './ollama';

// RAG agent
export {
  runRagAgent,
  executeMultiQuerySearch,
  formatContextForClaude,
  processRagQuery
} from './agent';
