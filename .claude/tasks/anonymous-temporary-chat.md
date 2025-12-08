# Analysis: Incognito Chat Implementation

## Current Session Architecture

### How It Works Now
This app does **NOT** use the official Anthropic API with API keys. Instead, it:

1. **Piggybacks on claude.ai web session**
   - Opens a browser window to `https://claude.ai/login`
   - Captures session cookies (`sessionKey`, `lastActiveOrg`)
   - Uses these cookies to authenticate all API requests

2. **Uses internal claude.ai API endpoints**
   ```
   Base URL: https://claude.ai/api/organizations/{orgId}/...
   ```

3. **Every conversation is saved server-side**
   - `POST /chat_conversations` - creates a new conversation
   - All messages are tied to a `conversationId`
   - History persists on Claude's servers (visible in claude.ai sidebar)

## Claude.ai Has Native Incognito Mode!

Claude.ai DOES have an incognito mode (screenshot confirmed):
- "Incognito chats aren't saved, added to memory, or used to train models"
- Available to all users (free, Pro, etc.)
- Ghost icon in UI to enable

**The API parameter is NOT publicly documented.** Need to discover it.

### Key Files
- `/src/api/client.ts:143-154` - Cookie-based authentication
- `/src/api/client.ts:227-314` - Message streaming via `/completion` endpoint
- `/src/main.ts:381-408` - Conversation creation

---

## Discovered: Incognito API Parameter

**Parameter: `is_temporary: true`**

Full request payload for incognito chat:
```json
{
  "uuid": "6adbdcff-605f-4ef8-b326-be28dd2289bd",
  "name": "",
  "model": "claude-sonnet-4-5-20250929",
  "include_conversation_preferences": true,
  "is_temporary": true
}
```

Response confirms incognito mode:
```json
{
  "uuid": "6adbdcff-605f-4ef8-b326-be28dd2289bd",
  "is_starred": false,
  "is_temporary": true,
  "model": "claude-sonnet-4-5-20250929",
  "platform": "CLAUDE_AI"
}
```

---

## Implementation - COMPLETED

### Changes Made

**File**: `/src/main.ts:391-399` - Main chat conversation creation
```typescript
// Create conversation in incognito mode (is_temporary: true)
// Incognito chats aren't saved, added to memory, or used to train models
const result = await makeRequest(url, 'POST', {
  uuid: conversationId,
  name: '',
  model: model || 'claude-opus-4-5-20251101',
  is_temporary: true,
  include_conversation_preferences: true
});
```

**File**: `/src/main.ts:170-181` - Spotlight conversation creation
```typescript
// Create spotlight conversation in incognito mode (is_temporary: true)
const createResult = await makeRequest(
  `${BASE_URL}/api/organizations/${orgId}/chat_conversations`,
  'POST',
  {
    name: '',
    model: 'claude-haiku-4-5-20251001',
    is_temporary: true,
    include_conversation_preferences: true
  }
);
```

### What This Means
- ALL conversations created through this app are now incognito by default
- Chats won't appear in claude.ai sidebar
- Chats aren't added to Claude's memory
- Chats aren't used to train models
- Still subject to 30-day safety retention per Anthropic policy
