import { NextResponse } from "next/server";

/**
 * Readiness Probe Endpoint
 * ========================
 * Purpose: Determine if the application can accept traffic
 *
 * Behavior:
 * - Runs continuously after startup probe succeeds
 * - If fails: Container removed from load balancer (no traffic)
 * - Container is NOT restarted (use liveness for that)
 * - Should check if app can serve requests
 *
 * What to check:
 * - All required dependencies are available
 * - Database connections are working
 * - External APIs are reachable
 * - Cache is initialized
 *
 * Return:
 * - 200: Application is ready to accept traffic
 * - 503: Application is not ready (removed from load balancer)
 */

interface DependencyCheck {
  name: string;
  status: "ok" | "error";
  latency?: number;
  error?: string;
}

async function checkLangGraphAPI(): Promise<DependencyCheck> {
  const langgraphUrl = process.env.LANGGRAPH_API_URL;

  if (!langgraphUrl) {
    return {
      name: "langgraph",
      status: "error",
      error: "LANGGRAPH_API_URL not configured",
    };
  }

  try {
    const startTime = Date.now();
    const response = await fetch(`${langgraphUrl}/ok`, {
      method: "GET",
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    const latency = Date.now() - startTime;

    if (response.ok) {
      return {
        name: "langgraph",
        status: "ok",
        latency,
      };
    }

    return {
      name: "langgraph",
      status: "error",
      latency,
      error: `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      name: "langgraph",
      status: "error",
      error: error instanceof Error ? error.message : "Connection failed",
    };
  }
}

async function checkClerk(): Promise<DependencyCheck> {
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const clerkSecret = process.env.CLERK_SECRET_KEY;

  if (!clerkKey || !clerkSecret) {
    return {
      name: "clerk",
      status: "error",
      error: "Clerk credentials not configured",
    };
  }

  // Just verify credentials are present (actual API check would require auth)
  return {
    name: "clerk",
    status: "ok",
  };
}

export async function GET() {
  const startTime = Date.now();

  try {
    // Run all dependency checks in parallel
    const checks = await Promise.all([checkLangGraphAPI(), checkClerk()]);

    const totalLatency = Date.now() - startTime;
    const allReady = checks.every((check) => check.status === "ok");
    const failedChecks = checks.filter((check) => check.status === "error");

    if (!allReady) {
      return NextResponse.json(
        {
          status: "not_ready",
          message: `${failedChecks.length} dependency check(s) failed`,
          checks,
          totalLatency,
          timestamp: new Date().toISOString(),
        },
        { status: 503 },
      );
    }

    return NextResponse.json({
      status: "ready",
      message: "All dependencies healthy",
      checks,
      totalLatency,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "not_ready",
        message: "Readiness check failed",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}

export async function HEAD() {
  try {
    const checks = await Promise.all([checkLangGraphAPI(), checkClerk()]);
    const allReady = checks.every((check) => check.status === "ok");

    if (!allReady) {
      return new NextResponse(null, { status: 503 });
    }

    return new NextResponse(null, { status: 200 });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
