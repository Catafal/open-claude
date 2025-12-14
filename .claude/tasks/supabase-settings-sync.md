# Supabase Settings Sync

## Goal
Store all application settings in Supabase so users can sync their configurations across devices when they connect with their Supabase credentials.

## Current Architecture

### Settings Storage (electron-store)
- Location: `~/Library/Application Support/Open Claude/config.json`
- Settings objects:
  - `settings` - UI settings (keybind, TTS, system prompt)
  - `knowledgeSettings` - Qdrant config (url, apiKey, collectionName)
  - `ragSettings` - Ollama config (enabled, url, model, etc.)
  - `memorySettings` - Supabase config (enabled, url, key)
  - `notionSettings` - Notion config (apiKey, pageId, autoSync)

### Current Flow
1. App starts → load from electron-store
2. User changes setting → save to electron-store
3. Initialize relevant clients

## Proposed Architecture

### Design Principle
- **Supabase as primary** when connected
- **electron-store as fallback** when offline
- **Write-through**: Save to both to ensure offline access

### Database Schema
```sql
-- Single table for all settings (simple, no over-engineering)
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settings_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Only one row per user (using RLS with anon key)
CREATE UNIQUE INDEX unique_user_settings ON user_settings (id);

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- RLS: Allow anon access (each Supabase project = unique user)
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON user_settings FOR ALL USING (true);
```

### Settings JSON Structure
```typescript
{
  // UI Settings
  spotlightKeybind: string,
  spotlightPersistHistory: boolean,
  spotlightSystemPrompt: string,
  ttsEngine: 'kokoro' | 'vibevoice',
  vibevoiceModel: '0.5b' | '1.5b',
  vibevoiceServerUrl: string,

  // Knowledge Settings
  knowledge: {
    qdrantUrl: string,
    qdrantApiKey: string,
    collectionName: string
  },

  // RAG Settings
  rag: {
    enabled: boolean,
    ollamaUrl: string,
    model: string,
    maxQueries: number,
    maxContextChunks: number,
    minRelevanceScore: number
  },

  // Notion Settings
  notion: {
    enabled: boolean,
    apiKey: string,
    pageId: string,
    autoSync: boolean
  }

  // Note: memorySettings NOT stored (contains Supabase creds - chicken/egg)
}
```

## Implementation Plan

### Task 1: Add SQL Schema
- [ ] Create `src/memory/sql/settings_setup.sql` with the schema above
- [ ] Document in existing setup.sql or add new file

### Task 2: Create Settings Sync Module
- [ ] Create `src/memory/settings-sync.ts`
- [ ] Functions:
  - `loadSettingsFromSupabase()` - Get settings JSON
  - `saveSettingsToSupabase(settings)` - Upsert settings JSON
  - `mergeSettings(local, remote)` - Handle conflicts (remote wins)

### Task 3: Modify Main Process Flow
- [ ] On memory connection success → load remote settings
- [ ] Merge remote with local (remote takes priority)
- [ ] Update all in-memory state + reinitialize clients
- [ ] On any setting save → write to both Supabase + electron-store

### Task 4: Add IPC Handlers
- [ ] `settings-sync-load` - Trigger manual sync from Supabase
- [ ] `settings-sync-save` - Force push local to Supabase
- [ ] Modify existing save handlers to also sync to Supabase

### Task 5: Update Settings UI
- [ ] Add sync status indicator in memory settings section
- [ ] Show "Settings synced from cloud" notification when loaded

## Key Decisions

1. **Why single JSONB column?**
   - Simple, no migrations needed for new settings
   - Single read/write operation
   - Easy to debug

2. **Why remote wins on conflict?**
   - User expects cloud to be "truth"
   - Prevents accidental local overwrites of cloud config
   - On first connect, explicitly asks user if they want to push local settings

3. **Why exclude memorySettings?**
   - Contains Supabase URL/Key itself (can't store before connecting)
   - Keep in electron-store only

4. **Sync Trigger**
   - On memory test/connect success
   - On any individual setting save

## Files to Modify
- `src/memory/supabase.ts` - Add settings CRUD
- `src/main.ts` - Modify init flow and IPC handlers
- `src/preload.ts` - Expose sync APIs if needed
- `src/renderer/settings.ts` - Add sync status UI

## Status
- [x] Plan approved
- [x] Task 1: SQL Schema (already existed at src/settings/sql/setup.sql)
- [x] Task 2: Settings Sync Module (src/settings/settings-sync.ts)
- [x] Task 3: Main Process Flow (main.ts IPC handlers)
- [x] Task 4: IPC Handlers (preload.ts APIs)
- [x] Task 5: UI Updates (settings.html, settings.css, settings.ts)

## Implementation Summary

### Files Created
- `src/settings/settings-sync.ts` - Supabase CRUD for user_settings table
- `src/settings/index.ts` - Module exports

### Files Modified
- `src/main.ts` - Added 3 IPC handlers (has-cloud, pull, push) + import
- `src/preload.ts` - Exposed 3 sync APIs to renderer
- `static/settings.html` - Added sync section with pull/push buttons
- `static/styles/settings.css` - Added sync section styles
- `src/renderer/settings.ts` - Added sync handlers + cloud status check

### How It Works
1. User configures Supabase in Memory section
2. Click "Test" → on success, sync status is checked
3. If cloud has settings → "Pull from Cloud" enabled
4. "Push to Cloud" always available to backup local settings
5. LOCAL always wins - cloud is backup only
