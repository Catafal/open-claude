/**
 * Gmail Service
 *
 * Provides email retrieval for the Personal Assistant Agent.
 * All operations are readonly - no sending/modifying emails.
 */

import { google } from 'googleapis';
import { getAuthenticatedClient } from './google-client';
import type { GoogleAccount, EmailSummary } from './types';

// Default number of emails to fetch
const DEFAULT_MAX_EMAILS = 10;

// Max emails to prevent context overflow
const MAX_EMAILS_LIMIT = 25;

// =============================================================================
// Email Retrieval
// =============================================================================

/**
 * Get recent inbox emails.
 *
 * @param account - Google account to query
 * @param maxEmails - Maximum emails to return (default: 10)
 */
export async function getRecentEmails(
  account: GoogleAccount,
  maxEmails: number = DEFAULT_MAX_EMAILS
): Promise<EmailSummary[]> {
  try {
    const auth = await getAuthenticatedClient(account);
    const gmail = google.gmail({ version: 'v1', auth });

    // List message IDs from inbox
    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      maxResults: Math.min(maxEmails, MAX_EMAILS_LIMIT),
      labelIds: ['INBOX']
    });

    const messages = listResponse.data.messages || [];
    console.log(`[Gmail] Found ${messages.length} recent emails for ${account.email}`);

    // Fetch message details in parallel
    const emailPromises = messages.map(msg =>
      getMessageDetails(gmail, msg.id || '')
    );

    const emails = await Promise.all(emailPromises);
    return emails.filter((e): e is EmailSummary => e !== null);
  } catch (error) {
    console.error(`[Gmail] Error fetching emails for ${account.email}:`, error);
    throw error;
  }
}

/**
 * Get unread email count.
 */
export async function getUnreadCount(account: GoogleAccount): Promise<number> {
  try {
    const auth = await getAuthenticatedClient(account);
    const gmail = google.gmail({ version: 'v1', auth });

    const response = await gmail.users.labels.get({
      userId: 'me',
      id: 'UNREAD'
    });

    return response.data.messagesUnread || 0;
  } catch (error) {
    console.error(`[Gmail] Error getting unread count for ${account.email}:`, error);
    return 0;  // Return 0 on error to avoid breaking the flow
  }
}

/**
 * Search emails by query.
 *
 * @param account - Google account to query
 * @param query - Gmail search query (supports Gmail search operators)
 * @param maxEmails - Maximum emails to return (default: 10)
 */
export async function searchEmails(
  account: GoogleAccount,
  query: string,
  maxEmails: number = DEFAULT_MAX_EMAILS
): Promise<EmailSummary[]> {
  try {
    const auth = await getAuthenticatedClient(account);
    const gmail = google.gmail({ version: 'v1', auth });

    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      maxResults: Math.min(maxEmails, MAX_EMAILS_LIMIT),
      q: query
    });

    const messages = listResponse.data.messages || [];
    console.log(`[Gmail] Search "${query}" found ${messages.length} emails for ${account.email}`);

    const emailPromises = messages.map(msg =>
      getMessageDetails(gmail, msg.id || '')
    );

    const emails = await Promise.all(emailPromises);
    return emails.filter((e): e is EmailSummary => e !== null);
  } catch (error) {
    console.error(`[Gmail] Error searching emails for ${account.email}:`, error);
    throw error;
  }
}

/**
 * Get unread emails only.
 */
export async function getUnreadEmails(
  account: GoogleAccount,
  maxEmails: number = DEFAULT_MAX_EMAILS
): Promise<EmailSummary[]> {
  return searchEmails(account, 'is:unread', maxEmails);
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Get detailed message information.
 */
async function getMessageDetails(
  gmail: ReturnType<typeof google.gmail>,
  messageId: string
): Promise<EmailSummary | null> {
  if (!messageId) return null;

  try {
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'metadata',          // Only get headers, not full body
      metadataHeaders: ['From', 'To', 'Subject', 'Date']
    });

    const message = response.data;
    const headers = message.payload?.headers || [];

    // Extract headers
    const from = getHeader(headers, 'From') || '';
    const to = getHeader(headers, 'To') || '';
    const subject = getHeader(headers, 'Subject') || '(No subject)';
    const dateStr = getHeader(headers, 'Date') || '';

    // Parse labels
    const labelIds = message.labelIds || [];
    const isUnread = labelIds.includes('UNREAD');
    const labels = labelIds.filter(l => !['UNREAD', 'INBOX', 'SENT'].includes(l));

    // Check for attachments (simplified check)
    const hasAttachments = message.payload?.parts?.some(
      part => part.filename && part.filename.length > 0
    ) || false;

    return {
      id: message.id || '',
      threadId: message.threadId || '',
      from: parseEmailAddress(from),
      to: to.split(',').map(t => parseEmailAddress(t.trim())),
      subject,
      snippet: message.snippet || '',
      date: parseDate(dateStr),
      isUnread,
      hasAttachments,
      labels
    };
  } catch (error) {
    console.error(`[Gmail] Error getting message ${messageId}:`, error);
    return null;
  }
}

/**
 * Get header value by name.
 */
function getHeader(
  headers: Array<{ name?: string | null; value?: string | null }>,
  name: string
): string | undefined {
  const header = headers.find(h => h.name?.toLowerCase() === name.toLowerCase());
  return header?.value || undefined;
}

/**
 * Parse email address from "Name <email>" format.
 */
function parseEmailAddress(raw: string): string {
  // Handle "Display Name <email@example.com>" format
  const match = raw.match(/<([^>]+)>/);
  if (match) return match[1];

  // Handle plain email
  return raw.trim();
}

/**
 * Parse date string to ISO format.
 */
function parseDate(dateStr: string): string {
  try {
    return new Date(dateStr).toISOString();
  } catch {
    return dateStr;  // Return as-is if parsing fails
  }
}
