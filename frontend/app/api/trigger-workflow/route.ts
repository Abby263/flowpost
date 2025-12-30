import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { queryOne, query, insert, upsert } from "@/lib/postgres";

// Timeout for workflow runs (10 minutes)
const WORKFLOW_TIMEOUT_MS = 10 * 60 * 1000;

// Credits required per workflow run
const CREDITS_PER_RUN = 1;

interface UserCredits {
  credits_balance: number;
  bonus_credits: number;
}

interface Workflow {
  id: string;
  user_id: string;
  connection_id: string | null;
  name: string;
  search_query: string | null;
  location: string | null;
  style_prompt: string | null;
  requires_approval: boolean;
  run_status: string;
  run_started_at: string | null;
  current_run_id: string | null;
}

interface Connection {
  id: string;
  platform: string;
  credentials: Record<string, unknown>;
}

interface Plan {
  id: string;
  credits_per_month: number;
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    const { workflowId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Received workflow trigger request:", { workflowId });

    if (!workflowId) {
      return NextResponse.json(
        { error: "Workflow ID is required" },
        { status: 400 },
      );
    }

    // 0. Check user credits before proceeding
    let credits = await queryOne<UserCredits>(
      `SELECT credits_balance, bonus_credits FROM user_credits WHERE user_id = $1`,
      [userId],
    );

    // If no credits record, initialize user with free plan
    if (!credits) {
      const plan = await queryOne<Plan>(
        `SELECT id, credits_per_month FROM plans WHERE slug = $1`,
        ["free"],
      );

      await upsert(
        "user_credits",
        {
          user_id: userId,
          credits_balance: plan?.credits_per_month || 10,
          credits_used_this_month: 0,
          bonus_credits: 0,
        },
        "user_id",
      );

      await upsert(
        "user_subscriptions",
        {
          user_id: userId,
          plan_id: plan?.id,
          status: "active",
        },
        "user_id",
      );

      credits = {
        credits_balance: plan?.credits_per_month || 10,
        bonus_credits: 0,
      };
    }

    const totalCredits =
      (credits.credits_balance || 0) + (credits.bonus_credits || 0);

    if (totalCredits < CREDITS_PER_RUN) {
      return NextResponse.json(
        {
          error: "Insufficient credits",
          message: `You need at least ${CREDITS_PER_RUN} credit to run a workflow. You have ${totalCredits} credits remaining.`,
          credits_remaining: totalCredits,
          credits_required: CREDITS_PER_RUN,
        },
        { status: 402 }, // Payment Required
      );
    }

    // 1. Fetch workflow and check ownership
    const workflow = await queryOne<Workflow>(
      `SELECT * FROM workflows WHERE id = $1 AND user_id = $2`,
      [workflowId, userId],
    );

    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 },
      );
    }

    if (!workflow.connection_id) {
      return NextResponse.json(
        { error: "Workflow has no connection" },
        { status: 400 },
      );
    }

    // 2. Check if workflow is already running (with stale run detection)
    if (workflow.run_status === "running") {
      const runStartedAt = workflow.run_started_at
        ? new Date(workflow.run_started_at).getTime()
        : 0;
      const now = Date.now();

      // If run has been going for more than timeout, consider it stale and allow restart
      if (now - runStartedAt < WORKFLOW_TIMEOUT_MS) {
        const remainingSeconds = Math.ceil(
          (WORKFLOW_TIMEOUT_MS - (now - runStartedAt)) / 1000,
        );
        return NextResponse.json(
          {
            error: `Workflow is already running. Please wait ${remainingSeconds} seconds or until it completes.`,
            isRunning: true,
            runId: workflow.current_run_id,
            startedAt: workflow.run_started_at,
          },
          { status: 409 }, // Conflict status code
        );
      }

      // Stale run detected - log and continue
      console.warn(
        `Stale run detected for workflow ${workflowId}. Previous run started at ${workflow.run_started_at}. Allowing new run.`,
      );
    }

    // 3. Acquire lock with atomic update (optimistic locking)
    const lockResult = await query<Workflow>(
      `UPDATE workflows
       SET run_status = 'running', run_started_at = NOW(), current_run_id = NULL, last_error = NULL
       WHERE id = $1 AND user_id = $2 AND run_status != 'running'
       RETURNING *`,
      [workflowId, userId],
    );

    const lockedWorkflow = lockResult.rows[0];

    // If we couldn't acquire the lock, another request got there first
    if (!lockedWorkflow) {
      // Check if it's because workflow is now running
      const checkWorkflow = await queryOne<{
        run_status: string;
        run_started_at: string;
      }>(`SELECT run_status, run_started_at FROM workflows WHERE id = $1`, [
        workflowId,
      ]);

      if (checkWorkflow?.run_status === "running") {
        return NextResponse.json(
          {
            error:
              "Workflow was just started by another request. Please wait for it to complete.",
            isRunning: true,
          },
          { status: 409 },
        );
      }

      return NextResponse.json(
        { error: "Failed to start workflow. Please try again." },
        { status: 500 },
      );
    }

    // 4. Fetch connection credentials
    const connection = await queryOne<Connection>(
      `SELECT * FROM connections WHERE id = $1 AND user_id = $2`,
      [workflow.connection_id, userId],
    );

    if (!connection) {
      // Release the lock since we can't proceed
      await query(
        `UPDATE workflows
         SET run_status = 'failed', run_completed_at = NOW(), last_error = $1
         WHERE id = $2`,
        ["Connection not found", workflowId],
      );

      return NextResponse.json(
        { error: "Connection not found" },
        { status: 404 },
      );
    }

    // 5. Prepare Input for Agent
    const input = {
      searchQuery: workflow.search_query || "AI News",
      location: workflow.location || "",
      stylePrompt: workflow.style_prompt || "",
      platform: connection.platform,
      credentials: connection.credentials,
      requiresApproval: workflow.requires_approval,
      userId: workflow.user_id,
      workflowId: workflow.id,
    };

    // 6. Trigger LangGraph Run using streaming API (threadless run)
    const apiUrl = process.env.LANGGRAPH_API_URL || "http://localhost:54367";

    let runResponse: Response;
    try {
      runResponse = await fetch(`${apiUrl}/runs/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assistant_id: "content_automation_advanced",
          input: input,
          stream_mode: "updates",
        }),
      });
    } catch (fetchError: unknown) {
      const errorMsg =
        fetchError instanceof Error ? fetchError.message : "Unknown error";
      // Release the lock on network error
      await query(
        `UPDATE workflows
         SET run_status = 'failed', run_completed_at = NOW(), last_error = $1
         WHERE id = $2`,
        [`Failed to connect to LangGraph: ${errorMsg}`, workflowId],
      );

      throw new Error(`Failed to connect to LangGraph: ${errorMsg}`);
    }

    if (!runResponse.ok) {
      const errorText = await runResponse.text();

      // Release the lock on API error
      await query(
        `UPDATE workflows
         SET run_status = 'failed', run_completed_at = NOW(), last_error = $1
         WHERE id = $2`,
        [`LangGraph API error: ${errorText}`, workflowId],
      );

      throw new Error(`Failed to start run: ${errorText}`);
    }

    // 7. Read the first chunk to get the run_id from metadata event
    const reader = runResponse.body?.getReader();
    let runId = "";

    if (reader) {
      const decoder = new TextDecoder();
      let buffer = "";

      // Read enough to get the metadata event
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Look for run_id in the metadata event
        const runIdMatch = buffer.match(/"run_id":\s*"([^"]+)"/);
        if (runIdMatch) {
          runId = runIdMatch[1];
          break;
        }
      }

      // Cancel the reader - let the backend continue processing
      reader.cancel();
    }

    // 8. Update workflow with the run ID
    await query(`UPDATE workflows SET current_run_id = $1 WHERE id = $2`, [
      runId || "unknown",
      workflowId,
    ]);

    // Get current credits balance for response
    const currentCredits = await queryOne<UserCredits>(
      `SELECT credits_balance, bonus_credits FROM user_credits WHERE user_id = $1`,
      [userId],
    );

    const currentBalance =
      (currentCredits?.credits_balance || 0) +
      (currentCredits?.bonus_credits || 0);

    console.log(
      `Workflow ${workflowId} started with run ID: ${runId}. Credits will be deducted on successful completion. Current balance: ${currentBalance}`,
    );

    return NextResponse.json({
      success: true,
      runId: runId || "started",
      workflowId: workflowId,
      message:
        "Workflow started successfully. Credits will be deducted on completion.",
      credits_to_deduct: CREDITS_PER_RUN,
      credits_balance: currentBalance,
    });
  } catch (error: unknown) {
    console.error("Trigger Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
