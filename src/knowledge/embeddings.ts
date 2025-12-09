/**
 * Embeddings Module
 *
 * Generates 384-dimensional embeddings using transformers.js with all-MiniLM-L6-v2.
 * Uses lazy loading pattern to avoid slow startup - model loads on first use.
 */

// Lazy-loaded embedding pipeline (stays in memory after first use)
let embeddingPipeline: any = null;

// Model configuration
const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';
export const VECTOR_SIZE = 384;  // Output dimension of all-MiniLM-L6-v2

/**
 * Get or initialize the embedding pipeline.
 * Uses lazy loading - model downloads and loads on first call.
 * Includes retry logic for network failures during model download.
 */
export async function getEmbeddingPipeline(retries = 3): Promise<any> {
  if (embeddingPipeline) return embeddingPipeline;

  // Dynamic import to avoid loading at startup
  const { pipeline } = await import('@xenova/transformers');

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[Embeddings] Loading model ${MODEL_NAME} (attempt ${attempt}/${retries})...`);

      embeddingPipeline = await pipeline('feature-extraction', MODEL_NAME, {
        // Use quantized model for faster inference
        quantized: true
      });

      console.log('[Embeddings] Model loaded successfully');
      return embeddingPipeline;
    } catch (err: any) {
      console.error(`[Embeddings] Attempt ${attempt} failed:`, err.message || err);
      if (attempt === retries) throw err;
      // Wait before retrying (1s, 2s, 3s...)
      await new Promise(r => setTimeout(r, attempt * 1000));
    }
  }

  throw new Error('Failed to load embedding model after retries');
}

/**
 * Generate embedding vector for a single text.
 * Returns normalized 384-dimensional vector.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const pipe = await getEmbeddingPipeline();

  // Run inference with mean pooling and normalization
  const output = await pipe(text, {
    pooling: 'mean',
    normalize: true
  });

  // Convert from tensor to array
  return Array.from(output.data as Float32Array);
}

/**
 * Generate embeddings for multiple texts in batch.
 * More efficient than calling generateEmbedding multiple times.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  // Process in parallel for efficiency
  return Promise.all(texts.map(text => generateEmbedding(text)));
}
