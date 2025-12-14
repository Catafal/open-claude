/**
 * Personal Assistant Retrieval & Context Formatting
 *
 * Orchestrates the full assistant pipeline:
 * 1. Run decision agent
 * 2. Fetch data from Google services
 * 3. Format context for Claude injection
 *
 * Similar to RAG's processRagQuery (src/rag/agent.ts).
 */

import { runAssistantAgent, checkAssistantAgentHealth } from './agent';
import { getAssistantSettings, getEnabledAccounts, isAssistantReady } from './google-client';
import { getTodayEvents, getUpcomingEvents, searchEvents } from './calendar';
import { getRecentEmails, getUnreadEmails, searchEmails, getUnreadCount } from './gmail';
import { getPendingTasks, getTasksDueToday } from './tasks';
import type {
  AssistantResult,
  AssistantContext,
  AssistantDecision,
  GoogleAccount,
  CalendarEvent,
  EmailSummary,
  TaskItem
} from './types';

// =============================================================================
// Main Pipeline
// =============================================================================

/**
 * Process a user query through the assistant pipeline.
 * This is the main entry point for the assistant agent.
 *
 * @param userQuery - The user's message
 * @param ollamaModel - Ollama model for decision agent
 * @returns AssistantResult with decision, contexts, and timing
 */
export async function processAssistantQuery(
  userQuery: string,
  ollamaModel: string
): Promise<AssistantResult> {
  const startTime = Date.now();

  // Check if assistant is enabled and has accounts
  if (!isAssistantReady()) {
    console.log('[Assistant] Not ready (disabled or no accounts)');
    return {
      decision: getSkipDecision(userQuery, 'Assistant not enabled'),
      contexts: [],
      processingTimeMs: Date.now() - startTime
    };
  }

  // Check Ollama availability
  const health = await checkAssistantAgentHealth(ollamaModel);
  if (!health.available) {
    console.log(`[Assistant] Ollama not available: ${health.error}`);
    return {
      decision: getSkipDecision(userQuery, 'Ollama not available'),
      contexts: [],
      processingTimeMs: Date.now() - startTime,
      error: health.error
    };
  }

  try {
    // Step 1: Run decision agent
    console.log('[Assistant] Running decision agent...');
    const decision = await runAssistantAgent(userQuery, ollamaModel);
    console.log(`[Assistant] Decision: needs_google=${decision.needs_google}, services=${decision.services.join(',')}`);

    // Step 2: If no retrieval needed, return early
    if (!decision.needs_google || decision.services.length === 0) {
      return {
        decision,
        contexts: [],
        processingTimeMs: Date.now() - startTime
      };
    }

    // Step 3: Fetch data from requested services
    console.log('[Assistant] Fetching Google services data...');
    const contexts = await fetchServiceData(decision);

    return {
      decision,
      contexts,
      processingTimeMs: Date.now() - startTime
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Assistant] Processing error:', errorMessage);

    return {
      decision: getSkipDecision(userQuery, 'Processing error'),
      contexts: [],
      processingTimeMs: Date.now() - startTime,
      error: errorMessage
    };
  }
}

// =============================================================================
// Data Fetching
// =============================================================================

/**
 * Fetch data from Google services based on agent decision.
 */
async function fetchServiceData(decision: AssistantDecision): Promise<AssistantContext[]> {
  const accounts = getEnabledAccounts();
  const contexts: AssistantContext[] = [];

  // Process each service in parallel per account
  for (const account of accounts) {
    const servicePromises: Promise<AssistantContext | null>[] = [];

    if (decision.services.includes('calendar')) {
      servicePromises.push(fetchCalendarData(account, decision));
    }

    if (decision.services.includes('email')) {
      servicePromises.push(fetchEmailData(account, decision));
    }

    if (decision.services.includes('tasks')) {
      servicePromises.push(fetchTasksData(account, decision));
    }

    const results = await Promise.all(servicePromises);
    contexts.push(...results.filter((c): c is AssistantContext => c !== null));
  }

  return contexts;
}

/**
 * Fetch calendar events for an account.
 * Default: upcoming 14 days (more useful than just today)
 */
async function fetchCalendarData(
  account: GoogleAccount,
  decision: AssistantDecision
): Promise<AssistantContext | null> {
  try {
    let events: CalendarEvent[];

    if (decision.search_query) {
      // Search for specific events
      events = await searchEvents(account, decision.search_query);
    } else {
      // Default: get upcoming events (14 days covers "next week" queries)
      events = await getUpcomingEvents(account, 14);
    }

    if (events.length === 0) return null;

    return {
      type: 'calendar',
      account: account.email,
      data: events
    };
  } catch (error) {
    console.error(`[Assistant] Calendar fetch failed for ${account.email}:`, error);
    return null;
  }
}

/**
 * Fetch emails for an account.
 */
