# YouTube Video Processing as Knowledge

## Status: IMPLEMENTED

## Overview
Add YouTube video processing capability to the existing knowledge system using Gemini's native YouTube support. Users can process videos and store personalized explanations as searchable knowledge.

## Implementation Completed
- **Date:** 2025-12-17
- **Approach:** Gemini Web Client (TypeScript, following Claude client patterns)

---

## Completed Implementation

### Core Gemini Module (`src/gemini/`)
- [x] `types.ts` - Type definitions (~130 lines)
- [x] `client.ts` - Cookie-based auth + API requests (~180 lines)
- [x] `parser.ts` - Response parser for Gemini's nested JSON format (~100 lines)
- [x] `youtube-agent.ts` - YouTube processing with memory integration (~180 lines)
- [x] `index.ts` - Module exports (~50 lines)

### Knowledge Integration
- [x] Added `'youtube'` to `KnowledgeMetadata.type` union in `src/knowledge/types.ts`
- [x] Added `GeminiSettingsStore` to `src/types/index.ts`

### IPC Handlers (`src/main.ts`)
- [x] `gemini:is-authenticated` - Check if user has valid Gemini cookies
- [x] `gemini:login` - Opens BrowserWindow to gemini.google.com for login
- [x] `gemini:validate-youtube-url` - Validate YouTube URL format
- [x] `gemini:process-youtube` - Process video + auto-store in Qdrant
- [x] `gemini:get-settings` / `gemini:save-settings` - Settings management
- [x] `gemini:clear-cache` - Clear cached SNlM0e token

### Preload API (`src/preload.ts`)
- [x] `geminiIsAuthenticated()`
- [x] `geminiLogin()`
- [x] `geminiValidateYoutubeUrl(url)`
- [x] `geminiProcessYoutube(input)`
- [x] `geminiGetSettings()`
- [x] `geminiSaveSettings(settings)`
- [x] `geminiClearCache()`
- [x] `onGeminiYoutubeStatus(callback)`
- [x] `removeGeminiListeners()`

### Settings UI
- [x] Added Gemini YouTube Agent section to `static/settings.html`
- [x] Added settings handlers to `src/renderer/settings.ts`
  - Enable/disable toggle
  - Login status indicator
  - Login button (opens Gemini web login)
  - How It Works guide

---

## Architecture

### Authentication Flow
```
User clicks "Login to Gemini"
    → Opens BrowserWindow to gemini.google.com
    → User logs in with Google
    → Electron stores session cookies automatically
    → isGeminiAuthenticated() checks for __Secure-1PSID cookie
```

### YouTube Processing Flow
```
┌──────────────┐    ┌───────────────┐    ┌─────────────┐
│ User Input   │───▶│ YouTube Agent │───▶│   Gemini    │
│ (URL + mem)  │    │               │    │   Web API   │
└──────────────┘    └───────────────┘    └─────────────┘
                           │
                           ▼
                    ┌───────────────┐
                    │ Qdrant Store  │
                    │ (knowledge)   │
                    └───────────────┘
```

### Key Design Decisions
| Decision | Choice | Rationale |
|----------|--------|-----------|
| **API** | Gemini Web (cookies) | Native YouTube access, no API key needed |
| **Auth** | Session cookies | Same pattern as Claude client |
| **Memory** | Query memory system | Personalize based on user's knowledge level |
| **Storage** | Auto-store to Qdrant | Every processed video becomes searchable knowledge |

---

## Files Created/Modified

| File | Change |
|------|--------|
| `src/gemini/*` | **NEW** - All 5 files (~640 lines total) |
| `src/knowledge/types.ts` | Added `'youtube'` type |
| `src/types/index.ts` | Added `GeminiSettingsStore` |
| `src/main.ts` | Added 9 IPC handlers |
| `src/preload.ts` | Exposed gemini methods |
| `static/settings.html` | Added Gemini section |
| `src/renderer/settings.ts` | Added Gemini settings handlers |

---

## Usage

### Option 1: Spotlight (Quick)
1. Open Spotlight (Cmd+Shift+Space)
2. Click the toggle button until it shows "YT"
3. Paste a YouTube URL and press Enter
4. Gemini processes → Shows summary → Saves to knowledge

### Option 2: Settings (Configure)
1. Open Settings → Gemini YouTube Agent
2. Click "Login to Gemini" → Sign in with Google
3. Enable the toggle

---

## Spotlight Integration (Added 2025-12-17)

### Files Modified
- `src/renderer/spotlight.ts` - Added 'yt' mode and `processYouTubeUrl()` function
- `static/spotlight.html` - Updated tooltip

### Toggle Cycle
`Haiku → Opus → TTS → YT → Haiku`

### Flow
```
User selects "YT" mode in spotlight
       ↓
Paste YouTube URL + Enter
       ↓
validateYouTubeUrl() checks format
       ↓
Fetch user memories (optional)
       ↓
geminiProcessYoutube() → Gemini API
       ↓
Show summary + store in Qdrant
```

---

## Bug Fixes (2025-12-17)

### Fix 1: Missing `addMessage` function
- **Issue:** `processYouTubeUrl()` called `addMessage()` which didn't exist in spotlight.ts
- **Fix:** Added `addMessage(role, text)` helper function to display messages in spotlight UI
- **File:** `src/renderer/spotlight.ts`

### Fix 2: Invalid Qdrant point ID format
- **Issue:** Qdrant requires UUID or integer IDs, but we used string format `yt-${videoId}-${timestamp}-${i}`
- **Error:** `"value yt-xxx is not a valid point ID, valid values are either an unsigned integer or a UUID"`
- **Fix:** Changed to `crypto.randomUUID()` for ID generation
- **File:** `src/main.ts` (line 1699)
