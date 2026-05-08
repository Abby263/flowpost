import "server-only";
import { createHash, randomBytes } from "crypto";

/**
 * X (Twitter) OAuth 2.0 with PKCE.
 *
 * Required scopes:
 *   - tweet.read
 *   - tweet.write
 *   - users.read
 *   - offline.access  (returns a refresh token; otherwise tokens last 2 hours
 *                      and the user has to re-authorize every time)
 *
 * Free tier limits posting to ~1500 tweets/month per app, total. That's a
 * single-user product cap; if you upgrade to Basic, you'll edit the Vercel
 * env, no code change.
 */

const AUTHORIZE_URL = "https://twitter.com/i/oauth2/authorize";
const TOKEN_URL = "https://api.twitter.com/2/oauth2/token";
const ME_URL = "https://api.twitter.com/2/users/me";

export const TWITTER_SCOPES = [
  "tweet.read",
  "tweet.write",
  "users.read",
  "offline.access",
];

export interface TwitterConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function getTwitterConfig(): TwitterConfig {
  const clientId = process.env.TWITTER_CLIENT_ID;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET;
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000";
  const redirectUri = `${baseUrl}/api/auth/twitter/callback`;
  if (!clientId || !clientSecret) {
    throw new Error(
      "TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET must be set for X OAuth",
    );
  }
  return { clientId, clientSecret, redirectUri };
}

/** PKCE: generate a code verifier (43–128 chars, base64url). */
export function generatePkce() {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

function base64url(b: Buffer): string {
  return b
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function buildAuthorizeUrl(state: string, codeChallenge: string) {
  const cfg = getTwitterConfig();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    scope: TWITTER_SCOPES.join(" "),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

interface TokenResponse {
  token_type: string;
  expires_in: number; // seconds (typically 7200)
  access_token: string;
  refresh_token?: string;
  scope?: string;
}

/** Both code-exchange and refresh use the same endpoint with different grant_type. */
async function postToken(body: URLSearchParams): Promise<TokenResponse> {
  const cfg = getTwitterConfig();
  // Confidential clients use HTTP Basic auth with client_id:client_secret.
  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString(
    "base64",
  );
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`X token endpoint ${res.status}: ${text.slice(0, 300)}`);
  }
  return JSON.parse(text) as TokenResponse;
}

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
): Promise<TokenResponse> {
  const cfg = getTwitterConfig();
  return postToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: cfg.redirectUri,
      code_verifier: codeVerifier,
      client_id: cfg.clientId,
    }),
  );
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<TokenResponse> {
  const cfg = getTwitterConfig();
  return postToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: cfg.clientId,
    }),
  );
}

export interface TwitterMe {
  id: string;
  username: string;
  name: string;
}

export async function fetchMe(accessToken: string): Promise<TwitterMe> {
  const res = await fetch(ME_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`X /users/me ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = JSON.parse(text) as { data: TwitterMe };
  return data.data;
}
