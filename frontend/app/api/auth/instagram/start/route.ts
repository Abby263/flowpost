import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { randomBytes } from "crypto";
import { buildAuthorizeUrl } from "@/lib/meta-oauth";

export const dynamic = "force-dynamic";

// GET /api/auth/instagram/start
//
// Kicks off the Facebook OAuth flow. We store a state token + the Clerk user
// id in a short-lived signed cookie and redirect to Facebook. The callback
// validates the state and looks up the user from the cookie, NOT from Clerk
// (because the cross-site OAuth redirect drops the Clerk session cookie on
// some browsers).
export async function GET(request: Request) {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = randomBytes(24).toString("hex");

  let authorizeUrl: string;
  try {
    authorizeUrl = buildAuthorizeUrl(state);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Instagram OAuth is not configured",
      },
      { status: 500 },
    );
  }

  const url = new URL(request.url);
  const isHttps = url.protocol === "https:";

  const response = NextResponse.redirect(authorizeUrl);
  // Bind state + user id together. 10 min is generous.
  response.cookies.set("ig_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps,
    path: "/",
    maxAge: 600,
  });
  response.cookies.set("ig_oauth_user", userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps,
    path: "/",
    maxAge: 600,
  });
  return response;
}
