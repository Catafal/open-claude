# Knowledge Documents Registry in Supabase

## Goal
Store the knowledge document list in Supabase instead of deriving it from Qdrant. This enables:
- Cross-device sync (same Supabase account)
- Faster document listing (no Qdrant scroll)
- Lighter local footprint

## Architecture
- **Supabase**: Document registry (metadata: title, source, type, chunk_count, date_added)
- **Qdrant**: Chunks with embeddings (unchanged)
- **Flow**: Ingest → store chunks in Qdrant + register document in Supabase

---

## Implementation Steps

### 1. SQL Schema
**File**: `src/settings/sql/setup.sql` (append)

```sql
-- Knowledge documents registry
CREATE TABLE IF NOT EXISTS knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('txt', 'md', 'pdf', 'url', 'notion')),
  chunk_count INT NOT NULL DEFAULT 0,
  date_added TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_knowledge_documents_updated_at
  BEFORE UPDATE ON knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON knowledge_documents FOR ALL USING (true);
CREATE INDEX idx_knowledge_documents_date ON knowledge_documents(date_added DESC);
```

### 2. Supabase CRUD Module
**File**: `src/knowledge/knowledge-supabase.ts` (new)

Functions:
- `initKnowledgeSupabase(url, anonKey)` - initialize client (reuse existing if same creds)
- `registerDocument(source, title, type, chunkCount)` - INSERT/upsert document
- `unregisterDocument(source)` - DELETE by source
- `listDocuments()` - SELECT all, return array
- `updateDocumentChunkCount(source, chunkCount)` - UPDATE after re-sync
- `isKnowledgeSupabaseReady()` - check if client initialized

### 3. Export Module
**File**: `src/knowledge/index.ts` (modify)

Add exports for new Supabase functions.

### 4. Main Process IPC Handlers
**File**: `src/main.ts` (modify)

Changes to existing handlers:

| Handler | Change |
|---------|--------|
| `knowledge-ingest-file` | After Qdrant upsert → call `registerDocument()` |
| `knowledge-ingest-url` | After Qdrant upsert → call `registerDocument()` |
| `knowledge-delete-by-source` | After Qdrant delete → call `unregisterDocument()` |
| `knowledge-list` | Query Supabase instead of Qdrant scroll |

New handler:
- `knowledge-migrate-to-supabase` - one-time migration of existing Qdrant docs

### 5. Migration Logic
**File**: `src/main.ts`

Handler `knowledge-migrate-to-supabase`:
1. List all items from Qdrant (existing `listItems()`)
2. Group by source (derive unique documents)
3. For each document: call `registerDocument(source, title, type, chunkCount)`
4. Return migration count

### 6. Initialization on App Start
**File**: `src/main.ts` (app.whenReady)

When memory settings have Supabase credentials:
1. Initialize `knowledgeSupabase` client
2. Knowledge list will now come from Supabase

### 7. Preload Exposure
**File**: `src/preload.ts` (modify)

Add new IPC:
- `knowledgeMigrateToSupabase` - expose migration function

### 8. Renderer Migration Button
**File**: `src/renderer/main.ts` + `static/index.html`

Add "Migrate to Cloud" button in Knowledge settings that:
1. Shows migration status
2. Calls `window.claude.knowledgeMigrateToSupabase()`
3. Reloads document list

---

## Critical Files

| File | Action |
|------|--------|
| `src/settings/sql/setup.sql` | Append table schema |
| `src/knowledge/knowledge-supabase.ts` | Create new module |
| `src/knowledge/index.ts` | Add exports |
| `src/main.ts` | Modify IPC handlers + add migration |
| `src/preload.ts` | Expose migration API |
| `src/renderer/main.ts` | Add migration button handler |
| `static/index.html` | Add migration UI |

---

## Data Flow (After Implementation)

**Ingest**:
```
File/URL → Parse → Chunk → Embed → Qdrant.upsert()
                                    ↓
                            Supabase.registerDocument()
```

**List**:
```
UI Request → Supabase.listDocuments() → Render cards
```

**Delete**:
```
UI Delete → Qdrant.deleteBySource() → Supabase.unregisterDocument()
```

---

## Notes
- Supabase credentials come from memorySettings (already configured)
- If Supabase not connected, fallback to Qdrant scroll for listing (backward compatible)
- Migration is user-triggered via button (not automatic)

---

## Implementation Complete ✅

### Changes Made:

1. **SQL Schema** (`src/settings/sql/setup.sql`)
   - Added `knowledge_documents` table with source, title, type, chunk_count, date_added
   - Added trigger for auto-updating `updated_at`
   - Added RLS policy and index

2. **New Module** (`src/knowledge/knowledge-supabase.ts`)
   - `initKnowledgeSupabase()` - initialize Supabase client
   - `registerDocument()` - upsert document metadata
   - `unregisterDocument()` - delete by source
   - `listDocuments()` - fetch all documents
   - `isKnowledgeSupabaseReady()` - check if connected

3. **Exports** (`src/knowledge/index.ts`)
   - Added exports for all new Supabase functions

4. **Main Process** (`src/main.ts`)
   - Modified `knowledge-ingest-file` to call `registerDocument()`
   - Modified `knowledge-ingest-url` to call `registerDocument()`
   - Modified `knowledge-delete-by-source` to call `unregisterDocument()`
   - Modified `knowledge-list` to query Supabase (with Qdrant fallback)
   - Added `knowledge-migrate-to-supabase` handler
   - Added Knowledge Supabase init on app start and when memory settings saved

5. **Preload** (`src/preload.ts`)
   - Exposed `knowledgeMigrateToSupabase` API

6. **UI** (`static/index.html`, `src/renderer/main.ts`, `static/styles/knowledge.css`)
   - Added "Knowledge Registry" section in Cloud Sync settings
   - Added "Migrate to Cloud" button
   - Added migration function and event handler
   - Added CSS for setting-divider

### User Instructions:
1. Run SQL in Supabase SQL Editor (copy from `src/settings/sql/setup.sql`)
2. Configure Memory settings with Supabase URL and key
3. Go to Settings → Cloud Sync → "Migrate to Cloud" button
4. Documents will now sync via Supabase registry
