/**
 * X (Twitter) v2 client built on top of an OAuth 2.0 access token.
 *
 * Replaces the API-key-based TwitterClient for the new OAuth flow. We don't
 * use twitter-api-v2's helpers here because they're built for API-key auth;
 * the v2 endpoints we need are simple HTTP calls.
 *
 * Posting:
 *   - Text-only:  POST /2/tweets   { text }
 *   - With image: POST /1.1/media/upload (multipart) → media_id
 *                 POST /2/tweets   { text, media: { media_ids: [...] } }
 *
 * Media upload uses the v1.1 endpoint because v2 doesn't have media upload
 * yet. Both work with the same OAuth 2.0 bearer token.
 */

const API_V2 = "https://api.twitter.com/2";
const API_V1_UPLOAD = "https://upload.twitter.com/1.1/media/upload.json";

export interface TweetResult {
  tweetId: string;
  url: string;
}

export class TwitterOAuthClient {
  constructor(
    private readonly accessToken: string,
    private readonly username: string,
  ) {
    if (!accessToken) {
      throw new Error("TwitterOAuthClient: accessToken required");
    }
  }

  async tweet(text: string, imageUrl?: string): Promise<TweetResult> {
    let mediaId: string | undefined;
    if (imageUrl) {
      mediaId = await this.uploadMedia(imageUrl);
    }

    const body: Record<string, unknown> = { text };
    if (mediaId) {
      body.media = { media_ids: [mediaId] };
    }

    const res = await fetch(`${API_V2}/tweets`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const text2 = await res.text();
    if (!res.ok) {
      throw new Error(`X /2/tweets ${res.status}: ${text2.slice(0, 300)}`);
    }
    const data = JSON.parse(text2) as { data: { id: string } };
    const tweetId = data.data.id;
    return {
      tweetId,
      url: `https://twitter.com/${this.username}/status/${tweetId}`,
    };
  }

  /**
   * Fetch a public image URL and upload to X's v1.1 media endpoint.
   *
   * v1.1 expects multipart/form-data with the image bytes in `media` and
   * media_category=tweet_image. The upload endpoint accepts a Bearer token
   * issued via OAuth 2.0.
   */
  private async uploadMedia(imageUrl: string): Promise<string> {
    if (imageUrl.startsWith("data:")) {
      throw new Error(
        "TwitterOAuthClient.uploadMedia requires a public URL, not base64",
      );
    }
    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) {
      throw new Error(`Failed to fetch image for X upload: ${imageRes.status}`);
    }
    const arrayBuffer = await imageRes.arrayBuffer();
    const blob = new Blob([new Uint8Array(arrayBuffer)], {
      type: imageRes.headers.get("content-type") || "image/jpeg",
    });

    const form = new FormData();
    form.set("media", blob);
    form.set("media_category", "tweet_image");

    const res = await fetch(API_V1_UPLOAD, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.accessToken}` },
      body: form,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `X /1.1/media/upload ${res.status}: ${text.slice(0, 300)}`,
      );
    }
    const data = JSON.parse(text) as { media_id_string: string };
    if (!data.media_id_string) {
      throw new Error(`X media upload missing media_id_string: ${text}`);
    }
    return data.media_id_string;
  }
}
