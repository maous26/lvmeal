-- ============================================================================
-- LYM Cloud Sync - Database Schema
-- Run this migration on your Supabase project
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USER DATA TABLE (Profile, Settings)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT UNIQUE NOT NULL,

  -- Profile data (JSONB for flexibility)
  profile JSONB DEFAULT '{}',

  -- Nutrition goals
  nutrition_goals JSONB DEFAULT NULL,

  -- Notification preferences
  notification_preferences JSONB DEFAULT '{
    "dailyInsightsEnabled": true,
    "alertsEnabled": true,
    "celebrationsEnabled": true,
    "lastNotificationDate": null
  }',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_sync_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast user lookup
CREATE INDEX IF NOT EXISTS idx_user_data_user_id ON user_data(user_id);

-- ============================================================================
-- WEIGHT ENTRIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS weight_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,

  -- Weight data
  date DATE NOT NULL,
  weight DECIMAL(5,2) NOT NULL,
  body_fat_percent DECIMAL(4,1),
  muscle_mass DECIMAL(5,2),
  bmi DECIMAL(4,1),

  -- Source
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'scale', 'healthkit')),
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one entry per user per date
  UNIQUE(user_id, date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_weight_entries_user_id ON weight_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_weight_entries_date ON weight_entries(user_id, date DESC);

-- ============================================================================
-- MEAL ENTRIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS meal_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,

  -- Meal info
  date DATE NOT NULL,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'snack', 'dinner')),

  -- Items (array of food items)
  items JSONB DEFAULT '[]',

  -- Totals
  total_calories INTEGER DEFAULT 0,
  total_proteins DECIMAL(5,1) DEFAULT 0,
  total_carbs DECIMAL(5,1) DEFAULT 0,
  total_fats DECIMAL(5,1) DEFAULT 0,

  -- Optional
  photo_url TEXT,
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one entry per user per date per meal type
  UNIQUE(user_id, date, meal_type)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_meal_entries_user_id ON meal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_entries_date ON meal_entries(user_id, date DESC);

-- ============================================================================
-- GAMIFICATION DATA TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS gamification_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT UNIQUE NOT NULL,

  -- XP
  total_xp INTEGER DEFAULT 0,
  weekly_xp INTEGER DEFAULT 0,
  weekly_xp_reset_date DATE DEFAULT CURRENT_DATE,

  -- Streaks
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_activity_date DATE,

  -- Achievements (array of achievement IDs)
  unlocked_achievements TEXT[] DEFAULT '{}',

  -- Premium & Credits
  ai_credits_remaining INTEGER DEFAULT 15,
  is_premium BOOLEAN DEFAULT FALSE,

  -- Timestamps
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_gamification_user_id ON gamification_data(user_id);

