/**
 * Personal Assistant Module
 *
 * Provides Google services integration (Calendar, Gmail, Tasks)
 * for the personal assistant agent.
 *
 * @module assistant
 */

// Types
export type {
  GoogleAccount,
  AssistantSettingsStore,
  AssistantDecision,
  GoogleService,
  CalendarEvent,
  EmailSummary,
  TaskList,
  TaskItem,
  AssistantContext,
  AssistantResult,
  OAuthTokens,
  OAuthResult
} from './types';

// Google Client (OAuth & Settings)
export {
  getAssistantSettings,
  saveAssistantSettings,
  getEnabledAccounts,
  getAuthenticatedClient,
  startOAuthFlow,
  removeGoogleAccount,
  toggleAccountEnabled,
  testAccountConnection,
  isAssistantReady,
  hasValidTokens,
  getAccountsTokenStatus
} from './google-client';

// Calendar Service
export {
  getUpcomingEvents,
  getTodayEvents,
  searchEvents
} from './calendar';

// Gmail Service
export {
  getRecentEmails,
  getUnreadCount,
  searchEmails,
  getUnreadEmails,
  sendEmail  // For morning email automation
} from './gmail';

// Tasks Service
export {
  getTaskLists,
  getTasks,
  getPendingTasks,
  getTasksDueToday,
  getOverdueTasks
} from './tasks';

// Agent & Retrieval
export {
  runAssistantAgent,
  checkAssistantAgentHealth
} from './agent';

export {
  processAssistantQuery,
  formatAssistantContext
} from './retrieval';
