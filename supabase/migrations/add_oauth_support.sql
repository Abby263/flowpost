-- Migration: Add OAuth support to connections table
-- This adds profile_image column, new platforms, and updates constraints

-- Update platform constraint to include new platforms
ALTER TABLE connections DROP CONSTRAINT IF EXISTS connections_platform_check;
ALTER TABLE connections ADD CONSTRAINT connections_platform_check 
  CHECK (platform IN ('instagram', 'twitter', 'linkedin', 'slack', 'threads', 'facebook', 'youtube'));

-- Add profile_image column if it doesn't exist
ALTER TABLE connections ADD COLUMN IF NOT EXISTS profile_image TEXT;

-- Add token_expires_at column for tracking token expiry
ALTER TABLE connections ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMP WITH TIME ZONE;

-- Add connection_status column for tracking connection health
ALTER TABLE connections ADD COLUMN IF NOT EXISTS connection_status TEXT DEFAULT 'active' 
  CHECK (connection_status IN ('active', 'expired', 'error', 'pending'));

-- Add display_name column for user-friendly account naming
ALTER TABLE connections ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Add last_used_at for tracking activity
ALTER TABLE connections ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMP WITH TIME ZONE;

-- Add index for faster lookups by platform and user
CREATE INDEX IF NOT EXISTS idx_connections_user_platform ON connections(user_id, platform);

-- Add comment for documentation
COMMENT ON COLUMN connections.profile_image IS 'URL to the user profile image from the OAuth provider';
COMMENT ON COLUMN connections.token_expires_at IS 'When the OAuth token expires and needs refresh';
COMMENT ON COLUMN connections.connection_status IS 'Current status: active, expired, error, pending';
COMMENT ON COLUMN connections.display_name IS 'User-friendly name for the connection (for multiple accounts)';
COMMENT ON COLUMN connections.last_used_at IS 'Last time this connection was used to post';