-- ============================================================================
-- WELLNESS ENTRIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS wellness_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,

  -- Date
  date DATE NOT NULL,

  -- Sleep
  sleep_hours DECIMAL(3,1),
  sleep_quality INTEGER CHECK (sleep_quality >= 1 AND sleep_quality <= 5),

  -- Energy & Stress (1-10)
  energy_level INTEGER CHECK (energy_level >= 1 AND energy_level <= 10),
  stress_level INTEGER CHECK (stress_level >= 1 AND stress_level <= 10),

  -- Mood
  mood TEXT,

  -- Notes
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one entry per user per date
  UNIQUE(user_id, date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wellness_entries_user_id ON wellness_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_wellness_entries_date ON wellness_entries(user_id, date DESC);

-- ============================================================================
-- MEAL PLANS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS meal_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,

  -- Plan details
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  -- Days (JSONB array of day plans)
  days JSONB NOT NULL DEFAULT '[]',

  -- Shopping list
  shopping_list JSONB DEFAULT '[]',

  -- Metadata
  generated_by TEXT DEFAULT 'ai', -- 'ai', 'manual', 'rag'
  target_calories INTEGER,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_meal_plans_user_id ON meal_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_plans_dates ON meal_plans(user_id, start_date DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE weight_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE gamification_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE wellness_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users
-- Users can only access their own data

-- User Data
CREATE POLICY "Users can view own data" ON user_data
  FOR SELECT USING (auth.uid()::text = user_id OR user_id LIKE 'anon_%');

CREATE POLICY "Users can insert own data" ON user_data
  FOR INSERT WITH CHECK (auth.uid()::text = user_id OR user_id LIKE 'anon_%');

CREATE POLICY "Users can update own data" ON user_data
  FOR UPDATE USING (auth.uid()::text = user_id OR user_id LIKE 'anon_%');

-- Weight Entries
CREATE POLICY "Users can view own weights" ON weight_entries
  FOR SELECT USING (auth.uid()::text = user_id OR user_id LIKE 'anon_%');

CREATE POLICY "Users can insert own weights" ON weight_entries
  FOR INSERT WITH CHECK (auth.uid()::text = user_id OR user_id LIKE 'anon_%');

CREATE POLICY "Users can update own weights" ON weight_entries
  FOR UPDATE USING (auth.uid()::text = user_id OR user_id LIKE 'anon_%');

CREATE POLICY "Users can delete own weights" ON weight_entries
  FOR DELETE USING (auth.uid()::text = user_id OR user_id LIKE 'anon_%');

-- Meal Entries
CREATE POLICY "Users can view own meals" ON meal_entries
  FOR SELECT USING (auth.uid()::text = user_id OR user_id LIKE 'anon_%');

CREATE POLICY "Users can insert own meals" ON meal_entries
  FOR INSERT WITH CHECK (auth.uid()::text = user_id OR user_id LIKE 'anon_%');

CREATE POLICY "Users can update own meals" ON meal_entries
  FOR UPDATE USING (auth.uid()::text = user_id OR user_id LIKE 'anon_%');

CREATE POLICY "Users can delete own meals" ON meal_entries
  FOR DELETE USING (auth.uid()::text = user_id OR user_id LIKE 'anon_%');

-- Gamification
CREATE POLICY "Users can view own gamification" ON gamification_data
  FOR SELECT USING (auth.uid()::text = user_id OR user_id LIKE 'anon_%');

CREATE POLICY "Users can insert own gamification" ON gamification_data
  FOR INSERT WITH CHECK (auth.uid()::text = user_id OR user_id LIKE 'anon_%');

CREATE POLICY "Users can update own gamification" ON gamification_data
  FOR UPDATE USING (auth.uid()::text = user_id OR user_id LIKE 'anon_%');

-- Wellness Entries
CREATE POLICY "Users can view own wellness" ON wellness_entries
  FOR SELECT USING (auth.uid()::text = user_id OR user_id LIKE 'anon_%');

CREATE POLICY "Users can insert own wellness" ON wellness_entries
  FOR INSERT WITH CHECK (auth.uid()::text = user_id OR user_id LIKE 'anon_%');

CREATE POLICY "Users can update own wellness" ON wellness_entries
  FOR UPDATE USING (auth.uid()::text = user_id OR user_id LIKE 'anon_%');

-- Meal Plans
CREATE POLICY "Users can view own plans" ON meal_plans
  FOR SELECT USING (auth.uid()::text = user_id OR user_id LIKE 'anon_%');

CREATE POLICY "Users can insert own plans" ON meal_plans
  FOR INSERT WITH CHECK (auth.uid()::text = user_id OR user_id LIKE 'anon_%');

CREATE POLICY "Users can update own plans" ON meal_plans
  FOR UPDATE USING (auth.uid()::text = user_id OR user_id LIKE 'anon_%');

CREATE POLICY "Users can delete own plans" ON meal_plans
  FOR DELETE USING (auth.uid()::text = user_id OR user_id LIKE 'anon_%');

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_user_data_updated_at
  BEFORE UPDATE ON user_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gamification_updated_at
  BEFORE UPDATE ON gamification_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_meal_plans_updated_at
  BEFORE UPDATE ON meal_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE user_data IS 'User profile and settings for LYM app';
COMMENT ON TABLE weight_entries IS 'Weight tracking history';
COMMENT ON TABLE meal_entries IS 'Daily meal logs';
COMMENT ON TABLE gamification_data IS 'XP, streaks, achievements, and premium status';
COMMENT ON TABLE wellness_entries IS 'Sleep, stress, energy tracking';
COMMENT ON TABLE meal_plans IS 'AI-generated meal plans';
