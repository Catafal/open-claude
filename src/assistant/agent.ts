/**
 * Personal Assistant Decision Agent
 *
 * Uses Ollama to analyze user queries and decide if Google services
 * data is needed. Follows the same pattern as RAG agent (src/rag/agent.ts).
 */

import { ollamaChat, checkOllamaHealth } from '../rag/ollama';
import type { AssistantDecision, GoogleService } from './types';

// =============================================================================
// System Prompt
// =============================================================================

/**
 * System prompt that guides the agent's decision-making.
 * Determines when to fetch calendar, email, or tasks data.
 */
const AGENT_SYSTEM_PROMPT = `You are a Personal Assistant decision agent. Your task is to analyze user queries and decide if they need information from the user's Google services (Calendar, Gmail, Tasks).

## Your Responsibilities:
1. Determine if the query needs data from Google services
2. Identify which specific services are relevant
3. Extract time ranges or search queries when applicable
4. ALWAYS rewrite the query to remove assistant/calendar/email references

## When to Fetch Calendar (services includes "calendar"):
- Questions about schedule, meetings, appointments, events
- "What's on my calendar?", "Do I have any meetings today?"
- "When is my next meeting with X?"
- "Am I free on Friday?"
- Any time-related scheduling questions

## When to Fetch Email (services includes "email"):
- Questions about recent messages, inbox, emails
- "Any new emails?", "Did X email me?"
- "What emails did I get from Y?"
- Looking for specific email content or senders

## When to Fetch Tasks (services includes "tasks"):
- Questions about to-dos, tasks, task lists
- "What tasks do I have?", "What's on my to-do list?"
- "What's due this week?"
- "Did I complete X?"

## When NOT to Fetch (needs_google: false):
- General knowledge questions unrelated to personal data
- Coding help, creative writing, explanations
- Casual conversation
- Questions about Claude's capabilities
- Math, translations, definitions

## Output Requirements:
- Return valid JSON matching the schema
- services array can have multiple values: ["calendar", "email", "tasks"]
- time_range is optional - use for calendar queries with specific dates
- search_query is optional - use for email/event searches
- cleaned_query removes ALL references to calendar/email/tasks so Claude won't try to search again

## Examples:

Query: "What meetings do I have tomorrow?"
{
  "needs_google": true,
  "services": ["calendar"],
  "reasoning": "User asking about scheduled meetings",
  "time_range": { "start": "tomorrow", "end": "tomorrow" },
  "cleaned_query": "What meetings do I have?"
}

Query: "Did John send me an email about the project?"
{
  "needs_google": true,
  "services": ["email"],
  "reasoning": "User looking for specific email from John",
  "search_query": "from:john project",
  "cleaned_query": "Did John contact me about the project?"
}

Query: "What's on my plate for this week?"
{
  "needs_google": true,
  "services": ["calendar", "tasks"],
  "reasoning": "User asking about weekly commitments - check calendar and tasks",
  "time_range": { "start": "today", "end": "+7 days" },
  "cleaned_query": "What do I need to do this week?"
}

Query: "Explain how async/await works in JavaScript"
{
  "needs_google": false,
  "services": [],
  "reasoning": "Technical question, no personal data needed",
  "cleaned_query": "Explain how async/await works in JavaScript"
}`;

// =============================================================================
// Keyword-Based Detection (Fallback)
// =============================================================================

/**
 * Keywords that strongly indicate Google service queries.
 * Used as fallback when Ollama doesn't detect properly.
 */
const CALENDAR_KEYWORDS = [
  'meeting', 'meetings', 'calendar', 'schedule', 'appointment', 'appointments',
  'event', 'events', 'busy', 'free', 'available', 'availability', 'booked'
];

const EMAIL_KEYWORDS = [
  'email', 'emails', 'mail', 'inbox', 'message', 'messages', 'sent',
  'unread', 'received', 'gmail'
];

const TASK_KEYWORDS = [
  'task', 'tasks', 'todo', 'to-do', 'to do', 'reminder', 'reminders',
  'due', 'pending', 'checklist'
];

/**
 * Detect services based on keywords in the query.
 * Returns services array if keywords found, empty array otherwise.
 */
function detectServicesByKeywords(query: string): GoogleService[] {
  const lowerQuery = query.toLowerCase();
  const services: GoogleService[] = [];

  if (CALENDAR_KEYWORDS.some(kw => lowerQuery.includes(kw))) {
    services.push('calendar');
  }
  if (EMAIL_KEYWORDS.some(kw => lowerQuery.includes(kw))) {
    services.push('email');
  }
  if (TASK_KEYWORDS.some(kw => lowerQuery.includes(kw))) {
    services.push('tasks');
  }

  return services;
}

// =============================================================================
// Agent Decision
// =============================================================================

/**
 * Run the assistant agent to decide on Google services retrieval.
 * Uses keyword detection as primary method, with Ollama for refinement.
 *
 * @param userQuery - The user's message
 * @param model - Ollama model to use
 */
export async function runAssistantAgent(
  userQuery: string,
  model: string
): Promise<AssistantDecision> {
  // First: Keyword-based detection (reliable)
  const keywordServices = detectServicesByKeywords(userQuery);

  // If keywords detected, use them directly (more reliable than small LLMs)
  if (keywordServices.length > 0) {
    console.log(`[Assistant Agent] Keyword detection: ${keywordServices.join(', ')}`);
    return {
      needs_google: true,
      services: keywordServices,
      reasoning: `Keyword detection found: ${keywordServices.join(', ')}`,
      cleaned_query: userQuery
    };
  }

  // Fallback: Try Ollama for more nuanced queries
  const messages = [
    { role: 'system', content: AGENT_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Analyze this user query and decide if Google services data is needed.

User Query: "${userQuery}"

Return your decision as JSON with: needs_google, services, reasoning, time_range (optional), search_query (optional), cleaned_query`
    }
  ];

  try {
    const response = await ollamaChat(model, messages, userQuery);
    return validateDecision(response, userQuery);
  } catch (error) {
    console.error('[Assistant Agent] Ollama error:', error);
    return getDefaultDecision(userQuery);
  }
}

/**
 * Check if Ollama is available for the assistant agent.
 */
export async function checkAssistantAgentHealth(model: string): Promise<{ available: boolean; error?: string }> {
  return checkOllamaHealth(model);
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Validate agent decision, ensuring required fields.
 */
function validateDecision(
  decision: Partial<AssistantDecision>,
  originalQuery: string
): AssistantDecision {
  return {
    needs_google: decision.needs_google ?? false,
    services: validateServices(decision.services),
    reasoning: decision.reasoning || 'No reasoning provided',
    time_range: decision.time_range,
    search_query: decision.search_query,
    cleaned_query: decision.cleaned_query || originalQuery
  };
}

/**
 * Validate services array.
 */
function validateServices(services: unknown): GoogleService[] {
  if (!Array.isArray(services)) return [];

  const validServices: GoogleService[] = ['calendar', 'email', 'tasks'];
  return services.filter((s): s is GoogleService =>
    typeof s === 'string' && validServices.includes(s as GoogleService)
  );
}

/**
 * Get default decision (no retrieval) for error cases.
 */
function getDefaultDecision(originalQuery: string): AssistantDecision {
  return {
    needs_google: false,
    services: [],
    reasoning: 'Default decision (agent unavailable)',
    cleaned_query: originalQuery
  };
}
