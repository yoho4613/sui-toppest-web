-- ============================================
-- Referral System Migration
-- ============================================

-- 1. user_profiles 테이블에 레퍼럴 컬럼 추가
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS referred_by TEXT,
ADD COLUMN IF NOT EXISTS referral_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS bonus_tickets INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- referred_by 인덱스
CREATE INDEX IF NOT EXISTS idx_user_profiles_referred_by
ON user_profiles(referred_by);

-- referral_code 인덱스 (빠른 조회용)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_referral_code
ON user_profiles(referral_code);

-- ============================================
-- 1.1 레퍼럴 코드 자동 생성 함수
-- ============================================
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_code TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    -- 8자리 영문+숫자 코드 생성 (예: CLUB7X9K)
    v_code := 'CLUB' || upper(substr(md5(random()::text), 1, 4));

    -- 중복 확인
    SELECT EXISTS(SELECT 1 FROM user_profiles WHERE referral_code = v_code) INTO v_exists;

    -- 중복이 없으면 반환
    IF NOT v_exists THEN
      RETURN v_code;
    END IF;
  END LOOP;
END;
$$;

-- 기존 유저에게 레퍼럴 코드 생성
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT wallet_address FROM user_profiles WHERE referral_code IS NULL
  LOOP
    UPDATE user_profiles
    SET referral_code = generate_referral_code()
    WHERE wallet_address = r.wallet_address;
  END LOOP;
END;
$$;

-- 신규 유저 가입 시 자동 레퍼럴 코드 생성 트리거
CREATE OR REPLACE FUNCTION set_referral_code_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_referral_code ON user_profiles;
CREATE TRIGGER trigger_set_referral_code
BEFORE INSERT ON user_profiles
FOR EACH ROW
EXECUTE FUNCTION set_referral_code_on_insert();

-- 2. referrals 테이블 생성
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_wallet TEXT NOT NULL,
  referred_wallet TEXT NOT NULL,

  -- 초기 보상 (피초대자에게 지급)
  invitee_club_reward INTEGER DEFAULT 250,
  invitee_ticket_reward INTEGER DEFAULT 3,

  -- 수익 공유 누적 (초대자에게 지급된 총액)
  revenue_share_club INTEGER DEFAULT 0,

  -- 상태
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed')),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 중복 방지: 한 사람은 한 번만 초대받을 수 있음
  CONSTRAINT unique_referred_wallet UNIQUE (referred_wallet)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_wallet);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_wallet);

