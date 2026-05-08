import "server-only";

/**
 * LinkedIn OAuth 2.0 (OpenID Connect) for "Sign In with LinkedIn".
 *
 * Required products on the LinkedIn Developer Portal:
 *   - Sign In with LinkedIn using OpenID Connect   (issues OAuth tokens)
 *   - Share on LinkedIn                            (lets the app post on
 *                                                   the user's personal feed)
 *
 * Required scopes:
 *   - openid       (OIDC, returns id_token)
 *   - profile      (name, picture)
 *   - email        (only if you want it; not used for posting)
 *   - w_member_social   (post on the user's behalf)
 *
 * Tokens last 60 days and LinkedIn's OIDC flow does NOT return a refresh
 * token, so once they expire the user must reconnect. The weekly
 * refresh-tokens cron flips expired LinkedIn rows to status='expired' so
 * the UI surfaces a Reconnect button.
 */

const AUTHORIZE_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const USERINFO_URL = "https://api.linkedin.com/v2/userinfo";

export const LINKEDIN_SCOPES = ["openid", "profile", "w_member_social"];

export interface LinkedInConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function getLinkedInConfig(): LinkedInConfig {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000";
  const redirectUri = `${baseUrl}/api/auth/linkedin/callback`;
  if (!clientId || !clientSecret) {
    throw new Error(
      "LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET must be set for LinkedIn OAuth",
    );
  }
  return { clientId, clientSecret, redirectUri };
}

export function buildAuthorizeUrl(state: string) {
  const cfg = getLinkedInConfig();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    scope: LINKEDIN_SCOPES.join(" "),
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  expires_in: number; // seconds (60 days = 5184000)
  scope: string;
  token_type: string;
  id_token?: string;
}

export async function exchangeCodeForToken(
  code: string,
): Promise<TokenResponse> {
  const cfg = getLinkedInConfig();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: cfg.redirectUri,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `LinkedIn token endpoint ${res.status}: ${text.slice(0, 300)}`,
    );
  }
  return JSON.parse(text) as TokenResponse;
}

export interface LinkedInUserInfo {
  sub: string; // person ID
  name: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  picture?: string;
}

export async function fetchUserInfo(
  accessToken: string,
): Promise<LinkedInUserInfo> {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `LinkedIn /v2/userinfo ${res.status}: ${text.slice(0, 300)}`,
    );
  }
  return JSON.parse(text) as LinkedInUserInfo;
}
