import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { encryptToken } from "@/lib/encryption";
import { fetchIgUsername } from "@/lib/meta-oauth";
import { insert, queryOne, update } from "@/lib/postgres";

export const dynamic = "force-dynamic";

interface PendingPage {
  pageId: string;
  pageName: string;
  igUserId: string;
  pageAccessToken: string;
  expiresAt: string;
}

interface ExistingConnection {
  id: string;
}

// GET  /api/auth/instagram/select-page  → returns the candidate Pages from
//                                         the cookie set by /callback.
// POST /api/auth/instagram/select-page  { pageId } → persists the chosen
//                                         Page as the connection.
export async function GET() {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const candidates = readCandidates();
  if (!candidates) {
    return NextResponse.json({ candidates: [] });
  }
  // Strip the access tokens before returning to the browser.
  return NextResponse.json({
    candidates: candidates.map((c) => ({
      pageId: c.pageId,
      pageName: c.pageName,
      igUserId: c.igUserId,
    })),
  });
}

export async function POST(request: Request) {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const pageId = typeof body?.pageId === "string" ? body.pageId : "";
  if (!pageId) {
    return NextResponse.json({ error: "pageId required" }, { status: 400 });
  }

  const candidates = readCandidates();
  const chosen = candidates?.find((c) => c.pageId === pageId);
  if (!chosen) {
    return NextResponse.json(
      { error: "Page not found in pending OAuth session" },
      { status: 400 },
    );
  }

  const username =
    (await fetchIgUsername(chosen.igUserId, chosen.pageAccessToken)) ||
    chosen.pageName;

  const encrypted = encryptToken(chosen.pageAccessToken);
  const expiresAt = new Date(chosen.expiresAt).toISOString();

  const existing = await queryOne<ExistingConnection>(
    `SELECT id FROM connections
      WHERE user_id = $1
        AND platform = 'instagram'
        AND ig_business_account_id = $2`,
    [userId, chosen.igUserId],
  );

  if (existing) {
    await update(
      "connections",
      {
        profile_name: username,
        access_token_encrypted: encrypted,
        page_id: chosen.pageId,
        token_expires_at: expiresAt,
        connection_status: "active",
        credentials: JSON.stringify({}),
      },
      "id = $1",
      [existing.id],
    );
  } else {
    await insert("connections", {
      user_id: userId,
      platform: "instagram",
      profile_name: username,
      credentials: JSON.stringify({}),
      access_token_encrypted: encrypted,
      page_id: chosen.pageId,
      ig_business_account_id: chosen.igUserId,
      token_expires_at: expiresAt,
      connection_status: "active",
    });
  }

  const response = NextResponse.json({ success: true, profileName: username });
  response.cookies.delete("ig_oauth_pages");
  response.cookies.delete("ig_oauth_user");
  return response;
}

function readCandidates(): PendingPage[] | null {
  const raw = cookies().get("ig_oauth_pages")?.value;
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  } catch {
    return null;
  }
}