async function fetchEmailData(
  account: GoogleAccount,
  decision: AssistantDecision
): Promise<AssistantContext | null> {
  try {
    let emails: EmailSummary[];

    if (decision.search_query) {
      // Search for specific emails
      emails = await searchEmails(account, decision.search_query);
    } else {
      // Default: get recent unread emails
      emails = await getUnreadEmails(account);
      // If no unread, get recent inbox
      if (emails.length === 0) {
        emails = await getRecentEmails(account, 5);
      }
    }

    if (emails.length === 0) return null;

    return {
      type: 'email',
      account: account.email,
      data: emails
    };
  } catch (error) {
    console.error(`[Assistant] Email fetch failed for ${account.email}:`, error);
    return null;
  }
}

/**
 * Fetch tasks for an account.
 */
async function fetchTasksData(
  account: GoogleAccount,
  decision: AssistantDecision
): Promise<AssistantContext | null> {
  try {
    let tasks: TaskItem[];

    if (decision.time_range?.start === 'today') {
      // Get tasks due today
      tasks = await getTasksDueToday(account);
    } else {
      // Default: get all pending tasks
      tasks = await getPendingTasks(account);
    }

    if (tasks.length === 0) return null;

    return {
      type: 'tasks',
      account: account.email,
      data: tasks
    };
  } catch (error) {
    console.error(`[Assistant] Tasks fetch failed for ${account.email}:`, error);
    return null;
  }
}

// =============================================================================
// Context Formatting
// =============================================================================

/**
 * Format assistant contexts for injection into Claude prompt.
 * Uses XML wrapper for clear delineation (same pattern as RAG).
 */
export function formatAssistantContext(contexts: AssistantContext[]): string {
  if (contexts.length === 0) return '';

  const sections: string[] = [];

  for (const context of contexts) {
    const header = `[${formatServiceName(context.type)} - ${context.account}]`;
    const content = formatContextData(context);
    if (content) {
      sections.push(`${header}\n${content}`);
    }
  }

  if (sections.length === 0) return '';

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return `<personal_assistant_context>
The following is current information from the user's Google services (as of ${today}):

${sections.join('\n\n')}
</personal_assistant_context>

`;
}

/**
 * Format service name for display.
 */
function formatServiceName(type: 'calendar' | 'email' | 'tasks'): string {
  const names: Record<string, string> = {
    calendar: 'Calendar',
    email: 'Gmail',
    tasks: 'Tasks'
  };
  return names[type] || type;
}

/**
 * Format context data based on type.
 */
function formatContextData(context: AssistantContext): string {
  switch (context.type) {
    case 'calendar':
      return formatCalendarEvents(context.data as CalendarEvent[]);
    case 'email':
      return formatEmails(context.data as EmailSummary[]);
    case 'tasks':
      return formatTasks(context.data as TaskItem[]);
    default:
      return '';
  }
}

/**
 * Format calendar events for context.
 */
function formatCalendarEvents(events: CalendarEvent[]): string {
  if (events.length === 0) return 'No upcoming events.';

  return events.map(event => {
    const time = event.isAllDay
      ? 'All day'
      : formatTime(event.start) + (event.end ? ` - ${formatTime(event.end)}` : '');

    let line = `• ${time}: ${event.summary}`;
    if (event.location) line += ` (${event.location})`;
    return line;
  }).join('\n');
}

/**
 * Format emails for context.
 */
function formatEmails(emails: EmailSummary[]): string {
  if (emails.length === 0) return 'No recent emails.';

  const unreadCount = emails.filter(e => e.isUnread).length;
  const header = unreadCount > 0 ? `${unreadCount} unread:` : 'Recent:';

  const lines = emails.slice(0, 10).map(email => {
    const date = formatDate(email.date);
    const unread = email.isUnread ? ' [UNREAD]' : '';
    return `• From: ${email.from} | Subject: ${email.subject} | ${date}${unread}`;
  });

  return `${header}\n${lines.join('\n')}`;
}

/**
 * Format tasks for context.
 */
function formatTasks(tasks: TaskItem[]): string {
  if (tasks.length === 0) return 'No pending tasks.';

  // Group by list
  const byList = new Map<string, TaskItem[]>();
  for (const task of tasks) {
    const list = byList.get(task.listTitle) || [];
    list.push(task);
    byList.set(task.listTitle, list);
  }

  const sections: string[] = [];
  for (const [listTitle, listTasks] of byList) {
    const taskLines = listTasks.map(task => {
      let line = `  • ${task.title}`;
      if (task.due) line += ` (due: ${formatDate(task.due)})`;
      return line;
    });
    sections.push(`${listTitle}:\n${taskLines.join('\n')}`);
  }

  return sections.join('\n\n');
}

// =============================================================================
// Utility Helpers
// =============================================================================

/**
 * Format time from ISO string.
 */
function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    // Check if it's just a date (no time component)
    if (isoString.length === 10) {
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch {
    return isoString;
  }
}

/**
 * Format date from ISO string.
 */
function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'short' });

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return isoString;
  }
}

/**
 * Get a skip decision for error/unavailable cases.
 */
function getSkipDecision(query: string, reason: string): AssistantDecision {
  return {
    needs_google: false,
    services: [],
    reasoning: reason,
    cleaned_query: query
  };
}
