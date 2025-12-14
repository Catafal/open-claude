/**
 * Settings Sync Module - Supabase Cloud Storage
 *
 * Handles syncing app settings to/from Supabase.
 * LOCAL always wins - Supabase is backup/sync destination.
 *
 * Flow:
 * - On Supabase connect: Check if local is empty → pull from cloud
 * - User can manually push local settings to cloud
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  SettingsSchema,
  KnowledgeSettingsStore,
  NotionSettingsStore,
  RAGSettingsStore
} from '../types';

// ============================================================
// Types
// ============================================================

// Settings stored in Supabase (excludes memorySettings - chicken/egg)
export interface CloudSettings {
  settings: Partial<SettingsSchema>;
  knowledge_settings: Partial<KnowledgeSettingsStore>;
  notion_settings: Partial<NotionSettingsStore>;
  rag_settings: Partial<RAGSettingsStore>;
}

// Database row shape
interface UserSettingsRow {
  id: string;
  settings: Partial<SettingsSchema>;
  knowledge_settings: Partial<KnowledgeSettingsStore>;
  notion_settings: Partial<NotionSettingsStore>;
  rag_settings: Partial<RAGSettingsStore>;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Client Management
// ============================================================

// Reuse existing Supabase client from memory module
let supabaseClient: SupabaseClient | null = null;
let currentUrl: string | null = null;
let currentKey: string | null = null;

/**
 * Initialize Supabase client for settings sync.
 * Called when memory settings are configured.
 */
export function initSettingsSyncClient(url: string, anonKey: string): void {
  if (url === currentUrl && anonKey === currentKey && supabaseClient) {
    return; // Already initialized
  }
  currentUrl = url;
  currentKey = anonKey;
  supabaseClient = createClient(url, anonKey);
  console.log('[SettingsSync] Client initialized');
}

/**
 * Get the Supabase client. Throws if not initialized.
 */
function getClient(): SupabaseClient {
  if (!supabaseClient) {
    throw new Error('Settings sync client not initialized');
  }
  return supabaseClient;
}

/**
 * Check if client is ready for operations.
 */
export function isSettingsSyncReady(): boolean {
  return supabaseClient !== null;
}

// ============================================================
// CRUD Operations
// ============================================================

/**
 * Load settings from Supabase (cloud).
 * Returns null if no settings found or on error.
 */
export async function loadSettingsFromCloud(): Promise<CloudSettings | null> {
  try {
    const client = getClient();

    // Get the first (and only) row - single user per Supabase project
    const { data, error } = await client
      .from('user_settings')
      .select('*')
      .limit(1)
      .single();

    if (error) {
      // PGRST116 = no rows found (not an error, just empty)
      if (error.code === 'PGRST116') {
        console.log('[SettingsSync] No cloud settings found');
        return null;
      }
      console.error('[SettingsSync] Failed to load:', error.message);
      return null;
    }

    const row = data as UserSettingsRow;
    console.log('[SettingsSync] Loaded settings from cloud');

    return {
      settings: row.settings || {},
      knowledge_settings: row.knowledge_settings || {},
      notion_settings: row.notion_settings || {},
      rag_settings: row.rag_settings || {}
    };
  } catch (err) {
    console.error('[SettingsSync] Error loading from cloud:', err);
    return null;
  }
}

/**
 * Save settings to Supabase (cloud).
 * Uses upsert - creates if not exists, updates if exists.
 */
export async function saveSettingsToCloud(settings: CloudSettings): Promise<boolean> {
  try {
    const client = getClient();

    // Check if row exists
    const { data: existing } = await client
      .from('user_settings')
      .select('id')
      .limit(1)
      .single();

    if (existing) {
      // Update existing row
      const { error } = await client
        .from('user_settings')
        .update({
          settings: settings.settings,
          knowledge_settings: settings.knowledge_settings,
          notion_settings: settings.notion_settings,
          rag_settings: settings.rag_settings
        })
        .eq('id', existing.id);

      if (error) {
        console.error('[SettingsSync] Failed to update:', error.message);
        return false;
      }
    } else {
      // Insert new row
      const { error } = await client
        .from('user_settings')
        .insert({
          settings: settings.settings,
          knowledge_settings: settings.knowledge_settings,
          notion_settings: settings.notion_settings,
          rag_settings: settings.rag_settings
        });

      if (error) {
        console.error('[SettingsSync] Failed to insert:', error.message);
        return false;
      }
    }

    console.log('[SettingsSync] Saved settings to cloud');
    return true;
  } catch (err) {
    console.error('[SettingsSync] Error saving to cloud:', err);
    return false;
  }
}

/**
 * Test if user_settings table exists and is accessible.
 */
export async function testSettingsTable(): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getClient();

    // Try to select from user_settings table
    const { error } = await client
      .from('user_settings')
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
 * Check if cloud has settings (for UI indication).
 */
export async function hasCloudSettings(): Promise<boolean> {
  try {
    const client = getClient();

    const { data, error } = await client
      .from('user_settings')
      .select('id')
      .limit(1)
      .single();

    if (error || !data) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
