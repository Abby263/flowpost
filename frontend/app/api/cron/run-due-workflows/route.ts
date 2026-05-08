import { NextResponse } from "next/server";
import { query, queryMany } from "@/lib/postgres";
import { computeNextRunAt } from "@/lib/schedule";
import { enqueueWorkflow, isQueueConfigured } from "@/lib/queue";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface DueWorkflow {
  id: string;
  user_id: string;
  connection_id: string | null;
  scheduling_mode: "cron" | "frequency";
  cron_expression: string | null;
  timezone: string | null;
  frequency: "daily" | "weekly" | "monthly" | null;
  next_run_at: string | null;
}

function isCronAuthorized(request: Request): boolean {
  const auth = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (expected && auth === `Bearer ${expected}`) return true;
  if (request.headers.get("x-vercel-cron")) return true;
  if (process.env.NODE_ENV !== "production") return true;
  return false;
}

// GET /api/cron/run-due-workflows
//
// Runs every 5 minutes (configured in vercel.json). For each active workflow
// whose next_run_at <= NOW(), this:
//   1. Computes the *next* next_run_at and stores it (idempotency lever — even
//      if dispatch fails, we don't fire the same slot again).
//   2. Enqueues the workflow id to QStash for the worker to actually publish.
//
// Workers (not this cron) handle the lease/rate-limit/LangGraph trigger so
// the cron stays fast (< 1s for thousands of workflows).
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isQueueConfigured()) {
    return NextResponse.json(
      { error: "QStash not configured (set QSTASH_TOKEN)" },
      { status: 503 },
    );
  }

  // We bound the lookback to 1 hour to avoid stampeding after extended
  // downtime — a workflow whose next_run_at is several hours stale should
  // fire once and reset, not fire repeatedly.
  const due = await queryMany<DueWorkflow>(
    `SELECT id, user_id, connection_id,
            scheduling_mode, cron_expression, timezone,
            frequency, next_run_at
       FROM workflows
      WHERE is_active = TRUE
        AND connection_id IS NOT NULL
        AND next_run_at IS NOT NULL
        AND next_run_at <= NOW()
        AND next_run_at > NOW() - INTERVAL '1 hour'
      ORDER BY next_run_at ASC
      LIMIT 500`,
  );

  const enqueued: string[] = [];
  const errors: { id: string; error: string }[] = [];

  for (const wf of due) {
    try {
      const next = computeNextRunAt({
        mode: wf.scheduling_mode,
        cronExpression: wf.cron_expression,
        timezone: wf.timezone || "UTC",
        frequency: wf.frequency,
      });

      // Advance next_run_at *before* enqueue. Even if enqueue fails the worker
      // will be re-driven by the next sweep (the cron runs every 5 min).
      await query(`UPDATE workflows SET next_run_at = $1 WHERE id = $2`, [
        next.toISOString(),
        wf.id,
      ]);

      await enqueueWorkflow({
        workflowId: wf.id,
        // Dedup within a 5-min window so two overlapping sweeps don't double-fire.
        deduplicationId: `wf:${wf.id}:${Math.floor(Date.now() / (5 * 60 * 1000))}`,
      });
      enqueued.push(wf.id);
    } catch (err) {
      errors.push({
        id: wf.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    inspected: due.length,
    enqueued,
    errors,
  });
}
