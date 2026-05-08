import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { encryptToken } from "@/lib/encryption";
import { exchangeCodeForToken, fetchUserInfo } from "@/lib/linkedin-oauth";
import { insert, queryOne, update } from "@/lib/postgres";

export const dynamic = "force-dynamic";

interface ExistingConnection {
  id: string;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error =
    url.searchParams.get("error_description") || url.searchParams.get("error");

  const dashboardUrl = new URL("/dashboard/connections", url.origin);

  if (error) {
    dashboardUrl.searchParams.set("li_error", String(error).slice(0, 200));
    return NextResponse.redirect(dashboardUrl);
  }
  if (!code || !state) {
    dashboardUrl.searchParams.set("li_error", "missing_code_or_state");
    return NextResponse.redirect(dashboardUrl);
  }

  const cookieStore = cookies();
  const expectedState = cookieStore.get("li_oauth_state")?.value;
  const userId = cookieStore.get("li_oauth_user")?.value;
  if (!expectedState || expectedState !== state || !userId) {
    dashboardUrl.searchParams.set("li_error", "state_mismatch");
    return NextResponse.redirect(dashboardUrl);
  }

  let tokens;
  try {
    tokens = await exchangeCodeForToken(code);
  } catch (err) {
    dashboardUrl.searchParams.set(
      "li_error",
      err instanceof Error
        ? err.message.slice(0, 200)
        : "token_exchange_failed",
    );
    return NextResponse.redirect(dashboardUrl);
  }

  let info;
  try {
    info = await fetchUserInfo(tokens.access_token);
  } catch (err) {
    dashboardUrl.searchParams.set(
      "li_error",
      err instanceof Error ? err.message.slice(0, 200) : "userinfo_failed",
    );
    return NextResponse.redirect(dashboardUrl);
  }

  // LinkedIn's UGC posts API uses the URN form `urn:li:person:<sub>`. We
  // store the sub raw and prefix it at post time.
  const expiresAt = new Date(
    Date.now() + (tokens.expires_in || 60 * 24 * 3600) * 1000,
  ).toISOString();

  const accessTokenEncrypted = encryptToken(tokens.access_token);
  const profileName = info.name || info.email || info.sub;

  const existing = await queryOne<ExistingConnection>(
    `SELECT id FROM connections
      WHERE user_id = $1
        AND platform = 'linkedin'
        AND oauth_provider_user_id = $2`,
    [userId, info.sub],
  );

  if (existing) {
    await update(
      "connections",
      {
        profile_name: profileName,
        access_token_encrypted: accessTokenEncrypted,
        oauth_provider_user_id: info.sub,
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
      platform: "linkedin",
      profile_name: profileName,
      credentials: JSON.stringify({}),
      access_token_encrypted: accessTokenEncrypted,
      oauth_provider_user_id: info.sub,
      token_expires_at: expiresAt,
      connection_status: "active",
    });
  }

  dashboardUrl.searchParams.set("li_connected", profileName);
  const response = NextResponse.redirect(dashboardUrl);
  response.cookies.delete("li_oauth_state");
  response.cookies.delete("li_oauth_user");
  return response;
}
