import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { insert, query, queryOne } from "@/lib/postgres";

export const dynamic = "force-dynamic";

interface DraftRow {
  id: string;
  user_id: string;
  status: string;
  workflow_id: string | null;
}

// POST /api/posts/:id/reject — reject a pending draft. The reviewer's reason
// is captured as a negative learning so future generations avoid repeating it.
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";

  const draft = await queryOne<DraftRow>(
    `SELECT id, user_id, status, workflow_id
       FROM posts
      WHERE id = $1 AND user_id = $2`,
    [params.id, userId],
  );

  if (!draft) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (draft.status !== "pending_approval") {
    return NextResponse.json(
      { error: `Cannot reject a post in status '${draft.status}'` },
      { status: 400 },
    );
  }

  await query(
    `UPDATE posts
        SET status = 'rejected',
            rejected_at = NOW(),
            rejection_reason = $1
      WHERE id = $2`,
    [reason || null, draft.id],
  );

  if (reason) {
    await insert("post_learnings", {
      user_id: userId,
      workflow_id: draft.workflow_id,
      post_id: draft.id,
      source: "manual_reject",
      signal: "negative",
      lesson: reason.slice(0, 500),
    });
  }

  return NextResponse.json({ success: true, postId: draft.id });
}
