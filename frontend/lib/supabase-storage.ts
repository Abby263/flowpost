import "server-only";

/**
 * Supabase Storage uploader.
 *
 * The Meta Graph API publish flow requires a publicly fetchable image URL.
 * To make that reliable regardless of where the image was generated (DALL-E
 * URLs expire, Gemini returns base64), every image is re-uploaded here
 * before publish.
 *
 * Required env:
 *   - SUPABASE_URL                  e.g. https://abcd.supabase.co
 *   - SUPABASE_SERVICE_ROLE_KEY     server-side only; never expose
 *   - SUPABASE_STORAGE_BUCKET       optional, defaults to 'post-media'
 *
 * Bucket setup (one-time, by hand in Supabase dashboard):
 *   - Create bucket `post-media` with Public access ON
 *     (Meta's servers need to GET the URL anonymously)
 */

const DEFAULT_BUCKET = "post-media";

function getConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to upload images for Instagram publishing.",
    );
  }
  return { url: url.replace(/\/$/, ""), key, bucket };
}

function publicUrl(bucket: string, baseUrl: string, path: string): string {
  return `${baseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

async function dataUrlToBuffer(
  dataUrl: string,
): Promise<{ buffer: Buffer; contentType: string }> {
  const m = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
  if (!m) throw new Error("Not a base64 data URL");
  return {
    contentType: m[1] || "image/png",
    buffer: Buffer.from(m[2], "base64"),
  };
}

async function urlToBuffer(
  remote: string,
): Promise<{ buffer: Buffer; contentType: string }> {
  const res = await fetch(remote);
  if (!res.ok) {
    throw new Error(`Failed to fetch image from ${remote}: ${res.status}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") || "image/jpeg";
  return { buffer: Buffer.from(arrayBuffer), contentType };
}

function extFromMime(contentType: string): string {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  return "jpg";
}

/**
 * Upload an image to Supabase Storage and return a stable public URL.
 *
 * Accepts:
 *   - https://... URL  (will fetch and re-upload)
 *   - data:image/...;base64,...  (will decode and upload)
 *
 * The path is keyed by user + post so we can later GC orphaned uploads.
 */
export async function uploadImageToSupabase(
  source: string,
  opts: { userId: string; postId?: string },
): Promise<string> {
  const { url: baseUrl, key, bucket } = getConfig();

  const { buffer, contentType } = source.startsWith("data:")
    ? await dataUrlToBuffer(source)
    : await urlToBuffer(source);

  const ext = extFromMime(contentType);
  const path = `${opts.userId}/${opts.postId || `tmp-${Date.now()}`}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

  const uploadUrl = `${baseUrl}/storage/v1/object/${bucket}/${path}`;
  // Buffer is a Uint8Array under the hood; the global fetch BodyInit type
  // only acknowledges Uint8Array, so cast accordingly.
  const body = new Uint8Array(buffer);
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Supabase Storage upload failed (${res.status}): ${text.slice(0, 300)}`,
    );
  }

  return publicUrl(bucket, baseUrl, path);
}
