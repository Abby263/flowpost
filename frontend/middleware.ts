import { authMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

const publicRoutePatterns = [
  /^\/$/,
  /^\/sign-in(?:\/.*)?$/,
  /^\/sign-up(?:\/.*)?$/,
  /^\/pricing(?:\/.*)?$/,
  /^\/api\/health(?:\/.*)?$/,
  /^\/api\/stripe\/webhooks(?:\/.*)?$/,
  /^\/api\/webhooks(?:\/.*)?$/,
  /^\/api\/cron(?:\/.*)?$/,
];

const hasClerkConfig =
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  !!process.env.CLERK_SECRET_KEY;

function isPublicRoute(pathname: string): boolean {
  return publicRoutePatterns.some((pattern) => pattern.test(pathname));
}

function missingClerkMiddleware(request: NextRequest) {
  if (isPublicRoute(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  return NextResponse.json(
    { error: "Authentication is not configured" },
    { status: 503 },
  );
}

const middleware = hasClerkConfig
  ? authMiddleware({
      // Public routes that don't require authentication
      publicRoutes: [
        "/",
        "/sign-in(.*)",
        "/sign-up(.*)",
        "/pricing(.*)",
        "/api/health(.*)",
        "/api/stripe/webhooks(.*)",
        "/api/webhooks(.*)",
        "/api/cron(.*)",
      ],
      // Routes that can be accessed by anyone, but auth state is still available
      ignoredRoutes: ["/api/health(.*)"],
    })
  : missingClerkMiddleware;

export default middleware;

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
