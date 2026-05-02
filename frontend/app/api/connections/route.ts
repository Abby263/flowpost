import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { queryMany, queryOne, insert, remove } from "@/lib/postgres";

export const dynamic = "force-dynamic";

interface Connection {
  id: string;
  user_id: string;
  platform: string;
  profile_name: string;
  credentials: Record<string, unknown>;
  created_at: string;
}

export async function GET() {
  const { userId } = auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const connections = await queryMany<Connection>(
      `SELECT id, platform, profile_name, created_at
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
  const { platform, profile_name, credentials } = body || {};

  if (!platform || !profile_name || !credentials) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  try {
    const connection = await insert<Connection>("connections", {
      user_id: userId,
      platform,
      profile_name,
      credentials: JSON.stringify(credentials),
    });

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
        },
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Database error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
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
