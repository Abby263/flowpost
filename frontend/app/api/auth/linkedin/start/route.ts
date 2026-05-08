import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { randomBytes } from "crypto";
import { buildAuthorizeUrl } from "@/lib/linkedin-oauth";

export const dynamic = "force-dynamic";

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
          err instanceof Error ? err.message : "LinkedIn OAuth not configured",
      },
      { status: 500 },
    );
  }

  const url = new URL(request.url);
  const isHttps = url.protocol === "https:";
  const cookieOpts = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isHttps,
    path: "/",
    maxAge: 600,
  };

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set("li_oauth_state", state, cookieOpts);
  response.cookies.set("li_oauth_user", userId, cookieOpts);
  return response;
}
