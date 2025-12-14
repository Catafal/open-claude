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
