import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { queryMany, queryOne, insert, update, remove } from "@/lib/postgres";
import {
  computeNextRunAt,
  isValidCronExpression,
  isValidTimezone,
  type Frequency,
  type SchedulingMode,
} from "@/lib/schedule";

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
  scheduling_mode: SchedulingMode;
  cron_expression: string | null;
  timezone: string;
  next_run_at: string | null;
  last_run_at: string | null;
  is_active: boolean;
  requires_approval: boolean;
  created_at: string;
  current_run_id: string | null;
  run_status: string;
  run_started_at: string | null;
  run_completed_at: string | null;
  last_error: string | null;
  posts?: { id: string; posted_at: string }[];
}

interface Post {
  id: string;
  posted_at: string;
}

const ALLOWED_UPDATE_FIELDS = new Set([
  "name",
  "search_query",
  "schedule",
  "frequency",
  "requires_approval",
  "is_active",
  "platform",
  "connection_id",
  "location",
  "style_prompt",
  "scheduling_mode",
  "cron_expression",
  "timezone",
  "next_run_at",
  // Run tracking fields (internal use)
  "run_status",
  "current_run_id",
  "run_started_at",
  "run_completed_at",
  "last_error",
]);

function validateScheduleFields(
  fields: Record<string, unknown>,
): { ok: true } | { ok: false; error: string } {
  const mode = fields.scheduling_mode as SchedulingMode | undefined;
  const tz =
    typeof fields.timezone === "string" ? (fields.timezone as string) : "UTC";
  if (mode && mode !== "cron" && mode !== "frequency") {
    return { ok: false, error: "scheduling_mode must be cron or frequency" };
  }
  if (typeof fields.timezone === "string" && !isValidTimezone(tz)) {
    return { ok: false, error: `invalid timezone: ${tz}` };
  }
  if (
    typeof fields.cron_expression === "string" &&
    fields.cron_expression.trim().length > 0 &&
    !isValidCronExpression(String(fields.cron_expression), tz)
  ) {
    return {
      ok: false,
      error: `invalid cron expression: ${String(fields.cron_expression)}`,
    };
  }
  return { ok: true };
}

