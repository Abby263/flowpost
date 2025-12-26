import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const { userId } = auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("connections")
    .select(
      "id, platform, profile_name, profile_image, display_name, connection_status, created_at, token_expires_at, last_used_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Check and update token expiry status
  const connectionsWithStatus = (data || []).map((conn) => {
    let status = conn.connection_status || "active";

    // Check if token is expired based on credentials
    if (conn.token_expires_at) {
      const expiresAt = new Date(conn.token_expires_at);
      if (expiresAt < new Date()) {
        status = "expired";
      }
    }

    return {
      ...conn,
      connection_status: status,
    };
  });

  return NextResponse.json({ connections: connectionsWithStatus });
}

export async function POST(request: Request) {
  const { userId } = auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { platform, profile_name, credentials, profile_image, display_name } =
    body || {};

  if (!platform || !profile_name || !credentials) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  // Extract token expiry from credentials if available
  const tokenExpiresAt = credentials.expiresAt || null;

  const { data, error } = await supabaseAdmin
    .from("connections")
    .insert({
      user_id: userId,
      platform,
      profile_name,
      profile_image,
      display_name,
      credentials,
      token_expires_at: tokenExpiresAt,
      connection_status: "active",
    })
    .select(
      "id, platform, profile_name, profile_image, display_name, connection_status, created_at",
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ connection: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { userId } = auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, display_name } = body || {};

  if (!id) {
    return NextResponse.json(
      { error: "Missing connection id" },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("connections")
    .update({ display_name })
    .eq("id", id)
    .eq("user_id", userId)
    .select("id, display_name")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ connection: data });
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
    .from("connections")
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
