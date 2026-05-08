-- ============================================================================
-- FlowPost: Twitter/X + LinkedIn OAuth
-- ============================================================================
-- Extends connections to hold OAuth tokens for X (Twitter) and LinkedIn the
-- same way migration 004 did for Instagram. Most columns added in 004 already
-- work for both:
--   - access_token_encrypted     (AES-GCM ciphertext)
--   - token_expires_at           (UTC)
--   - connection_status          ('active' | 'expired' | 'revoked' | 'pending')
--
-- This migration adds:
--   - refresh_token_encrypted    Twitter's OAuth 2.0 PKCE flow returns a
--                                refresh token alongside the (2-hour) access
--                                token. Without it the user would have to
--                                re-OAuth every 2 hours.
--   - oauth_provider_user_id     The platform's user ID (Twitter user_id,
--                                LinkedIn URN). Decoupled from
--                                ig_business_account_id so each platform has
--                                its own field.
--
-- Drops legacy username/password rows for Twitter (similar to what 004 did
-- for Instagram). LinkedIn never used a password flow so nothing to drop.
--
-- Usage:
--   psql $DATABASE_URI -f migrations/006_twitter_linkedin_oauth.sql
-- ============================================================================

-- 1) Drop legacy Twitter API-key rows (kept track an apiKey/apiKeySecret pair
--    in credentials JSON; that flow is now replaced by OAuth).
DELETE FROM connections
 WHERE platform = 'twitter'
   AND credentials ? 'apiKey';

-- 2) New columns.
ALTER TABLE connections
  ADD COLUMN IF NOT EXISTS refresh_token_encrypted TEXT;

ALTER TABLE connections
  ADD COLUMN IF NOT EXISTS oauth_provider_user_id TEXT;

CREATE INDEX IF NOT EXISTS idx_connections_oauth_user
  ON connections(platform, oauth_provider_user_id)
  WHERE oauth_provider_user_id IS NOT NULL;

COMMENT ON COLUMN connections.refresh_token_encrypted IS 'AES-GCM ciphertext of the OAuth refresh token (Twitter only — LinkedIn OIDC does not issue one).';
COMMENT ON COLUMN connections.oauth_provider_user_id IS 'Platform-native user identifier. Twitter: numeric user_id. LinkedIn: person URN. Instagram uses ig_business_account_id instead.';

DO $$
BEGIN
  RAISE NOTICE 'Migration 006 applied. Twitter/LinkedIn OAuth columns added; legacy Twitter API-key connections deleted.';
END $$;
