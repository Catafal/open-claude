# Manual Notion Page Import Feature - COMPLETED

## Overview

Add ability to manually import specific Notion pages (and their subpages) separately from the full auto-sync. Tracked pages will auto-update when changes are detected in Notion.

---

## Current Architecture Summary

- **Full sync** via `notion-sync` IPC handler syncs ALL accessible pages
- Each chunk stores `source: page.url` in Qdrant metadata
- `deleteBySource(url)` exists for removing page chunks
- No per-page tracking - only global `lastSync` timestamp
- Notion API provides `last_edited_time` on pages

---

## Implementation Plan

### Task 1: Extend Types for Tracked Pages

**File:** `src/types/index.ts`

Add type for tracked pages:

```typescript
interface TrackedNotionPage {
  id: string;              // Notion page ID
  url: string;             // Page URL (used as source in Qdrant)
  title: string;           // Page title for display
  lastSynced: string;      // ISO timestamp when we last synced
  lastEditedTime: string;  // Notion's last_edited_time for update detection
  includeSubpages: boolean; // Whether to sync subpages
}
```

Extend `NotionSettingsStore`:

```typescript
interface NotionSettingsStore {
  notionToken?: string;
  lastSync?: string;
  syncOnStart: boolean;
  trackedPages?: TrackedNotionPage[];  // NEW: manually tracked pages
}
```

---

### Task 2: Backend - Add IPC Handlers (main.ts)

Add new handlers:

1. **`notion-import-page`** - Import a specific page by URL/ID
   - Parse page ID from URL (e.g., `notion.so/Page-Title-abc123def456`)
   - Fetch page metadata + content
   - Optionally fetch subpages (child pages)
   - Delete existing chunks by source (if re-importing)
   - Chunk, embed, and store in Qdrant
   - Add to `trackedPages` array with `lastEditedTime`
   - Return success/stats

2. **`notion-get-tracked-pages`** - List tracked pages
   - Return `trackedPages` array from settings

3. **`notion-remove-tracked-page`** - Remove a tracked page
   - Remove from `trackedPages` array
   - Delete chunks from Qdrant via `deleteBySource(url)`

4. **`notion-check-updates`** - Check for updates on tracked pages
   - For each tracked page, fetch current `last_edited_time` from Notion
   - Compare with stored `lastEditedTime`
   - Return list of pages with updates

5. **`notion-sync-tracked-page`** - Re-sync a specific tracked page
   - Delete old chunks
   - Re-fetch, chunk, embed, store
   - Update `lastSynced` and `lastEditedTime`

---

### Task 3: Notion Module - Add Helper Functions

**File:** `src/knowledge/notion.ts`

Add:

```typescript
// Extract page ID from URL (handles various Notion URL formats)
function extractPageIdFromUrl(urlOrId: string): string

// Fetch a single page with metadata
function fetchPageWithMeta(pageId: string): Promise<{ page, content, subpages }>

// Fetch child pages (subpages) of a page
function fetchChildPages(pageId: string): Promise<NotionPage[]>
```

---

### Task 4: UI - Add Manual Import Section

**File:** `static/index.html`

Add new collapsible section inside settings panel (after Notion section):

```html
<!-- Manual Import Section -->
<div class="settings-section">
  <button class="settings-section-header" data-section="manual-import">
    <span class="section-icon">📥</span>
    <span class="section-title">Manual Page Import</span>
    <span class="section-arrow">›</span>
  </button>
  <div class="settings-section-content" id="manual-import-section">
    <!-- Import Input -->
    <div class="setting-item">
      <div class="setting-info">
        <label>Page URL or ID</label>
        <span class="setting-description">Paste Notion page link</span>
      </div>
      <input type="text" id="notion-page-url" class="text-input" placeholder="https://notion.so/...">
    </div>
    <div class="setting-item">
      <div class="setting-info">
        <label>Include Subpages</label>
        <span class="setting-description">Also import child pages</span>
      </div>
      <input type="checkbox" id="notion-include-subpages" class="toggle-switch">
    </div>
    <div class="setting-item setting-actions">
      <button id="notion-import-btn" class="btn btn-primary">Import Page</button>
      <span id="import-status" class="status-text"></span>
    </div>

    <!-- Tracked Pages List -->
    <div class="tracked-pages-header">
      <span>Tracked Pages</span>
      <button id="check-updates-btn" class="btn btn-secondary btn-small">Check Updates</button>
    </div>
    <div id="tracked-pages-list" class="tracked-pages-list">
      <!-- Dynamically populated -->
    </div>
  </div>
</div>
```

---

### Task 5: Renderer - Add Import Logic

**File:** `src/renderer/main.ts`

Add functions:

1. `loadTrackedPages()` - Load and render tracked pages list
2. `importNotionPage()` - Handle import button click
3. `checkForUpdates()` - Check tracked pages for updates
4. `removeTrackedPage(pageId)` - Remove a tracked page
5. `syncTrackedPage(pageId)` - Re-sync a specific page

Each tracked page in the list should show:
- Title
- Last synced time
- Update indicator (if newer in Notion)
- "Sync" and "Remove" buttons

---

### Task 6: CSS - Style Tracked Pages List

**File:** `static/styles/knowledge.css`

Add styles for:
- `.tracked-pages-header` - Header with "Check Updates" button
- `.tracked-pages-list` - Container for page items
- `.tracked-page-item` - Individual page row
- `.update-indicator` - Badge showing "Update available"
- Dark mode variants

---

### Task 7: Auto-Update on App Start (Optional Enhancement)

In `main.ts` app ready handler:
- If `syncOnStart` is true, also check tracked pages for updates
- Auto-sync any pages where `last_edited_time > lastSynced`

---

## File Changes Summary

| File | Changes |
|------|---------|
| `src/types/index.ts` | Add `TrackedNotionPage` interface, extend `NotionSettingsStore` |
| `src/knowledge/notion.ts` | Add `extractPageIdFromUrl()`, `fetchPageWithMeta()`, `fetchChildPages()` |
| `src/main.ts` | Add 5 new IPC handlers for manual import |
| `static/index.html` | Add Manual Import collapsible section |
| `src/renderer/main.ts` | Add import/tracking UI logic |
| `static/styles/knowledge.css` | Add styles for tracked pages list |

---

## Notes

- Use Notion's `last_edited_time` from page metadata for update detection
- Page ID extraction needs to handle multiple URL formats:
  - `https://notion.so/Page-abc123`
  - `https://notion.so/workspace/Page-abc123`
  - `https://www.notion.so/Page-abc123?v=...`
  - Direct ID: `abc123def456...`
- Rate limiting: 350ms delay between API calls (Notion limit: 3 req/sec)
- Subpages are fetched via `blocks.children.list` looking for `child_page` blocks
