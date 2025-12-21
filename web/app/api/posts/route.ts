import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const ORDERABLE_COLUMNS = new Set([
    "created_at",
    "posted_at",
    "scheduled_at",
]);

export async function GET(request: Request) {
    const { userId } = auth();

    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const excludeStatus = searchParams.get("excludeStatus");
    const workflowId = searchParams.get("workflowId");
    const order = searchParams.get("order") || "created_at";
    const direction = searchParams.get("direction") === "asc" ? "asc" : "desc";
    const limitValue = searchParams.get("limit");

    if (!ORDERABLE_COLUMNS.has(order)) {
        return NextResponse.json({ error: "Invalid order column" }, { status: 400 });
    }

    let query = supabaseAdmin
        .from("posts")
        .select("*, workflows(connection_id)")
        .eq("user_id", userId)
        .order(order, { ascending: direction === "asc" });

    if (status) {
        query = query.eq("status", status);
    }

    if (excludeStatus) {
        query = query.neq("status", excludeStatus);
    }

    if (workflowId === "null") {
        query = query.is("workflow_id", null);
    } else if (workflowId) {
        query = query.eq("workflow_id", workflowId);
    }

    if (limitValue) {
        const limit = Number(limitValue);
        if (!Number.isNaN(limit) && limit > 0) {
            query = query.limit(limit);
        }
    }

    const { data, error } = await query;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const normalizedPosts = (data || []).map((post: any) => {
        const { workflows, ...postData } = post;
        if (!postData.connection_id && workflows?.connection_id) {
            return { ...postData, connection_id: workflows.connection_id };
        }
        return postData;
    });

    return NextResponse.json({ posts: normalizedPosts });
}

export async function DELETE(request: Request) {
    const { userId } = auth();

    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
        return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
        .from("posts")
        .delete()
        .eq("id", id)
        .eq("user_id", userId)
        .eq("status", "scheduled")
        .select("id")
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
}
