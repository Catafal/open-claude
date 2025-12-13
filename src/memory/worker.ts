/**
 * Memory Worker
 *
 * Background worker that processes buffered messages after 10 minutes of inactivity.
 * Extracts memories using Ollama, stores in Supabase, and embeds in Qdrant.
 */

import {
  getBuffer,
  clearBuffer,
  hasMessages,
  formatBufferForExtraction,
  getDominantSource
} from './buffer';
import { extractMemories } from './extractor';
import { saveMemory, cleanupExpiredMemories } from './supabase';
import { generateEmbedding } from '../knowledge/embeddings';
import { upsertVectors, getQdrantClient, ensureCollection } from '../knowledge/qdrant';
import type { ExtractedMemory } from '../types';

// Processing delay: 10 minutes (600000 ms)
const PROCESS_DELAY_MS = 10 * 60 * 1000;

// Worker state
let workerTimer: NodeJS.Timeout | null = null;
let isProcessing = false;
let memoryEnabled = false;
let ollamaModel = 'ministral-3:3b';
let collectionName = 'open-claude-knowledge';

/**
 * Initialize the memory worker with settings.
 */
export function initMemoryWorker(settings: {
  enabled: boolean;
  ollamaModel: string;
  collectionName: string;
}): void {
  memoryEnabled = settings.enabled;
  ollamaModel = settings.ollamaModel;
  collectionName = settings.collectionName;

  console.log(`[Memory Worker] Initialized (enabled: ${memoryEnabled}, model: ${ollamaModel})`);
}

/**
 * Schedule processing after delay.
 * Called whenever a message is added to the buffer.
 * Resets the timer if already scheduled (debounce pattern).
 */
export function scheduleProcessing(): void {
  if (!memoryEnabled) return;

  // Cancel existing timer
  if (workerTimer) {
    clearTimeout(workerTimer);
  }

  // Schedule new processing
  workerTimer = setTimeout(async () => {
    await processBuffer();
  }, PROCESS_DELAY_MS);

  console.log('[Memory Worker] Processing scheduled in 10 minutes');
}

/**
 * Cancel scheduled processing.
 */
export function cancelProcessing(): void {
  if (workerTimer) {
    clearTimeout(workerTimer);
    workerTimer = null;
    console.log('[Memory Worker] Scheduled processing cancelled');
  }
}

/**
 * Process the message buffer immediately.
 * Called by timer or can be called manually (e.g., on app quit).
 */
export async function processBuffer(): Promise<void> {
  // Guard against concurrent processing
  if (isProcessing) {
    console.log('[Memory Worker] Already processing, skipping');
    return;
  }

  if (!hasMessages()) {
    console.log('[Memory Worker] No messages to process');
    return;
  }

  if (!memoryEnabled) {
    console.log('[Memory Worker] Memory disabled, clearing buffer');
    clearBuffer();
    return;
  }

  isProcessing = true;
  console.log('[Memory Worker] Starting buffer processing...');

  try {
    // Get conversation text for extraction
    const conversationText = formatBufferForExtraction();
    const sourceType = getDominantSource() || 'main_chat';

    // Step 1: Extract memories using Ollama
    console.log('[Memory Worker] Extracting memories with Ollama...');
    const memories = await extractMemories(conversationText, ollamaModel);

    if (memories.length === 0) {
      console.log('[Memory Worker] No memories extracted');
      clearBuffer();
      isProcessing = false;
      return;
    }

    console.log(`[Memory Worker] Extracted ${memories.length} memories`);

    // Step 2: Save to Supabase and embed in Qdrant
    for (const memory of memories) {
      await processMemory(memory, sourceType);
    }

    // Step 3: Clean up expired temporal memories
    await cleanupExpiredMemories();

    // Step 4: Clear buffer
    clearBuffer();

    console.log(`[Memory Worker] Completed processing ${memories.length} memories`);
  } catch (error: unknown) {
    console.error('[Memory Worker] Error processing buffer:', error);
  } finally {
    isProcessing = false;
    workerTimer = null;
  }
}

/**
 * Process a single memory: save to Supabase and embed in Qdrant.
 */
async function processMemory(
  memory: ExtractedMemory,
  sourceType: 'spotlight' | 'main_chat'
): Promise<void> {
  try {
    // Save to Supabase
    const savedMemory = await saveMemory(memory, sourceType);
    if (!savedMemory) {
      console.error('[Memory Worker] Failed to save memory to Supabase');
      return;
    }

    // Generate embedding
    const embedding = await generateEmbedding(memory.content);

    // Ensure collection exists
    try {
      getQdrantClient();
      await ensureCollection(collectionName);
    } catch {
      console.warn('[Memory Worker] Qdrant not available, skipping embedding');
      return;
    }

    // Store in Qdrant with memory-specific metadata
    await upsertVectors(collectionName, [{
      id: savedMemory.id,
      content: memory.content,
      vector: embedding,
      metadata: {
        source: `memory:${savedMemory.id}`,
        filename: `memory_${memory.category}`,
        type: 'memory',
        chunkIndex: 0,
        totalChunks: 1,
        dateAdded: savedMemory.created_at,
        category: memory.category,
        importance: memory.importance,
        source_type: sourceType
      }
    }]);

    console.log(`[Memory Worker] Stored: [${memory.category}] ${memory.content.substring(0, 40)}...`);
  } catch (error: unknown) {
    console.error('[Memory Worker] Error processing memory:', error);
  }
}

/**
 * Force process buffer now (e.g., before app quit).
 */
export async function flushBuffer(): Promise<void> {
  cancelProcessing();
  await processBuffer();
}

/**
 * Check if worker is currently processing.
 */
export function isWorkerProcessing(): boolean {
  return isProcessing;
}

/**
 * Check if processing is scheduled.
 */
export function isProcessingScheduled(): boolean {
  return workerTimer !== null;
}
