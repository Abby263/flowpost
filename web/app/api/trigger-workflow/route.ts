import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Client } from "@langchain/langgraph-sdk";

// Initialize Supabase Admin Client (to read all data)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!; // In prod use Service Role Key
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize LangGraph Client
const client = new Client({
    apiUrl: process.env.LANGGRAPH_API_URL || "http://localhost:54367",
});

export async function POST(request: Request) {
    try {
        const { workflow, connection } = await request.json();

        console.log("Received workflow trigger request:", {
            workflowId: workflow?.id,
            searchQuery: workflow?.search_query,
            location: workflow?.location,
            stylePrompt: workflow?.style_prompt,
            fullWorkflow: workflow,
        });

        if (!workflow || !workflow.id) {
            return NextResponse.json({ error: "Workflow ID is required" }, { status: 400 });
        }

        if (!connection) {
            return NextResponse.json({ error: "Connection details are required" }, { status: 400 });
        }

        // 2. Prepare Input for Agent
        const input = {
            searchQuery: workflow.search_query || "AI News",
            location: workflow.location || "", // No default location
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
        const run = await client.runs.create(thread.thread_id, "content_automation_advanced", {
            input: input,
        });

        return NextResponse.json({ success: true, runId: run.run_id, threadId: thread.thread_id });

    } catch (error: any) {
        console.error("Trigger Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