export async function GET(request: Request) {
  const { userId } = auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const includePosts = searchParams.get("includePosts") !== "false";

  try {
    const workflows = await queryMany<Workflow>(
      `SELECT * FROM workflows WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    );

    if (includePosts && workflows.length > 0) {
      // Fetch posts for all workflows
      const workflowIds = workflows.map((w) => w.id);
      const posts = await queryMany<Post & { workflow_id: string }>(
        `SELECT id, posted_at, workflow_id FROM posts WHERE workflow_id = ANY($1)`,
        [workflowIds],
      );

      // Group posts by workflow_id
      const postsByWorkflow = posts.reduce(
        (acc, post) => {
          if (!acc[post.workflow_id]) {
            acc[post.workflow_id] = [];
          }
          acc[post.workflow_id].push({
            id: post.id,
            posted_at: post.posted_at,
          });
          return acc;
        },
        {} as Record<string, { id: string; posted_at: string }[]>,
      );

      // Attach posts to workflows
      workflows.forEach((workflow) => {
        workflow.posts = postsByWorkflow[workflow.id] || [];
      });
    }

    return NextResponse.json({ workflows });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Database error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { userId } = auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    name,
    platform,
    connection_id,
    search_query,
    location,
    style_prompt,
    schedule,
    frequency,
    requires_approval,
    scheduling_mode,
    cron_expression,
    timezone,
  } = body || {};

  if (!name || !platform || !connection_id || !search_query) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  const tz = typeof timezone === "string" && timezone ? timezone : "UTC";
  const mode: SchedulingMode =
    scheduling_mode === "cron" ? "cron" : "frequency";
  const cronExpr =
    typeof cron_expression === "string" && cron_expression.trim().length > 0
      ? cron_expression.trim()
      : null;
  const freq = (frequency || "daily") as Frequency;

  const valid = validateScheduleFields({
    scheduling_mode: mode,
    cron_expression: cronExpr || undefined,
    timezone: tz,
  });
  if (!valid.ok) {
    return NextResponse.json({ error: valid.error }, { status: 400 });
  }

  const nextRunAt = computeNextRunAt({
    mode,
    cronExpression: cronExpr,
    timezone: tz,
    frequency: freq,
  });

  try {
    // Verify connection belongs to user
    const connection = await queryOne(
      `SELECT id FROM connections WHERE id = $1 AND user_id = $2`,
      [connection_id, userId],
    );

    if (!connection) {
      return NextResponse.json(
        { error: "Invalid connection" },
        { status: 400 },
      );
    }

    const workflow = await insert<Workflow>("workflows", {
      user_id: userId,
      name,
      platform,
      connection_id,
      search_query,
      location: location || null,
      style_prompt: style_prompt || null,
      schedule: schedule || null,
      frequency: freq,
      requires_approval: !!requires_approval,
      type: "content_automation_advanced",
      config: JSON.stringify({}),
      is_active: true,
      scheduling_mode: mode,
      cron_expression: cronExpr,
      timezone: tz,
      next_run_at: nextRunAt.toISOString(),
    });

    if (!workflow) {
      return NextResponse.json(
        { error: "Failed to create workflow" },
        { status: 500 },
      );
    }

    return NextResponse.json({ workflow }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Database error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const { userId } = auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, ...updates } = body || {};

  if (!id) {
    return NextResponse.json({ error: "Missing workflow id" }, { status: 400 });
  }

  const filteredUpdates = Object.fromEntries(
    Object.entries(updates).filter(
      ([key, value]) => ALLOWED_UPDATE_FIELDS.has(key) && value !== undefined,
    ),
  );

  if (Object.keys(filteredUpdates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 },
    );
  }

  // If any schedule field is being changed, validate and recompute next_run_at
  // so the sweep cron picks up the new cadence immediately.
  if (
    "scheduling_mode" in filteredUpdates ||
    "cron_expression" in filteredUpdates ||
    "timezone" in filteredUpdates ||
    "frequency" in filteredUpdates
  ) {
    const valid = validateScheduleFields(filteredUpdates);
    if (!valid.ok) {
      return NextResponse.json({ error: valid.error }, { status: 400 });
    }

    // Read the current row so we can fill in fields the request omitted.
    const current = await queryOne<Workflow>(
      `SELECT scheduling_mode, cron_expression, timezone, frequency
         FROM workflows WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    const merged = {
      mode: ((filteredUpdates.scheduling_mode as SchedulingMode) ||
        current?.scheduling_mode ||
        "frequency") as SchedulingMode,
      cronExpression: (filteredUpdates.cron_expression as string | undefined)
        ? String(filteredUpdates.cron_expression).trim() || null
        : current?.cron_expression || null,
      timezone:
        (filteredUpdates.timezone as string | undefined) ||
        current?.timezone ||
        "UTC",
      frequency: ((filteredUpdates.frequency as Frequency) ||
        current?.frequency ||
        "daily") as Frequency,
    };
    filteredUpdates.next_run_at = computeNextRunAt(merged).toISOString();
  }

  try {
    // Verify connection if being updated
    if (filteredUpdates.connection_id) {
      const connection = await queryOne(
        `SELECT id FROM connections WHERE id = $1 AND user_id = $2`,
        [filteredUpdates.connection_id, userId],
      );

      if (!connection) {
        return NextResponse.json(
          { error: "Invalid connection" },
          { status: 400 },
        );
      }
    }

    const workflow = await update<Workflow>(
      "workflows",
      filteredUpdates,
      "id = $1 AND user_id = $2",
      [id, userId],
    );

    if (!workflow) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ workflow });
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
    const deleted = await remove<Workflow>(
      "workflows",
      "id = $1 AND user_id = $2",
      [id, userId],
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
