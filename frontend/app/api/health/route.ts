import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Health check endpoint for container orchestration
 * Used by Azure Container Apps, Kubernetes, and load balancers
 *
 * This is the main health endpoint that provides detailed status.
 * For specific probe endpoints, see:
 * - /api/health/startup - Startup probe
 * - /api/health/live - Liveness probe
 * - /api/health/ready - Readiness probe
 */
export async function GET() {
  const healthCheck = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    version: process.env.npm_package_version || "1.0.0",
  };

  // Check critical dependencies
  const checks: Record<string, boolean> = {
    clerk: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    langgraph: !!process.env.LANGGRAPH_API_URL,
  };

  const allHealthy = Object.values(checks).every(Boolean);

  if (!allHealthy) {
    return NextResponse.json(
      {
        ...healthCheck,
        status: "degraded",
        checks,
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    ...healthCheck,
    checks,
  });
}

/**
 * HEAD request for simple health probes
 */
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
