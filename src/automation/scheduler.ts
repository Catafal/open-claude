/**
 * Automation Scheduler
 *
 * Time-based scheduler for morning email automation.
 * Features:
 * - Configurable trigger time (HH:MM format)
 * - Catch-up logic: if app wasn't open at scheduled time, runs on startup
 * - Uses Supabase to track if today's email was already sent
 */

import { runMorningEmailAutomation } from './morning-email';
import { hasSentMorningEmailToday, initAutomationSupabase } from './supabase';
import { initResend, isResendConfigured } from './resend';
import type { AutomationSettings } from './types';
import type { GoogleAccount } from '../assistant';
import type { RAGSettings } from '../rag/types';

// Scheduler state
let schedulerInterval: NodeJS.Timeout | null = null;
let lastCheckedMinute: string | null = null;
let isRunning = false;

// Settings cache
let cachedSettings: AutomationSettings | null = null;
let cachedAccount: GoogleAccount | null = null;
let cachedRagSettings: RAGSettings | null = null;
let cachedCollectionName: string = 'knowledge';

/**
 * Initialize the morning email scheduler.
 * Call this at app startup.
 *
 * @param settings - Automation settings (enabled, time, Resend config)
 * @param getAccount - Function to get the Google account by email (optional for calendar/tasks)
 * @param ragSettings - RAG settings for knowledge retrieval
 * @param collectionName - Qdrant collection name
 * @param supabaseConfig - Supabase config for state tracking
 */
export function initMorningEmailScheduler(
  settings: AutomationSettings,
  getAccount: (email: string) => GoogleAccount | undefined,
  ragSettings: RAGSettings,
  collectionName: string,
  supabaseConfig: { url: string; anonKey: string; deviceId: string }
): void {
  // Stop any existing scheduler
  stopMorningEmailScheduler();

  // Initialize Supabase for state tracking
  if (supabaseConfig.url && supabaseConfig.anonKey) {
    initAutomationSupabase(supabaseConfig.url, supabaseConfig.anonKey, supabaseConfig.deviceId);
  }

  // Initialize Resend if API key is configured
  if (settings.resendApiKey) {
    initResend(settings.resendApiKey);
  }

  // Cache settings
  cachedSettings = settings;
  cachedRagSettings = ragSettings;
  cachedCollectionName = collectionName;

  // Get the Google account (optional - for calendar/tasks/gmail reading)
  if (settings.morningEmailAccount) {
    cachedAccount = getAccount(settings.morningEmailAccount) || null;
  }

  if (!settings.morningEmailEnabled) {
    console.log('[Scheduler] Morning email disabled');
    return;
  }

  // Check Resend configuration (required for sending)
  if (!settings.resendApiKey || !settings.resendFromEmail || !settings.resendToEmail) {
    console.log('[Scheduler] Resend not configured (API key, from, or to email missing)');
    return;
  }

  console.log(`[Scheduler] Morning email enabled at ${settings.morningEmailTime}`);

  // Check for catch-up on startup (async, non-blocking)
  checkAndCatchUp();

  // Start the scheduler (checks every minute)
  schedulerInterval = setInterval(() => {
    checkScheduledTime();
  }, 60 * 1000); // Every minute

  // Also check immediately in case we're exactly at the scheduled time
  checkScheduledTime();
}

/**
 * Stop the morning email scheduler.
 */
export function stopMorningEmailScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
  lastCheckedMinute = null;
  console.log('[Scheduler] Morning email scheduler stopped');
}

/**
 * Update scheduler settings without full restart.
 */
export function updateSchedulerSettings(
  settings: AutomationSettings,
  getAccount: (email: string) => GoogleAccount | undefined
): void {
  cachedSettings = settings;

  if (settings.morningEmailAccount) {
    cachedAccount = getAccount(settings.morningEmailAccount) || null;
  } else {
    cachedAccount = null;
  }

  if (!settings.morningEmailEnabled) {
    stopMorningEmailScheduler();
  } else if (!schedulerInterval) {
    // Restart scheduler if it was stopped
    initMorningEmailScheduler(
      settings,
      getAccount,
      cachedRagSettings!,
      cachedCollectionName,
      { url: '', anonKey: '', deviceId: '' } // Supabase already initialized
    );
  }
}

