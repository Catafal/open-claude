-- Automation State Table
-- Tracks automation execution state for cross-device sync
-- Used by morning email automation to prevent duplicate sends

CREATE TABLE IF NOT EXISTS automation_state (
  user_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  morning_email_last_sent DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups by date
CREATE INDEX IF NOT EXISTS idx_automation_state_last_sent
  ON automation_state(morning_email_last_sent);

-- Enable Row Level Security
ALTER TABLE automation_state ENABLE ROW LEVEL SECURITY;

-- Policy: Allow devices to manage their own automation state rows
-- Since we use anon key with device-generated UUIDs (not auth.uid()),
-- we allow all operations but the app enforces user_id matching via queries
CREATE POLICY "Allow insert for all users"
  ON automation_state
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow select own rows"
  ON automation_state
  FOR SELECT
  USING (true);

CREATE POLICY "Allow update own rows"
  ON automation_state
  FOR UPDATE
  USING (true)
  WITH CHECK (true);
