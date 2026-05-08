/**
 * Instagram Graph API client (Meta).
 *
 * Read-only client for pulling per-media insights for a Business / Creator
 * Instagram account. Requires:
 *   - A long-lived Page access token (or User token granting instagram_basic +
 *     instagram_manage_insights for the connected IG Business account).
 *   - The Instagram Business Account ID (numeric, e.g. 17841...).
 *
 * Flow:
 *   1. listRecentMedia(limit)        → recent media from the IG account
 *   2. getMediaInsights(mediaId)     → per-media metrics (likes, comments, ...)
 *
 * Notes:
 *   - The `insights` edge requires the IG account to be a Business or Creator
 *     account linked to a Facebook Page. Personal IG accounts cannot use this.
 *   - Some metric names changed in v22+ (e.g. impressions → views). We request
 *     a conservative core set and tolerate missing fields.
 *   - We do NOT post via Graph API here — posting still goes through the
 *     existing instagram-private-api client. This module is read-only.
 */

const GRAPH_BASE = "https://graph.facebook.com/v22.0";

export interface IgMedia {
  id: string;
  caption?: string;
  permalink?: string;
  media_type?: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM" | "REELS";
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
}

export interface IgInsightMetrics {
  likes?: number;
  comments?: number;
  saves?: number;
  shares?: number;
  reach?: number;
  impressions?: number;
  raw: Record<string, unknown>;
}

export class InstagramGraphClient {
  constructor(
    private readonly accessToken: string,
    private readonly igBusinessAccountId: string,
  ) {
    if (!accessToken) {
      throw new Error("InstagramGraphClient: accessToken required");
    }
    if (!igBusinessAccountId) {
      throw new Error("InstagramGraphClient: igBusinessAccountId required");
    }
  }

  private async fetchJson<T>(path: string, params: Record<string, string>) {
    const url = new URL(`${GRAPH_BASE}${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.searchParams.set("access_token", this.accessToken);

    const res = await fetch(url.toString(), { method: "GET" });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `Meta Graph API ${path} → ${res.status}: ${text.slice(0, 300)}`,
      );
    }
    return JSON.parse(text) as T;
  }

  /** Recent media from the connected IG Business account. */
  async listRecentMedia(limit = 25): Promise<IgMedia[]> {
    const fields =
      "id,caption,permalink,media_type,timestamp,like_count,comments_count";
    const data = await this.fetchJson<{ data: IgMedia[] }>(
      `/${this.igBusinessAccountId}/media`,
      { fields, limit: String(limit) },
    );
    return data.data || [];
  }

  /**
   * Per-media insights. Returns the core engagement metrics; raw payload is
   * preserved for debugging and future expansion.
   *
   * We split the call into two requests because Meta gates "shares" and
   * "reach"-style metrics behind a different metric set in v22 and rejects
   * the entire call if any single metric is invalid for the media type.
   */
  async getMediaInsights(media: IgMedia): Promise<IgInsightMetrics> {
    const baseLikes = media.like_count;
    const baseComments = media.comments_count;

    // Best-effort insight pulls. Each call is wrapped because the set of
    // available metrics depends on media type / age / account tier.
    let reach: number | undefined;
    let impressions: number | undefined;
    let saves: number | undefined;
    let shares: number | undefined;
    let raw: Record<string, unknown> = {};

    try {
      const insights = await this.fetchJson<{
        data: { name: string; values: { value: number }[] }[];
      }>(`/${media.id}/insights`, {
        metric: "reach,saved,shares",
      });

      raw = insights as unknown as Record<string, unknown>;
      for (const item of insights.data || []) {
        const value = item.values?.[0]?.value;
        if (typeof value !== "number") continue;
        if (item.name === "reach") reach = value;
        else if (item.name === "saved") saves = value;
        else if (item.name === "shares") shares = value;
      }
    } catch (err) {
      // Insights edge unavailable (personal account, expired token, etc.)
      // We keep the public counts and return what we have.
      raw = { error: err instanceof Error ? err.message : String(err) };
    }

    return {
      likes: baseLikes,
      comments: baseComments,
      saves,
      shares,
      reach,
      impressions,
      raw,
    };
  }
}
