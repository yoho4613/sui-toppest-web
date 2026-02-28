-- =============================================
-- Quests System Migration
-- 퀘스트 시스템 테이블 + 초기 데이터
-- Supabase SQL Editor에서 실행하세요
-- =============================================

-- 1. 퀘스트 정의 테이블
-- =============================================
CREATE TABLE IF NOT EXISTS quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 기본 정보
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🎯',
  category TEXT NOT NULL CHECK (category IN ('daily', 'weekly', 'special')),

  -- 조건
  condition_type TEXT NOT NULL,
  condition_value INTEGER NOT NULL,  -- 목표값 (예: 5게임, 1000점)
  condition_game_type TEXT,          -- null이면 모든 게임

  -- 보상
  reward_type TEXT NOT NULL CHECK (reward_type IN ('club', 'star_ticket', 'sui')),
  reward_amount INTEGER NOT NULL,

  -- 상태
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,

  -- 타임스탬프
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 유저별 퀘스트 진행 상황 테이블
-- =============================================
CREATE TABLE IF NOT EXISTS user_quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL REFERENCES user_profiles(wallet_address) ON DELETE CASCADE,
  quest_id UUID NOT NULL REFERENCES quests(id) ON DELETE CASCADE,

  -- 진행 상황
  progress INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  claimed BOOLEAN NOT NULL DEFAULT false,

  -- 리셋 관리
  period_start DATE NOT NULL DEFAULT CURRENT_DATE,  -- daily/weekly 퀘스트용

  -- 타임스탬프
  completed_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 유니크 제약 (유저당 퀘스트당 기간당 1개)
  UNIQUE(wallet_address, quest_id, period_start)
);

