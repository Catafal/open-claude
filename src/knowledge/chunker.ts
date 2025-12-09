/**
 * Text Chunker
 *
 * Splits text into chunks for embedding and storage.
 * Uses character-based approximation: ~4 chars per token.
 */

import type { Chunk } from './types';

// Chunking configuration
const CHUNK_SIZE = 2000;    // ~500 tokens (4 chars/token)
const CHUNK_OVERLAP = 200;  // ~50 tokens overlap for context continuity
const MIN_CHUNK_SIZE = 50;  // Skip chunks smaller than this

/**
 * Split text into overlapping chunks for RAG retrieval.
 * Tries to break at natural points (paragraphs, sentences).
 */
export function chunkText(text: string): Chunk[] {
  // Normalize whitespace
  const normalized = text.replace(/\r\n/g, '\n').trim();

  if (normalized.length <= CHUNK_SIZE) {
    // Text fits in single chunk
    return [{ text: normalized, index: 0 }];
  }

  const chunks: Chunk[] = [];
  let start = 0;
  let index = 0;

  while (start < normalized.length) {
    // Calculate tentative end position
    let end = Math.min(start + CHUNK_SIZE, normalized.length);

    // If not at the end, find a natural break point
    if (end < normalized.length) {
      const breakPoint = findBreakPoint(normalized, start, end);
      if (breakPoint > start) {
        end = breakPoint;
      }
    }

    // Extract chunk text
    const chunkText = normalized.slice(start, end).trim();

    // Only add non-empty chunks above minimum size
    if (chunkText.length >= MIN_CHUNK_SIZE) {
      chunks.push({
        text: chunkText,
        index: index++
      });
    }

    // Move start position, accounting for overlap
    start = end - CHUNK_OVERLAP;

    // Safety: ensure we always make progress
    if (start <= chunks[chunks.length - 1]?.index || start < 0) {
      start = end;
    }
  }

  return chunks;
}

/**
 * Find a natural break point (paragraph or sentence end) near target position.
 * Returns the best break position, or original end if none found.
 */
function findBreakPoint(text: string, start: number, end: number): number {
  // Look for paragraph break (double newline) first
  const paragraphBreak = text.lastIndexOf('\n\n', end);
  if (paragraphBreak > start + CHUNK_SIZE / 2) {
    return paragraphBreak + 2;  // Include the newlines
  }

  // Look for sentence end (. followed by space or newline)
  const sentenceEnd = findLastSentenceEnd(text, start, end);
  if (sentenceEnd > start + CHUNK_SIZE / 2) {
    return sentenceEnd;
  }

  // Look for single newline as fallback
  const lineBreak = text.lastIndexOf('\n', end);
  if (lineBreak > start + CHUNK_SIZE / 2) {
    return lineBreak + 1;
  }

  // No good break point found, use original end
  return end;
}

/**
 * Find the last sentence ending position in the range.
 */
function findLastSentenceEnd(text: string, start: number, end: number): number {
  // Look for common sentence endings
  const endings = ['. ', '.\n', '! ', '!\n', '? ', '?\n'];

  let lastEnd = -1;

  for (const ending of endings) {
    const pos = text.lastIndexOf(ending, end);
    if (pos > start + CHUNK_SIZE / 2 && pos > lastEnd) {
      lastEnd = pos + ending.length;
    }
  }

  return lastEnd;
}