/**
 * Check if it's time to run the scheduled task.
 */
async function checkScheduledTime(): Promise<void> {
  if (!cachedSettings?.morningEmailEnabled || !isResendConfigured() || isRunning) {
    return;
  }

  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Prevent running multiple times in the same minute
  if (currentTime === lastCheckedMinute) {
    return;
  }
  lastCheckedMinute = currentTime;

  // Check if it's the scheduled time
  if (currentTime === cachedSettings.morningEmailTime) {
    console.log(`[Scheduler] Scheduled time reached: ${currentTime}`);
    await runMorningEmail();
  }
}

/**
 * Check on startup if we missed the scheduled time and need to catch up.
 * Only catches up if:
 * 1. Current time is past scheduled time
 * 2. Today's email hasn't been sent yet
 */
async function checkAndCatchUp(): Promise<void> {
  if (!cachedSettings?.morningEmailEnabled || !isResendConfigured()) {
    return;
  }

  try {
    // Check Supabase first - was today's email already sent?
    const alreadySent = await hasSentMorningEmailToday();
    if (alreadySent) {
      console.log('[Scheduler] Today\'s email already sent, no catch-up needed');
      return;
    }

    // Parse scheduled time
    const [scheduledHour, scheduledMinute] = cachedSettings.morningEmailTime.split(':').map(Number);

    // Get current time
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Check if current time is past scheduled time
    const isPastScheduledTime =
      currentHour > scheduledHour ||
      (currentHour === scheduledHour && currentMinute > scheduledMinute);

    if (isPastScheduledTime) {
      console.log(`[Scheduler] Catch-up: missed scheduled time ${cachedSettings.morningEmailTime}, running now`);
      await runMorningEmail();
    } else {
      console.log(`[Scheduler] Waiting for scheduled time ${cachedSettings.morningEmailTime}`);
    }
  } catch (error) {
    console.error('[Scheduler] Catch-up check failed:', error);
  }
}

/**
 * Run the morning email automation.
 */
async function runMorningEmail(): Promise<void> {
  if (!cachedSettings || !cachedRagSettings || isRunning) {
    return;
  }

  // Validate Resend configuration
  if (!cachedSettings.resendFromEmail || !cachedSettings.resendToEmail) {
    console.error('[Scheduler] Resend from/to emails not configured');
    return;
  }

  isRunning = true;
  console.log('[Scheduler] Running morning email automation...');

  try {
    const result = await runMorningEmailAutomation(
      cachedAccount, // Can be null - Google account is optional
      cachedRagSettings,
      cachedCollectionName,
      cachedSettings.resendFromEmail,
      cachedSettings.resendToEmail
    );

    if (result.success) {
      console.log(`[Scheduler] Morning email sent successfully (ID: ${result.messageId})`);
    } else {
      console.error(`[Scheduler] Morning email failed: ${result.error}`);
    }
  } catch (error) {
    console.error('[Scheduler] Morning email error:', error);
  } finally {
    isRunning = false;
  }
}

/**
 * Manually trigger the morning email (for testing/UI).
 */
export async function triggerMorningEmailNow(): Promise<{ success: boolean; error?: string }> {
  if (!cachedSettings || !cachedRagSettings) {
    return { success: false, error: 'Automation not configured' };
  }

  if (!cachedSettings.resendFromEmail || !cachedSettings.resendToEmail) {
    return { success: false, error: 'Resend from/to emails not configured' };
  }

  if (!isResendConfigured()) {
    return { success: false, error: 'Resend API key not configured' };
  }

  if (isRunning) {
    return { success: false, error: 'Automation already running' };
  }

  const result = await runMorningEmailAutomation(
    cachedAccount, // Can be null
    cachedRagSettings,
    cachedCollectionName,
    cachedSettings.resendFromEmail,
    cachedSettings.resendToEmail
  );

  return { success: result.success, error: result.error };
}

/**
 * Get scheduler status.
 */
export function getSchedulerStatus(): {
  enabled: boolean;
  scheduledTime: string;
  account: string;
  isRunning: boolean;
} {
  return {
    enabled: cachedSettings?.morningEmailEnabled || false,
    scheduledTime: cachedSettings?.morningEmailTime || '07:30',
    account: cachedSettings?.morningEmailAccount || '',
    isRunning
  };
}