-- 3. 인덱스 생성
-- =============================================
CREATE INDEX IF NOT EXISTS idx_quests_category ON quests(category, is_active);
CREATE INDEX IF NOT EXISTS idx_quests_condition_type ON quests(condition_type);
CREATE INDEX IF NOT EXISTS idx_user_quests_wallet ON user_quests(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_quests_quest ON user_quests(quest_id);
CREATE INDEX IF NOT EXISTS idx_user_quests_period ON user_quests(wallet_address, period_start);
CREATE INDEX IF NOT EXISTS idx_user_quests_claimed ON user_quests(wallet_address, claimed);

-- 4. RLS 정책
-- =============================================
ALTER TABLE quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_quests ENABLE ROW LEVEL SECURITY;

-- Quests: 누구나 조회 가능
DROP POLICY IF EXISTS "Anyone can view quests" ON quests;
CREATE POLICY "Anyone can view quests"
  ON quests FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Service role can manage quests" ON quests;
CREATE POLICY "Service role can manage quests"
  ON quests FOR ALL
  WITH CHECK (true);

-- User Quests: 누구나 조회 가능, 서비스 역할만 수정
DROP POLICY IF EXISTS "Anyone can view user_quests" ON user_quests;
CREATE POLICY "Anyone can view user_quests"
  ON user_quests FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Service role can manage user_quests" ON user_quests;
CREATE POLICY "Service role can manage user_quests"
  ON user_quests FOR ALL
  WITH CHECK (true);

-- 5. 초기 퀘스트 데이터 삽입
-- =============================================

-- Daily Quests (매일 UTC 00:00 리셋)
INSERT INTO quests (title, description, icon, category, condition_type, condition_value, reward_type, reward_amount, sort_order)
VALUES
  ('First Game', 'Play any game once', '🎮', 'daily', 'games_played_daily', 1, 'club', 10, 1),
  ('Make Any Purchase', 'Complete any purchase', '🛒', 'daily', 'purchase_made_daily', 1, 'club', 20, 2),
  ('Invite a Friend', 'Invite 1 friend today', '👋', 'daily', 'referral_daily', 1, 'club', 15, 3);

-- Weekly Quests (매주 월요일 UTC 00:00 리셋)
INSERT INTO quests (title, description, icon, category, condition_type, condition_value, reward_type, reward_amount, sort_order)
VALUES
  ('Play 10 Games', 'Play 10 games this week', '🎯', 'weekly', 'games_played_weekly', 10, 'club', 100, 1),
  ('Over $20 Purchase', 'Spend $20 or more this week', '💵', 'weekly', 'purchase_usd_weekly', 20, 'club', 150, 2),
  ('Invite 10 Friends', 'Invite 10 friends this week', '🤝', 'weekly', 'referral_weekly', 10, 'club', 200, 3);

-- Special Quests (일회성)
INSERT INTO quests (title, description, icon, category, condition_type, condition_value, reward_type, reward_amount, sort_order)
VALUES
  ('Welcome', 'Play your first game', '🌟', 'special', 'first_game', 1, 'club', 50, 1),
  ('Profile Setup', 'Set up your nickname', '✨', 'special', 'profile_complete', 1, 'club', 30, 2),
  ('First Purchase', 'Complete your first purchase', '💎', 'special', 'first_purchase', 1, 'club', 50, 3);

-- 6. 퀘스트 진행 상황 업데이트 함수
-- =============================================
CREATE OR REPLACE FUNCTION update_quest_progress(
  p_wallet TEXT,
  p_condition_type TEXT,
  p_increment INTEGER DEFAULT 1
) RETURNS void AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_week_start DATE := DATE_TRUNC('week', CURRENT_DATE)::DATE;
  v_quest RECORD;
  v_period_start DATE;
  v_current_progress INTEGER;
BEGIN
  -- 해당 condition_type을 가진 활성화된 퀘스트들을 순회
  FOR v_quest IN
    SELECT * FROM quests
    WHERE condition_type = p_condition_type AND is_active = true
  LOOP
    -- period_start 결정
    IF v_quest.category = 'daily' THEN
      v_period_start := v_today;
    ELSIF v_quest.category = 'weekly' THEN
      v_period_start := v_week_start;
    ELSE -- special
      v_period_start := '1970-01-01'::DATE; -- 일회성은 고정값
    END IF;

    -- user_quests에 레코드 생성 또는 업데이트
    INSERT INTO user_quests (wallet_address, quest_id, progress, period_start)
    VALUES (p_wallet, v_quest.id, p_increment, v_period_start)
    ON CONFLICT (wallet_address, quest_id, period_start) DO UPDATE SET
      progress = LEAST(user_quests.progress + p_increment, v_quest.condition_value),
      completed = CASE
        WHEN user_quests.progress + p_increment >= v_quest.condition_value THEN true
        ELSE user_quests.completed
      END,
      completed_at = CASE
        WHEN user_quests.completed = false AND user_quests.progress + p_increment >= v_quest.condition_value THEN NOW()
        ELSE user_quests.completed_at
      END,
      updated_at = NOW();
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 7. 퀘스트 보상 수령 함수
-- =============================================
CREATE OR REPLACE FUNCTION claim_quest_reward(
  p_wallet TEXT,
  p_quest_id UUID
) RETURNS TABLE(
  success BOOLEAN,
  reward_type TEXT,
  reward_amount INTEGER,
  error_message TEXT
) AS $$
DECLARE
  v_quest RECORD;
  v_user_quest RECORD;
  v_today DATE := CURRENT_DATE;
  v_week_start DATE := DATE_TRUNC('week', CURRENT_DATE)::DATE;
  v_period_start DATE;
BEGIN
  -- 퀘스트 정보 조회
  SELECT * INTO v_quest FROM quests WHERE id = p_quest_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::INTEGER, 'Quest not found';
    RETURN;
  END IF;

  -- period_start 결정
  IF v_quest.category = 'daily' THEN
    v_period_start := v_today;
  ELSIF v_quest.category = 'weekly' THEN
    v_period_start := v_week_start;
  ELSE
    v_period_start := '1970-01-01'::DATE;
  END IF;

  -- 유저 퀘스트 상태 조회
  SELECT * INTO v_user_quest
  FROM user_quests
  WHERE wallet_address = p_wallet
    AND quest_id = p_quest_id
    AND period_start = v_period_start;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::INTEGER, 'Quest not started';
    RETURN;
  END IF;

  IF NOT v_user_quest.completed THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::INTEGER, 'Quest not completed';
    RETURN;
  END IF;

  IF v_user_quest.claimed THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::INTEGER, 'Already claimed';
    RETURN;
  END IF;

  -- 보상 수령 처리
  UPDATE user_quests
  SET claimed = true, claimed_at = NOW(), updated_at = NOW()
  WHERE id = v_user_quest.id;

  -- 보상 타입별 처리
  IF v_quest.reward_type = 'club' THEN
    UPDATE user_profiles
    SET total_club = COALESCE(total_club, 0) + v_quest.reward_amount,
        updated_at = NOW()
    WHERE wallet_address = p_wallet;
  ELSIF v_quest.reward_type = 'star_ticket' THEN
    UPDATE user_profiles
    SET star_tickets = COALESCE(star_tickets, 0) + v_quest.reward_amount,
        updated_at = NOW()
    WHERE wallet_address = p_wallet;
  END IF;
  -- sui rewards require on-chain transfer, handled by application layer

  RETURN QUERY SELECT true, v_quest.reward_type, v_quest.reward_amount, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 8. user_profiles에 total_club 컬럼 추가 (없으면)
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'total_club'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN total_club INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

-- 9. 확인 쿼리
-- =============================================
-- SELECT * FROM quests ORDER BY category, sort_order;
-- SELECT * FROM user_quests WHERE wallet_address = 'your_wallet' ORDER BY created_at;
