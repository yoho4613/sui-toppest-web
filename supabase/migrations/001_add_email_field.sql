-- Add email field for wallet users
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Create index for email lookup
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
