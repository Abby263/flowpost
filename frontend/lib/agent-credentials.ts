import "server-only";
import { decryptToken, encryptToken } from "@/lib/encryption";
import { query } from "@/lib/postgres";
import { refreshAccessToken } from "@/lib/twitter-oauth";

/**
 * Builds the `credentials` payload the agent expects, decrypting whatever's
 * stored for the platform and (for X) auto-refreshing the access token if
 * it's within 5 minutes of expiry.
 *
 * Used by both /api/trigger-workflow (synchronous Run-now) and the queue
 * worker (async sweep), so logic stays consistent.
 */

export interface ConnectionRow {
  id: string;
  platform: string;
  credentials: Record<string, unknown> | null;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  ig_business_account_id: string | null;
  oauth_provider_user_id: string | null;
  page_id: string | null;
  profile_name: string | null;
  token_expires_at: string | null;
  connection_status: string | null;
}

export interface AgentCredentials {
  accessToken?: string;
  // Instagram (Meta)
  igUserId?: string;
  pageId?: string;
  // X (Twitter)
  username?: string;
  // LinkedIn
  memberSub?: string;
  // Always
  userId?: string;
}

const REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000;

/**
 * Returns the credentials payload, or throws with a user-readable message
 * if the connection is not in a usable state. Callers should catch and
 * surface the message to the user / mark the workflow run as failed.
 */
export async function buildAgentCredentials(
  connection: ConnectionRow,
  userId: string,
): Promise<AgentCredentials> {
  if (connection.platform === "instagram") {
    if (
      !connection.access_token_encrypted ||
      !connection.ig_business_account_id ||
      connection.connection_status !== "active"
    ) {
      throw new Error(
        "Instagram connection is not active. Reconnect via Facebook OAuth.",
      );
    }
    return {
      accessToken: decryptToken(connection.access_token_encrypted),
      igUserId: connection.ig_business_account_id,
      pageId: connection.page_id || undefined,
      userId,
    };
  }

  if (connection.platform === "twitter") {
    if (
      !connection.access_token_encrypted ||
      connection.connection_status !== "active"
    ) {
      throw new Error(
        "X connection is not active. Reconnect via Connect with X.",
      );
    }
    let accessToken = decryptToken(connection.access_token_encrypted);

    // Auto-refresh if within ~5 min of expiry. X tokens last 2 hours so we
    // need this — without it, slow workflows fail mid-run.
    const expiresAt = connection.token_expires_at
      ? new Date(connection.token_expires_at).getTime()
      : 0;
    const expiringSoon =
      expiresAt > 0 && expiresAt - Date.now() < REFRESH_BEFORE_EXPIRY_MS;
    if (expiringSoon && connection.refresh_token_encrypted) {
      try {
        const refreshToken = decryptToken(connection.refresh_token_encrypted);
        const fresh = await refreshAccessToken(refreshToken);
        const newExpiry = new Date(
          Date.now() + (fresh.expires_in || 7200) * 1000,
        ).toISOString();
        await query(
          `UPDATE connections
              SET access_token_encrypted = $1,
                  refresh_token_encrypted = COALESCE($2, refresh_token_encrypted),
                  token_expires_at = $3
            WHERE id = $4`,
          [
            encryptToken(fresh.access_token),
            fresh.refresh_token ? encryptToken(fresh.refresh_token) : null,
            newExpiry,
            connection.id,
          ],
        );
        accessToken = fresh.access_token;
      } catch (err) {
        // Refresh failed → leave the existing token in place; it might still
        // work, or the agent will surface the auth error and the daily
        // refresh-tokens cron will mark the connection expired next run.
        console.warn(
          `[credentials] X refresh failed for connection ${connection.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    return {
      accessToken,
      username: connection.profile_name || undefined,
      userId,
    };
  }

  if (connection.platform === "linkedin") {
    if (
      !connection.access_token_encrypted ||
      !connection.oauth_provider_user_id ||
      connection.connection_status !== "active"
    ) {
      throw new Error(
        "LinkedIn connection is not active. Reconnect via Connect with LinkedIn.",
      );
    }
    return {
      accessToken: decryptToken(connection.access_token_encrypted),
      memberSub: connection.oauth_provider_user_id,
      userId,
    };
  }

  // Unknown platform — pass the raw credentials JSON through (legacy paths).
  return (connection.credentials as AgentCredentials) || {};
}

/** SQL projection that includes every column ConnectionRow needs. */
export const CONNECTION_COLUMNS = `
  id, platform, credentials,
  access_token_encrypted, refresh_token_encrypted,
  ig_business_account_id, oauth_provider_user_id, page_id,
  profile_name, token_expires_at, connection_status
`;
