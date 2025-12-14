-- ============================================================================
-- Prompts Table Setup for Supabase
-- Run this in Supabase SQL Editor to enable the Prompt Base feature
-- ============================================================================

-- Prompts table for storing user prompt templates
CREATE TABLE IF NOT EXISTS prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL DEFAULT 'default_user',
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('coding', 'writing', 'analysis', 'research', 'creative', 'system')),
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  is_favorite BOOLEAN DEFAULT FALSE,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_prompts_user ON prompts(user_id);
CREATE INDEX IF NOT EXISTS idx_prompts_category ON prompts(category);
CREATE INDEX IF NOT EXISTS idx_prompts_favorite ON prompts(is_favorite);

-- Enable Row Level Security
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can access their own prompts
DROP POLICY IF EXISTS "Users can access own prompts" ON prompts;
CREATE POLICY "Users can access own prompts" ON prompts
  FOR ALL USING (user_id = 'default_user');

-- ============================================================================
-- Optional: Seed starter prompts
-- Uncomment to add default prompts
-- ============================================================================

-- INSERT INTO prompts (name, category, content, variables) VALUES
-- ('Code Review', 'coding', 'Review this code for bugs, performance issues, and best practices. Provide specific feedback with line numbers where applicable.', '[]'),
-- ('Debug Helper', 'coding', 'Help me debug this issue.\n\nError: {{error}}\n\nCode:\n{{code}}\n\nThink step by step to identify the root cause.', '[{"name": "error", "defaultValue": "", "description": "The error message"}, {"name": "code", "defaultValue": "", "description": "The relevant code"}]'),
-- ('Explain Code', 'coding', 'Explain this code step by step. Focus on the logic flow and key decisions made.', '[]'),
-- ('Write Tests', 'coding', 'Write comprehensive unit tests for this function. Cover edge cases and error scenarios.', '[]'),
-- ('Improve Writing', 'writing', 'Improve this text for clarity and conciseness. Maintain the original tone and intent.', '[]'),
-- ('Summarize', 'analysis', 'Summarize the key points of the following content in bullet points:', '[]'),
-- ('Research Assistant', 'research', 'You are a research assistant. Help me understand {{topic}} by providing:\n1. Key concepts\n2. Important considerations\n3. Common pitfalls', '[{"name": "topic", "defaultValue": "", "description": "The topic to research"}]'),
-- ('Brainstorm Ideas', 'creative', 'Help me brainstorm ideas for {{project}}. Generate 10 creative and diverse suggestions.', '[{"name": "project", "defaultValue": "", "description": "The project or problem"}]');
