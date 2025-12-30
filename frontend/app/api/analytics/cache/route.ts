import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { query, queryOne, upsert } from "@/lib/postgres";

interface AnalyticsCache {
  id: string;
  user_id: string;
  posts_data: any[];
  connections_data: any[];
  last_updated_at: string;
}

// GET - Retrieve cached analytics data
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cache = await queryOne<AnalyticsCache>(
      `SELECT * FROM user_analytics_cache WHERE user_id = $1`,
      [userId],
    );

    if (!cache) {
      return NextResponse.json({
        cached: false,
        posts: [],
        connections: [],
        lastUpdated: null,
      });
    }

    return NextResponse.json({
      cached: true,
      posts: cache.posts_data || [],
      connections: cache.connections_data || [],
      lastUpdated: cache.last_updated_at,
    });
  } catch (error) {
    console.error("Analytics cache GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch cached analytics" },
      { status: 500 },
    );
  }
}

// POST - Update cached analytics data
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { posts, connections } = body;

    // Upsert the cache
    await upsert<AnalyticsCache>(
      "user_analytics_cache",
      {
        user_id: userId,
        posts_data: JSON.stringify(posts || []),
        connections_data: JSON.stringify(connections || []),
        last_updated_at: new Date().toISOString(),
      },
      "user_id",
    );

    return NextResponse.json({
      success: true,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Analytics cache POST error:", error);
    return NextResponse.json(
      { error: "Failed to update analytics cache" },
      { status: 500 },
    );
  }
}

// DELETE - Clear the cache (force refresh on next load)
export async function DELETE() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await query(`DELETE FROM user_analytics_cache WHERE user_id = $1`, [
      userId,
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Analytics cache DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to clear analytics cache" },
      { status: 500 },
    );
  }
}
