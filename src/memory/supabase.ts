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

// =============================================================================
// Memory Improvement Functions (deduplication, decay, access tracking)
// =============================================================================

/**
 * Update an existing memory's content and/or importance.
 */
export async function updateMemory(
  id: string,
  updates: { content?: string; importance?: number }
): Promise<boolean> {
  try {
    const client = getClient();

    const { error } = await client
      .from('memories')
      .update({
        ...updates,
        last_accessed: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      console.error('[Memory] Failed to update memory:', error.message);
      return false;
    }

    console.log(`[Memory] Updated memory: ${id}`);
    return true;
  } catch (err: unknown) {
    console.error('[Memory] Error updating memory:', err);
    return false;
  }
}

/**
 * Track memory access - update last_accessed timestamp.
 * Called when memories are retrieved for context injection.
 * Note: access_count increment would require raw SQL or RPC function.
 */
export async function trackMemoryAccess(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  try {
    const client = getClient();

    // Update last_accessed for all retrieved memories
    await client
      .from('memories')
      .update({ last_accessed: new Date().toISOString() })
      .in('id', ids);

  } catch (err: unknown) {
    console.error('[Memory] Error tracking access:', err);
  }
}

/**
 * Boost importance of an existing memory (when duplicate detected).
 * Increases by 0.1, capped at 1.0.
 */
export async function boostImportance(id: string): Promise<boolean> {
  try {
    const client = getClient();

    // First get current importance
    const { data: existing } = await client
      .from('memories')
      .select('importance')
      .eq('id', id)
      .single();

    if (!existing) return false;

    const newImportance = Math.min(1.0, (existing.importance || 0.5) + 0.1);

    const { error } = await client
      .from('memories')
      .update({
        importance: newImportance,
        last_accessed: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      console.error('[Memory] Failed to boost importance:', error.message);
      return false;
    }

    console.log(`[Memory] Boosted importance of ${id} to ${newImportance}`);
    return true;
  } catch (err: unknown) {
    console.error('[Memory] Error boosting importance:', err);
    return false;
  }
}

/**
 * Mark a memory as superseded by another (for contradiction resolution).
 */
export async function markSuperseded(oldId: string, newId: string): Promise<boolean> {
  try {
    const client = getClient();

    const { error } = await client
      .from('memories')
      .update({ superseded_by: newId })
      .eq('id', oldId);

    if (error) {
      console.error('[Memory] Failed to mark superseded:', error.message);
      return false;
    }

    console.log(`[Memory] Marked ${oldId} as superseded by ${newId}`);
    return true;
  } catch (err: unknown) {
    console.error('[Memory] Error marking superseded:', err);
    return false;
  }
}

/**
 * Decay importance of memories not accessed recently.
 * Multiplies importance by decay factor for memories not accessed in last 7 days.
 * @returns Number of memories decayed
 */
export async function decayImportance(decayFactor: number = 0.95): Promise<number> {
  try {
    const client = getClient();

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Get memories to decay
    const { data: toDecay, error: fetchError } = await client
      .from('memories')
      .select('id, importance')
      .lt('last_accessed', sevenDaysAgo.toISOString())
      .gt('importance', 0.1)
      .is('superseded_by', null);

    if (fetchError || !toDecay) {
      console.error('[Memory] Failed to fetch memories for decay:', fetchError?.message);
      return 0;
    }

    // Update each memory's importance
    let decayedCount = 0;
    for (const memory of toDecay) {
      const newImportance = Math.max(0.05, memory.importance * decayFactor);
      const { error } = await client
        .from('memories')
        .update({ importance: newImportance })
        .eq('id', memory.id);

      if (!error) decayedCount++;
    }

    if (decayedCount > 0) {
      console.log(`[Memory] Decayed importance of ${decayedCount} memories`);
    }
    return decayedCount;
  } catch (err: unknown) {
    console.error('[Memory] Error decaying importance:', err);
    return 0;
  }
}

/**
 * Prune low-importance, stale memories.
 * Deletes memories with importance < minImportance that haven't been accessed in staleDays.
 * @returns Number of memories pruned
 */
export async function pruneMemories(
  minImportance: number = 0.1,
  staleDays: number = 90
): Promise<number> {
  try {
    const client = getClient();

    const staleDate = new Date();
    staleDate.setDate(staleDate.getDate() - staleDays);

    const { data, error } = await client
      .from('memories')
      .delete()
      .lt('importance', minImportance)
      .lt('last_accessed', staleDate.toISOString())
      .is('superseded_by', null)  // Don't delete historical records
      .select('id');

    if (error) {
      console.error('[Memory] Failed to prune memories:', error.message);
      return 0;
    }

    const count = data?.length || 0;
    if (count > 0) {
      console.log(`[Memory] Pruned ${count} low-importance stale memories`);
    }
    return count;
  } catch (err: unknown) {
    console.error('[Memory] Error pruning memories:', err);
    return 0;
  }
}

/**
 * Get a memory by ID.
 */
export async function getMemoryById(id: string): Promise<StoredMemory | null> {
  try {
    const client = getClient();

    const { data, error } = await client
      .from('memories')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return null;
    }

    return data as StoredMemory;
  } catch {
    return null;
  }
}
