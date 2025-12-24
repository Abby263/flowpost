import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Timeout for workflow runs (30 minutes) - if running longer, consider stale
const STALE_RUN_TIMEOUT_MS = 30 * 60 * 1000;

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
    const { data: workflow, error } = await supabaseAdmin
      .from("workflows")
      .select(
        "id, name, run_status, current_run_id, run_started_at, run_completed_at, last_error",
      )
      .eq("id", workflowId)
      .eq("user_id", userId)
      .single();

    if (error || !workflow) {
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
      elapsedSeconds = Math.floor((Date.now() - runStartedAt) / 1000);

      // Auto-detect stale runs and mark them as failed
      if (Date.now() - runStartedAt > STALE_RUN_TIMEOUT_MS) {
        console.warn(
          `Stale run detected for workflow ${workflowId}. Started at ${workflow.run_started_at}. Auto-resetting to failed.`,
        );

        // Auto-reset stale workflow
        await supabaseAdmin
          .from("workflows")
          .update({
            run_status: "failed",
            run_completed_at: new Date().toISOString(),
            last_error:
              "Workflow timed out - run was interrupted or failed to complete",
          })
          .eq("id", workflowId)
          .eq("user_id", userId);

        actualStatus = "failed";
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
  } catch (error: any) {
    console.error("Status Fetch Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH: Update workflow run status (called by backend when run completes)
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { workflowId, status, error: runError, webhookSecret } = body;

    // For webhook-based updates, verify the secret
    // For authenticated users, verify userId
    const { userId } = auth();
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

    // Build update object
    const updateData: any = {
      run_status: status,
    };

    if (status === "completed" || status === "failed") {
      updateData.run_completed_at = new Date().toISOString();
    }

    if (runError) {
      updateData.last_error = runError;
    }

    // Build query - if user is authenticated, verify ownership
    let query = supabaseAdmin
      .from("workflows")
      .update(updateData)
      .eq("id", workflowId);

    if (userId) {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query.select().single();

    if (error) {
      console.error("Failed to update workflow status:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 },
      );
    }

    console.log(`Workflow ${workflowId} status updated to: ${status}`);

    return NextResponse.json({
      success: true,
      workflow: {
        id: data.id,
        run_status: data.run_status,
        run_completed_at: data.run_completed_at,
      },
    });
  } catch (error: any) {
    console.error("Status Update Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
