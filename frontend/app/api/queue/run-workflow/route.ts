import { NextResponse } from "next/server";
import { insert, query, queryOne, upsert } from "@/lib/postgres";
import { decryptToken } from "@/lib/encryption";
import { verifyAndParseQueueRequest } from "@/lib/queue";
import {
  acquireConnectionLease,
  checkPublishRateLimit,
  releaseConnectionLease,
} from "@/lib/redis";
import { CREDITS_CONFIG } from "@/config";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const STALE_RUN_MS = 10 * 60 * 1000;
const CREDITS_PER_RUN = CREDITS_CONFIG.perOperation.workflowRun;

interface Workflow {
  id: string;
  user_id: string;
  connection_id: string | null;
  search_query: string | null;
  location: string | null;
  style_prompt: string | null;
  requires_approval: boolean;
  run_status: string;
  run_started_at: string | null;
  is_active: boolean;
}

interface Connection {
  id: string;
  user_id: string;
  platform: string;
  credentials: Record<string, unknown> | null;
  access_token_encrypted: string | null;
  ig_business_account_id: string | null;
  page_id: string | null;
  connection_status: string | null;
}

interface UserCredits {
  credits_balance: number;
  bonus_credits: number;
}

interface Plan {
  id: string;
  credits_per_month: number;
}

