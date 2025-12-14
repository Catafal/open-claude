/**
 * Automation Module
 *
 * Provides scheduled automation features like the morning email.
 *
 * @module automation
 */

// Types
export type {
  AutomationSettings,
  MorningEmailResult,
  AutomationState,
  MorningEmailContext
} from './types';

export { DEFAULT_AUTOMATION_SETTINGS } from './types';

// Supabase state tracking
export {
  initAutomationSupabase,
  getMorningEmailLastSent,
  setMorningEmailLastSent,
  hasSentMorningEmailToday,
  getTodayDate
} from './supabase';

// Morning email automation
export { runMorningEmailAutomation } from './morning-email';

// Resend email service
export { initResend, sendEmailWithResend, isResendConfigured } from './resend';

// Scheduler
export {
  initMorningEmailScheduler,
  stopMorningEmailScheduler,
  updateSchedulerSettings,
  triggerMorningEmailNow,
  getSchedulerStatus
} from './scheduler';
