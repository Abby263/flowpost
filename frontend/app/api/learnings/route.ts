import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { insert, queryMany, remove } from "@/lib/postgres";

export const dynamic = "force-dynamic";

interface LearningRow {
  id: string;
  user_id: string;
  workflow_id: string | null;
  post_id: string | null;
  source: string;
  signal: "positive" | "negative" | "neutral";
  lesson: string;
  created_at: string;
}

const ALLOWED_SIGNALS = new Set(["positive", "negative", "neutral"]);

export async function GET(request: Request) {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const workflowId = searchParams.get("workflowId");

  const learnings = await queryMany<LearningRow>(
    `SELECT *
       FROM post_learnings
      WHERE user_id = $1
        AND ($2::uuid IS NULL OR workflow_id = $2)
      ORDER BY created_at DESC
      LIMIT 200`,
    [userId, workflowId],
  );

  return NextResponse.json({ learnings });
}

export async function POST(request: Request) {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { workflow_id, signal, lesson } = body || {};

  if (!signal || !ALLOWED_SIGNALS.has(signal)) {
    return NextResponse.json(
      { error: "signal must be positive | negative | neutral" },
      { status: 400 },
    );
  }
  if (!lesson || typeof lesson !== "string" || lesson.trim().length < 3) {
    return NextResponse.json({ error: "lesson is required" }, { status: 400 });
  }

  const row = await insert<LearningRow>("post_learnings", {
    user_id: userId,
    workflow_id: workflow_id || null,
    source: "user_note",
    signal,
    lesson: lesson.trim().slice(0, 500),
  });

  return NextResponse.json({ learning: row }, { status: 201 });
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

  const removed = await remove<LearningRow>(
    "post_learnings",
    "id = $1 AND user_id = $2",
    [id, userId],
    "id",
  );

  if (!removed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
