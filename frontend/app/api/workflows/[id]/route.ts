import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { queryOne, queryMany } from "@/lib/postgres";

export const dynamic = "force-dynamic";

interface Workflow {
  id: string;
  user_id: string;
  connection_id: string | null;
  name: string;
  type: string | null;
  platform: string | null;
  config: Record<string, unknown> | null;
  search_query: string | null;
  location: string | null;
  style_prompt: string | null;
  schedule: string | null;
  frequency: string | null;
  is_active: boolean;
  requires_approval: boolean;
  created_at: string;
  current_run_id: string | null;
  run_status: string;
  run_started_at: string | null;
  run_completed_at: string | null;
  last_error: string | null;
}

interface Post {
  id: string;
  workflow_id: string | null;
  connection_id: string | null;
  user_id: string;
  content: string | null;
  platform: string | null;
  status: string;
  source: string;
  image_url: string | null;
  published_url: string | null;
  posted_at: string | null;
  scheduled_at: string | null;
  created_at: string;
}

export async function GET(
  _request: Request,
  context: { params: { id: string } },
) {
  const { userId } = auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workflowId = context.params.id;

  try {
    const workflow = await queryOne<Workflow>(
      `SELECT * FROM workflows WHERE id = $1 AND user_id = $2`,
      [workflowId, userId],
    );

    if (!workflow) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const posts = await queryMany<Post>(
      `SELECT * FROM posts
       WHERE workflow_id = $1 AND user_id = $2
       ORDER BY COALESCE(posted_at, created_at) DESC, created_at DESC`,
      [workflowId, userId],
    );

    return NextResponse.json({ workflow, posts });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Database error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
