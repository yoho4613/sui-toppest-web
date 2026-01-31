-- =====================================================
-- Toppest Database Schema
-- =====================================================

-- 1. User Profiles Table
-- Stores user profile information for both wallet and zkLogin users
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT UNIQUE NOT NULL,

  -- Profile info
  nickname TEXT,
  avatar_url TEXT,

  -- zkLogin specific (null for wallet users)
  google_email TEXT,
  google_name TEXT,
  google_picture TEXT,
  google_sub TEXT,

  -- Auth method
  auth_method TEXT NOT NULL CHECK (auth_method IN ('wallet', 'zklogin')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_wallet ON user_profiles(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_profiles_google_sub ON user_profiles(google_sub);

-- 2. zkLogin Salts Table
-- Stores salts for zkLogin users (required for consistent address generation)
CREATE TABLE IF NOT EXISTS zklogin_salts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_sub TEXT UNIQUE NOT NULL,
  salt TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zklogin_salts_sub ON zklogin_salts(google_sub);

-- 3. Game Records Table (for future use)
CREATE TABLE IF NOT EXISTS game_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,

  -- Game info
  game_type TEXT NOT NULL,
  score BIGINT NOT NULL,

  -- Rewards
  luck_earned BIGINT DEFAULT 0,
  club_earned BIGINT DEFAULT 0,

  -- Season info
  season_id INTEGER,

  -- Timestamps
  played_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game_records_user ON game_records(user_id);
CREATE INDEX IF NOT EXISTS idx_game_records_wallet ON game_records(wallet_address);
CREATE INDEX IF NOT EXISTS idx_game_records_game_type ON game_records(game_type);
CREATE INDEX IF NOT EXISTS idx_game_records_season ON game_records(season_id);

-- 4. Seasons Table
CREATE TABLE IF NOT EXISTS seasons (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Leaderboard View (per game type, per season)
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  gr.game_type,
  gr.season_id,
  up.wallet_address,
  COALESCE(up.nickname, up.google_name, LEFT(up.wallet_address, 8) || '...') as display_name,
  up.avatar_url,
  MAX(gr.score) as high_score,
  SUM(gr.luck_earned) as total_luck,
  SUM(gr.club_earned) as total_club,
  COUNT(*) as games_played
FROM game_records gr
JOIN user_profiles up ON gr.user_id = up.id
GROUP BY gr.game_type, gr.season_id, up.wallet_address, up.nickname, up.google_name, up.avatar_url
ORDER BY high_score DESC;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for user_profiles
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- Row Level Security (RLS) Policies
-- =====================================================

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE zklogin_salts ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;

-- user_profiles: Anyone can read, only service role can write
CREATE POLICY "Public read access" ON user_profiles FOR SELECT USING (true);
CREATE POLICY "Service role insert" ON user_profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role update" ON user_profiles FOR UPDATE USING (true);

-- zklogin_salts: Only service role can access
CREATE POLICY "Service role only" ON zklogin_salts FOR ALL USING (true);

-- game_records: Anyone can read, only service role can write
CREATE POLICY "Public read access" ON game_records FOR SELECT USING (true);
CREATE POLICY "Service role insert" ON game_records FOR INSERT WITH CHECK (true);

-- seasons: Anyone can read
CREATE POLICY "Public read access" ON seasons FOR SELECT USING (true);
