import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { queryMany } from "@/lib/postgres";

export const dynamic = "force-dynamic";

interface ApprovalRow {
  id: string;
  workflow_id: string | null;
  workflow_name: string | null;
  content: string | null;
  image_url: string | null;
  platform: string | null;
  draft_metadata: Record<string, unknown> | null;
  created_at: string;
}

export async function GET() {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await queryMany<ApprovalRow>(
    `SELECT p.id, p.workflow_id, w.name AS workflow_name,
            p.content, p.image_url, p.platform,
            p.draft_metadata, p.created_at
       FROM posts p
       LEFT JOIN workflows w ON w.id = p.workflow_id
      WHERE p.user_id = $1
        AND p.status = 'pending_approval'
      ORDER BY p.created_at DESC`,
    [userId],
  );

  return NextResponse.json({ approvals: rows });
}
