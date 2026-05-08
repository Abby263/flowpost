import { NextResponse } from "next/server";
import { query, queryMany } from "@/lib/postgres";
import { decryptToken, encryptToken } from "@/lib/encryption";
import { exchangeForLongLivedToken } from "@/lib/meta-oauth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface RefreshableConnection {
  id: string;
  user_id: string;
  access_token_encrypted: string;
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
// Meta long-lived tokens last 60 days. To avoid surprise expiries we re-issue
// them when they're within 14 days of expiring. Tokens already expired are
// flipped to connection_status='expired' so the UI prompts a reconnect (we
// can't refresh after the fact — the user must redo the OAuth flow).
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Mark expired tokens as such.
  const expired = await query(
    `UPDATE connections
        SET connection_status = 'expired'
      WHERE platform = 'instagram'
        AND access_token_encrypted IS NOT NULL
        AND token_expires_at IS NOT NULL
        AND token_expires_at < NOW()
        AND connection_status != 'expired'`,
  );

  // Find tokens that will expire in the next 14 days and re-exchange them.
  const candidates = await queryMany<RefreshableConnection>(
    `SELECT id, user_id, access_token_encrypted, token_expires_at
       FROM connections
      WHERE platform = 'instagram'
        AND connection_status = 'active'
        AND access_token_encrypted IS NOT NULL
        AND token_expires_at IS NOT NULL
        AND token_expires_at < NOW() + INTERVAL '14 days'
        AND token_expires_at > NOW()`,
  );

  let refreshed = 0;
  const errors: { connection_id: string; error: string }[] = [];

  for (const c of candidates) {
    try {
      const current = decryptToken(c.access_token_encrypted);
      const longLived = await exchangeForLongLivedToken(current);
      const newExpiresAt = new Date(
        Date.now() + longLived.expires_in * 1000,
      ).toISOString();
      await query(
        `UPDATE connections
            SET access_token_encrypted = $1,
                token_expires_at = $2,
                connection_status = 'active'
          WHERE id = $3`,
        [encryptToken(longLived.access_token), newExpiresAt, c.id],
      );
      refreshed += 1;
    } catch (err) {
      // Refresh failed — leave the token as-is for now; the next run will
      // either retry or (if it expires) flip it to expired.
      errors.push({
        connection_id: c.id,
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
