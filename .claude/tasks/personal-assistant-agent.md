# Personal Assistant Agent - Google Services Integration

## Task
Add a Personal Assistant Agent that connects to Google services (Gmail, Calendar, Tasks) with multi-account support.

## Reasoning
- Follows same pattern as RAG/Memory agents (proven architecture)
- Uses Ollama for decision-making (consistent with existing approach)
- Direct Google APIs for simplicity (no MCP protocol overhead)
- Readonly APIs only for safety

## Implementation Plan

### 1. Types & Settings
- Create `src/assistant/types.ts` with interfaces
- Update `src/types/index.ts` with AssistantSettingsStore

### 2. Google OAuth Client
- Handle OAuth2 flow via Electron BrowserWindow
- Token refresh logic
- Multi-account management

### 3. Service Modules
- Calendar: events fetch, search
- Gmail: emails fetch, search, unread count
- Tasks: lists and tasks fetch

### 4. Decision Agent
- Ollama-based query analysis
- Determines if query needs Google data

### 5. Retrieval & Formatting
- Main pipeline (like RAG's processRagQuery)
- XML context formatting

### 6. Main Integration
- IPC handlers
- Chat flow integration

### 7. Settings UI
- Account management section

## Files Created
- [ ] src/assistant/types.ts
- [ ] src/assistant/google-client.ts
- [ ] src/assistant/calendar.ts
- [ ] src/assistant/gmail.ts
- [ ] src/assistant/tasks.ts
- [ ] src/assistant/agent.ts
- [ ] src/assistant/retrieval.ts
- [ ] src/assistant/index.ts

## Files Modified
- [ ] src/types/index.ts
- [ ] src/main.ts
- [ ] src/preload.ts
- [ ] static/settings.html

## Progress Log

### Implementation Complete (Dec 14, 2024)

**Files Created:**
- `src/assistant/types.ts` - Type definitions (GoogleAccount, AssistantDecision, CalendarEvent, EmailSummary, TaskItem, etc.)
- `src/assistant/google-client.ts` - OAuth2 flow, token management, multi-account support
- `src/assistant/calendar.ts` - Google Calendar API wrapper (getUpcomingEvents, getTodayEvents, searchEvents)
- `src/assistant/gmail.ts` - Gmail API wrapper (getRecentEmails, searchEmails, getUnreadCount)
- `src/assistant/tasks.ts` - Google Tasks API wrapper (getTaskLists, getPendingTasks, getTasksDueToday)
- `src/assistant/agent.ts` - Ollama-based decision agent (determines if query needs Google data)
- `src/assistant/retrieval.ts` - Main pipeline (processAssistantQuery) and context formatting
- `src/assistant/index.ts` - Module exports

**Files Modified:**
- `src/types/index.ts` - Added GoogleAccount and AssistantSettingsStore interfaces, added to StoreSchema
- `src/main.ts` - Added imports, IPC handlers, integrated into chat flow (after RAG processing)
- `src/preload.ts` - Added IPC bridge functions for assistant operations
- `src/renderer/settings.ts` - Added assistant settings management UI logic
- `static/settings.html` - Added Personal Assistant settings section with account management UI
- `static/styles/settings.css` - Added styles for accounts list and assistant UI

**Key Features:**
1. Multi-account Google OAuth2 support
2. Decision agent using Ollama (same model as RAG)
3. Context injection via XML format (like existing memory/knowledge)
4. Non-blocking - errors don't stop chat flow
5. Settings UI for enabling/disabling and managing Google accounts

**Build Status:** ✅ Success

### UI Fix (Dec 14, 2024)

**Issue:** Personal Assistant section was not visible in the main app's settings sidebar.

**Root Cause:** The settings UI was added to `static/settings.html` (the separate Settings window), but the user was looking at the main app's sidebar settings which is in `static/index.html`.

**Fix Applied:**
1. Added Personal Assistant section to `static/index.html` (lines 2689-2725) - between Memory and Cloud Sync sections
2. Added JavaScript handlers in `src/renderer/main.ts`:
   - `loadAssistantSettings()` - loads settings and renders accounts
   - `saveAssistantSettings()` - saves enable toggle
   - `renderAssistantAccounts()` - renders connected accounts with toggle/remove buttons
   - `addGoogleAccount()` - triggers OAuth flow
3. Added CSS styles in `static/styles/knowledge.css` for `.assistant-accounts-list` and `.assistant-account-item`

**Files Modified:**
- `static/index.html` - Added Personal Assistant collapsible section
- `src/renderer/main.ts` - Added 4 assistant functions and event listeners
- `static/styles/knowledge.css` - Added styles for accounts list

**Build Status:** ✅ Success

### Modal UX Improvement (Dec 14, 2024)

**Task:** Move Google OAuth credentials (Client ID, Client Secret) from inline settings fields to a modal popup that appears when clicking "+ Add Google Account". Credentials should be synced to Supabase.

**Changes Made:**

1. **`static/index.html`**
   - Removed inline Client ID/Secret input fields from Personal Assistant section
   - Added Google Account modal (reuses `.import-modal` pattern from Notion modal)
   - Modal includes: Client ID field, Client Secret field, hint link to Google Cloud Console

2. **`src/renderer/main.ts`**
   - Removed `saveAssistantCredentials()` function
   - Added `showGoogleAccountModal()` - opens modal, pre-fills credentials if they exist
   - Added `hideGoogleAccountModal()` - closes modal
   - Added `connectGoogleAccount()` - validates inputs, saves credentials, triggers OAuth flow
   - Updated event listeners for modal interactions

3. **`src/settings/settings-sync.ts`**
   - Added `CloudAssistantSettings` interface (credentials only, NOT tokens for security)
   - Added `assistant_settings` to `CloudSettings` and `UserSettingsRow` interfaces
   - Updated `loadSettingsFromCloud()` to include assistant_settings
   - Updated `saveSettingsToCloud()` to include assistant_settings

4. **`src/main.ts`**
   - Updated `settings-sync-push` handler to include assistant credentials (excludes googleAccounts tokens)
   - Updated `settings-sync-pull` handler to restore assistant credentials from cloud

5. **`static/styles/knowledge.css`**
   - Added `.modal-description` style for modal hint text

**User Flow:**
1. User clicks "+ Add Google Account" button
2. Modal opens (pre-fills credentials if they exist)
3. User enters Client ID and Client Secret
4. User clicks "Connect"
5. Credentials saved to electron-store
6. OAuth flow starts in new BrowserWindow
7. On success: Modal closes, accounts list refreshes
8. On "Push to Cloud": Credentials sync to Supabase (tokens excluded for security)

**Build Status:** ✅ Success

### Bug Fix: Modal Not Visible (Dec 14, 2024)

**Issue:** Clicking "+ Add Google Account" in Settings did nothing - modal was invisible.

**Root Cause:** The `google-account-modal` was placed INSIDE the `#knowledge` container, which has `display: none` when not active. Even with `position: fixed`, a child of a `display: none` parent is not rendered.

**Fix:** Moved the modal outside all view containers (after `#prompts`, before `#settings`) to the document level where it's always accessible.

**File Modified:** `static/index.html`
- Removed modal from inside `#knowledge` (was line 2433-2458)
- Added modal at document level (now line 2484-2509)

**Build Status:** ✅ Success

### Reconnect Button Feature (Dec 14, 2024)

**Task:** Add "Reconnect" button for accounts that need re-authentication (e.g., on new devices where tokens aren't synced).

**Changes Made:**

1. **`src/assistant/google-client.ts`**
   - Added `hasValidTokens(email)` - checks if account has refresh token
   - Added `getAccountsTokenStatus()` - returns token status for all accounts

2. **`src/assistant/index.ts`**
   - Exported new functions

3. **`src/main.ts`**
   - Added import for `getAccountsTokenStatus`
   - Added IPC handler `assistant-get-accounts-token-status`

4. **`src/preload.ts`**
   - Added `assistantGetAccountsTokenStatus` bridge function

5. **`src/renderer/main.ts`**
   - Updated `loadAssistantSettings()` to fetch token status
   - Updated `renderAssistantAccounts()` to show:
     - "Needs Reconnect" status (yellow) when tokens missing
     - "Reconnect" button instead of Enable/Disable
   - Added reconnect handler that triggers OAuth flow

6. **`static/styles/knowledge.css`**
   - Added `.account-status.needs-reconnect` style (yellow/warning)
   - Added `.btn-reconnect` button style

**UI Behavior:**
- Token valid: `Active` | `Disable` | `Remove`
- Token missing/expired: `Needs Reconnect` | `Reconnect` | `Remove`

**New Device Flow:**
1. Pull from Cloud → Settings restored, accounts list shows emails
2. Accounts show "Needs Reconnect" (no tokens synced)
3. Click "Reconnect" → OAuth popup opens
4. Log in → Account now active with fresh tokens

**Build Status:** ✅ Success

### Spotlight Integration (Dec 14, 2024)

**Issue:** Personal Assistant was only integrated into the main chat, not the Spotlight.

**Fix:** Added assistant processing to `spotlight-send` handler in `src/main.ts`:
- Added `assistantContext` variable
- Added assistant processing block (same logic as main chat)
- Updated all `finalPrompt` constructions to include `assistantContext`
- Added `spotlight-assistant` IPC events for UI feedback

**Build Status:** ✅ Success

### Startup Loading Fix (Dec 14, 2024)

**Issue:** Personal Assistant wasn't triggering despite being enabled. No `[Assistant/Spotlight]` logs appearing.

**Root Cause:** The `assistantSettings` variable was initialized with defaults (`enabled: false`) but never loaded from `electron-store` at app startup. When checking `assistantSettings.enabled`, it was always false.

**Fix:** Added startup loading in `src/main.ts` (in `app.whenReady()`):
```typescript
// Load Assistant settings at startup
const assistantStored = store.get('assistantSettings') as AssistantSettingsStore | undefined;
if (assistantStored) {
  assistantSettings = { ...DEFAULT_ASSISTANT_SETTINGS, ...assistantStored };
  console.log(`[Assistant] Settings loaded (enabled: ${assistantSettings.enabled}, accounts: ${assistantSettings.googleAccounts?.length || 0})`);
}
```

**Expected Logs on Startup:**
- `[Assistant] Settings loaded (enabled: true, accounts: 2)`

**Expected Logs on Query:**
- `[Assistant/Spotlight] Injected context from services: calendar, tasks, gmail`

**Build Status:** ✅ Success

### Keyword Detection Fix (Dec 14, 2024)

**Issue:** Ollama (`ministral-3:3b`) returned `needs_google=false` for obvious queries like "do i have any meetings next week?".

**Root Cause:** Small LLM not reliably following the JSON schema prompt.

**Fix:** Added keyword-based detection as PRIMARY method in `src/assistant/agent.ts`:
```typescript
const CALENDAR_KEYWORDS = ['meeting', 'meetings', 'calendar', 'schedule', ...];
const EMAIL_KEYWORDS = ['email', 'emails', 'mail', 'inbox', ...];
const TASK_KEYWORDS = ['task', 'tasks', 'todo', 'reminder', ...];

function detectServicesByKeywords(query: string): GoogleService[] {
  // Check keywords, return detected services
}

export async function runAssistantAgent(userQuery, model) {
  // First: Keyword-based detection (reliable)
  const keywordServices = detectServicesByKeywords(userQuery);
  if (keywordServices.length > 0) {
    return { needs_google: true, services: keywordServices, ... };
  }
  // Fallback: Ollama for nuanced queries
  ...
}
```

**Logic:** Keywords are checked FIRST (reliable), Ollama only used for nuanced queries without obvious keywords.

**Build Status:** ✅ Success

### Calendar Fetch Fix (Dec 14, 2024)

**Issue:** Calendar queries fetched "today's events" instead of "upcoming events", so "meetings next week" returned nothing.

**Root Cause:** In `fetchCalendarData()`, keyword detection doesn't set `time_range`, so it fell to the default case which called `getTodayEvents()`.

**Fix:** Changed default calendar fetch to `getUpcomingEvents(account, 14)` (14 days covers "next week" queries).

**File Modified:** `src/assistant/retrieval.ts`

**Build Status:** ✅ Success

### Morning Email Automation (Dec 14, 2024)

**Feature:** Daily morning email automation that gathers context from memories, knowledge, calendar, tasks, and emails, sends to Claude for personalized content, then emails to self.

**Files Created:**
- `src/automation/types.ts` - Type definitions
- `src/automation/supabase.ts` - Supabase state tracking (cross-device sync)
- `src/automation/morning-email.ts` - Core automation logic
- `src/automation/scheduler.ts` - Time-based scheduler with catch-up
- `src/automation/index.ts` - Module exports

**Files Modified:**
- `src/assistant/google-client.ts` - Added `gmail.send` OAuth scope
- `src/assistant/gmail.ts` - Added `sendEmail()` function
- `src/assistant/index.ts` - Exported sendEmail
- `src/types/index.ts` - Added AutomationSettingsStore
- `src/main.ts` - Added automation initialization and IPC handlers
- `src/preload.ts` - Added automation IPC bridge functions
- `static/index.html` - Added Automations settings section
- `src/renderer/main.ts` - Added automation UI handlers

**Key Features:**
1. Gmail send capability via `gmail.send` OAuth scope
2. Supabase state tracking (won't send twice per day)
3. Catch-up logic on startup (if app wasn't open at scheduled time)
4. Configurable time and account in Settings UI
5. "Send Now" button for testing

**User Notes:**
- Requires Supabase configuration for state tracking
- App must be running for scheduler to work

**Build Status:** ✅ Success

### Resend Email Integration (Dec 14, 2024)

**Issue:** Gmail OAuth token refresh was failing with `unauthorized_client` error, making email sending unreliable.

**Solution:** Switched from Gmail API to [Resend](https://resend.com) for email sending. Resend only needs an API key - no OAuth required.

**Files Created:**
- `src/automation/resend.ts` - Simple Resend client (initResend, sendEmailWithResend, isResendConfigured)

**Files Modified:**
- `src/automation/types.ts` - Added resendApiKey, resendFromEmail, resendToEmail to AutomationSettings
- `src/automation/morning-email.ts` - Use Resend instead of Gmail, Google account now optional (for context only)
- `src/automation/scheduler.ts` - Check Resend config instead of Google account, initialize Resend client
- `src/automation/index.ts` - Export Resend functions
- `src/types/index.ts` - Added Resend fields to AutomationSettingsStore
- `src/main.ts` - Check Resend config for scheduler initialization
- `src/preload.ts` - Added Resend fields to automationSaveSettings type
- `static/index.html` - Added Resend API Key, From Email, To Email fields in Automations section
- `src/renderer/main.ts` - Handle new Resend input fields, updated status logic

**Key Changes:**
1. Email sending now uses Resend API (simple API key authentication)
2. Google account is now **optional** - only used for calendar/tasks/email context
3. If no Google account is connected, morning email still works with memories + knowledge only
4. Added separate From/To email fields (can send to any email, not just self)

**Settings UI:**
- Resend API Key (get from resend.com/api-keys)
- From Email (must be from verified Resend domain or use onboarding@resend.dev for testing)
- To Email (where to receive the morning email)
- Google Account (optional - for calendar/tasks/gmail context)

**Build Status:** ✅ Success
