-- Migration: Create feedbacks table for test phase qualitative feedback
-- Date: 2026-01-12
-- Purpose: Store paywall and general feedback during test phase

-- Create feedbacks table
CREATE TABLE IF NOT EXISTS feedbacks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('paywall', 'general')),
  response TEXT,              -- For paywall: 'would_pay', 'not_now', 'need_more_time', 'too_expensive'
                              -- For general: 'bug', 'suggestion', 'question', 'other'
  reason TEXT,                -- Optional custom reason text
  days_since_signup INTEGER,  -- How many days since user signed up (for paywall)
  message TEXT,               -- For general feedback: the actual message
  screen TEXT,                -- Which screen the feedback came from
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster queries by user and type
CREATE INDEX IF NOT EXISTS idx_feedbacks_user_id ON feedbacks(user_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_type ON feedbacks(feedback_type);
CREATE INDEX IF NOT EXISTS idx_feedbacks_response ON feedbacks(response);
CREATE INDEX IF NOT EXISTS idx_feedbacks_created_at ON feedbacks(created_at);

-- Enable RLS
ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own feedback
CREATE POLICY "Users can insert own feedback"
  ON feedbacks
  FOR INSERT
  WITH CHECK (true);  -- Allow all inserts (user_id is set by the app)

-- Policy: Users can read their own feedback
CREATE POLICY "Users can read own feedback"
  ON feedbacks
  FOR SELECT
  USING (true);  -- For now, allow reading all (admin analytics)

-- Grant permissions
GRANT SELECT, INSERT ON feedbacks TO anon;
GRANT SELECT, INSERT ON feedbacks TO authenticated;

-- Comment on table
COMMENT ON TABLE feedbacks IS 'User feedback collected during test phase (paywall responses, bug reports, suggestions)';
COMMENT ON COLUMN feedbacks.feedback_type IS 'Type of feedback: paywall or general';
COMMENT ON COLUMN feedbacks.response IS 'Paywall: would_pay/not_now/need_more_time/too_expensive. General: bug/suggestion/question/other';
COMMENT ON COLUMN feedbacks.days_since_signup IS 'Number of days since user signup when feedback was given';
