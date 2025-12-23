import { NextResponse } from "next/server";
import { Client } from "@langchain/langgraph-sdk";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Initialize LangGraph Client
const client = new Client({
  apiUrl: process.env.LANGGRAPH_API_URL || "http://localhost:54367",
});

export async function POST(request: Request) {
  try {
    const { userId } = auth();
    const { workflowId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("Received workflow trigger request:", {
      workflowId,
    });

    if (!workflowId) {
      return NextResponse.json(
        { error: "Workflow ID is required" },
        { status: 400 },
      );
    }

    const { data: workflow, error: workflowError } = await supabaseAdmin
      .from("workflows")
      .select("*")
      .eq("id", workflowId)
      .eq("user_id", userId)
      .single();

    if (workflowError || !workflow) {
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

    const { data: connection, error: connectionError } = await supabaseAdmin
      .from("connections")
      .select("*")
      .eq("id", workflow.connection_id)
      .eq("user_id", userId)
      .single();

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: "Connection not found" },
        { status: 404 },
      );
    }

    // 2. Prepare Input for Agent
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

    // 3. Trigger LangGraph Run
    // Create a thread
    const thread = await client.threads.create();

    // Start the run
    const run = await client.runs.create(
      thread.thread_id,
      "content_automation_advanced",
      {
        input: input,
      },
    );

    return NextResponse.json({
      success: true,
      runId: run.run_id,
      threadId: thread.thread_id,
    });
  } catch (error: any) {
    console.error("Trigger Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
