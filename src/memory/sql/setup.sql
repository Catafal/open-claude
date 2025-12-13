-- =============================================================================
-- Open Claude Memory System - Supabase Setup
-- =============================================================================
-- Run this SQL in your Supabase SQL Editor (supabase.com > Your Project > SQL Editor)
-- =============================================================================

-- 1. Create the memories table
CREATE TABLE IF NOT EXISTS memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('factual', 'preference', 'relationship', 'temporal')),
  importance FLOAT DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),
  source_type TEXT CHECK (source_type IN ('spotlight', 'main_chat')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ  -- Only used for 'temporal' category (auto-expires after 7 days)
);

-- 2. Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category);
CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_expires_at ON memories(expires_at) WHERE expires_at IS NOT NULL;

-- 3. Enable Row Level Security (recommended for production)
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

-- 4. Create a permissive policy for anon access (adjust based on your needs)
-- This allows the anon key to read/write memories (single-user setup)
CREATE POLICY "Allow anon full access" ON memories
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- 5. Optional: Auto-cleanup function for expired temporal memories
-- This can be called periodically or via a cron job
CREATE OR REPLACE FUNCTION cleanup_expired_memories()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM memories
  WHERE category = 'temporal'
    AND expires_at IS NOT NULL
    AND expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- 6. Optional: Schedule automatic cleanup (requires pg_cron extension)
-- Uncomment if you have pg_cron enabled in your Supabase project
-- SELECT cron.schedule('cleanup-expired-memories', '0 * * * *', 'SELECT cleanup_expired_memories()');

-- =============================================================================
-- Verification: Run this to check the table was created correctly
-- =============================================================================
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'memories'
-- ORDER BY ordinal_position;
