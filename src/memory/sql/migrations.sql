-- =============================================================================
-- Memory System Improvements - Migration
-- =============================================================================
-- Run this SQL if you already have the memories table and want to add
-- the new columns for deduplication, decay, and access tracking.
-- =============================================================================

-- Add new columns for memory improvements
ALTER TABLE memories ADD COLUMN IF NOT EXISTS last_accessed TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE memories ADD COLUMN IF NOT EXISTS access_count INTEGER DEFAULT 0;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS superseded_by UUID REFERENCES memories(id);

-- Indexes for maintenance and retrieval queries
CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance);
CREATE INDEX IF NOT EXISTS idx_memories_last_accessed ON memories(last_accessed);
CREATE INDEX IF NOT EXISTS idx_memories_superseded ON memories(superseded_by) WHERE superseded_by IS NOT NULL;

-- Update existing rows to have default values
UPDATE memories SET last_accessed = created_at WHERE last_accessed IS NULL;
UPDATE memories SET access_count = 0 WHERE access_count IS NULL;
