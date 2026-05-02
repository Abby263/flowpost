import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Startup Probe Endpoint
 * ======================
 * Purpose: Determine when the application has started successfully
 *
 * Behavior:
 * - Runs only during container startup
 * - Disables liveness/readiness probes until startup succeeds
 * - Allows slow-starting applications time to initialize
 * - Prevents premature termination during initialization
 *
 * What to check:
 * - Basic application bootstrap complete
 * - Essential configuration loaded
 * - Critical initialization done
 *
 * What NOT to check:
 * - External service connectivity (use readiness for that)
 * - Database connections (use readiness for that)
 *
 * Return:
 * - 200: Application has started successfully
 * - 503: Application is still starting up
 */

// Track if the application has completed startup
let startupComplete = false;
let startupTime: Date | null = null;

// Mark startup as complete after initial checks
const initStartup = () => {
  if (!startupComplete) {
    // Check if essential environment variables are set
    const essentialVars = [
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
      "CLERK_SECRET_KEY",
    ];

    const allVarsPresent = essentialVars.every(
      (varName) => !!process.env[varName],
    );

    if (allVarsPresent) {
      startupComplete = true;
      startupTime = new Date();
    }
  }
};

export async function GET() {
  initStartup();

  if (!startupComplete) {
    return NextResponse.json(
      {
        status: "starting",
        message: "Application is still initializing",
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }

  return NextResponse.json({
    status: "started",
    message: "Application startup complete",
    startupTime: startupTime?.toISOString(),
    timestamp: new Date().toISOString(),
  });
}

export async function HEAD() {
  initStartup();

  if (!startupComplete) {
    return new NextResponse(null, { status: 503 });
  }

  return new NextResponse(null, { status: 200 });
}
