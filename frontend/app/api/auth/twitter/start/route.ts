import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { randomBytes } from "crypto";
import { buildAuthorizeUrl, generatePkce } from "@/lib/twitter-oauth";

export const dynamic = "force-dynamic";

// GET /api/auth/twitter/start
//
// Mints a state token + PKCE verifier, stores both in short-lived cookies
// (the verifier is needed at the callback to prove the same browser session
// initiated the flow), and redirects to twitter.com for the user to grant.
export async function GET(request: Request) {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = randomBytes(24).toString("hex");
  const { verifier, challenge } = generatePkce();

  let authorizeUrl: string;
  try {
    authorizeUrl = buildAuthorizeUrl(state, challenge);
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "X OAuth not configured",
      },
      { status: 500 },
    );
  }

  const url = new URL(request.url);
  const isHttps = url.protocol === "https:";

  const response = NextResponse.redirect(authorizeUrl);
  const cookieOpts = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isHttps,
    path: "/",
    maxAge: 600,
  };
  response.cookies.set("tw_oauth_state", state, cookieOpts);
  response.cookies.set("tw_oauth_verifier", verifier, cookieOpts);
  response.cookies.set("tw_oauth_user", userId, cookieOpts);
  return response;
}
