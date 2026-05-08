import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { queryOne, update } from "@/lib/postgres";

export const dynamic = "force-dynamic";

interface PostRow {
  id: string;
  user_id: string;
  status: string;
  content: string | null;
  image_url: string | null;
}

// PATCH /api/posts/:id — edit a pending-approval draft (caption + image_url).
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { content, image_url } = body || {};

  if (typeof content === "undefined" && typeof image_url === "undefined") {
    return NextResponse.json(
      { error: "Provide content and/or image_url" },
      { status: 400 },
    );
  }

  const existing = await queryOne<PostRow>(
    `SELECT id, user_id, status FROM posts WHERE id = $1 AND user_id = $2`,
    [params.id, userId],
  );

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (existing.status !== "pending_approval") {
    return NextResponse.json(
      { error: "Only pending_approval drafts can be edited" },
      { status: 400 },
    );
  }

  const updates: Record<string, unknown> = {};
  if (typeof content === "string") updates.content = content.slice(0, 2200);
  if (typeof image_url === "string") updates.image_url = image_url;

  const updated = await update<PostRow>(
    "posts",
    updates,
    "id = $1 AND user_id = $2",
    [params.id, userId],
  );

  return NextResponse.json({ post: updated });
}
