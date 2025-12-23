import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  _request: Request,
  context: { params: { id: string } },
) {
  const { userId } = auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workflowId = context.params.id;

  const { data: workflow, error: workflowError } = await supabaseAdmin
    .from("workflows")
    .select("*")
    .eq("id", workflowId)
    .eq("user_id", userId)
    .single();

  if (workflowError) {
    return NextResponse.json({ error: workflowError.message }, { status: 500 });
  }

  if (!workflow) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: posts, error: postsError } = await supabaseAdmin
    .from("posts")
    .select("*")
    .eq("workflow_id", workflowId)
    .eq("user_id", userId)
    .order("posted_at", { ascending: false });

  if (postsError) {
    return NextResponse.json({ error: postsError.message }, { status: 500 });
  }

  return NextResponse.json({ workflow, posts: posts || [] });
}
