import { NextResponse } from "next/server";
import { query, queryMany, queryOne } from "@/lib/postgres";

export const dynamic = "force-dynamic";

interface DueWorkflow {
  id: string;
  user_id: string;
  connection_id: string | null;
  search_query: string | null;
  location: string | null;
  style_prompt: string | null;
  requires_approval: boolean;
  frequency: string | null;
  last_run_at: string | null;
  run_status: string;
  run_started_at: string | null;
}

interface ConnectionRow {
  id: string;
  platform: string;
  credentials: Record<string, unknown> | null;
}

const STALE_RUN_MS = 10 * 60 * 1000;

function frequencyToHours(freq: string | null): number {
  switch ((freq || "daily").toLowerCase()) {
    case "weekly":
      return 24 * 7;
    case "monthly":
      return 24 * 30;
    case "daily":
    default:
      return 24;
  }
}

function isCronAuthorized(request: Request): boolean {
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET>. We accept either
  // that or the standard `x-vercel-cron` header that Vercel adds.
  const auth = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (expected && auth === `Bearer ${expected}`) return true;
  if (request.headers.get("x-vercel-cron")) return true;
  // Allow in dev so it can be hit by curl.
  if (process.env.NODE_ENV !== "production") return true;
  return false;
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Pull active workflows whose last run is older than their cadence.
  const due = await queryMany<DueWorkflow>(
    `SELECT id, user_id, connection_id, search_query, location, style_prompt,
            requires_approval, frequency, last_run_at, run_status, run_started_at
       FROM workflows
      WHERE is_active = TRUE
        AND connection_id IS NOT NULL
        AND (
          last_run_at IS NULL OR
          last_run_at < NOW() - (
            CASE LOWER(COALESCE(frequency, 'daily'))
              WHEN 'weekly'  THEN INTERVAL '7 days'
              WHEN 'monthly' THEN INTERVAL '30 days'
              ELSE INTERVAL '1 day'
            END
          )
        )
      ORDER BY COALESCE(last_run_at, '1970-01-01') ASC
      LIMIT 25`,
  );

  const apiUrl = process.env.LANGGRAPH_API_URL || "http://localhost:54367";
  const triggered: string[] = [];
  const skipped: { id: string; reason: string }[] = [];

  for (const wf of due) {
    // Skip if a run is currently in flight and not stale.
    if (wf.run_status === "running") {
      const startedAt = wf.run_started_at
        ? new Date(wf.run_started_at).getTime()
        : 0;
      if (Date.now() - startedAt < STALE_RUN_MS) {
        skipped.push({ id: wf.id, reason: "already running" });
        continue;
      }
    }

    const connection = await queryOne<ConnectionRow>(
      `SELECT id, platform, credentials FROM connections WHERE id = $1`,
      [wf.connection_id],
    );
    if (!connection) {
      skipped.push({ id: wf.id, reason: "connection missing" });
      continue;
    }

    // Acquire the run lock atomically.
    const locked = await query(
      `UPDATE workflows
          SET run_status = 'running',
              run_started_at = NOW(),
              last_run_at = NOW(),
              last_error = NULL,
              current_run_id = NULL
        WHERE id = $1 AND run_status != 'running'`,
      [wf.id],
    );
    if (locked.rowCount === 0) {
      skipped.push({ id: wf.id, reason: "lock contended" });
      continue;
    }

    try {
      await fetch(`${apiUrl}/runs/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assistant_id: "content_automation_advanced",
          input: {
            searchQuery: wf.search_query || "AI News",
            location: wf.location || "",
            stylePrompt: wf.style_prompt || "",
            platform: connection.platform,
            credentials: connection.credentials,
            requiresApproval: wf.requires_approval,
            userId: wf.user_id,
            workflowId: wf.id,
          },
          stream_mode: "updates",
        }),
      });
      triggered.push(wf.id);

      // Compute next_run_at for visibility (advisory only).
      const hrs = frequencyToHours(wf.frequency);
      await query(
        `UPDATE workflows
            SET next_run_at = NOW() + ($1::int * INTERVAL '1 hour')
          WHERE id = $2`,
        [hrs, wf.id],
      );
    } catch (err) {
      // Release the lock so the next cron sweep can retry.
      await query(
        `UPDATE workflows
            SET run_status = 'failed',
                run_completed_at = NOW(),
                last_error = $1
          WHERE id = $2`,
        [err instanceof Error ? err.message : "trigger failed", wf.id],
      );
      skipped.push({
        id: wf.id,
        reason: err instanceof Error ? err.message : "trigger failed",
      });
    }
  }

  return NextResponse.json({
    triggered,
    skipped,
    inspected: due.length,
  });
}
