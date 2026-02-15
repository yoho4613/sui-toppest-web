-- ============================================
-- Game Sessions Table (Anti-Cheat System)
-- ============================================
-- This table stores game session tokens to prevent:
-- - Replay attacks (resubmitting same game results)
-- - Fabricated submissions (no actual game played)
-- - Rate limiting bypass
-- ============================================

-- 1. Create game_sessions table
CREATE TABLE IF NOT EXISTS game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Session token (cryptographically secure, 64 char hex)
  session_token TEXT NOT NULL UNIQUE,

  -- User identification
  wallet_address TEXT NOT NULL,

  -- Game information
  game_type TEXT NOT NULL,

  -- Timing
  start_time TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,

  -- Usage tracking
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_game_sessions_token
ON game_sessions(session_token);

CREATE INDEX IF NOT EXISTS idx_game_sessions_wallet
ON game_sessions(wallet_address);

CREATE INDEX IF NOT EXISTS idx_game_sessions_expires
ON game_sessions(expires_at);

-- Composite index for common query pattern
CREATE INDEX IF NOT EXISTS idx_game_sessions_wallet_unused
ON game_sessions(wallet_address, used)
WHERE used = FALSE;

-- ============================================
-- 3. Automatic cleanup of expired sessions
-- Run this periodically (e.g., via cron job or pg_cron)
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_expired_game_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  -- Delete sessions older than 1 hour past expiry
  -- Keep some buffer for debugging purposes
  DELETE FROM game_sessions
  WHERE expires_at < NOW() - INTERVAL '1 hour';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN v_deleted;
END;
$$;

-- ============================================
-- 4. Rate limiting helper function
-- Returns recent game count for a wallet
-- ============================================
CREATE OR REPLACE FUNCTION get_recent_game_count(
  p_wallet_address TEXT,
  p_hours INTEGER DEFAULT 24
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM game_records
  WHERE wallet_address = p_wallet_address
    AND played_at > NOW() - (p_hours || ' hours')::INTERVAL;

  RETURN v_count;
END;
$$;

-- ============================================
-- 5. Suspicious activity logging table
-- For monitoring and analysis of potential abuse
-- ============================================
CREATE TABLE IF NOT EXISTS suspicious_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  wallet_address TEXT NOT NULL,
  reason TEXT NOT NULL,
  details JSONB,

  -- Request metadata
  ip_address TEXT,
  user_agent TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suspicious_activity_wallet
ON suspicious_activity_log(wallet_address);

CREATE INDEX IF NOT EXISTS idx_suspicious_activity_time
ON suspicious_activity_log(created_at);

-- ============================================
-- 6. Function to log suspicious activity
-- ============================================
CREATE OR REPLACE FUNCTION log_suspicious_activity(
  p_wallet_address TEXT,
  p_reason TEXT,
  p_details JSONB DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO suspicious_activity_log (
    wallet_address,
    reason,
    details,
    ip_address,
    user_agent
  )
  VALUES (
    p_wallet_address,
    p_reason,
    p_details,
    p_ip_address,
    p_user_agent
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- ============================================
-- 7. View for monitoring suspicious wallets
-- Wallets with multiple suspicious activities
-- ============================================
CREATE OR REPLACE VIEW suspicious_wallets AS
SELECT
  wallet_address,
  COUNT(*) as incident_count,
  array_agg(DISTINCT reason) as reasons,
  MIN(created_at) as first_incident,
  MAX(created_at) as last_incident
FROM suspicious_activity_log
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY wallet_address
HAVING COUNT(*) >= 3
ORDER BY incident_count DESC;

-- ============================================
-- Comments for documentation
-- ============================================
COMMENT ON TABLE game_sessions IS 'Stores game session tokens for anti-cheat validation';
COMMENT ON COLUMN game_sessions.session_token IS 'Cryptographically secure token (64 char hex)';
COMMENT ON COLUMN game_sessions.used IS 'TRUE once token has been consumed by game record submission';
COMMENT ON TABLE suspicious_activity_log IS 'Log of potential cheating/abuse attempts';
