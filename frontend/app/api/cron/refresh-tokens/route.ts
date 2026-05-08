import { NextResponse } from "next/server";
import { query, queryMany } from "@/lib/postgres";
import { decryptToken, encryptToken } from "@/lib/encryption";
import { exchangeForLongLivedToken } from "@/lib/meta-oauth";
import { refreshAccessToken as refreshTwitterToken } from "@/lib/twitter-oauth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface RefreshableConnection {
  id: string;
  user_id: string;
  platform: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string | null;
  token_expires_at: string | null;
}

function isCronAuthorized(request: Request): boolean {
  const auth = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (expected && auth === `Bearer ${expected}`) return true;
  if (request.headers.get("x-vercel-cron")) return true;
  if (process.env.NODE_ENV !== "production") return true;
  return false;
}

// GET /api/cron/refresh-tokens
//
// Per-platform refresh strategy:
//
//   Instagram (Meta long-lived Page tokens, 60-day lifetime):
//     - Re-exchange when within 14 days of expiry.
//     - Mark expired rows status='expired' so the UI surfaces a Reconnect.
//
//   Twitter (OAuth 2.0 access tokens, 2-hour lifetime + refresh tokens):
//     - The trigger-workflow + queue-worker paths already auto-refresh
//       inline (see lib/agent-credentials.ts) when running a workflow. This
//       cron is the safety net: if a connection hasn't been used in a while
//       and the *refresh token* has expired, we mark the row expired so the
//       user sees the Reconnect badge before clicking Run.
//
//   LinkedIn (OAuth 2.0, 60-day access token, no refresh):
//     - Same as Meta but with no refresh path — only mark expired.
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Mark expired tokens. Same query covers all platforms.
  const expired = await query(
    `UPDATE connections
        SET connection_status = 'expired'
      WHERE platform IN ('instagram', 'twitter', 'linkedin')
        AND access_token_encrypted IS NOT NULL
        AND token_expires_at IS NOT NULL
        AND token_expires_at < NOW()
        AND connection_status != 'expired'`,
  );

  // Refresh Meta long-lived tokens within 14 days of expiry.
  const igCandidates = await queryMany<RefreshableConnection>(
    `SELECT id, user_id, platform, access_token_encrypted,
            refresh_token_encrypted, token_expires_at
       FROM connections
      WHERE platform = 'instagram'
        AND connection_status = 'active'
        AND access_token_encrypted IS NOT NULL
        AND token_expires_at IS NOT NULL
        AND token_expires_at < NOW() + INTERVAL '14 days'
        AND token_expires_at > NOW()`,
  );

  // Refresh Twitter tokens within 1 day of expiry that haven't been used
  // recently. (Inline refresh in agent-credentials handles in-use cases.)
  const twCandidates = await queryMany<RefreshableConnection>(
    `SELECT id, user_id, platform, access_token_encrypted,
            refresh_token_encrypted, token_expires_at
       FROM connections
      WHERE platform = 'twitter'
        AND connection_status = 'active'
        AND access_token_encrypted IS NOT NULL
        AND refresh_token_encrypted IS NOT NULL
        AND token_expires_at IS NOT NULL
        AND token_expires_at < NOW() + INTERVAL '1 day'
        AND token_expires_at > NOW()`,
  );

  let refreshed = 0;
  const errors: { connection_id: string; platform: string; error: string }[] =
    [];

  for (const c of igCandidates) {
    try {
      const current = decryptToken(c.access_token_encrypted);
      const longLived = await exchangeForLongLivedToken(current);
      const newExpiresAt = new Date(
        Date.now() + longLived.expires_in * 1000,
      ).toISOString();
      await query(
        `UPDATE connections
            SET access_token_encrypted = $1, token_expires_at = $2,
                connection_status = 'active'
          WHERE id = $3`,
        [encryptToken(longLived.access_token), newExpiresAt, c.id],
      );
      refreshed += 1;
    } catch (err) {
      errors.push({
        connection_id: c.id,
        platform: c.platform,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  for (const c of twCandidates) {
    if (!c.refresh_token_encrypted) continue;
    try {
      const refreshToken = decryptToken(c.refresh_token_encrypted);
      const fresh = await refreshTwitterToken(refreshToken);
      const newExpiresAt = new Date(
        Date.now() + (fresh.expires_in || 7200) * 1000,
      ).toISOString();
      await query(
        `UPDATE connections
            SET access_token_encrypted = $1,
                refresh_token_encrypted = COALESCE($2, refresh_token_encrypted),
                token_expires_at = $3,
                connection_status = 'active'
          WHERE id = $4`,
        [
          encryptToken(fresh.access_token),
          fresh.refresh_token ? encryptToken(fresh.refresh_token) : null,
          newExpiresAt,
          c.id,
        ],
      );
      refreshed += 1;
    } catch (err) {
      errors.push({
        connection_id: c.id,
        platform: c.platform,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    refreshed,
    expired_marked: expired.rowCount,
    errors,
  });
}
