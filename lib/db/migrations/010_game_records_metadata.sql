-- Migration: Add game metadata columns to game_records table
-- Purpose: Store full game activity data for analytics and anti-cheat
-- Date: 2025-02-15

-- =============================================
-- 1. Game Activity Metadata
-- =============================================

-- Fever mode activations count
ALTER TABLE game_records
ADD COLUMN IF NOT EXISTS fever_count INTEGER DEFAULT NULL;

-- Perfect dodge count
ALTER TABLE game_records
ADD COLUMN IF NOT EXISTS perfect_count INTEGER DEFAULT NULL;

-- Coins collected
ALTER TABLE game_records
ADD COLUMN IF NOT EXISTS coin_count INTEGER DEFAULT NULL;

-- Potions collected
ALTER TABLE game_records
ADD COLUMN IF NOT EXISTS potion_count INTEGER DEFAULT NULL;

-- Difficulty level reached (tutorial, easy, medium, hard, extreme)
ALTER TABLE game_records
ADD COLUMN IF NOT EXISTS difficulty TEXT DEFAULT NULL;

-- =============================================
-- 2. Session & Anti-Cheat Tracking
-- =============================================

-- Session token used for this game (for audit trail)
ALTER TABLE game_records
ADD COLUMN IF NOT EXISTS session_token TEXT DEFAULT NULL;

-- When the game session was started (server timestamp)
ALTER TABLE game_records
ADD COLUMN IF NOT EXISTS session_start_time TIMESTAMPTZ DEFAULT NULL;

-- Actual session duration (server-calculated, for comparison with time_ms)
ALTER TABLE game_records
ADD COLUMN IF NOT EXISTS session_duration_ms INTEGER DEFAULT NULL;

-- Any validation warnings triggered (array of strings)
ALTER TABLE game_records
ADD COLUMN IF NOT EXISTS validation_warnings TEXT[] DEFAULT NULL;

-- =============================================
-- 3. Client Info (for abuse detection)
-- =============================================

-- Client information as JSONB
-- Contains: user_agent, platform, screen_width, screen_height, device_pixel_ratio, timezone
ALTER TABLE game_records
ADD COLUMN IF NOT EXISTS client_info JSONB DEFAULT NULL;

-- =============================================
-- 4. Indexes for Analytics & Anti-Cheat Queries
-- =============================================

-- Index for analyzing games by difficulty
CREATE INDEX IF NOT EXISTS idx_game_records_difficulty
ON game_records(difficulty)
WHERE difficulty IS NOT NULL;

-- Index for finding suspicious games (with validation warnings)
CREATE INDEX IF NOT EXISTS idx_game_records_validation_warnings
ON game_records USING gin(validation_warnings)
WHERE validation_warnings IS NOT NULL;

-- Index for session analysis
CREATE INDEX IF NOT EXISTS idx_game_records_session_token
ON game_records(session_token)
WHERE session_token IS NOT NULL;

-- Index for client platform analysis
CREATE INDEX IF NOT EXISTS idx_game_records_client_platform
ON game_records((client_info->>'platform'))
WHERE client_info IS NOT NULL;

-- =============================================
-- 5. Add Comments for Documentation
-- =============================================

COMMENT ON COLUMN game_records.fever_count IS 'Number of fever mode activations during the game';
COMMENT ON COLUMN game_records.perfect_count IS 'Number of perfect dodges/actions';
COMMENT ON COLUMN game_records.coin_count IS 'Number of coins collected';
COMMENT ON COLUMN game_records.potion_count IS 'Number of health potions collected';
COMMENT ON COLUMN game_records.difficulty IS 'Final difficulty level reached (tutorial, easy, medium, hard, extreme)';
COMMENT ON COLUMN game_records.session_token IS 'Anti-cheat session token used for this game';
COMMENT ON COLUMN game_records.session_start_time IS 'Server timestamp when game session was started';
COMMENT ON COLUMN game_records.session_duration_ms IS 'Server-calculated session duration (should match time_ms)';
COMMENT ON COLUMN game_records.validation_warnings IS 'Array of anti-cheat warnings triggered during validation';
COMMENT ON COLUMN game_records.client_info IS 'Client device/browser info for abuse detection (user_agent, platform, etc.)';
