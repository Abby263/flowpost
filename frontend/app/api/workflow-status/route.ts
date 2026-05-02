import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { queryOne, query, insert } from "@/lib/postgres";
import { CREDITS_CONFIG } from "@/config";

export const dynamic = "force-dynamic";

// Timeout for workflow runs (30 minutes) - if running longer, consider stale
const STALE_RUN_TIMEOUT_MS = 30 * 60 * 1000;

// Threshold to check LangGraph for run status (2 minutes)
const SYNC_CHECK_THRESHOLD_MS = 2 * 60 * 1000;

// Credits required per workflow run (deducted only on success) - from centralized config
const CREDITS_PER_WORKFLOW = CREDITS_CONFIG.perOperation.workflowRun;

interface Workflow {
  id: string;
  name: string;
  user_id: string;
  run_status: string;
  current_run_id: string | null;
  run_started_at: string | null;
  run_completed_at: string | null;
  last_error: string | null;
}

interface UserCredits {
  credits_balance: number;
  bonus_credits: number;
}

// GET: Check workflow run status from database
export async function GET(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const workflowId = searchParams.get("workflowId");

  if (!workflowId) {
    return NextResponse.json(
      { error: "Missing workflowId parameter" },
      { status: 400 },
    );
  }

  try {
    const workflow = await queryOne<Workflow>(
      `SELECT id, name, run_status, current_run_id, run_started_at, run_completed_at, last_error
       FROM workflows
       WHERE id = $1 AND user_id = $2`,
      [workflowId, userId],
    );

    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 },
      );
    }

    // Calculate elapsed time if running
    let elapsedSeconds = 0;
    let actualStatus = workflow.run_status;

    if (workflow.run_status === "running" && workflow.run_started_at) {
      const runStartedAt = new Date(workflow.run_started_at).getTime();
      const elapsedMs = Date.now() - runStartedAt;
      elapsedSeconds = Math.floor(elapsedMs / 1000);

      // Auto-detect stale runs and mark them as failed
      if (elapsedMs > STALE_RUN_TIMEOUT_MS) {
        console.warn(
          `Stale run detected for workflow ${workflowId}. Started at ${workflow.run_started_at}. Auto-resetting to failed.`,
        );

        // Auto-reset stale workflow
        await query(
          `UPDATE workflows
           SET run_status = 'failed', run_completed_at = NOW(), last_error = $1
           WHERE id = $2 AND user_id = $3`,
          [
            "Workflow timed out - run was interrupted or failed to complete",
            workflowId,
            userId,
          ],
        );

        actualStatus = "failed";
      } else if (
        elapsedMs > SYNC_CHECK_THRESHOLD_MS &&
        workflow.current_run_id
      ) {
        // If running for more than 2 minutes, check LangGraph for actual status
        // This catches cases where the run failed but our DB wasn't updated
        try {
          const apiUrl =
            process.env.LANGGRAPH_API_URL || "http://localhost:54367";
          const response = await fetch(
            `${apiUrl}/runs/${workflow.current_run_id}`,
            {
              method: "GET",
              headers: { "Content-Type": "application/json" },
              signal: AbortSignal.timeout(5000), // 5 second timeout
            },
          );

          if (response.ok) {
            const runData = await response.json();
            const lgStatus = runData.status?.toLowerCase();

            if (lgStatus === "error" || lgStatus === "failed") {
              console.log(
                `LangGraph shows run ${workflow.current_run_id} as ${lgStatus}. Syncing status.`,
              );

              await query(
                `UPDATE workflows
                 SET run_status = 'failed', run_completed_at = NOW(), last_error = $1
                 WHERE id = $2 AND user_id = $3`,
                [
                  runData.error || "Run failed (synced from LangGraph)",
                  workflowId,
                  userId,
                ],
              );

              actualStatus = "failed";
            }
          }
        } catch (syncError) {
          // Ignore sync errors - this is just an optimization
          console.debug("LangGraph sync check failed:", syncError);
        }
      }
    }

    return NextResponse.json({
      status: actualStatus,
      runId: workflow.current_run_id,
      startedAt: workflow.run_started_at,
      completedAt: workflow.run_completed_at,
      elapsedSeconds,
      error:
        actualStatus === "failed" && !workflow.last_error
          ? "Workflow timed out - run was interrupted or failed to complete"
          : workflow.last_error,
    });
  } catch (error: unknown) {
    console.error("Status Fetch Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH: Update workflow run status (called by backend when run completes)
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { workflowId, status, error: runError, webhookSecret } = body;

    // For webhook-based updates, verify the secret
    // For authenticated users, verify userId
    const { userId } = await auth();
    const expectedSecret = process.env.WORKFLOW_WEBHOOK_SECRET;

    // Allow either authenticated user or valid webhook secret
    if (!userId && webhookSecret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!workflowId || !status) {
      return NextResponse.json(
        { error: "Missing required fields: workflowId, status" },
        { status: 400 },
      );
    }

    const validStatuses = ["idle", "running", "completed", "failed"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        {
          error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
        },
        { status: 400 },
      );
    }

    // Build update query
    let updateQuery = `UPDATE workflows SET run_status = $1`;
    const params: unknown[] = [status];
    let paramIndex = 2;

    if (status === "completed" || status === "failed") {
      updateQuery += `, run_completed_at = NOW()`;
    }

    if (runError) {
      updateQuery += `, last_error = $${paramIndex}`;
      params.push(runError);
      paramIndex++;
    }

    updateQuery += ` WHERE id = $${paramIndex}`;
    params.push(workflowId);
    paramIndex++;

    if (userId) {
      updateQuery += ` AND user_id = $${paramIndex}`;
      params.push(userId);
    }

    updateQuery += ` RETURNING *, user_id`;

    const result = await query<Workflow>(updateQuery, params);
    const data = result.rows[0];

    if (!data) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 },
      );
    }

    // Deduct credits ONLY on successful completion
    let creditsDeducted = false;
    if (status === "completed") {
      const workflowUserId = data.user_id;
      if (workflowUserId) {
        try {
          // Get current credits
          const credits = await queryOne<UserCredits>(
            `SELECT credits_balance, bonus_credits FROM user_credits WHERE user_id = $1`,
            [workflowUserId],
          );

          if (credits) {
            // Deduct from bonus credits first, then regular credits
            let remainingDeduct = CREDITS_PER_WORKFLOW;
            let newBonusCredits = credits.bonus_credits;
            let newCreditsBalance = credits.credits_balance;

            if (credits.bonus_credits > 0) {
              const bonusDeduct = Math.min(
                credits.bonus_credits,
                remainingDeduct,
              );
              newBonusCredits = credits.bonus_credits - bonusDeduct;
              remainingDeduct -= bonusDeduct;
            }

            if (remainingDeduct > 0) {
              newCreditsBalance = credits.credits_balance - remainingDeduct;
            }

            // Update credits
            await query(
              `UPDATE user_credits
               SET credits_balance = $1, bonus_credits = $2, credits_used_this_month = credits_used_this_month + $3, updated_at = NOW()
               WHERE user_id = $4`,
              [
                newCreditsBalance,
                newBonusCredits,
                CREDITS_PER_WORKFLOW,
                workflowUserId,
              ],
            );

            // Log transaction
            await insert("credit_transactions", {
              user_id: workflowUserId,
              amount: -CREDITS_PER_WORKFLOW,
              balance_after: newCreditsBalance + newBonusCredits,
              transaction_type: "usage",
              description: `Workflow completed: ${data.name || workflowId}`,
            });

            creditsDeducted = true;
            console.log(
              `Workflow ${workflowId} completed successfully. Deducted ${CREDITS_PER_WORKFLOW} credit(s) from user ${workflowUserId}`,
            );
          }
        } catch (creditError) {
          console.error("Failed to deduct credits:", creditError);
          // Don't fail the status update if credit deduction fails
        }
      }
    } else {
      console.log(
        `Workflow ${workflowId} status updated to: ${status}. No credits deducted (only charged on success).`,
      );
    }

    return NextResponse.json({
      success: true,
      workflow: {
        id: data.id,
        run_status: data.run_status,
        run_completed_at: data.run_completed_at,
      },
      credits_deducted: creditsDeducted ? CREDITS_PER_WORKFLOW : 0,
    });
  } catch (error: unknown) {
    console.error("Status Update Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
