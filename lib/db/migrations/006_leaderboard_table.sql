-- =============================================
-- Leaderboard Table Migration
-- 리더보드 성능 최적화를 위한 별도 테이블
-- Supabase SQL Editor에서 실행하세요
-- =============================================

-- 0. 기존 뷰 삭제 (테이블로 대체)
-- =============================================
-- 기존 leaderboard_view나 leaderboard 뷰가 있으면 삭제
DROP VIEW IF EXISTS leaderboard_view CASCADE;
DROP VIEW IF EXISTS leaderboard CASCADE;

-- 1. 리더보드 테이블 생성
-- =============================================
CREATE TABLE IF NOT EXISTS leaderboard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  game_type TEXT NOT NULL,

  -- 최고 기록 (all-time)
  high_score INTEGER NOT NULL DEFAULT 0,
  high_distance INTEGER NOT NULL DEFAULT 0,

  -- 주간 최고 기록 (weekly reset)
  weekly_high_score INTEGER NOT NULL DEFAULT 0,
  weekly_high_distance INTEGER NOT NULL DEFAULT 0,

  -- 일간 최고 기록 (daily reset)
  daily_high_score INTEGER NOT NULL DEFAULT 0,
  daily_high_distance INTEGER NOT NULL DEFAULT 0,

  -- 통계
  games_played INTEGER NOT NULL DEFAULT 0,
  total_club_earned INTEGER NOT NULL DEFAULT 0,

  -- 타임스탬프
  last_played_at TIMESTAMPTZ DEFAULT NOW(),
  weekly_reset_at DATE NOT NULL DEFAULT CURRENT_DATE,
  daily_reset_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 유니크 제약 (유저당 게임타입별 1개 레코드)
  UNIQUE(wallet_address, game_type),

  -- 외래 키: user_profiles와 연결 (PostgREST JOIN을 위해 필요)
  CONSTRAINT fk_leaderboard_user_profiles
    FOREIGN KEY (wallet_address)
    REFERENCES user_profiles(wallet_address)
    ON DELETE CASCADE
);

-- 2. 인덱스 생성
-- =============================================
-- All-time 랭킹 조회용
CREATE INDEX IF NOT EXISTS idx_leaderboard_alltime
  ON leaderboard(game_type, high_score DESC);

-- Weekly 랭킹 조회용
CREATE INDEX IF NOT EXISTS idx_leaderboard_weekly
  ON leaderboard(game_type, weekly_high_score DESC);

-- Daily 랭킹 조회용
CREATE INDEX IF NOT EXISTS idx_leaderboard_daily
  ON leaderboard(game_type, daily_high_score DESC);

-- 유저 조회용
CREATE INDEX IF NOT EXISTS idx_leaderboard_wallet
  ON leaderboard(wallet_address);

-- 3. RLS 정책
-- =============================================
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view leaderboard" ON leaderboard;
CREATE POLICY "Anyone can view leaderboard"
  ON leaderboard FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Service role can manage leaderboard" ON leaderboard;
CREATE POLICY "Service role can manage leaderboard"
  ON leaderboard FOR ALL
  WITH CHECK (true);

-- 4. 리더보드 업데이트 함수
-- =============================================
CREATE OR REPLACE FUNCTION update_leaderboard(
  p_wallet TEXT,
  p_game_type TEXT,
  p_score INTEGER,
  p_distance INTEGER,
  p_club INTEGER
) RETURNS void AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_week_start DATE := DATE_TRUNC('week', CURRENT_DATE)::DATE;
BEGIN
  INSERT INTO leaderboard (
    wallet_address,
    game_type,
    high_score,
    high_distance,
    weekly_high_score,
    weekly_high_distance,
    daily_high_score,
    daily_high_distance,
    games_played,
    total_club_earned,
    last_played_at,
    weekly_reset_at,
    daily_reset_at
  )
  VALUES (
    p_wallet,
    p_game_type,
    p_score,
    p_distance,
    p_score,
    p_distance,
    p_score,
    p_distance,
    1,
    p_club,
    NOW(),
    v_week_start,
    v_today
  )
  ON CONFLICT (wallet_address, game_type) DO UPDATE SET
    -- All-time high score (항상 최고값 유지)
    high_score = GREATEST(leaderboard.high_score, p_score),
    high_distance = GREATEST(leaderboard.high_distance, p_distance),

    -- Weekly high score (주가 바뀌면 리셋)
    weekly_high_score = CASE
      WHEN leaderboard.weekly_reset_at < v_week_start THEN p_score
      ELSE GREATEST(leaderboard.weekly_high_score, p_score)
    END,
    weekly_high_distance = CASE
      WHEN leaderboard.weekly_reset_at < v_week_start THEN p_distance
      ELSE GREATEST(leaderboard.weekly_high_distance, p_distance)
    END,
    weekly_reset_at = CASE
      WHEN leaderboard.weekly_reset_at < v_week_start THEN v_week_start
      ELSE leaderboard.weekly_reset_at
    END,

    -- Daily high score (날짜가 바뀌면 리셋)
    daily_high_score = CASE
      WHEN leaderboard.daily_reset_at < v_today THEN p_score
      ELSE GREATEST(leaderboard.daily_high_score, p_score)
    END,
    daily_high_distance = CASE
      WHEN leaderboard.daily_reset_at < v_today THEN p_distance
      ELSE GREATEST(leaderboard.daily_high_distance, p_distance)
    END,
    daily_reset_at = CASE
      WHEN leaderboard.daily_reset_at < v_today THEN v_today
      ELSE leaderboard.daily_reset_at
    END,

    -- 통계 업데이트
    games_played = leaderboard.games_played + 1,
    total_club_earned = leaderboard.total_club_earned + p_club,
    last_played_at = NOW(),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- 5. 기존 game_records 데이터로 leaderboard 초기화 (선택사항)
-- =============================================
-- 아래 쿼리로 기존 데이터를 leaderboard 테이블로 마이그레이션할 수 있습니다.
-- 주의: 이미 데이터가 있으면 중복 오류가 발생할 수 있습니다.

/*
INSERT INTO leaderboard (wallet_address, game_type, high_score, high_distance, weekly_high_score, weekly_high_distance, daily_high_score, daily_high_distance, games_played, total_club_earned, last_played_at)
SELECT
  wallet_address,
  game_type,
  MAX(score) as high_score,
  MAX(distance) as high_distance,
  MAX(CASE WHEN played_at >= DATE_TRUNC('week', CURRENT_DATE) THEN score ELSE 0 END) as weekly_high_score,
  MAX(CASE WHEN played_at >= DATE_TRUNC('week', CURRENT_DATE) THEN distance ELSE 0 END) as weekly_high_distance,
  MAX(CASE WHEN played_at >= CURRENT_DATE THEN score ELSE 0 END) as daily_high_score,
  MAX(CASE WHEN played_at >= CURRENT_DATE THEN distance ELSE 0 END) as daily_high_distance,
  COUNT(*) as games_played,
  SUM(COALESCE(club_earned, 0)) as total_club_earned,
  MAX(played_at) as last_played_at
FROM game_records
GROUP BY wallet_address, game_type
ON CONFLICT (wallet_address, game_type) DO NOTHING;
*/

-- 6. 확인 쿼리
-- =============================================
-- SELECT * FROM leaderboard ORDER BY high_score DESC LIMIT 10;
-- SELECT * FROM leaderboard WHERE game_type = 'dash-trials' ORDER BY weekly_high_score DESC;
