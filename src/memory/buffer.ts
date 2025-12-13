/**
 * Message Buffer for Memory System
 *
 * In-memory buffer that holds unprocessed messages from conversations.
 * Messages are stored until the memory worker processes them (10 min after last message).
 */

export interface BufferedMessage {
  role: 'user' | 'assistant';
  content: string;
  source: 'spotlight' | 'main_chat';
  timestamp: number;  // Unix timestamp (ms)
}

// In-memory buffer - simple array
let messageBuffer: BufferedMessage[] = [];

// Track when last message was added (for worker scheduling)
let lastMessageTime: number | null = null;

/**
 * Add a message to the buffer.
 * Updates lastMessageTime for worker scheduling.
 */
export function addToBuffer(msg: BufferedMessage): void {
  messageBuffer.push(msg);
  lastMessageTime = Date.now();

  console.log(`[Memory Buffer] Added ${msg.role} message from ${msg.source} (buffer size: ${messageBuffer.length})`);
}

/**
 * Add a user-assistant pair to buffer (common pattern).
 */
export function addConversationPair(
  userMessage: string,
  assistantMessage: string,
  source: 'spotlight' | 'main_chat'
): void {
  const now = Date.now();

  addToBuffer({
    role: 'user',
    content: userMessage,
    source,
    timestamp: now
  });

  addToBuffer({
    role: 'assistant',
    content: assistantMessage,
    source,
    timestamp: now
  });
}

/**
 * Get all buffered messages.
 */
export function getBuffer(): BufferedMessage[] {
  return [...messageBuffer];  // Return copy to prevent mutation
}

/**
 * Get buffer size.
 */
export function getBufferSize(): number {
  return messageBuffer.length;
}

/**
 * Clear the buffer (after processing).
 */
export function clearBuffer(): void {
  const size = messageBuffer.length;
  messageBuffer = [];
  console.log(`[Memory Buffer] Cleared ${size} messages`);
}

/**
 * Get timestamp of last message added.
 */
export function getLastMessageTime(): number | null {
  return lastMessageTime;
}

/**
 * Check if buffer has messages to process.
 */
export function hasMessages(): boolean {
  return messageBuffer.length > 0;
}

/**
 * Format buffer for Ollama extraction prompt.
 * Returns conversation in readable format.
 */
export function formatBufferForExtraction(): string {
  if (messageBuffer.length === 0) return '';

  return messageBuffer
    .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
    .join('\n\n');
}

/**
 * Get the dominant source type in buffer (for metadata).
 */
export function getDominantSource(): 'spotlight' | 'main_chat' | null {
  if (messageBuffer.length === 0) return null;

  const spotlightCount = messageBuffer.filter(m => m.source === 'spotlight').length;
  const mainChatCount = messageBuffer.filter(m => m.source === 'main_chat').length;

  return spotlightCount >= mainChatCount ? 'spotlight' : 'main_chat';
}
