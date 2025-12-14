/**
 * Knowledge Supabase Module
 *
 * Stores document registry (metadata) in Supabase for cross-device sync.
 * Actual content/embeddings remain in Qdrant.
 *
 * Table: knowledge_documents (source, title, type, chunk_count, date_added)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ============================================================
// Types
// ============================================================

// Document registry entry (stored in Supabase)
export interface KnowledgeDocument {
  id: string;
  source: string;      // File path or URL (unique)
  title: string;       // Display name
  type: 'txt' | 'md' | 'pdf' | 'url' | 'notion';
  chunk_count: number;
  date_added: string;  // ISO timestamp
  updated_at: string;
}

// Database row shape (matches Supabase table)
interface KnowledgeDocumentRow {
  id: string;
  source: string;
  title: string;
  type: string;
  chunk_count: number;
  date_added: string;
  updated_at: string;
}

// ============================================================
// Client Management
// ============================================================

let supabaseClient: SupabaseClient | null = null;
let currentUrl: string | null = null;
let currentKey: string | null = null;

/**
 * Initialize Supabase client for knowledge registry.
 * Reuses client if credentials unchanged.
 */
export function initKnowledgeSupabase(url: string, anonKey: string): void {
  if (url === currentUrl && anonKey === currentKey && supabaseClient) {
    return; // Already initialized with same credentials
  }
  currentUrl = url;
  currentKey = anonKey;
  supabaseClient = createClient(url, anonKey);
  console.log('[KnowledgeSupabase] Client initialized');
}

/**
 * Get the Supabase client. Throws if not initialized.
 */
function getClient(): SupabaseClient {
  if (!supabaseClient) {
    throw new Error('Knowledge Supabase client not initialized');
  }
  return supabaseClient;
}

/**
 * Check if client is ready for operations.
 */
export function isKnowledgeSupabaseReady(): boolean {
  return supabaseClient !== null;
}

// ============================================================
// CRUD Operations
// ============================================================

/**
 * Register a document in Supabase (INSERT or UPDATE on conflict).
 * Called after ingesting a file/URL into Qdrant.
 */
export async function registerDocument(
  source: string,
  title: string,
  type: 'txt' | 'md' | 'pdf' | 'url' | 'notion',
  chunkCount: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getClient();

    // Upsert: insert or update if source exists
    const { error } = await client
      .from('knowledge_documents')
      .upsert(
        {
          source,
          title,
          type,
          chunk_count: chunkCount,
          date_added: new Date().toISOString()
        },
        { onConflict: 'source' }
      );

    if (error) {
      console.error('[KnowledgeSupabase] Register failed:', error.message);
      return { success: false, error: error.message };
    }

    console.log(`[KnowledgeSupabase] Registered: ${title} (${chunkCount} chunks)`);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[KnowledgeSupabase] Register error:', msg);
    return { success: false, error: msg };
  }
}

/**
 * Unregister a document from Supabase (DELETE by source).
 * Called after deleting chunks from Qdrant.
 */
export async function unregisterDocument(source: string): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getClient();

    const { error } = await client
      .from('knowledge_documents')
      .delete()
      .eq('source', source);

    if (error) {
      console.error('[KnowledgeSupabase] Unregister failed:', error.message);
      return { success: false, error: error.message };
    }

    console.log(`[KnowledgeSupabase] Unregistered: ${source}`);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[KnowledgeSupabase] Unregister error:', msg);
    return { success: false, error: msg };
  }
}

/**
 * List all documents from Supabase registry.
 * Returns empty array if no documents or on error.
 */
export async function listDocuments(): Promise<KnowledgeDocument[]> {
  try {
    const client = getClient();

    const { data, error } = await client
      .from('knowledge_documents')
      .select('*')
      .order('date_added', { ascending: false });

    if (error) {
      console.error('[KnowledgeSupabase] List failed:', error.message);
      return [];
    }

    // Map to typed array
    const docs: KnowledgeDocument[] = (data as KnowledgeDocumentRow[]).map(row => ({
      id: row.id,
      source: row.source,
      title: row.title,
      type: row.type as KnowledgeDocument['type'],
      chunk_count: row.chunk_count,
      date_added: row.date_added,
      updated_at: row.updated_at
    }));

    return docs;
  } catch (err) {
    console.error('[KnowledgeSupabase] List error:', err);
    return [];
  }
}

/**
 * Update chunk count for an existing document.
 * Used when re-syncing a document (e.g., Notion page updated).
 */
export async function updateDocumentChunkCount(
  source: string,
  chunkCount: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getClient();

    const { error } = await client
      .from('knowledge_documents')
      .update({ chunk_count: chunkCount })
      .eq('source', source);

    if (error) {
      console.error('[KnowledgeSupabase] Update chunk count failed:', error.message);
      return { success: false, error: error.message };
    }

    console.log(`[KnowledgeSupabase] Updated chunk count: ${source} → ${chunkCount}`);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Test if knowledge_documents table exists and is accessible.
 */
export async function testKnowledgeTable(): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getClient();

    const { error } = await client
      .from('knowledge_documents')
      .select('id')
      .limit(1);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Clear all documents from registry.
 * Use with caution - only for full reset/migration.
 */
export async function clearAllDocuments(): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getClient();

    const { error } = await client
      .from('knowledge_documents')
      .delete()
      .not('id', 'is', null); // Delete all rows

    if (error) {
      console.error('[KnowledgeSupabase] Clear all failed:', error.message);
      return { success: false, error: error.message };
    }

    console.log('[KnowledgeSupabase] Cleared all documents');
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}
