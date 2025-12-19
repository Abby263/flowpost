import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const ALLOWED_UPDATE_FIELDS = new Set([
    "name",
    "search_query",
    "schedule",
    "frequency",
    "requires_approval",
    "is_active",
    "platform",
    "connection_id",
    "location",
    "style_prompt",
]);

export async function GET(request: Request) {
    const { userId } = auth();

    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includePosts = searchParams.get("includePosts") !== "false";

    const selectFields = includePosts
        ? "*, posts (id, posted_at)"
        : "*";

    const { data, error } = await supabaseAdmin
        .from("workflows")
        .select(selectFields)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ workflows: data || [] });
}

export async function POST(request: Request) {
    const { userId } = auth();

    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
        name,
        platform,
        connection_id,
        search_query,
        location,
        style_prompt,
        schedule,
        frequency,
        requires_approval,
    } = body || {};

    if (!name || !platform || !connection_id || !search_query) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { data: connection, error: connectionError } = await supabaseAdmin
        .from("connections")
        .select("id")
        .eq("id", connection_id)
        .eq("user_id", userId)
        .single();

    if (connectionError || !connection) {
        return NextResponse.json({ error: "Invalid connection" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
        .from("workflows")
        .insert({
            user_id: userId,
            name,
            platform,
            connection_id,
            search_query,
            location: location || null,
            style_prompt: style_prompt || null,
            schedule: schedule || null,
            frequency: frequency || "daily",
            requires_approval: !!requires_approval,
            type: "content_automation_advanced",
            config: {},
            is_active: true,
        })
        .select("*")
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ workflow: data }, { status: 201 });
}

export async function PATCH(request: Request) {
    const { userId } = auth();

    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...updates } = body || {};

    if (!id) {
        return NextResponse.json({ error: "Missing workflow id" }, { status: 400 });
    }

    const filteredUpdates = Object.fromEntries(
        Object.entries(updates).filter(([key, value]) => ALLOWED_UPDATE_FIELDS.has(key) && value !== undefined)
    );

    if (Object.keys(filteredUpdates).length === 0) {
        return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    if (filteredUpdates.connection_id) {
        const { data: connection, error: connectionError } = await supabaseAdmin
            .from("connections")
            .select("id")
            .eq("id", filteredUpdates.connection_id)
            .eq("user_id", userId)
            .single();

        if (connectionError || !connection) {
            return NextResponse.json({ error: "Invalid connection" }, { status: 400 });
        }
    }

    const { data, error } = await supabaseAdmin
        .from("workflows")
        .update(filteredUpdates)
        .eq("id", id)
        .eq("user_id", userId)
        .select("*")
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ workflow: data });
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
        .from("workflows")
        .delete()
        .eq("id", id)
        .eq("user_id", userId)
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
