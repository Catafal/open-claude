/**
 * Memory Module
 *
 * Exports all memory system functions for use in main.ts.
 */

// Supabase client
export {
  initSupabaseClient,
  testSupabaseConnection,
  saveMemory,
  getMemories,
  deleteMemory,
  deleteAllMemories,
  cleanupExpiredMemories
} from './supabase';

// Message buffer
export {
  addToBuffer,
  addConversationPair,
  getBuffer,
  getBufferSize,
  clearBuffer,
  getLastMessageTime,
  hasMessages,
  formatBufferForExtraction,
  getDominantSource,
  type BufferedMessage
} from './buffer';

// Memory extraction
export { extractMemories } from './extractor';

// Background worker
export {
  initMemoryWorker,
  scheduleProcessing,
  cancelProcessing,
  processBuffer,
  flushBuffer,
  isWorkerProcessing,
  isProcessingScheduled
} from './worker';

// Memory retrieval
export {
  searchMemories,
  formatMemoriesForPrompt,
  getMemoriesForContext,
  type MemorySearchResult
} from './retrieval';
