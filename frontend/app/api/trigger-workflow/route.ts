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

    // 3. Trigger LangGraph Run using streaming API (threadless run)
    // This avoids the "Thread is already running" bug in the regular runs API
    const apiUrl = process.env.LANGGRAPH_API_URL || "http://localhost:54367";

    const runResponse = await fetch(`${apiUrl}/runs/stream`, {
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

    if (!runResponse.ok) {
      const errorText = await runResponse.text();
      throw new Error(`Failed to start run: ${errorText}`);
    }

    // Read the first chunk to get the run_id from metadata event
    const reader = runResponse.body?.getReader();
    let runId = "";
    let threadId = "";

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
          // For threadless runs, we don't have a thread_id, use run_id as a reference
          threadId = runId;
          break;
        }
      }

      // Don't close the reader - let the backend continue processing in the background
      reader.cancel();
    }

    return NextResponse.json({
      success: true,
      runId: runId || "started",
      threadId: threadId || "threadless",
    });
  } catch (error: any) {
    console.error("Trigger Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
