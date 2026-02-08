-- Migration: Add Star Tickets (bonus tickets that don't reset daily)
-- Run this in Supabase SQL Editor

-- Add star_tickets column to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS star_tickets INTEGER DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN user_profiles.star_tickets IS 'Star tickets - bonus tickets that do not reset daily. Can be earned or purchased.';

-- Optional: Add some star tickets to existing users as a welcome bonus
-- UPDATE user_profiles SET star_tickets = 1 WHERE star_tickets = 0;
