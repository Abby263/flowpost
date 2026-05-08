import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { encryptToken } from "@/lib/encryption";
import { exchangeCodeForTokens, fetchMe } from "@/lib/twitter-oauth";
import { insert, queryOne, update } from "@/lib/postgres";

export const dynamic = "force-dynamic";

interface ExistingConnection {
  id: string;
}

// GET /api/auth/twitter/callback?code=...&state=...
//
// Validates state + PKCE verifier, exchanges code for access + refresh
// tokens, fetches the user's @handle, persists the connection. Errors
// surface back to the Connections page via ?tw_error=.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error =
    url.searchParams.get("error_description") || url.searchParams.get("error");

  const dashboardUrl = new URL("/dashboard/connections", url.origin);

  if (error) {
    dashboardUrl.searchParams.set("tw_error", String(error).slice(0, 200));
    return NextResponse.redirect(dashboardUrl);
  }
  if (!code || !state) {
    dashboardUrl.searchParams.set("tw_error", "missing_code_or_state");
    return NextResponse.redirect(dashboardUrl);
  }

  const cookieStore = cookies();
  const expectedState = cookieStore.get("tw_oauth_state")?.value;
  const verifier = cookieStore.get("tw_oauth_verifier")?.value;
  const userId = cookieStore.get("tw_oauth_user")?.value;
  if (!expectedState || expectedState !== state || !verifier || !userId) {
    dashboardUrl.searchParams.set("tw_error", "state_or_verifier_mismatch");
    return NextResponse.redirect(dashboardUrl);
  }

  let tokens;
  try {
    tokens = await exchangeCodeForTokens(code, verifier);
  } catch (err) {
    dashboardUrl.searchParams.set(
      "tw_error",
      err instanceof Error
        ? err.message.slice(0, 200)
        : "token_exchange_failed",
    );
    return NextResponse.redirect(dashboardUrl);
  }

  let me;
  try {
    me = await fetchMe(tokens.access_token);
  } catch (err) {
    dashboardUrl.searchParams.set(
      "tw_error",
      err instanceof Error ? err.message.slice(0, 200) : "fetch_me_failed",
    );
    return NextResponse.redirect(dashboardUrl);
  }

  const expiresAt = new Date(
    Date.now() + (tokens.expires_in || 7200) * 1000,
  ).toISOString();

  const accessTokenEncrypted = encryptToken(tokens.access_token);
  const refreshTokenEncrypted = tokens.refresh_token
    ? encryptToken(tokens.refresh_token)
    : null;

  const existing = await queryOne<ExistingConnection>(
    `SELECT id FROM connections
      WHERE user_id = $1
        AND platform = 'twitter'
        AND oauth_provider_user_id = $2`,
    [userId, me.id],
  );

  if (existing) {
    await update(
      "connections",
      {
        profile_name: me.username,
        access_token_encrypted: accessTokenEncrypted,
        refresh_token_encrypted: refreshTokenEncrypted,
        oauth_provider_user_id: me.id,
        token_expires_at: expiresAt,
        connection_status: "active",
        credentials: JSON.stringify({}),
      },
      "id = $1",
      [existing.id],
    );
  } else {
    await insert("connections", {
      user_id: userId,
      platform: "twitter",
      profile_name: me.username,
      credentials: JSON.stringify({}),
      access_token_encrypted: accessTokenEncrypted,
      refresh_token_encrypted: refreshTokenEncrypted,
      oauth_provider_user_id: me.id,
      token_expires_at: expiresAt,
      connection_status: "active",
    });
  }

  dashboardUrl.searchParams.set("tw_connected", me.username);
  const response = NextResponse.redirect(dashboardUrl);
  response.cookies.delete("tw_oauth_state");
  response.cookies.delete("tw_oauth_verifier");
  response.cookies.delete("tw_oauth_user");
  return response;
}
