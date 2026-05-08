import "server-only";

/**
 * Meta OAuth helpers — Facebook Login flow that yields an Instagram Graph API
 * access token + IG Business Account ID, used for both posting and insights.
 *
 * Required Meta App scopes:
 *   - instagram_basic
 *   - instagram_content_publish
 *   - instagram_manage_insights
 *   - pages_show_list
 *   - pages_read_engagement
 *   - business_management
 *
 * Until Meta App Review approves these scopes for your app, only test users
 * added in the Meta Dashboard can complete the flow.
 */

export const META_GRAPH_VERSION = "v22.0";
export const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
export const META_OAUTH_BASE = `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`;

export const REQUIRED_SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_insights",
  "pages_show_list",
  "pages_read_engagement",
  "business_management",
];

export interface MetaConfig {
  appId: string;
  appSecret: string;
  redirectUri: string;
}

export function getMetaConfig(): MetaConfig {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000";
  const redirectUri = `${baseUrl}/api/auth/instagram/callback`;
  if (!appId || !appSecret) {
    throw new Error(
      "META_APP_ID and META_APP_SECRET must be set for Instagram OAuth",
    );
  }
  return { appId, appSecret, redirectUri };
}

export function buildAuthorizeUrl(state: string): string {
  const cfg = getMetaConfig();
  const params = new URLSearchParams({
    client_id: cfg.appId,
    redirect_uri: cfg.redirectUri,
    state,
    response_type: "code",
    scope: REQUIRED_SCOPES.join(","),
  });
  return `${META_OAUTH_BASE}?${params.toString()}`;
}

interface ShortLivedTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

export async function exchangeCodeForToken(
  code: string,
): Promise<ShortLivedTokenResponse> {
  const cfg = getMetaConfig();
  const url = new URL(`${META_GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("client_id", cfg.appId);
  url.searchParams.set("client_secret", cfg.appSecret);
  url.searchParams.set("redirect_uri", cfg.redirectUri);
  url.searchParams.set("code", code);
  const res = await fetch(url.toString());
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`OAuth code exchange failed: ${text.slice(0, 300)}`);
  }
  return JSON.parse(text) as ShortLivedTokenResponse;
}

interface LongLivedTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number; // seconds (~5184000 = 60 days)
}

export async function exchangeForLongLivedToken(
  shortLivedToken: string,
): Promise<LongLivedTokenResponse> {
  const cfg = getMetaConfig();
  const url = new URL(`${META_GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", cfg.appId);
  url.searchParams.set("client_secret", cfg.appSecret);
  url.searchParams.set("fb_exchange_token", shortLivedToken);
  const res = await fetch(url.toString());
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Long-lived token exchange failed: ${text.slice(0, 300)}`);
  }
  return JSON.parse(text) as LongLivedTokenResponse;
}

export interface FacebookPage {
  id: string;
  name: string;
  access_token: string; // Page access token (also long-lived after we exchange)
  instagram_business_account?: { id: string };
}

/**
 * List Pages the user manages, with their attached IG Business Account if any.
 * Page access tokens returned here are long-lived when the User token is
 * long-lived.
 */
export async function listPagesWithInstagram(
  userAccessToken: string,
): Promise<FacebookPage[]> {
  const url = new URL(`${META_GRAPH_BASE}/me/accounts`);
  url.searchParams.set(
    "fields",
    "id,name,access_token,instagram_business_account",
  );
  url.searchParams.set("access_token", userAccessToken);
  const res = await fetch(url.toString());
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Failed to list Pages: ${text.slice(0, 300)}`);
  }
  const data = JSON.parse(text) as { data: FacebookPage[] };
  return data.data || [];
}

/**
 * Look up the IG Business Account's username so we can show a friendly
 * profile name on the Connections page.
 */
export async function fetchIgUsername(
  igUserId: string,
  pageAccessToken: string,
): Promise<string | null> {
  try {
    const url = new URL(`${META_GRAPH_BASE}/${igUserId}`);
    url.searchParams.set("fields", "username");
    url.searchParams.set("access_token", pageAccessToken);
    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = (await res.json()) as { username?: string };
    return data.username || null;
  } catch {
    return null;
  }
}
