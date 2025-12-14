/**
 * Morning Email Automation
 *
 * Gathers context from memories, knowledge, and Google services,
 * sends to Claude for a personalized morning message, then emails the response.
 */

import { getMemoriesForContext } from '../memory/retrieval';
import { processRagQuery, formatContextForClaude } from '../rag/agent';
import { getTodayEvents, getPendingTasks, getUnreadEmails } from '../assistant';
import type { GoogleAccount } from '../assistant';
import type { RAGSettings } from '../rag/types';
import type { MorningEmailResult, MorningEmailContext } from './types';
import { makeRequest, getOrgId, isAuthenticated, streamCompletion } from '../api/client';
import { hasSentMorningEmailToday, setMorningEmailLastSent, getTodayDate } from './supabase';
import { sendEmailWithResend } from './resend';

// Morning email prompt template
const MORNING_EMAIL_PROMPT = `You are a personal assistant sending a morning email.
Based on the context provided (memories, knowledge, calendar, tasks, emails), generate a personalized morning message.

The email should include:
1. A motivational phrase to start the day
2. What tasks I should tackle today (based on calendar events and pending tasks)
3. A reminder about something interesting from my knowledge base

Keep it concise, friendly, and actionable. Format as plain text email (no HTML).
Do not include a subject line - just the email body.
Keep it under 300 words.`;

/**
 * Run the morning email automation.
 * Gathers context, sends to Claude, and emails the response via Resend.
 *
 * @param account - Google account for calendar/tasks/gmail reading (optional)
 * @param ragSettings - RAG settings for knowledge retrieval
 * @param collectionName - Qdrant collection name for memories/knowledge
 * @param resendFromEmail - Email to send from (must be from verified Resend domain)
 * @param resendToEmail - Email to send to
 * @returns Result with success status and any error
 */