// POST /api/queue/run-workflow
//
// Worker endpoint invoked by QStash (and only by QStash — signature checked).
// Acquires a per-connection lease + per-account rate-limit token, then
// triggers the LangGraph run. The cron sweep is the only thing that should
// publish to this queue; user-triggered "Run now" still hits trigger-workflow
// directly because that path needs synchronous feedback.
export async function POST(request: Request) {
  let body: { workflowId: string };
  try {
    body = await verifyAndParseQueueRequest(request);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "verify failed" },
      { status: 401 },
    );
  }

  const workflow = await queryOne<Workflow>(
    `SELECT id, user_id, connection_id, search_query, location, style_prompt,
            requires_approval, run_status, run_started_at, is_active
       FROM workflows WHERE id = $1`,
    [body.workflowId],
  );
  if (!workflow) {
    return NextResponse.json({ error: "workflow not found" }, { status: 404 });
  }
  if (!workflow.is_active) {
    return NextResponse.json({ skipped: "workflow inactive" });
  }
  if (!workflow.connection_id) {
    return NextResponse.json({ skipped: "no connection" });
  }

  // Skip if a non-stale run is already in flight.
  if (workflow.run_status === "running") {
    const startedAt = workflow.run_started_at
      ? new Date(workflow.run_started_at).getTime()
      : 0;
    if (Date.now() - startedAt < STALE_RUN_MS) {
      // QStash will treat 200 as success. If we want a retry instead, return
      // a 5xx — but here we *want* to skip, not retry: the previous run is
      // still working.
      return NextResponse.json({ skipped: "already running" });
    }
  }

  const connection = await queryOne<Connection>(
    `SELECT id, user_id, platform, credentials,
            access_token_encrypted, ig_business_account_id, page_id,
            connection_status
       FROM connections WHERE id = $1`,
    [workflow.connection_id],
  );
  if (!connection) {
    await query(
      `UPDATE workflows SET run_status='failed', last_error=$1, run_completed_at=NOW() WHERE id=$2`,
      ["connection missing", workflow.id],
    );
    return NextResponse.json({ skipped: "connection missing" });
  }
  if (
    connection.platform === "instagram" &&
    (connection.connection_status !== "active" ||
      !connection.access_token_encrypted ||
      !connection.ig_business_account_id)
  ) {
    await query(
      `UPDATE workflows SET run_status='failed', last_error=$1, run_completed_at=NOW() WHERE id=$2`,
      ["IG connection not active (reconnect)", workflow.id],
    );
    return NextResponse.json({ skipped: "connection not active" });
  }

  // Per-account publish rate limit. If we're over budget, ask QStash to
  // retry by returning 429 — Upstash will back off and retry.
  const rate = await checkPublishRateLimit(connection.id);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        retry: true,
        reason: "rate_limited",
        retryAfterMs: rate.retryAfterMs,
      },
      { status: 429 },
    );
  }

  // Per-connection lease so two workers don't publish to the same IG account
  // simultaneously.
  const leaseToken = await acquireConnectionLease(connection.id);
  if (!leaseToken) {
    return NextResponse.json(
      { retry: true, reason: "lease_busy" },
      { status: 429 },
    );
  }

  try {
    // Make sure the user has credits before spending compute.
    let credits = await queryOne<UserCredits>(
      `SELECT credits_balance, bonus_credits FROM user_credits WHERE user_id = $1`,
      [workflow.user_id],
    );
    if (!credits) {
      const plan = await queryOne<Plan>(
        `SELECT id, credits_per_month FROM plans WHERE slug = $1`,
        ["free"],
      );
      await upsert(
        "user_credits",
        {
          user_id: workflow.user_id,
          credits_balance: plan?.credits_per_month || 10,
          credits_used_this_month: 0,
          bonus_credits: 0,
        },
        "user_id",
      );
      credits = {
        credits_balance: plan?.credits_per_month || 10,
        bonus_credits: 0,
      };
    }
    if (
      (credits.credits_balance || 0) + (credits.bonus_credits || 0) <
      CREDITS_PER_RUN
    ) {
      await query(
        `UPDATE workflows SET run_status='failed', last_error=$1, run_completed_at=NOW() WHERE id=$2`,
        ["insufficient credits", workflow.id],
      );
      return NextResponse.json({ skipped: "insufficient credits" });
    }

    // Acquire run lock atomically. Two workers can't both flip idle → running.
    const locked = await query(
      `UPDATE workflows
          SET run_status='running',
              run_started_at=NOW(),
              last_run_at=NOW(),
              last_error=NULL,
              current_run_id=NULL
        WHERE id=$1 AND run_status != 'running'`,
      [workflow.id],
    );
    if (locked.rowCount === 0) {
      return NextResponse.json({ skipped: "lock contended" });
    }

    let agentCredentials: Record<string, unknown> =
      connection.credentials || {};
    if (connection.platform === "instagram") {
      try {
        agentCredentials = {
          accessToken: decryptToken(connection.access_token_encrypted!),
          igUserId: connection.ig_business_account_id,
          pageId: connection.page_id,
          userId: workflow.user_id,
        };
      } catch (err) {
        await query(
          `UPDATE workflows SET run_status='failed', last_error=$1, run_completed_at=NOW() WHERE id=$2`,
          [
            `decrypt failed: ${err instanceof Error ? err.message : "unknown"}`,
            workflow.id,
          ],
        );
        return NextResponse.json({ error: "decrypt failed" }, { status: 500 });
      }
    }

    const apiUrl = process.env.LANGGRAPH_API_URL || "http://localhost:54367";
    const runResponse = await fetch(`${apiUrl}/runs/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assistant_id: "content_automation_advanced",
        input: {
          searchQuery: workflow.search_query || "AI News",
          location: workflow.location || "",
          stylePrompt: workflow.style_prompt || "",
          platform: connection.platform,
          credentials: agentCredentials,
          requiresApproval: workflow.requires_approval,
          userId: workflow.user_id,
          workflowId: workflow.id,
        },
        stream_mode: "updates",
      }),
    });

    if (!runResponse.ok) {
      const text = await runResponse.text().catch(() => "");
      await query(
        `UPDATE workflows
            SET run_status='failed', run_completed_at=NOW(), last_error=$1
          WHERE id=$2`,
        [`LangGraph ${runResponse.status}: ${text.slice(0, 300)}`, workflow.id],
      );
      // 5xx → QStash will retry; 4xx → permanent.
      return NextResponse.json(
        { error: `LangGraph trigger failed: ${runResponse.status}` },
        { status: runResponse.status >= 500 ? 502 : 400 },
      );
    }

    // Read just enough to capture the run_id, then let LangGraph keep going.
    const reader = runResponse.body?.getReader();
    let runId = "";
    if (reader) {
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const m = buffer.match(/"run_id":\s*"([^"]+)"/);
        if (m) {
          runId = m[1];
          break;
        }
      }
      reader.cancel();
    }
    if (runId) {
      await query(`UPDATE workflows SET current_run_id=$1 WHERE id=$2`, [
        runId,
        workflow.id,
      ]);
    }

    // Audit row so we can correlate enqueue → trigger.
    await insert("credit_transactions", {
      user_id: workflow.user_id,
      amount: 0,
      balance_after:
        (credits.credits_balance || 0) + (credits.bonus_credits || 0),
      transaction_type: "adjustment",
      description: `Queue worker triggered workflow ${workflow.id}`,
      reference_type: "workflow",
      reference_id: workflow.id,
    }).catch(() => null);

    return NextResponse.json({ ok: true, workflowId: workflow.id, runId });
  } finally {
    await releaseConnectionLease(connection.id, leaseToken);
  }
}
