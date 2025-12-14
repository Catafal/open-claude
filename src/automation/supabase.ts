/**
 * Automation State Tracking with Supabase
 *
 * Tracks automation state (like last morning email sent date) in Supabase
 * for cross-device synchronization. Uses the same Supabase instance as memory.
 *
 * Required SQL table in Supabase:
 * CREATE TABLE automation_state (
 *   user_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   morning_email_last_sent DATE,
 *   updated_at TIMESTAMPTZ DEFAULT NOW()
 * );
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { AutomationState } from './types';

// Supabase client instance (shared pattern with memory module)
let supabaseClient: SupabaseClient | null = null;
let currentUrl: string | null = null;
let currentKey: string | null = null;

// Device ID for identifying this installation (same across sessions)
let deviceId: string | null = null;

/**
 * Initialize or reinitialize the Supabase client for automation.
 * Uses the same credentials as memory settings.
 */
export function initAutomationSupabase(url: string, anonKey: string, devId: string): void {
  if (url === currentUrl && anonKey === currentKey && supabaseClient) {
    deviceId = devId;
    return;  // Already initialized with same credentials
  }

  currentUrl = url;
  currentKey = anonKey;
  deviceId = devId;
  supabaseClient = createClient(url, anonKey);
  console.log('[Automation] Supabase client initialized');
}

/**
 * Get the Supabase client. Returns null if not initialized.
 */
function getClient(): SupabaseClient | null {
  return supabaseClient;
}

/**
 * Get the device ID (used as user_id in automation_state table).
 */
function getDeviceId(): string {
  if (!deviceId) {
    throw new Error('Device ID not set. Call initAutomationSupabase first.');
  }
  return deviceId;
}

/**
 * Get the last morning email sent date from Supabase.
 * Returns null if never sent or on error.
 */
export async function getMorningEmailLastSent(): Promise<string | null> {
  const client = getClient();
  if (!client) {
    console.log('[Automation] Supabase not initialized, skipping state check');
    return null;
  }

  try {
    const { data, error } = await client
      .from('automation_state')
      .select('morning_email_last_sent')
      .eq('user_id', getDeviceId())
      .single();

    if (error) {
      // Row doesn't exist yet - that's fine, means never sent
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('[Automation] Error getting last sent date:', error.message);
      return null;
    }

    return data?.morning_email_last_sent || null;
  } catch (err) {
    console.error('[Automation] Error getting last sent date:', err);
    return null;
  }
}

/**
 * Set the morning email last sent date in Supabase.
 * Uses upsert to create or update the row.
 */
export async function setMorningEmailLastSent(date: string): Promise<boolean> {
  const client = getClient();
  if (!client) {
    console.log('[Automation] Supabase not initialized, skipping state save');
    return false;
  }

  try {
    const { error } = await client
      .from('automation_state')
      .upsert({
        user_id: getDeviceId(),
        morning_email_last_sent: date,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      console.error('[Automation] Error setting last sent date:', error.message);
      return false;
    }

    console.log(`[Automation] Marked morning email sent for ${date}`);
    return true;
  } catch (err) {
    console.error('[Automation] Error setting last sent date:', err);
    return false;
  }
}

/**
 * Check if the morning email has already been sent today.
 */
export async function hasSentMorningEmailToday(): Promise<boolean> {
  const lastSent = await getMorningEmailLastSent();
  if (!lastSent) return false;

  // Compare dates (YYYY-MM-DD format)
  const today = new Date().toISOString().split('T')[0];
  return lastSent === today;
}

/**
 * Get today's date in YYYY-MM-DD format.
 */
export function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}
