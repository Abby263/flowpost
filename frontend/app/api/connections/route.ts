import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { queryMany, queryOne, insert, remove, update } from "@/lib/postgres";

export const dynamic = "force-dynamic";

interface Connection {
  id: string;
  user_id: string;
  platform: string;
  profile_name: string;
  credentials: Record<string, unknown>;
  graph_access_token: string | null;
  ig_business_account_id: string | null;
  created_at: string;
}

export async function GET() {
  const { userId } = auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Note: graph_access_token is NOT returned (sensitive). We only return a
    // boolean flag so the UI can show whether Graph API is configured.
    const connections = await queryMany<Connection>(
      `SELECT id, platform, profile_name, created_at,
              ig_business_account_id,
              (graph_access_token IS NOT NULL) AS has_graph_token
       FROM connections
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId],
    );

    return NextResponse.json({ connections });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Database error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { userId } = auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    platform,
    profile_name,
    credentials,
    graph_access_token,
    ig_business_account_id,
  } = body || {};

  if (!platform || !profile_name || !credentials) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  try {
    const insertData: Record<string, unknown> = {
      user_id: userId,
      platform,
      profile_name,
      credentials: JSON.stringify(credentials),
    };
    if (
      typeof graph_access_token === "string" &&
      graph_access_token.length > 0
    ) {
      insertData.graph_access_token = graph_access_token;
    }
    if (
      typeof ig_business_account_id === "string" &&
      ig_business_account_id.length > 0
    ) {
      insertData.ig_business_account_id = ig_business_account_id;
    }

    const connection = await insert<Connection>("connections", insertData);

    if (!connection) {
      return NextResponse.json(
        { error: "Failed to create connection" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        connection: {
          id: connection.id,
          platform: connection.platform,
          profile_name: connection.profile_name,
          created_at: connection.created_at,
          ig_business_account_id: connection.ig_business_account_id,
          has_graph_token: !!connection.graph_access_token,
        },
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Database error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/connections — attach or update Meta Graph API credentials on an
// existing connection without rewriting the IG username/password credentials.
export async function PATCH(request: Request) {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { id, graph_access_token, ig_business_account_id } = body || {};
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const owned = await queryOne<{ id: string }>(
    `SELECT id FROM connections WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
  if (!owned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof graph_access_token === "string") {
    updates.graph_access_token = graph_access_token || null;
  }
  if (typeof ig_business_account_id === "string") {
    updates.ig_business_account_id = ig_business_account_id || null;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  await update("connections", updates, "id = $1 AND user_id = $2", [
    id,
    userId,
  ]);

  return NextResponse.json({ success: true });
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

  try {
    const deleted = await remove<Connection>(
      "connections",
      "id = $1 AND user_id = $2",
      [id, userId],
      "id",
    );

    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Database error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
