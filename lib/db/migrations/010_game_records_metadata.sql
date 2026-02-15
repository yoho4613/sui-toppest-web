-- Migration: Add game metadata columns to game_records table
-- Purpose: Store full game activity data for analytics and anti-cheat
-- Date: 2025-02-15
-- Updated: Use JSONB for game-specific metadata (supports multiple game types)

-- =============================================
-- 1. Game-Specific Metadata (JSONB - flexible per game)
-- =============================================

-- Game metadata as JSONB - structure varies by game_type
-- Dash Trials: { fever_count, perfect_count, coin_count, potion_count, difficulty }
-- Future games: { level, combo_count, power_ups, boss_defeated, etc. }
ALTER TABLE game_records
ADD COLUMN IF NOT EXISTS game_metadata JSONB DEFAULT NULL;

-- =============================================
-- 2. Session & Anti-Cheat Tracking (common to all games)
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

-- Index for Dash Trials difficulty (GIN for JSONB path)
CREATE INDEX IF NOT EXISTS idx_game_records_difficulty
ON game_records USING gin((game_metadata->'difficulty'))
WHERE game_metadata IS NOT NULL;

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

-- GIN index on full game_metadata for flexible queries
CREATE INDEX IF NOT EXISTS idx_game_records_game_metadata
ON game_records USING gin(game_metadata)
WHERE game_metadata IS NOT NULL;

-- =============================================
-- 5. Add Comments for Documentation
-- =============================================

COMMENT ON COLUMN game_records.game_metadata IS 'Game-specific metadata as JSONB. Structure varies by game_type. E.g., Dash Trials: {fever_count, perfect_count, coin_count, potion_count, difficulty}';
COMMENT ON COLUMN game_records.session_token IS 'Anti-cheat session token used for this game';
COMMENT ON COLUMN game_records.session_start_time IS 'Server timestamp when game session was started';
COMMENT ON COLUMN game_records.session_duration_ms IS 'Server-calculated session duration (should match time_ms)';
COMMENT ON COLUMN game_records.validation_warnings IS 'Array of anti-cheat warnings triggered during validation';
COMMENT ON COLUMN game_records.client_info IS 'Client device/browser info for abuse detection (user_agent, platform, etc.)';

-- =============================================
-- 6. Example Queries for Different Games
-- =============================================

-- Query Dash Trials games by difficulty:
-- SELECT * FROM game_records
-- WHERE game_type = 'dash-trials'
-- AND game_metadata->>'difficulty' = 'hard';

-- Query high fever count games:
-- SELECT * FROM game_records
-- WHERE game_type = 'dash-trials'
-- AND (game_metadata->>'fever_count')::int > 5;

-- Query future puzzle game by level:
-- SELECT * FROM game_records
-- WHERE game_type = 'puzzle-quest'
-- AND (game_metadata->>'level')::int >= 10;
