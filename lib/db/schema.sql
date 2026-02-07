-- =============================================
-- Toppest Game Database Schema
-- Supabase SQL Editor에서 실행하세요
-- =============================================

-- 0. 유저 프로필 테이블 (이미 있으면 스킵됨)
-- =============================================
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
  auth_method TEXT NOT NULL DEFAULT 'wallet' CHECK (auth_method IN ('wallet', 'zklogin')),

  -- Daily tickets (shared across all games, resets at UTC 00:00)
  daily_tickets INTEGER NOT NULL DEFAULT 3,
  last_ticket_reset DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기존 테이블에 컬럼 추가 (이미 있으면 무시)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'daily_tickets') THEN
    ALTER TABLE user_profiles ADD COLUMN daily_tickets INTEGER NOT NULL DEFAULT 3;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'last_ticket_reset') THEN
    ALTER TABLE user_profiles ADD COLUMN last_ticket_reset DATE NOT NULL DEFAULT CURRENT_DATE;
  END IF;
END $$;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_wallet ON user_profiles(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_profiles_google_sub ON user_profiles(google_sub);

-- 1. 시즌 테이블 (리더보드 시즌 관리)
-- =============================================
CREATE TABLE IF NOT EXISTS seasons (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 첫 번째 시즌 생성 (선택사항)
INSERT INTO seasons (name, start_date, end_date, is_active)
VALUES (
  'Season 1',
  NOW(),
  NOW() + INTERVAL '3 months',
  true
);

-- 2. 게임 기록 테이블
-- =============================================
CREATE TABLE IF NOT EXISTS game_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  game_type TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  distance INTEGER NOT NULL DEFAULT 0,
  time_ms INTEGER NOT NULL DEFAULT 0,
  luck_earned INTEGER NOT NULL DEFAULT 0,
  club_earned INTEGER NOT NULL DEFAULT 0,
  season_id INTEGER REFERENCES seasons(id) ON DELETE SET NULL,
  played_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기존 game_records 테이블에 컬럼 추가 (이미 있으면 무시)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'game_records' AND column_name = 'distance') THEN
    ALTER TABLE game_records ADD COLUMN distance INTEGER NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'game_records' AND column_name = 'time_ms') THEN
    ALTER TABLE game_records ADD COLUMN time_ms INTEGER NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'game_records' AND column_name = 'luck_earned') THEN
    ALTER TABLE game_records ADD COLUMN luck_earned INTEGER NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'game_records' AND column_name = 'club_earned') THEN
    ALTER TABLE game_records ADD COLUMN club_earned INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

-- 게임 기록 인덱스
CREATE INDEX IF NOT EXISTS idx_game_records_wallet
  ON game_records(wallet_address);
CREATE INDEX IF NOT EXISTS idx_game_records_game_type
  ON game_records(game_type);
CREATE INDEX IF NOT EXISTS idx_game_records_played_at
  ON game_records(played_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_records_score
  ON game_records(game_type, score DESC);
CREATE INDEX IF NOT EXISTS idx_game_records_user_game
  ON game_records(wallet_address, game_type);
CREATE INDEX IF NOT EXISTS idx_game_records_distance
  ON game_records(game_type, distance DESC);

-- 3. 일일 티켓 테이블 (레거시 - 더이상 사용안함, user_profiles.daily_tickets 사용)
-- =============================================
-- daily_tickets 테이블은 더이상 사용하지 않습니다.
-- 대신 user_profiles 테이블의 daily_tickets, last_ticket_reset 컬럼을 사용합니다.
-- 기존 테이블이 있으면 유지하되, 새로운 로직은 user_profiles를 사용합니다.

-- 4. RLS (Row Level Security) 정책
-- =============================================

-- game_records RLS 활성화
ALTER TABLE game_records ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 후 재생성
DROP POLICY IF EXISTS "Anyone can view game records" ON game_records;
CREATE POLICY "Anyone can view game records"
  ON game_records FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Service role can insert game records" ON game_records;
CREATE POLICY "Service role can insert game records"
  ON game_records FOR INSERT
  WITH CHECK (true);

-- daily_tickets RLS는 더이상 사용하지 않음 (user_profiles 사용)

-- seasons RLS 활성화
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view seasons" ON seasons;
CREATE POLICY "Anyone can view seasons"
  ON seasons FOR SELECT
  USING (true);

-- user_profiles RLS 활성화
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view profiles" ON user_profiles;
CREATE POLICY "Anyone can view profiles"
  ON user_profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Service role can manage profiles" ON user_profiles;
CREATE POLICY "Service role can manage profiles"
  ON user_profiles FOR ALL
  WITH CHECK (true);

-- =============================================
-- 유용한 뷰 (선택사항)
-- =============================================

-- 게임별 리더보드 뷰
CREATE OR REPLACE VIEW leaderboard_view AS
SELECT
  gr.wallet_address,
  gr.game_type,
  MAX(gr.score) as high_score,
  COUNT(*) as games_played,
  SUM(gr.luck_earned) as total_luck,
  up.nickname,
  up.avatar_url,
  up.google_name,
  up.google_picture
FROM game_records gr
LEFT JOIN user_profiles up ON gr.wallet_address = up.wallet_address
GROUP BY gr.wallet_address, gr.game_type, up.nickname, up.avatar_url, up.google_name, up.google_picture;

-- =============================================
-- 테이블 확인 쿼리
-- =============================================
-- 아래 쿼리로 테이블이 정상 생성되었는지 확인하세요

-- SELECT * FROM seasons;
-- SELECT * FROM game_records LIMIT 10;
-- SELECT * FROM daily_tickets LIMIT 10;
