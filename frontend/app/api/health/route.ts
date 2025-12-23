import { NextResponse } from "next/server";

/**
 * Health check endpoint for container orchestration
 * Used by Azure Container Apps, Kubernetes, and load balancers
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
    supabase: !!process.env.SUPABASE_URL,
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
