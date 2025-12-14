/**
 * Supabase Client for Prompt Storage
 *
 * Handles connection to Supabase and CRUD operations for prompts.
 * Prompts are stored in a 'prompts' table with structured fields.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { StoredPrompt, CreatePromptInput, UpdatePromptInput, PromptVariable } from './types';

// Supabase client instance (initialized on first use or settings change)
let supabaseClient: SupabaseClient | null = null;
let currentUrl: string | null = null;
let currentKey: string | null = null;

// Default user ID (can be replaced with actual auth later)
const DEFAULT_USER_ID = 'default_user';

/**
 * Initialize or reinitialize the Supabase client.
 * Only recreates if URL or key changed.
 */
export function initPromptsSupabaseClient(url: string, anonKey: string): void {
  if (url === currentUrl && anonKey === currentKey && supabaseClient) {
    return;  // Already initialized with same credentials
  }

  currentUrl = url;
  currentKey = anonKey;
  supabaseClient = createClient(url, anonKey);
  console.log('[Prompts] Supabase client initialized');
}

/**
 * Get the Supabase client. Throws if not initialized.
 */
function getClient(): SupabaseClient {
  if (!supabaseClient) {
    throw new Error('Supabase client not initialized. Call initPromptsSupabaseClient first.');
  }
  return supabaseClient;
}

/**
 * Test connection to Supabase by attempting a simple query.
 */
export async function testPromptsConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getClient();
    const { error } = await client.from('prompts').select('id').limit(1);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMessage };
  }
}

/**
 * Get all prompts for the user.
 */
export async function getPrompts(): Promise<StoredPrompt[]> {
  try {
    const client = getClient();

    const { data, error } = await client
      .from('prompts')
      .select('*')
      .eq('user_id', DEFAULT_USER_ID)
      .order('is_favorite', { ascending: false })
      .order('usage_count', { ascending: false })
      .order('name', { ascending: true });

    if (error) {
      console.error('[Prompts] Failed to fetch prompts:', error.message);
      return [];
    }

    return (data || []) as StoredPrompt[];
  } catch (err: unknown) {
    console.error('[Prompts] Error fetching prompts:', err);
    return [];
  }
}

/**
 * Get prompts filtered by category.
 */
export async function getPromptsByCategory(category: string): Promise<StoredPrompt[]> {
  try {
    const client = getClient();

    const { data, error } = await client
      .from('prompts')
      .select('*')
      .eq('user_id', DEFAULT_USER_ID)
      .eq('category', category)
      .order('is_favorite', { ascending: false })
      .order('usage_count', { ascending: false });

    if (error) {
      console.error('[Prompts] Failed to fetch prompts by category:', error.message);
      return [];
    }

    return (data || []) as StoredPrompt[];
  } catch (err: unknown) {
    console.error('[Prompts] Error fetching prompts by category:', err);
    return [];
  }
}

/**
 * Create a new prompt.
 */
export async function createPrompt(input: CreatePromptInput): Promise<StoredPrompt | null> {
  try {
    const client = getClient();

    // Extract variables from content ({{variable}} pattern)
    const extractedVars = extractVariables(input.content);
    const variables = input.variables || extractedVars;

    const insertData = {
      user_id: DEFAULT_USER_ID,
      name: input.name,
      category: input.category,
      content: input.content,
      variables: variables,
      is_favorite: input.is_favorite || false,
      usage_count: 0,
    };

    const { data, error } = await client
      .from('prompts')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('[Prompts] Failed to create prompt:', error.message);
      return null;
    }

    console.log(`[Prompts] Created: ${input.name}`);
    return data as StoredPrompt;
  } catch (err: unknown) {
    console.error('[Prompts] Error creating prompt:', err);
    return null;
  }
}

/**
 * Update an existing prompt.
 */
export async function updatePrompt(id: string, updates: UpdatePromptInput): Promise<StoredPrompt | null> {
  try {
    const client = getClient();

    // If content is updated, re-extract variables
    const updateData: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() };
    if (updates.content && !updates.variables) {
      updateData.variables = extractVariables(updates.content);
    }

    const { data, error } = await client
      .from('prompts')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', DEFAULT_USER_ID)
      .select()
      .single();

    if (error) {
      console.error('[Prompts] Failed to update prompt:', error.message);
      return null;
    }

    console.log(`[Prompts] Updated: ${id}`);
    return data as StoredPrompt;
  } catch (err: unknown) {
    console.error('[Prompts] Error updating prompt:', err);
    return null;
  }
}

/**
 * Delete a prompt.
 */
export async function deletePrompt(id: string): Promise<boolean> {
  try {
    const client = getClient();

    const { error } = await client
      .from('prompts')
      .delete()
      .eq('id', id)
      .eq('user_id', DEFAULT_USER_ID);

    if (error) {
      console.error('[Prompts] Failed to delete prompt:', error.message);
      return false;
    }

    console.log(`[Prompts] Deleted: ${id}`);
    return true;
  } catch (err: unknown) {
    console.error('[Prompts] Error deleting prompt:', err);
    return false;
  }
}

/**
 * Toggle favorite status of a prompt.
 */
export async function toggleFavorite(id: string): Promise<StoredPrompt | null> {
  try {
    const client = getClient();

    // Get current status
    const { data: existing } = await client
      .from('prompts')
      .select('is_favorite')
      .eq('id', id)
      .single();

    if (!existing) return null;

    // Toggle it
    const { data, error } = await client
      .from('prompts')
      .update({ is_favorite: !existing.is_favorite, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[Prompts] Failed to toggle favorite:', error.message);
      return null;
    }

    return data as StoredPrompt;
  } catch (err: unknown) {
    console.error('[Prompts] Error toggling favorite:', err);
    return null;
  }
}

/**
 * Increment usage count when a prompt is used.
 */
export async function incrementUsageCount(id: string): Promise<boolean> {
  try {
    const client = getClient();

    // Get current count
    const { data: existing } = await client
      .from('prompts')
      .select('usage_count')
      .eq('id', id)
      .single();

    if (!existing) return false;

    // Increment it
    const { error } = await client
      .from('prompts')
      .update({ usage_count: (existing.usage_count || 0) + 1 })
      .eq('id', id);

    if (error) {
      console.error('[Prompts] Failed to increment usage:', error.message);
      return false;
    }

    return true;
  } catch (err: unknown) {
    console.error('[Prompts] Error incrementing usage:', err);
    return false;
  }
}

/**
 * Extract variable placeholders from prompt content.
 * Matches {{variableName}} patterns.
 */
function extractVariables(content: string): PromptVariable[] {
  const regex = /\{\{(\w+)\}\}/g;
  const matches = content.matchAll(regex);
  const seen = new Set<string>();
  const variables: PromptVariable[] = [];

  for (const match of matches) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      variables.push({ name, defaultValue: '', description: '' });
    }
  }

  return variables;
}

/**
 * Fill variables in a prompt template with provided values.
 */
export function fillPromptVariables(content: string, values: Record<string, string>): string {
  let result = content;
  for (const [key, value] of Object.entries(values)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}
