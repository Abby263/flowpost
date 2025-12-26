import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

// Threads uses the same OAuth as Instagram (Meta)
const THREADS_APP_ID = process.env.INSTAGRAM_CLIENT_ID!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/threads/callback`;

export async function GET() {
  const { userId } = auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!THREADS_APP_ID) {
    return NextResponse.json(
      {
        error:
          "Threads OAuth not configured. Please set INSTAGRAM_CLIENT_ID in environment variables.",
      },
      { status: 500 },
    );
  }

  const state = Buffer.from(
    JSON.stringify({ userId, timestamp: Date.now() }),
  ).toString("base64");

  // Threads API uses Instagram's OAuth flow
  const authUrl = new URL("https://www.threads.net/oauth/authorize");
  authUrl.searchParams.append("client_id", THREADS_APP_ID);
  authUrl.searchParams.append("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.append("state", state);
  authUrl.searchParams.append("scope", "threads_basic,threads_content_publish");
  authUrl.searchParams.append("response_type", "code");

  return NextResponse.json({ authUrl: authUrl.toString() });
}
