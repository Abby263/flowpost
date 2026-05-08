/**
 * LinkedIn UGC Posts client built on top of a member access token issued via
 * "Sign In with LinkedIn using OpenID Connect" + "Share on LinkedIn".
 *
 * Posts on the user's personal feed only — Company Page posting requires the
 * Marketing Developer Platform product which has heavier review.
 *
 * Image posting flow (LinkedIn requires three calls):
 *   1. POST /v2/assets?action=registerUpload  → returns uploadUrl + asset URN
 *   2. PUT  uploadUrl  (binary image bytes)   → uploads the image
 *   3. POST /v2/ugcPosts  with the asset URN  → creates the visible post
 *
 * Text-only posts skip steps 1-2.
 */

const API = "https://api.linkedin.com/v2";

export interface LinkedInPostResult {
  postId: string;
  url: string;
}

export class LinkedInOAuthClient {
  constructor(
    private readonly accessToken: string,
    /** OIDC `sub` from /v2/userinfo. Stored on the connection row. */
    private readonly memberSub: string,
  ) {
    if (!accessToken) {
      throw new Error("LinkedInOAuthClient: accessToken required");
    }
    if (!memberSub) {
      throw new Error("LinkedInOAuthClient: memberSub required");
    }
  }

  private get authorURN() {
    return `urn:li:person:${this.memberSub}`;
  }

  private headers() {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    };
  }

  async post(text: string, imageUrl?: string): Promise<LinkedInPostResult> {
    const mediaAsset = imageUrl ? await this.uploadImage(imageUrl) : null;

    const body = mediaAsset
      ? this.buildBody(text, [mediaAsset])
      : this.buildBody(text);

    const res = await fetch(`${API}/ugcPosts`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    const respText = await res.text();
    if (!res.ok) {
      throw new Error(
        `LinkedIn /v2/ugcPosts ${res.status}: ${respText.slice(0, 300)}`,
      );
    }
    // The post URN is returned as a header (x-restli-id) and in the JSON body.
    const data = JSON.parse(respText) as { id: string };
    const postId = data.id;
    return {
      postId,
      url: `https://www.linkedin.com/feed/update/${postId}`,
    };
  }

  private buildBody(text: string, mediaAssets: string[] = []) {
    return {
      author: this.authorURN,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory: mediaAssets.length > 0 ? "IMAGE" : "NONE",
          ...(mediaAssets.length > 0
            ? {
                media: mediaAssets.map((asset) => ({
                  status: "READY",
                  media: asset,
                })),
              }
            : {}),
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    };
  }

  /**
   * Returns the asset URN once the image is uploaded. Three round trips
   * (register → PUT bytes → return URN). Could be parallelized but the
   * register call returns the upload URL we need, so we sequence.
   */
  private async uploadImage(imageUrl: string): Promise<string> {
    if (imageUrl.startsWith("data:")) {
      throw new Error(
        "LinkedInOAuthClient.uploadImage requires a public URL, not base64",
      );
    }

    // 1. registerUpload
    const registerBody = {
      registerUploadRequest: {
        recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
        owner: this.authorURN,
        serviceRelationships: [
          {
            relationshipType: "OWNER",
            identifier: "urn:li:userGeneratedContent",
          },
        ],
      },
    };
    const regRes = await fetch(`${API}/assets?action=registerUpload`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(registerBody),
    });
    const regText = await regRes.text();
    if (!regRes.ok) {
      throw new Error(
        `LinkedIn registerUpload ${regRes.status}: ${regText.slice(0, 300)}`,
      );
    }
    const regData = JSON.parse(regText) as {
      value: {
        uploadMechanism: {
          "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest": {
            uploadUrl: string;
          };
        };
        asset: string;
      };
    };
    const uploadUrl =
      regData.value.uploadMechanism[
        "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
      ].uploadUrl;
    const assetUrn = regData.value.asset;

    // 2. fetch image and PUT it to the uploadUrl
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      throw new Error(
        `Failed to fetch image for LinkedIn upload: ${imgRes.status}`,
      );
    }
    const arrayBuffer = await imgRes.arrayBuffer();
    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": imgRes.headers.get("content-type") || "image/jpeg",
      },
      body: new Uint8Array(arrayBuffer),
    });
    if (!putRes.ok) {
      const putText = await putRes.text().catch(() => "");
      throw new Error(
        `LinkedIn image PUT ${putRes.status}: ${putText.slice(0, 300)}`,
      );
    }

    return assetUrn;
  }
}
