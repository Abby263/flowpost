import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import crypto from "crypto";

const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/twitter/callback`;

// Twitter OAuth 2.0 with PKCE
export async function GET() {
  const { userId } = auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!TWITTER_CLIENT_ID) {
    return NextResponse.json(
      {
        error:
          "Twitter OAuth not configured. Please set TWITTER_CLIENT_ID in environment variables.",
      },
      { status: 500 },
    );
  }

  // Generate PKCE code verifier and challenge
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  const state = Buffer.from(
    JSON.stringify({
      userId,
      codeVerifier,
      timestamp: Date.now(),
    }),
  ).toString("base64");

  const authUrl = new URL("https://twitter.com/i/oauth2/authorize");
  authUrl.searchParams.append("response_type", "code");
  authUrl.searchParams.append("client_id", TWITTER_CLIENT_ID);
  authUrl.searchParams.append("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.append("state", state);
  authUrl.searchParams.append(
    "scope",
    "tweet.read tweet.write users.read offline.access",
  );
  authUrl.searchParams.append("code_challenge", codeChallenge);
  authUrl.searchParams.append("code_challenge_method", "S256");

  return NextResponse.json({ authUrl: authUrl.toString() });
}
