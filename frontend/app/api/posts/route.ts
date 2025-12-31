import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { queryMany, remove } from "@/lib/postgres";

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

interface Workflow {
  connection_id: string | null;
}

const ORDERABLE_COLUMNS = new Set(["created_at", "posted_at", "scheduled_at"]);

export async function GET(request: Request) {
  const { userId } = auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const excludeStatus = searchParams.get("excludeStatus");
  const workflowId = searchParams.get("workflowId");
  const order = searchParams.get("order") || "created_at";
  const direction = searchParams.get("direction") === "asc" ? "ASC" : "DESC";
  const limitValue = searchParams.get("limit");

  if (!ORDERABLE_COLUMNS.has(order)) {
    return NextResponse.json(
      { error: "Invalid order column" },
      { status: 400 },
    );
  }

  try {
    let queryText = `
      SELECT p.*, w.connection_id as workflow_connection_id
      FROM posts p
      LEFT JOIN workflows w ON p.workflow_id = w.id
      WHERE p.user_id = $1
    `;
    const params: unknown[] = [userId];
    let paramIndex = 2;

    if (status) {
      queryText += ` AND p.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (excludeStatus) {
      queryText += ` AND p.status != $${paramIndex}`;
      params.push(excludeStatus);
      paramIndex++;
    }

    if (workflowId === "null") {
      queryText += ` AND p.workflow_id IS NULL`;
    } else if (workflowId) {
      queryText += ` AND p.workflow_id = $${paramIndex}`;
      params.push(workflowId);
      paramIndex++;
    }

    queryText += ` ORDER BY p.${order} ${direction}`;

    if (limitValue) {
      const limit = Number(limitValue);
      if (!Number.isNaN(limit) && limit > 0) {
        queryText += ` LIMIT $${paramIndex}`;
        params.push(limit);
      }
    }

    const rawPosts = await queryMany<
      Post & { workflow_connection_id: string | null }
    >(queryText, params);

    // Normalize posts to include connection_id from workflow if not set
    const normalizedPosts = rawPosts.map((post) => {
      const { workflow_connection_id, ...postData } = post;
      if (!postData.connection_id && workflow_connection_id) {
        return { ...postData, connection_id: workflow_connection_id };
      }
      return postData;
    });

    return NextResponse.json({ posts: normalizedPosts });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Database error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { userId } = auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    const deleted = await remove<Post>(
      "posts",
      "id = $1 AND user_id = $2 AND status = $3",
      [id, userId, "scheduled"],
      "id",
    );

    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Database error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
