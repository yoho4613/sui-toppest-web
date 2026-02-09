-- =============================================
-- Shop Database Schema
-- Supabase SQL Editor에서 실행하세요
-- =============================================

-- 1. 상품 테이블
-- =============================================
CREATE TABLE IF NOT EXISTS shop_products (
  id TEXT PRIMARY KEY,

  -- Product info
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- 'tickets', 'boosters', 'cosmetics', etc.

  -- Pricing
  price_usd DECIMAL(10, 2) NOT NULL,
  price_sui_mist BIGINT, -- Calculated from USD, nullable for auto-calc
  price_luck BIGINT NOT NULL, -- LUCK token price (without decimals)

  -- Reward
  reward_type TEXT NOT NULL, -- 'star_tickets', 'energy', 'booster', etc.
  reward_amount INTEGER NOT NULL,

  -- Display
  sort_order INTEGER DEFAULT 0,
  badge TEXT, -- 'NEW', 'HOT', 'POPULAR', etc.
  bonus_text TEXT, -- '+20%', '-30%', etc.
  is_active BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 상품 인덱스
CREATE INDEX IF NOT EXISTS idx_shop_products_category ON shop_products(category);
CREATE INDEX IF NOT EXISTS idx_shop_products_active ON shop_products(is_active);
CREATE INDEX IF NOT EXISTS idx_shop_products_sort ON shop_products(category, sort_order);

-- 2. 구매 기록 테이블
-- =============================================
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User info
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,

  -- Product info
  product_id TEXT REFERENCES shop_products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL, -- Snapshot at purchase time
  reward_type TEXT NOT NULL,
  reward_amount INTEGER NOT NULL,

  -- Payment info
  payment_method TEXT NOT NULL CHECK (payment_method IN ('sui', 'luck')),
  amount_paid BIGINT NOT NULL, -- In MIST for SUI, with decimals for LUCK
  price_usd DECIMAL(10, 2),

  -- Transaction info
  transaction_digest TEXT,
  sender_address TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 구매 기록 인덱스
CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_wallet ON purchases(wallet_address);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
CREATE INDEX IF NOT EXISTS idx_purchases_created ON purchases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_digest ON purchases(transaction_digest);

-- 3. user_profiles에 star_tickets 컬럼 추가
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'star_tickets') THEN
    ALTER TABLE user_profiles ADD COLUMN star_tickets INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

-- 4. RLS 정책
-- =============================================

-- shop_products RLS
ALTER TABLE shop_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active products" ON shop_products;
CREATE POLICY "Anyone can view active products"
  ON shop_products FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Service role can manage products" ON shop_products;
CREATE POLICY "Service role can manage products"
  ON shop_products FOR ALL
  USING (true)
  WITH CHECK (true);

-- purchases RLS
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own purchases" ON purchases;
CREATE POLICY "Users can view own purchases"
  ON purchases FOR SELECT
  USING (true); -- Service role handles this

DROP POLICY IF EXISTS "Service role can manage purchases" ON purchases;
CREATE POLICY "Service role can manage purchases"
  ON purchases FOR ALL
  USING (true)
  WITH CHECK (true);

-- 5. 초기 상품 데이터
-- =============================================
INSERT INTO shop_products (id, name, description, category, price_usd, price_luck, reward_type, reward_amount, sort_order, badge, bonus_text)
VALUES
  -- Star Tickets
  ('tickets_10', '10 Star Tickets', 'Get 10 bonus tickets to play more games', 'tickets', 1.75, 100, 'star_tickets', 10, 1, NULL, NULL),
  ('tickets_30', '30 Star Tickets', 'Get 30 bonus tickets with 20% bonus value', 'tickets', 4.20, 250, 'star_tickets', 30, 2, 'POPULAR', '+20%'),
  ('tickets_100', '100 Star Tickets', 'Best value! Get 100 bonus tickets with 30% bonus', 'tickets', 12.25, 700, 'star_tickets', 100, 3, 'BEST', '+30%')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_usd = EXCLUDED.price_usd,
  price_luck = EXCLUDED.price_luck,
  reward_amount = EXCLUDED.reward_amount,
  badge = EXCLUDED.badge,
  bonus_text = EXCLUDED.bonus_text,
  updated_at = NOW();

-- 6. 유용한 함수들
-- =============================================

-- 스타 티켓 추가 함수
CREATE OR REPLACE FUNCTION add_star_tickets(p_wallet_address TEXT, p_amount INTEGER)
RETURNS void AS $$
BEGIN
  UPDATE user_profiles
  SET star_tickets = star_tickets + p_amount,
      updated_at = NOW()
  WHERE wallet_address = p_wallet_address;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 구매 완료 처리 함수 (트랜잭션으로 구매완료 + 리워드 지급)
CREATE OR REPLACE FUNCTION complete_purchase(
  p_purchase_id UUID,
  p_digest TEXT,
  p_sender TEXT
)
RETURNS TABLE(success BOOLEAN, reward_type TEXT, reward_amount INTEGER) AS $$
DECLARE
  v_purchase purchases%ROWTYPE;
BEGIN
  -- Get purchase record
  SELECT * INTO v_purchase FROM purchases WHERE id = p_purchase_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::INTEGER;
    RETURN;
  END IF;

  -- Update purchase status
  UPDATE purchases
  SET status = 'completed',
      transaction_digest = p_digest,
      sender_address = p_sender,
      verified_at = NOW(),
      updated_at = NOW()
  WHERE id = p_purchase_id;

  -- Grant reward based on type
  IF v_purchase.reward_type = 'star_tickets' THEN
    PERFORM add_star_tickets(v_purchase.wallet_address, v_purchase.reward_amount);
  END IF;

  RETURN QUERY SELECT true, v_purchase.reward_type, v_purchase.reward_amount;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
