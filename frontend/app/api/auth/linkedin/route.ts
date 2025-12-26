import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/linkedin/callback`;

export async function GET() {
  const { userId } = auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!LINKEDIN_CLIENT_ID) {
    return NextResponse.json(
      {
        error:
          "LinkedIn OAuth not configured. Please set LINKEDIN_CLIENT_ID in environment variables.",
      },
      { status: 500 },
    );
  }

  const state = Buffer.from(
    JSON.stringify({ userId, timestamp: Date.now() }),
  ).toString("base64");

  const authUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
  authUrl.searchParams.append("response_type", "code");
  authUrl.searchParams.append("client_id", LINKEDIN_CLIENT_ID);
  authUrl.searchParams.append("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.append("state", state);
  authUrl.searchParams.append("scope", "openid profile email w_member_social");

  return NextResponse.json({ authUrl: authUrl.toString() });
}
