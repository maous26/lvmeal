-- Migration 004: Analytics Events for LYM Insights
-- Tracks user journey events focused on continuity, reassurance, and return behavior
-- Philosophy: No toxic metrics, no discipline scoring - just understanding moments of life

-- ============================================================================
-- CORE EVENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User identification (anonymous ID from app)
  user_id TEXT NOT NULL,

  -- Event identification
  event_name TEXT NOT NULL,
  event_category TEXT NOT NULL CHECK (event_category IN ('activation', 'continuity', 'reassurance')),

  -- Event payload (flexible JSON for event-specific data)
  payload JSONB DEFAULT '{}',

  -- Context at time of event
  app_version TEXT,
  platform TEXT, -- ios, android

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Day tracking (for gap detection)
  event_date DATE DEFAULT CURRENT_DATE
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Primary lookup by user
CREATE INDEX IF NOT EXISTS idx_analytics_user_id
  ON analytics_events (user_id);

-- Event type queries
CREATE INDEX IF NOT EXISTS idx_analytics_event_name
  ON analytics_events (event_name);

-- Category queries
CREATE INDEX IF NOT EXISTS idx_analytics_event_category
  ON analytics_events (event_category);

-- Time-based queries
CREATE INDEX IF NOT EXISTS idx_analytics_created_at
  ON analytics_events (created_at DESC);

-- User + date for gap detection
CREATE INDEX IF NOT EXISTS idx_analytics_user_date
  ON analytics_events (user_id, event_date);

-- Composite for user journey analysis
CREATE INDEX IF NOT EXISTS idx_analytics_user_event_time
  ON analytics_events (user_id, event_name, created_at DESC);

-- ============================================================================
-- RLS (Row Level Security)
-- ============================================================================

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Policy: Service role has full access (for analytics dashboard)
CREATE POLICY "Service role full access to analytics"
  ON analytics_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Anonymous users can insert their own events
CREATE POLICY "Anon can insert own events"
  ON analytics_events
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Policy: Authenticated users can insert their own events
CREATE POLICY "Users can insert own events"
  ON analytics_events
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid()::TEXT);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to track an event
CREATE OR REPLACE FUNCTION track_event(
  p_user_id TEXT,
  p_event_name TEXT,
  p_event_category TEXT,
  p_payload JSONB DEFAULT '{}',
  p_app_version TEXT DEFAULT NULL,
  p_platform TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO analytics_events (user_id, event_name, event_category, payload, app_version, platform)
  VALUES (p_user_id, p_event_name, p_event_category, p_payload, p_app_version, p_platform)
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

-- Function to get last activity date for a user
CREATE OR REPLACE FUNCTION get_last_activity_date(p_user_id TEXT)
RETURNS DATE
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN (
    SELECT MAX(event_date)
    FROM analytics_events
    WHERE user_id = p_user_id
  );
END;
$$;

-- Function to calculate gap days for a user
CREATE OR REPLACE FUNCTION get_gap_days(p_user_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_last_activity DATE;
BEGIN
  v_last_activity := get_last_activity_date(p_user_id);

  IF v_last_activity IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN CURRENT_DATE - v_last_activity;
END;
$$;

-- ============================================================================
-- INSIGHT VIEWS (Admin Dashboard)
-- ============================================================================

-- VIEW 1: Onboarding Completion Rate
CREATE OR REPLACE VIEW insight_onboarding_completion AS
SELECT
  DATE_TRUNC('week', created_at) AS week,
  COUNT(DISTINCT user_id) FILTER (WHERE event_name = 'onboarding_started') AS started,
  COUNT(DISTINCT user_id) FILTER (WHERE event_name = 'onboarding_completed') AS completed,
  ROUND(
    100.0 * COUNT(DISTINCT user_id) FILTER (WHERE event_name = 'onboarding_completed') /
    NULLIF(COUNT(DISTINCT user_id) FILTER (WHERE event_name = 'onboarding_started'), 0),
    1
  ) AS completion_rate
FROM analytics_events
WHERE event_name IN ('onboarding_started', 'onboarding_completed')
GROUP BY DATE_TRUNC('week', created_at)
ORDER BY week DESC;

-- VIEW 2: First Action Distribution
CREATE OR REPLACE VIEW insight_first_actions AS
SELECT
  payload->>'action_type' AS first_action_type,
  COUNT(*) AS count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS percentage
FROM analytics_events
WHERE event_name = 'first_action_taken'
GROUP BY payload->>'action_type'
ORDER BY count DESC;

-- VIEW 3: Return After Gap Analysis (THE KEY METRIC)
CREATE OR REPLACE VIEW insight_return_after_gap AS
SELECT
  (payload->>'gap_days')::INTEGER AS gap_days,
  COUNT(*) AS returns,
  COUNT(DISTINCT user_id) AS unique_users
FROM analytics_events
WHERE event_name = 'return_after_gap'
GROUP BY (payload->>'gap_days')::INTEGER
ORDER BY gap_days;

-- VIEW 4: Gap Distribution (when do users pause?)
CREATE OR REPLACE VIEW insight_gap_distribution AS
SELECT
  DATE_TRUNC('week', created_at) AS week,
  AVG((payload->>'gap_days')::NUMERIC) AS avg_gap_days,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (payload->>'gap_days')::NUMERIC) AS median_gap_days,
  COUNT(*) AS gap_events
FROM analytics_events
WHERE event_name = 'first_gap_detected'
GROUP BY DATE_TRUNC('week', created_at)
ORDER BY week DESC;

-- VIEW 5: Post-Gap Actions (how do people restart?)
CREATE OR REPLACE VIEW insight_post_gap_actions AS
SELECT
  payload->>'action_type' AS restart_action,
  COUNT(*) AS count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) AS percentage