-- ============================================
-- 3. 수익 공유 RPC 함수
-- CLUB 획득/구매 시 초대자에게 수익 공유
-- ============================================
CREATE OR REPLACE FUNCTION grant_referral_revenue_share(
  p_referred_wallet TEXT,
  p_club_amount INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_referral RECORD;
  v_referrer_wallet TEXT;
BEGIN
  -- 입력 검증
  IF p_club_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_amount');
  END IF;

  -- 레퍼럴 관계 조회
  SELECT id, referrer_wallet, revenue_share_club
  INTO v_referral
  FROM referrals
  WHERE referred_wallet = p_referred_wallet
  LIMIT 1;

  -- 레퍼럴 관계가 없으면 종료
  IF v_referral IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_referral');
  END IF;

  v_referrer_wallet := v_referral.referrer_wallet;

  -- 초대자 total_club 증가
  UPDATE user_profiles
  SET total_club = COALESCE(total_club, 0) + p_club_amount
  WHERE wallet_address = v_referrer_wallet;

  -- 레퍼럴 테이블 누적
  UPDATE referrals
  SET revenue_share_club = revenue_share_club + p_club_amount
  WHERE id = v_referral.id;

  RETURN jsonb_build_object(
    'success', true,
    'referrer_wallet', v_referrer_wallet,
    'club_granted', p_club_amount,
    'total_revenue_share', v_referral.revenue_share_club + p_club_amount
  );
END;
$$;

-- ============================================
-- 4. 레퍼럴 생성 함수
-- 신규 유저 가입 시 레퍼럴 관계 생성 + 보상 지급
-- referral_code 또는 wallet address 모두 지원
-- ============================================
CREATE OR REPLACE FUNCTION create_referral(
  p_referrer_code TEXT,  -- referral_code 또는 wallet address
  p_referred_wallet TEXT,
  p_club_reward INTEGER DEFAULT 250,
  p_ticket_reward INTEGER DEFAULT 3
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_referral_id UUID;
  v_referred_created_at TIMESTAMPTZ;
  v_time_diff INTERVAL;
  v_referrer_wallet TEXT;
BEGIN
  -- referral_code로 초대자 wallet 조회 (CLUB로 시작하면 코드, 아니면 wallet)
  IF p_referrer_code LIKE 'CLUB%' THEN
    SELECT wallet_address INTO v_referrer_wallet
    FROM user_profiles
    WHERE referral_code = p_referrer_code;
  ELSE
    v_referrer_wallet := p_referrer_code;
  END IF;

  -- 초대자가 존재하는지 확인
  IF v_referrer_wallet IS NULL OR NOT EXISTS (SELECT 1 FROM user_profiles WHERE wallet_address = v_referrer_wallet) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'referrer_not_found');
  END IF;

  -- 자기 자신 초대 방지
  IF v_referrer_wallet = p_referred_wallet THEN
    RETURN jsonb_build_object('success', false, 'reason', 'self_referral');
  END IF;

  -- 피초대자가 이미 레퍼럴이 있는지 확인
  IF EXISTS (SELECT 1 FROM referrals WHERE referred_wallet = p_referred_wallet) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_referred');
  END IF;

  -- 피초대자의 referred_by가 이미 설정되어 있는지 확인
  IF EXISTS (SELECT 1 FROM user_profiles WHERE wallet_address = p_referred_wallet AND referred_by IS NOT NULL) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_referred');
  END IF;

  -- 피초대자가 신규 유저인지 확인 (1분 이내 가입)
  SELECT created_at INTO v_referred_created_at
  FROM user_profiles
  WHERE wallet_address = p_referred_wallet;

  IF v_referred_created_at IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'referred_user_not_found');
  END IF;

  v_time_diff := NOW() - v_referred_created_at;
  IF v_time_diff > INTERVAL '1 minute' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_new_user', 'created_ago_seconds', EXTRACT(EPOCH FROM v_time_diff));
  END IF;

  -- 레퍼럴 관계 생성
  INSERT INTO referrals (referrer_wallet, referred_wallet, invitee_club_reward, invitee_ticket_reward)
  VALUES (v_referrer_wallet, p_referred_wallet, p_club_reward, p_ticket_reward)
  RETURNING id INTO v_referral_id;

  -- 피초대자의 referred_by 설정
  UPDATE user_profiles
  SET referred_by = v_referrer_wallet
  WHERE wallet_address = p_referred_wallet;

  -- 피초대자에게 보상 지급
  UPDATE user_profiles
  SET
    total_club = COALESCE(total_club, 0) + p_club_reward,
    bonus_tickets = COALESCE(bonus_tickets, 0) + p_ticket_reward
  WHERE wallet_address = p_referred_wallet;

  -- 초대자의 referral_count 증가
  UPDATE user_profiles
  SET referral_count = COALESCE(referral_count, 0) + 1
  WHERE wallet_address = v_referrer_wallet;

  RETURN jsonb_build_object(
    'success', true,
    'referral_id', v_referral_id,
    'referrer_wallet', v_referrer_wallet,
    'club_reward', p_club_reward,
    'ticket_reward', p_ticket_reward
  );
END;
$$;

-- ============================================
-- 5. 레퍼럴 코드로 지갑 주소 조회 함수
-- ============================================
CREATE OR REPLACE FUNCTION get_wallet_by_referral_code(
  p_referral_code TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet TEXT;
BEGIN
  SELECT wallet_address INTO v_wallet
  FROM user_profiles
  WHERE referral_code = p_referral_code;

  RETURN v_wallet;
END;
$$;

-- ============================================
-- 6. 레퍼럴 통계 조회 함수
-- ============================================
CREATE OR REPLACE FUNCTION get_referral_stats(
  p_wallet_address TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_count INTEGER;
  v_total_signup_rewards INTEGER;
  v_total_revenue_share INTEGER;
BEGIN
  -- 총 초대 수
  SELECT COUNT(*) INTO v_total_count
  FROM referrals
  WHERE referrer_wallet = p_wallet_address;

  -- 총 가입 보상 (현재 초대자는 가입 보상 없음 = 0)
  SELECT COALESCE(SUM(0), 0) INTO v_total_signup_rewards
  FROM referrals
  WHERE referrer_wallet = p_wallet_address;

  -- 총 수익 공유
  SELECT COALESCE(SUM(revenue_share_club), 0) INTO v_total_revenue_share
  FROM referrals
  WHERE referrer_wallet = p_wallet_address;

  RETURN jsonb_build_object(
    'total_count', v_total_count,
    'total_signup_rewards', v_total_signup_rewards,
    'total_revenue_share', v_total_revenue_share
  );
END;
$$;
