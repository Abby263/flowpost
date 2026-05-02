import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Liveness Probe Endpoint
 * =======================
 * Purpose: Detect if the application is in a broken state
 *
 * Behavior:
 * - Runs continuously after startup probe succeeds
 * - If fails: Container is RESTARTED
 * - Should check core application health
 *
 * What to check:
 * - Application process is responsive
 * - No deadlocks or infinite loops
 * - Memory is not exhausted
 * - Event loop is not blocked
 *
 * What NOT to check:
 * - External dependencies (database, APIs)
 * - Use readiness probe for dependency checks
 *
 * Return:
 * - 200: Application is alive and functioning
 * - 503: Application is in broken state (will trigger restart)
 */

export async function GET() {
  try {
    // Check if the event loop is responsive
    // This is a simple check that the Node.js runtime is functioning
    const startTime = Date.now();

    // Simulate a minimal async operation to verify event loop
    await new Promise((resolve) => setImmediate(resolve));

    const responseTime = Date.now() - startTime;

    // If event loop is severely blocked (>1000ms), consider unhealthy
    if (responseTime > 1000) {
      return NextResponse.json(
        {
          status: "unhealthy",
          message: "Event loop is blocked",
          responseTime,
          timestamp: new Date().toISOString(),
        },
        { status: 503 },
      );
    }

    // Check memory usage
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    // If heap usage is over 95%, consider unhealthy
    if (heapUsagePercent > 95) {
      return NextResponse.json(
        {
          status: "unhealthy",
          message: "Memory usage critical",
          memory: {
            heapUsedMB,
            heapTotalMB,
            heapUsagePercent: Math.round(heapUsagePercent),
          },
          timestamp: new Date().toISOString(),
        },
        { status: 503 },
      );
    }

    return NextResponse.json({
      status: "alive",
      uptime: process.uptime(),
      responseTime,
      memory: {
        heapUsedMB,
        heapTotalMB,
        heapUsagePercent: Math.round(heapUsagePercent),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        message: "Liveness check failed",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}

export async function HEAD() {
  try {
    await new Promise((resolve) => setImmediate(resolve));
    return new NextResponse(null, { status: 200 });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
