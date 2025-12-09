# Plan: Add Configurable System Prompt for Spotlight (Cmd+Shift+C)

## Summary
Add a configurable system prompt that is always prepended to messages sent via the Spotlight feature (Cmd+Shift+C). The prompt should be editable in the Settings page with a default value.

**Default prompt:** `"search for real citations that verify your response, if you do some affirmation"`

---

## Files to Modify

| File | Change |
|------|--------|
| `src/types/index.ts` | Add `spotlightSystemPrompt` to `SettingsSchema` |
| `src/main.ts` | Add default value + prepend prompt in `spotlight-send` handler |
| `src/renderer/settings.ts` | Add textarea control logic |
| `static/settings.html` | Add textarea UI element |
| `static/styles/settings.css` | Add textarea styling |
| `src/preload.ts` | Update `saveSettings` type signature |

---

## Implementation Tasks

### Task 1: Update Type Definition
**File:** `src/types/index.ts`

Add new field to `SettingsSchema`:
```typescript
export interface SettingsSchema {
  spotlightKeybind: string;
  spotlightPersistHistory: boolean;
  spotlightSystemPrompt: string;  // NEW
}
```

### Task 2: Add Default Value
**File:** `src/main.ts` (line ~46)

Update `DEFAULT_SETTINGS`:
```typescript
const DEFAULT_SETTINGS: SettingsSchema = {
  spotlightKeybind: 'CommandOrControl+Shift+C',
  spotlightPersistHistory: true,
  spotlightSystemPrompt: 'search for real citations that verify your response, if you do some affirmation',
};
```

### Task 3: Prepend System Prompt in Spotlight Handler
**File:** `src/main.ts` (line ~271, `spotlight-send` handler)

Before sending the message, prepend the system prompt:
```typescript
ipcMain.handle('spotlight-send', async (_event, message: string) => {
  const orgId = await getOrgId();
  if (!orgId) throw new Error('Not authenticated');

  const settings = getSettings();
  // Prepend system prompt if configured
  const systemPrompt = settings.spotlightSystemPrompt?.trim();
  const fullMessage = systemPrompt
    ? `[System instruction: ${systemPrompt}]\n\n${message}`
    : message;

  // ... rest of handler uses fullMessage instead of message
});
```

### Task 4: Add Settings UI - HTML
**File:** `static/settings.html`

Add new setting item in the Spotlight section (after persist history toggle):
```html
<div class="setting-item setting-item-vertical">
  <div class="setting-info">
    <label>System Prompt</label>
    <span class="setting-description">Instructions always prepended to your spotlight messages</span>
  </div>
  <textarea id="spotlight-system-prompt" class="setting-textarea" placeholder="e.g., search for real citations..."></textarea>
</div>
```

### Task 5: Add Settings UI - CSS
**File:** `static/styles/settings.css`

Add textarea styling:
```css
.setting-item-vertical {
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.setting-textarea {
  width: 100%;
  min-height: 80px;
  padding: 10px 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.04);
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
  font-size: 13px;
  resize: vertical;
  transition: all 0.15s;
}
/* + dark mode styles */
```

### Task 6: Add Settings UI - TypeScript
**File:** `src/renderer/settings.ts`

1. Update `Settings` interface to include `spotlightSystemPrompt`
2. Get DOM reference for the textarea
3. Load value in `loadSettings()`
4. Add change event listener to save on edit

### Task 7: Update Preload Types
**File:** `src/preload.ts` (line ~126)

Update `saveSettings` parameter type to include `spotlightSystemPrompt`:
```typescript
saveSettings: (settings: {
  spotlightKeybind?: string;
  spotlightPersistHistory?: boolean;
  spotlightSystemPrompt?: string;  // NEW
}) => ...
```

---

## Testing
1. Open Settings, verify textarea appears with default value
2. Modify the prompt, close and reopen Settings to verify persistence
3. Use Cmd+Shift+C, send a message, verify the system prompt affects Claude's response (should include citations)
4. Clear the prompt, verify messages are sent without the prefix

---

## Notes
- The system prompt is prepended as `[System instruction: ...]` to clearly separate it from user input
- Empty/whitespace-only prompts are ignored (no prefix added)
- Only the display message in `spotlightMessages` array should exclude the system prompt (for clean history)

---

## Implementation Log

### Completed - All Tasks Done ✓

**Task 1:** Added `spotlightSystemPrompt: string` to `SettingsSchema` in `src/types/index.ts:5`

**Task 2:** Added default value in `src/main.ts:48`:
```typescript
spotlightSystemPrompt: 'search for real citations that verify your response, if you do some affirmation',
```

**Task 3:** Added system prompt prepending in `src/main.ts:276-281`:
```typescript
const settings = getSettings();
const systemPrompt = settings.spotlightSystemPrompt?.trim();
const promptWithSystem = systemPrompt
  ? `[System instruction: ${systemPrompt}]\n\n${message}`
  : message;
```
And updated `streamCompletion` call at line 343 to use `promptWithSystem`.

**Task 4:** Updated `saveSettings` type in `src/preload.ts:126` to include `spotlightSystemPrompt?: string`

**Task 5:** Added textarea HTML in `static/settings.html:42-48`

**Task 6:** Added CSS styles in `static/styles/settings.css:206-247` (light mode) and lines 346-363 (dark mode)

**Task 7:** Added TypeScript logic in `src/renderer/settings.ts`:
- Interface updated at line 8
- DOM reference at line 15
- Load value at line 111
- Save on blur listener at lines 198-202

**Build:** Successful - all TypeScript compiled without errors
