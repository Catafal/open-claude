/**
 * Resend Email Service
 *
 * Simple email sending using Resend API.
 * Much simpler than Gmail API - just needs an API key.
 */

import { Resend } from 'resend';

// Resend client instance (initialized on first use)
let resendClient: Resend | null = null;

/**
 * Initialize Resend client with API key.
 */
export function initResend(apiKey: string): void {
  resendClient = new Resend(apiKey);
  console.log('[Resend] Client initialized');
}

/**
 * Send an email using Resend.
 *
 * @param from - Sender email (must be from verified domain)
 * @param to - Recipient email
 * @param subject - Email subject
 * @param body - Email body (plain text)
 * @returns Result with success status
 */
export async function sendEmailWithResend(
  from: string,
  to: string,
  subject: string,
  body: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!resendClient) {
    return { success: false, error: 'Resend client not initialized' };
  }

  try {
    const { data, error } = await resendClient.emails.send({
      from,
      to: [to],
      subject,
      text: body
    });

    if (error) {
      console.error('[Resend] Send error:', error);
      return { success: false, error: error.message };
    }

    console.log('[Resend] Email sent successfully:', data?.id);
    return { success: true, messageId: data?.id };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Resend] Send failed:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Check if Resend is configured.
 */
export function isResendConfigured(): boolean {
  return resendClient !== null;
}