export async function runMorningEmailAutomation(
  account: GoogleAccount | null,
  ragSettings: RAGSettings,
  collectionName: string,
  resendFromEmail: string,
  resendToEmail: string
): Promise<MorningEmailResult> {
  console.log('[Morning Email] Starting automation...');

  try {
    // Step 1: Check if already sent today (Supabase)
    const alreadySent = await hasSentMorningEmailToday();
    if (alreadySent) {
      console.log('[Morning Email] Already sent today, skipping');
      return { success: true, sentAt: getTodayDate() };
    }

    // Step 2: Check authentication
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      console.error('[Morning Email] Not authenticated with Claude');
      return { success: false, error: 'Not authenticated with Claude' };
    }

    // Step 3: Gather context (parallel)
    console.log('[Morning Email] Gathering context...');
    const context = await gatherContext(account, ragSettings, collectionName);

    // Step 4: Generate email with Claude
    console.log('[Morning Email] Generating email with Claude...');
    const emailBody = await generateEmailWithClaude(context);

    if (!emailBody) {
      return { success: false, error: 'Failed to generate email content' };
    }

    // Step 5: Send email via Resend
    console.log('[Morning Email] Sending email via Resend...');
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
    const subject = `Good Morning! - ${today}`;

    const result = await sendEmailWithResend(resendFromEmail, resendToEmail, subject, emailBody);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Step 6: Mark as sent in Supabase
    await setMorningEmailLastSent(getTodayDate());

    console.log('[Morning Email] Automation completed successfully');
    return {
      success: true,
      messageId: result.messageId,
      sentAt: new Date().toISOString()
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Morning Email] Automation error:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Gather context from all sources for the morning email.
 */
async function gatherContext(
  account: GoogleAccount | null,
  ragSettings: RAGSettings,
  collectionName: string
): Promise<MorningEmailContext> {
  // Gather all context in parallel
  const [memories, knowledge, calendar, tasks, emails] = await Promise.all([
    // Memories - search for productivity/morning related
    gatherMemories(collectionName),
    // Knowledge - RAG query
    gatherKnowledge(ragSettings, collectionName),
    // Calendar - today's events (requires Google account)
    account ? gatherCalendar(account) : Promise.resolve('No Google account configured.'),
    // Tasks - pending tasks (requires Google account)
    account ? gatherTasks(account) : Promise.resolve('No Google account configured.'),
    // Emails - unread emails (requires Google account)
    account ? gatherEmails(account) : Promise.resolve('No Google account configured.')
  ]);

  return { memories, knowledge, calendar, tasks, emails };
}

/**
 * Gather memories for morning context.
 */
async function gatherMemories(collectionName: string): Promise<string> {
  try {
    // Search for productivity/routine related memories
    const memories = await getMemoriesForContext(
      'morning routine productivity goals priorities',
      collectionName,
      5,
      0.3
    );
    return memories || 'No relevant memories found.';
  } catch (error) {
    console.error('[Morning Email] Memory gathering failed:', error);
    return 'No memories available.';
  }
}

/**
 * Gather knowledge for morning context.
 */
async function gatherKnowledge(settings: RAGSettings, collectionName: string): Promise<string> {
  try {
    if (!settings.enabled) {
      return 'Knowledge retrieval disabled.';
    }
    const result = await processRagQuery(
      'daily tips insights interesting facts',
      collectionName,
      settings
    );
    if (result.contexts.length > 0) {
      return formatContextForClaude(result.contexts);
    }
    return 'No relevant knowledge found.';
  } catch (error) {
    console.error('[Morning Email] Knowledge gathering failed:', error);
    return 'No knowledge available.';
  }
}

/**
 * Gather today's calendar events.
 */
async function gatherCalendar(account: GoogleAccount): Promise<string> {
  try {
    const events = await getTodayEvents(account);
    if (events.length === 0) {
      return 'No calendar events today.';
    }
    const formatted = events.map(e => {
      const time = e.isAllDay ? 'All day' : formatTime(e.start);
      return `- ${time}: ${e.summary}${e.location ? ` (${e.location})` : ''}`;
    }).join('\n');
    return `Today's events:\n${formatted}`;
  } catch (error) {
    console.error('[Morning Email] Calendar gathering failed:', error);
    return 'Calendar not available.';
  }
}

/**
 * Gather pending tasks.
 */
async function gatherTasks(account: GoogleAccount): Promise<string> {
  try {
    const tasks = await getPendingTasks(account);
    if (tasks.length === 0) {
      return 'No pending tasks.';
    }
    const formatted = tasks.slice(0, 10).map(t => {
      const due = t.due ? ` (due: ${formatDate(t.due)})` : '';
      return `- ${t.title}${due}`;
    }).join('\n');
    return `Pending tasks:\n${formatted}`;
  } catch (error) {
    console.error('[Morning Email] Tasks gathering failed:', error);
    return 'Tasks not available.';
  }
}

/**
 * Gather recent unread emails.
 */
async function gatherEmails(account: GoogleAccount): Promise<string> {
  try {
    const emails = await getUnreadEmails(account, 5);
    if (emails.length === 0) {
      return 'No unread emails.';
    }
    const formatted = emails.map(e => {
      return `- From: ${e.from} | Subject: ${e.subject}`;
    }).join('\n');
    return `Unread emails:\n${formatted}`;
  } catch (error) {
    console.error('[Morning Email] Email gathering failed:', error);
    return 'Emails not available.';
  }
}

/**
 * Generate the email content using Claude API.
 */
async function generateEmailWithClaude(context: MorningEmailContext): Promise<string | null> {
  try {
    const orgId = await getOrgId();
    if (!orgId) {
      throw new Error('Not authenticated');
    }

    // Build the full prompt with context
    const fullPrompt = `${MORNING_EMAIL_PROMPT}

<context>
<memories>
${context.memories}
</memories>

<knowledge>
${context.knowledge}
</knowledge>

<calendar>
${context.calendar}
</calendar>

<tasks>
${context.tasks}
</tasks>

<emails>
${context.emails}
</emails>
</context>

Generate the morning email now:`;

    // Create a temporary conversation
    const createResponse = await makeRequest(
      `https://claude.ai/api/organizations/${orgId}/chat_conversations`,
      'POST',
      { name: 'Morning Email Generation' }
    );

    if (createResponse.status !== 200 && createResponse.status !== 201) {
      throw new Error(`Failed to create conversation: ${createResponse.status}`);
    }

    const conversationData = createResponse.data as { uuid: string };
    const conversationId = conversationData.uuid;

    // Collect the full response
    let fullText = '';
    let chunkCount = 0;
    const eventTypes: string[] = [];

    await streamCompletion(
      orgId,
      conversationId,
      fullPrompt,
      conversationId, // parent = conversation id for first message
      (chunk) => {
        chunkCount++;
        // Parse SSE data - handle multiple lines in a single chunk
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              // Track event types for debugging
              if (data.type && !eventTypes.includes(data.type)) {
                eventTypes.push(data.type);
              }
              // Handle text_delta within content_block_delta
              if (data.type === 'content_block_delta') {
                const delta = data.delta as { type?: string; text?: string } | undefined;
                if (delta?.type === 'text_delta' && delta.text) {
                  fullText += delta.text;
                }
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    );

    console.log(`[Morning Email] Stream: ${chunkCount} chunks, text length: ${fullText.length}, events: ${eventTypes.join(', ')}`);

    // Cleanup: Delete the temporary conversation
    try {
      await makeRequest(
        `https://claude.ai/api/organizations/${orgId}/chat_conversations/${conversationId}`,
        'DELETE'
      );
    } catch {
      // Ignore cleanup errors
    }

    if (!fullText.trim()) {
      console.error('[Morning Email] Claude returned empty response');
      return null;
    }

    return fullText.trim();
  } catch (error) {
    console.error('[Morning Email] Claude generation failed:', error);
    return null;
  }
}

// =============================================================================
// Utility Helpers
// =============================================================================

function formatTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
  } catch {
    return isoString;
  }
}

function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return isoString;
  }
}
