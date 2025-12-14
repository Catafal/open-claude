/**
 * Automation Types
 *
 * Type definitions for the morning email automation feature.
 */

// Automation settings stored in electron-store
export interface AutomationSettings {
  morningEmailEnabled: boolean;
  morningEmailTime: string; // "HH:MM" format (24h), e.g., "07:30"
  morningEmailAccount: string; // Google account email for calendar/tasks/gmail reading
  // Resend email sending
  resendApiKey: string; // Resend API key
  resendFromEmail: string; // Email to send from (must be from verified domain)
  resendToEmail: string; // Email to send to (can be any email)
}

// Default settings
export const DEFAULT_AUTOMATION_SETTINGS: AutomationSettings = {
  morningEmailEnabled: false,
  morningEmailTime: '07:30',
  morningEmailAccount: '',
  resendApiKey: '',
  resendFromEmail: '',
  resendToEmail: ''
};

// Result from sending morning email
export interface MorningEmailResult {
  success: boolean;
  error?: string;
  messageId?: string;
  sentAt?: string;
}

// State tracked in Supabase for cross-device sync
export interface AutomationState {
  userId: string;
  morningEmailLastSent: string | null; // ISO date string "YYYY-MM-DD" or null
  updatedAt: string;
}

// Context gathered for morning email generation
export interface MorningEmailContext {
  memories: string;
  knowledge: string;
  calendar: string;
  tasks: string;
  emails: string;
}
