-- ============================================================
-- User Settings Table for Cloud Sync
-- ============================================================
-- Stores all app settings except bootstrap credentials (Supabase URL/key).
-- Uses JSONB for flexible schema evolution.
-- Single row per user (anon key = single user app).
-- ============================================================

CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core app settings (spotlight, TTS, etc.)
  settings JSONB NOT NULL DEFAULT '{}',

  -- Knowledge base settings (Qdrant, Firecrawl)
  knowledge_settings JSONB DEFAULT '{}',

  -- Notion integration settings
  notion_settings JSONB DEFAULT '{}',

  -- RAG agent settings (Ollama)
  rag_settings JSONB DEFAULT '{}',

  -- Personal Assistant settings (Google OAuth credentials, NOT tokens)
  assistant_settings JSONB DEFAULT '{}',

  -- Timestamps for sync tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Auto-update timestamp trigger
-- ============================================================
-- Automatically updates `updated_at` on any row modification.

CREATE OR REPLACE FUNCTION update_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists (for re-runs)
DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;

CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_user_settings_updated_at();

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
-- Permissive policy for anon key access (single-user desktop app).
-- In production with multi-user, you'd scope by auth.uid().

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if exists (for re-runs)
DROP POLICY IF EXISTS "Allow all for anon" ON user_settings;

CREATE POLICY "Allow all for anon" ON user_settings
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- Indexes (optional, for larger deployments)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_user_settings_updated_at
  ON user_settings(updated_at DESC);

-- ============================================================
-- Knowledge Documents Registry
-- ============================================================
-- Stores metadata about ingested documents (files, URLs, Notion pages).
-- Actual content/embeddings are in Qdrant; this is the fast-lookup registry.
-- Enables cross-device sync without scanning Qdrant.

CREATE TABLE IF NOT EXISTS knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL UNIQUE,  -- File path or URL (unique identifier)
  title TEXT NOT NULL,          -- Display name
  type TEXT NOT NULL CHECK (type IN ('txt', 'md', 'pdf', 'url', 'notion')),
  chunk_count INT NOT NULL DEFAULT 0,
  date_added TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generic updated_at trigger function (reusable)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_knowledge_documents_updated_at ON knowledge_documents;

CREATE TRIGGER update_knowledge_documents_updated_at
  BEFORE UPDATE ON knowledge_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for anon knowledge" ON knowledge_documents;

CREATE POLICY "Allow all for anon knowledge" ON knowledge_documents
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_date
  ON knowledge_documents(date_added DESC);

-- ============================================================
-- Migrations for existing databases
-- ============================================================
-- Run these if you already have the user_settings table created
-- and need to add new columns.

-- Add assistant_settings column (Dec 2024)
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS assistant_settings JSONB DEFAULT '{}';
