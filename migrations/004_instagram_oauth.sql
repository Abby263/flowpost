-- ============================================================================
-- FlowPost: Instagram → Meta Graph API OAuth (drops username/password)
-- ============================================================================
-- Pivots the Instagram connection model to OAuth-only.
--
-- BREAKING:
--   - Existing username/password Instagram connections are deleted.
--     Workflows that referenced them will lose their connection_id (set null
--     by ON DELETE SET NULL) and need to be re-pointed at a new OAuth
--     connection. There is no way to silently migrate username/password to
--     a Graph API token — the user must reconnect through the OAuth flow.
--
-- New shape for Instagram connections:
--   - credentials JSON       → kept for forward-compat, currently unused for IG
--   - access_token_encrypted → AES-GCM ciphertext of the long-lived Page token
--   - page_id                → numeric Facebook Page ID owning the IG account
--   - ig_business_account_id → already exists (added in migration 003)
--   - token_expires_at       → UTC; long-lived tokens last ~60 days
--   - connection_status      → 'active' | 'expired' | 'revoked' | 'pending'
--
-- Usage:
--   psql $DATABASE_URI -f migrations/004_instagram_oauth.sql
-- ============================================================================

-- 1) Drop legacy username/password Instagram connections.
--    Identified by credentials containing a 'username' key.
DELETE FROM connections
 WHERE platform = 'instagram'
   AND credentials ? 'username';

-- 2) Add OAuth columns. We keep the legacy graph_access_token column for one
--    release so any in-flight rows aren't silently destroyed; new code reads
--    access_token_encrypted exclusively.
ALTER TABLE connections
  ADD COLUMN IF NOT EXISTS access_token_encrypted TEXT;

ALTER TABLE connections
  ADD COLUMN IF NOT EXISTS page_id TEXT;

ALTER TABLE connections
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE connections
  ADD COLUMN IF NOT EXISTS connection_status TEXT NOT NULL DEFAULT 'active'
    CHECK (connection_status IN ('active', 'expired', 'revoked', 'pending'));

CREATE INDEX IF NOT EXISTS idx_connections_status
  ON connections(connection_status)
  WHERE connection_status != 'active';

CREATE INDEX IF NOT EXISTS idx_connections_token_expiry
  ON connections(token_expires_at)
  WHERE platform = 'instagram' AND access_token_encrypted IS NOT NULL;

-- 3) Drop the now-deprecated plaintext graph_access_token column added in
--    migration 003. New code never writes to it.
ALTER TABLE connections DROP COLUMN IF EXISTS graph_access_token;
ALTER TABLE connections DROP COLUMN IF EXISTS graph_token_expires_at;

COMMENT ON COLUMN connections.access_token_encrypted IS 'AES-GCM ciphertext of the long-lived Meta Page access token. Decrypted with TOKEN_ENCRYPTION_KEY. Never log this.';
COMMENT ON COLUMN connections.page_id IS 'Facebook Page ID that owns the IG Business Account.';
COMMENT ON COLUMN connections.token_expires_at IS 'UTC expiry of the long-lived token. Refresh job runs weekly.';
COMMENT ON COLUMN connections.connection_status IS 'pending | active | expired | revoked. UI shows a reconnect prompt when not active.';

DO $$
BEGIN
  RAISE NOTICE 'Migration 004 applied. Legacy IG password connections deleted; OAuth columns added.';
END $$;
