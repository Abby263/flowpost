import { NextResponse } from "next/server";
import { Client } from "@langchain/langgraph-sdk";

const client = new Client({
  apiUrl: process.env.LANGGRAPH_API_URL || "http://localhost:54367",
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const runId = searchParams.get("runId");
  const threadId = searchParams.get("threadId");

  if (!runId || !threadId) {
    return NextResponse.json(
      { error: "Missing runId or threadId" },
      { status: 400 },
    );
  }

  try {
    const run = await client.runs.get(threadId, runId);
    return NextResponse.json({ status: run.status, result: run });
  } catch (error: any) {
    console.error("Status Fetch Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
