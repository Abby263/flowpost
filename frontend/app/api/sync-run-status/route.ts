import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { query, queryOne } from "@/lib/postgres";

interface Workflow {
  id: string;
  user_id: string;
  current_run_id: string | null;
  run_status: string;
  run_started_at: string | null;
}

interface LangGraphRun {
  run_id: string;
  status: string;
  error?: string;
}

/**
 * POST: Sync workflow run status with LangGraph
 *
 * This endpoint checks with LangGraph to see if a run has completed or failed,
 * and updates the local database accordingly. This fixes the issue where the UI
 * shows "running" even when the LangGraph run has already failed.
 */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    const { workflowId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!workflowId) {
      return NextResponse.json(
        { error: "Workflow ID is required" },
        { status: 400 },
      );
    }

    // Get the workflow
    const workflow = await queryOne<Workflow>(
      `SELECT id, user_id, current_run_id, run_status, run_started_at
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

    // Only sync if currently showing as running
    if (workflow.run_status !== "running") {
      return NextResponse.json({
        synced: false,
        message: "Workflow is not running",
        status: workflow.run_status,
      });
    }

    // If we don't have a run_id, we can't check LangGraph
    if (!workflow.current_run_id || workflow.current_run_id === "unknown") {
      return NextResponse.json({
        synced: false,
        message: "No run ID available to check",
        status: workflow.run_status,
      });
    }

    // Check run status with LangGraph
    const apiUrl = process.env.LANGGRAPH_API_URL || "http://localhost:54367";

    let runStatus: LangGraphRun | null = null;

    try {
      const response = await fetch(
        `${apiUrl}/runs/${workflow.current_run_id}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (response.ok) {
        runStatus = await response.json();
      }
    } catch (fetchError) {
      console.warn(
        `Could not check LangGraph run status: ${fetchError instanceof Error ? fetchError.message : "Unknown error"}`,
      );
    }

    // If LangGraph says the run has ended, update our database
    if (runStatus) {
      const lgStatus = runStatus.status?.toLowerCase();

      if (lgStatus === "error" || lgStatus === "failed") {
        // Run failed - update database
        await query(
          `UPDATE workflows
           SET run_status = 'failed', run_completed_at = NOW(), last_error = $1
           WHERE id = $2 AND user_id = $3`,
          [
            runStatus.error || "Run failed in LangGraph (synced from backend)",
            workflowId,
            userId,
          ],
        );

        console.log(
          `✅ Synced workflow ${workflowId} status to 'failed' from LangGraph`,
        );

        return NextResponse.json({
          synced: true,
          previousStatus: "running",
          newStatus: "failed",
          error: runStatus.error,
        });
      }

      if (lgStatus === "success" || lgStatus === "completed") {
        // Run completed - this shouldn't happen as savePostToDb should update it
        // but handle it just in case
        await query(
          `UPDATE workflows
           SET run_status = 'completed', run_completed_at = NOW()
           WHERE id = $1 AND user_id = $2`,
          [workflowId, userId],
        );

        console.log(
          `✅ Synced workflow ${workflowId} status to 'completed' from LangGraph`,
        );

        return NextResponse.json({
          synced: true,
          previousStatus: "running",
          newStatus: "completed",
        });
      }

      // Still running in LangGraph
      return NextResponse.json({
        synced: false,
        message: `Run is still ${lgStatus} in LangGraph`,
        status: workflow.run_status,
        langGraphStatus: lgStatus,
      });
    }

    // Could not get status from LangGraph - check if run started long ago
    // and should be considered stale
    if (workflow.run_started_at) {
      const runStartedAt = new Date(workflow.run_started_at).getTime();
      const staleThresholdMs = 5 * 60 * 1000; // 5 minutes

      if (Date.now() - runStartedAt > staleThresholdMs) {
        // Run is stale, mark as failed
        await query(
          `UPDATE workflows
           SET run_status = 'failed', run_completed_at = NOW(), last_error = $1
           WHERE id = $2 AND user_id = $3`,
          [
            "Workflow timed out - could not verify run status with backend",
            workflowId,
            userId,
          ],
        );

        console.log(
          `✅ Marked stale workflow ${workflowId} as 'failed' (started ${Math.floor((Date.now() - runStartedAt) / 1000)}s ago)`,
        );

        return NextResponse.json({
          synced: true,
          previousStatus: "running",
          newStatus: "failed",
          error:
            "Workflow timed out - could not verify run status with backend",
        });
      }
    }

    return NextResponse.json({
      synced: false,
      message: "Could not determine run status from LangGraph",
      status: workflow.run_status,
    });
  } catch (error: unknown) {
    console.error("Sync Run Status Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