FROM analytics_events
WHERE event_name = 'post_gap_action'
GROUP BY payload->>'action_type'
ORDER BY count DESC;

-- VIEW 6: Partial Week Usage (normalizing irregularity)
CREATE OR REPLACE VIEW insight_partial_week_usage AS
SELECT
  DATE_TRUNC('week', created_at) AS week,
  COUNT(*) AS partial_week_users,
  AVG((payload->>'active_days')::NUMERIC) AS avg_active_days
FROM analytics_events
WHERE event_name = 'week_with_partial_usage'
GROUP BY DATE_TRUNC('week', created_at)
ORDER BY week DESC;

-- VIEW 7: Deviation Logging (emotional moment)
CREATE OR REPLACE VIEW insight_deviation_events AS
SELECT
  DATE_TRUNC('week', created_at) AS week,
  COUNT(*) AS deviations_logged,
  COUNT(DISTINCT user_id) AS users_who_logged
FROM analytics_events
WHERE event_name = 'first_deviation_logged'
GROUP BY DATE_TRUNC('week', created_at)
ORDER BY week DESC;

-- VIEW 8: Reassurance Effectiveness (THE PROOF)
CREATE OR REPLACE VIEW insight_reassurance_effectiveness AS
WITH reassurance_sent AS (
  SELECT user_id, created_at, id AS reassurance_id
  FROM analytics_events
  WHERE event_name = 'reassurance_message_shown'
),
follow_up AS (
  SELECT user_id, created_at
  FROM analytics_events
  WHERE event_name = 'user_continues_after_reassurance'
)
SELECT
  DATE_TRUNC('week', r.created_at) AS week,
  COUNT(DISTINCT r.user_id) AS reassurance_shown,
  COUNT(DISTINCT f.user_id) AS continued_after,
  ROUND(
    100.0 * COUNT(DISTINCT f.user_id) / NULLIF(COUNT(DISTINCT r.user_id), 0),
    1
  ) AS continuation_rate
FROM reassurance_sent r
LEFT JOIN follow_up f ON r.user_id = f.user_id AND f.created_at > r.created_at
GROUP BY DATE_TRUNC('week', r.created_at)
ORDER BY week DESC;

-- VIEW 9: Daily Active Users by Category
CREATE OR REPLACE VIEW insight_daily_activity AS
SELECT
  event_date,
  COUNT(DISTINCT user_id) AS unique_users,
  COUNT(*) AS total_events,
  COUNT(*) FILTER (WHERE event_category = 'activation') AS activation_events,
  COUNT(*) FILTER (WHERE event_category = 'continuity') AS continuity_events,
  COUNT(*) FILTER (WHERE event_category = 'reassurance') AS reassurance_events
FROM analytics_events
GROUP BY event_date
ORDER BY event_date DESC;

-- VIEW 10: User Journey Summary
CREATE OR REPLACE VIEW insight_user_journey AS
SELECT
  user_id,
  MIN(created_at) AS first_seen,
  MAX(created_at) AS last_seen,
  COUNT(DISTINCT event_date) AS active_days,
  COUNT(*) FILTER (WHERE event_name = 'return_after_gap') AS returns_after_gap,
  COUNT(*) FILTER (WHERE event_name = 'user_continues_after_reassurance') AS continued_after_reassurance,
  BOOL_OR(event_name = 'onboarding_completed') AS completed_onboarding,
  BOOL_OR(event_name = 'first_deviation_logged') AS logged_deviation
FROM analytics_events
GROUP BY user_id;

-- ============================================================================
-- MASTER DASHBOARD VIEW (standalone, no view dependencies)
-- ============================================================================

CREATE OR REPLACE VIEW insight_dashboard_summary AS
SELECT
  (SELECT COUNT(DISTINCT user_id) FROM analytics_events) AS total_users,
  (SELECT COUNT(DISTINCT user_id) FROM analytics_events WHERE event_date = CURRENT_DATE) AS active_today,
  (SELECT COUNT(DISTINCT user_id) FROM analytics_events WHERE event_date >= CURRENT_DATE - INTERVAL '7 days') AS active_last_7_days,
  -- Onboarding completion rate (last 30 days)
  (
    SELECT ROUND(
      100.0 * COUNT(DISTINCT user_id) FILTER (WHERE event_name = 'onboarding_completed') /
      NULLIF(COUNT(DISTINCT user_id) FILTER (WHERE event_name = 'onboarding_started'), 0),
      1
    )
    FROM analytics_events
    WHERE event_name IN ('onboarding_started', 'onboarding_completed')
      AND created_at >= CURRENT_DATE - INTERVAL '30 days'
  ) AS avg_onboarding_completion,
  (SELECT COUNT(*) FROM analytics_events WHERE event_name = 'return_after_gap' AND created_at >= CURRENT_DATE - INTERVAL '7 days') AS returns_last_7_days,
  -- Reassurance effectiveness (last 30 days)
  (
    WITH reassurance AS (
      SELECT DISTINCT user_id FROM analytics_events
      WHERE event_name = 'reassurance_message_shown'
        AND created_at >= CURRENT_DATE - INTERVAL '30 days'
    ),
    continued AS (
      SELECT DISTINCT user_id FROM analytics_events
      WHERE event_name = 'user_continues_after_reassurance'
        AND created_at >= CURRENT_DATE - INTERVAL '30 days'
    )
    SELECT ROUND(100.0 * (SELECT COUNT(*) FROM continued) / NULLIF((SELECT COUNT(*) FROM reassurance), 0), 1)
  ) AS avg_reassurance_success_rate;
