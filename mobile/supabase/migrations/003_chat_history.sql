-- Migration 003: Chat History table
-- Stores conversation history between users and LymIA

CREATE TABLE IF NOT EXISTS chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User identification (anonymous ID from app)
  user_id TEXT NOT NULL,

  -- Conversation grouping
  conversation_id UUID DEFAULT gen_random_uuid(),

  -- Message content
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,

  -- RAG context used for this response
  context_used JSONB DEFAULT NULL,
  sources_cited TEXT[] DEFAULT '{}',

  -- Response metadata
  model_used TEXT DEFAULT 'gpt-4o-mini',
  tokens_used INTEGER DEFAULT 0,
  response_time_ms INTEGER DEFAULT 0,

  -- User feedback
  feedback_rating INTEGER CHECK (feedback_rating IS NULL OR (feedback_rating >= 1 AND feedback_rating <= 5)),
  feedback_text TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user queries
CREATE INDEX IF NOT EXISTS idx_chat_history_user_id
  ON chat_history (user_id);

-- Index for conversation grouping
CREATE INDEX IF NOT EXISTS idx_chat_history_conversation
  ON chat_history (conversation_id);

-- Index for user + time queries
CREATE INDEX IF NOT EXISTS idx_chat_history_user_created
  ON chat_history (user_id, created_at DESC);

-- Composite index for fetching conversations
CREATE INDEX IF NOT EXISTS idx_chat_history_user_conversation
  ON chat_history (user_id, conversation_id, created_at);

-- Function to get recent conversations for a user
CREATE OR REPLACE FUNCTION get_user_conversations(
  p_user_id TEXT,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  conversation_id UUID,
  first_message TEXT,
  last_message_at TIMESTAMPTZ,
  message_count BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ch.conversation_id,
    (
      SELECT content
      FROM chat_history
      WHERE conversation_id = ch.conversation_id
        AND role = 'user'
      ORDER BY created_at ASC
      LIMIT 1
    ) AS first_message,
    MAX(ch.created_at) AS last_message_at,
    COUNT(*) AS message_count
  FROM chat_history ch
  WHERE ch.user_id = p_user_id
  GROUP BY ch.conversation_id
  ORDER BY last_message_at DESC
  LIMIT p_limit;
END;
$$;

-- Function to get conversation messages
CREATE OR REPLACE FUNCTION get_conversation_messages(
  p_conversation_id UUID,
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  role TEXT,
  content TEXT,
  sources_cited TEXT[],
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ch.id,
    ch.role,
    ch.content,
    ch.sources_cited,
    ch.created_at
  FROM chat_history ch
  WHERE ch.conversation_id = p_conversation_id
  ORDER BY ch.created_at ASC
  LIMIT p_limit;
END;
$$;

-- RLS (Row Level Security)
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own chat history
CREATE POLICY "Users can view own chat history"
  ON chat_history
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::TEXT);

-- Policy: Users can insert their own messages
CREATE POLICY "Users can insert own messages"
  ON chat_history
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid()::TEXT);

-- Policy: Service role has full access
CREATE POLICY "Service role full access to chat_history"
  ON chat_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Analytics view for monitoring
CREATE OR REPLACE VIEW chat_analytics AS
SELECT
  DATE_TRUNC('day', created_at) AS day,
  COUNT(*) AS total_messages,
  COUNT(DISTINCT user_id) AS unique_users,
  COUNT(DISTINCT conversation_id) AS conversations,
  AVG(tokens_used) AS avg_tokens,
  AVG(response_time_ms) AS avg_response_time_ms,
  AVG(feedback_rating) AS avg_rating
FROM chat_history
WHERE role = 'assistant'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY day DESC;
