import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { encryptToken } from "@/lib/encryption";
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  fetchIgUsername,
  listPagesWithInstagram,
} from "@/lib/meta-oauth";
import { insert, queryOne, update } from "@/lib/postgres";

export const dynamic = "force-dynamic";

interface ExistingConnection {
  id: string;
}

// GET /api/auth/instagram/callback?code=...&state=...
//
// Validates the OAuth state, exchanges for a long-lived token, lists the
// user's Pages, and:
//   - If exactly one Page has an attached IG Business Account, saves the
//     connection immediately and redirects back to /dashboard/connections.
//   - If multiple Pages match, redirects to /dashboard/connections?ig_pick=1
//     with a temporary cookie that holds the candidate list, so the UI can
//     prompt the user to pick which IG account to connect.
//
// We never log or surface the access token in URLs. Errors are surfaced via
// a query param (?ig_error=...) so the Connections page can show a toast.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error =
    url.searchParams.get("error_description") || url.searchParams.get("error");

  const dashboardUrl = new URL("/dashboard/connections", url.origin);

  if (error) {
    dashboardUrl.searchParams.set("ig_error", String(error).slice(0, 200));
    return NextResponse.redirect(dashboardUrl);
  }
  if (!code || !state) {
    dashboardUrl.searchParams.set("ig_error", "missing_code_or_state");
    return NextResponse.redirect(dashboardUrl);
  }

  const cookieStore = cookies();
  const expectedState = cookieStore.get("ig_oauth_state")?.value;
  const userId = cookieStore.get("ig_oauth_user")?.value;
  if (!expectedState || expectedState !== state || !userId) {
    dashboardUrl.searchParams.set("ig_error", "state_mismatch");
    return NextResponse.redirect(dashboardUrl);
  }

  let userAccessToken: string;
  let userTokenExpiresInSec: number;
  try {
    const shortLived = await exchangeCodeForToken(code);
    const longLived = await exchangeForLongLivedToken(shortLived.access_token);
    userAccessToken = longLived.access_token;
    userTokenExpiresInSec = longLived.expires_in;
  } catch (err) {
    dashboardUrl.searchParams.set(
      "ig_error",
      err instanceof Error
        ? err.message.slice(0, 200)
        : "token_exchange_failed",
    );
    return NextResponse.redirect(dashboardUrl);
  }

  let pages;
  try {
    pages = await listPagesWithInstagram(userAccessToken);
  } catch (err) {
    dashboardUrl.searchParams.set(
      "ig_error",
      err instanceof Error ? err.message.slice(0, 200) : "list_pages_failed",
    );
    return NextResponse.redirect(dashboardUrl);
  }

  const candidates = pages.filter((p) => p.instagram_business_account?.id);
  if (candidates.length === 0) {
    dashboardUrl.searchParams.set(
      "ig_error",
      "No Instagram Business account found. Make sure your IG account is set to Business or Creator and connected to a Facebook Page you admin.",
    );
    return NextResponse.redirect(dashboardUrl);
  }

  // Compute token expiry once — Page tokens inherit the User token's lifetime.
  const expiresAt = new Date(Date.now() + userTokenExpiresInSec * 1000);

  if (candidates.length === 1) {
    const page = candidates[0];
    const igUserId = page.instagram_business_account!.id;
    const username =
      (await fetchIgUsername(igUserId, page.access_token)) || page.name;

    await upsertConnection({
      userId,
      profileName: username,
      pageId: page.id,
      igUserId,
      pageAccessToken: page.access_token,
      tokenExpiresAt: expiresAt,
    });

    dashboardUrl.searchParams.set("ig_connected", username);
    const response = NextResponse.redirect(dashboardUrl);
    response.cookies.delete("ig_oauth_state");
    response.cookies.delete("ig_oauth_user");
    return response;
  }

  // Multiple candidate Pages — show a picker. Stash candidates in a short-
  // lived cookie keyed by user; the picker UI calls /api/auth/instagram/select-page
  // with the chosen page id, and we resolve from this cookie.
  const pickerPayload = candidates.map((p) => ({
    pageId: p.id,
    pageName: p.name,
    igUserId: p.instagram_business_account!.id,
    pageAccessToken: p.access_token,
    expiresAt: expiresAt.toISOString(),
  }));

  const isHttps = url.protocol === "https:";
  dashboardUrl.searchParams.set("ig_pick", "1");
  const response = NextResponse.redirect(dashboardUrl);
  response.cookies.set(
    "ig_oauth_pages",
    Buffer.from(JSON.stringify(pickerPayload)).toString("base64"),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: isHttps,
      path: "/",
      maxAge: 600,
    },
  );
  // Keep ig_oauth_user set so select-page can verify it's the same user.
  response.cookies.delete("ig_oauth_state");
  return response;
}

async function upsertConnection(args: {
  userId: string;
  profileName: string;
  pageId: string;
  igUserId: string;
  pageAccessToken: string;
  tokenExpiresAt: Date;
}) {
  const encrypted = encryptToken(args.pageAccessToken);

  // If a connection already exists for this IG account, update it instead of
  // creating a duplicate.
  const existing = await queryOne<ExistingConnection>(
    `SELECT id FROM connections
      WHERE user_id = $1
        AND platform = 'instagram'
        AND ig_business_account_id = $2`,
    [args.userId, args.igUserId],
  );

  if (existing) {
    await update(
      "connections",
      {
        profile_name: args.profileName,
        access_token_encrypted: encrypted,
        page_id: args.pageId,
        ig_business_account_id: args.igUserId,
        token_expires_at: args.tokenExpiresAt.toISOString(),
        connection_status: "active",
        credentials: JSON.stringify({}),
      },
      "id = $1",
      [existing.id],
    );
    return existing.id;
  }

  const inserted = await insert<{ id: string }>("connections", {
    user_id: args.userId,
    platform: "instagram",
    profile_name: args.profileName,
    credentials: JSON.stringify({}),
    access_token_encrypted: encrypted,
    page_id: args.pageId,
    ig_business_account_id: args.igUserId,
    token_expires_at: args.tokenExpiresAt.toISOString(),
    connection_status: "active",
  });
  return inserted?.id;
}
