/**
 * Instagram Graph API client (Meta) — frontend copy.
 *
 * Read-only client for pulling per-media insights for a Business / Creator
 * Instagram account. Used by the engagement-sync cron route.
 *
 * Mirrored in `backend/clients/instagram/graph-client.ts` so backend scripts
 * can use the same logic without cross-package imports. Keep them in sync.
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

  async listRecentMedia(limit = 25): Promise<IgMedia[]> {
    const fields =
      "id,caption,permalink,media_type,timestamp,like_count,comments_count";
    const data = await this.fetchJson<{ data: IgMedia[] }>(
      `/${this.igBusinessAccountId}/media`,
      { fields, limit: String(limit) },
    );
    return data.data || [];
  }

  async getMediaInsights(media: IgMedia): Promise<IgInsightMetrics> {
    const baseLikes = media.like_count;
    const baseComments = media.comments_count;

    let reach: number | undefined;
    const impressions: number | undefined = undefined;
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
