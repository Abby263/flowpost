/**
 * Supabase Storage uploader (backend copy).
 *
 * Mirrored from frontend/lib/supabase-storage.ts so the LangGraph runtime
 * doesn't have to reach across packages. Keep in sync.
 */

const DEFAULT_BUCKET = "post-media";

function getConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set on the LangGraph runtime to upload images for Instagram publishing.",
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
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body: buffer,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Supabase Storage upload failed (${res.status}): ${text.slice(0, 300)}`,
    );
  }

  return publicUrl(bucket, baseUrl, path);
}
