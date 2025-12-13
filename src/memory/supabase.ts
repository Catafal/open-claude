/**
 * Supabase Client for Memory Storage
 *
 * Handles connection to Supabase and CRUD operations for memories.
 * Memories are stored in a 'memories' table with structured fields.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { StoredMemory, ExtractedMemory, MemoryCategory } from '../types';

// Supabase client instance (initialized on first use or settings change)
let supabaseClient: SupabaseClient | null = null;
let currentUrl: string | null = null;
let currentKey: string | null = null;

/**
 * Initialize or reinitialize the Supabase client.
 * Only recreates if URL or key changed.
 */
export function initSupabaseClient(url: string, anonKey: string): void {
  if (url === currentUrl && anonKey === currentKey && supabaseClient) {
    return;  // Already initialized with same credentials
  }

  currentUrl = url;
  currentKey = anonKey;
  supabaseClient = createClient(url, anonKey);
  console.log('[Memory] Supabase client initialized');
}

/**
 * Get the Supabase client. Throws if not initialized.
 */
function getClient(): SupabaseClient {
  if (!supabaseClient) {
    throw new Error('Supabase client not initialized. Call initSupabaseClient first.');
  }
  return supabaseClient;
}

/**
 * Test connection to Supabase by attempting a simple query.
 */
export async function testSupabaseConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getClient();
    // Try to query the memories table (will fail if table doesn't exist)
    const { error } = await client.from('memories').select('id').limit(1);

    if (error) {
      // Table doesn't exist or permission issue
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMessage };
  }
}

/**
 * Save a memory to Supabase.
 */
export async function saveMemory(
  memory: ExtractedMemory,
  sourceType: 'spotlight' | 'main_chat'
): Promise<StoredMemory | null> {
  try {
    const client = getClient();

    const insertData = {
      content: memory.content,
      category: memory.category,
      importance: memory.importance,
      source_type: sourceType,
      // expires_at is null for non-temporal, could be set for temporal memories
      expires_at: memory.category === 'temporal' ? getExpiryDate() : null
    };

    const { data, error } = await client
      .from('memories')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('[Memory] Failed to save memory:', error.message);
      return null;
    }

    console.log(`[Memory] Saved: [${memory.category}] ${memory.content.substring(0, 50)}...`);
    return data as StoredMemory;
  } catch (err: unknown) {
    console.error('[Memory] Error saving memory:', err);
    return null;
  }
}

/**
 * Get memories from Supabase, optionally filtered by category.
 */
export async function getMemories(
  limit: number = 50,
  category?: MemoryCategory
): Promise<StoredMemory[]> {
  try {
    const client = getClient();

    let query = client
      .from('memories')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Memory] Failed to fetch memories:', error.message);
      return [];
    }

    return (data || []) as StoredMemory[];
  } catch (err: unknown) {
    console.error('[Memory] Error fetching memories:', err);
    return [];
  }
}

/**
 * Delete a memory by ID.
 */
export async function deleteMemory(id: string): Promise<boolean> {
  try {
    const client = getClient();

    const { error } = await client
      .from('memories')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[Memory] Failed to delete memory:', error.message);
      return false;
    }

    console.log(`[Memory] Deleted memory: ${id}`);
    return true;
  } catch (err: unknown) {
    console.error('[Memory] Error deleting memory:', err);
    return false;
  }
}

/**
 * Delete all memories (for cleanup/reset).
 */
export async function deleteAllMemories(): Promise<boolean> {
  try {
    const client = getClient();

    // Delete all rows by matching any non-null id
    const { error } = await client
      .from('memories')
      .delete()
      .not('id', 'is', null);

    if (error) {
      console.error('[Memory] Failed to delete all memories:', error.message);
      return false;
    }

    console.log('[Memory] Deleted all memories');
    return true;
  } catch (err: unknown) {
    console.error('[Memory] Error deleting all memories:', err);
    return false;
  }
}

/**
 * Get default expiry date for temporal memories (7 days from now).
 */
function getExpiryDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString();
}

/**
 * Clean up expired temporal memories.
 */
export async function cleanupExpiredMemories(): Promise<number> {
  try {
    const client = getClient();

    const { data, error } = await client
      .from('memories')
      .delete()
      .eq('category', 'temporal')
      .lt('expires_at', new Date().toISOString())
      .select('id');

    if (error) {
      console.error('[Memory] Failed to cleanup expired memories:', error.message);
      return 0;
    }

    const count = data?.length || 0;
    if (count > 0) {
      console.log(`[Memory] Cleaned up ${count} expired temporal memories`);
    }
    return count;
  } catch (err: unknown) {
    console.error('[Memory] Error cleaning up memories:', err);
    return 0;
  }
}
