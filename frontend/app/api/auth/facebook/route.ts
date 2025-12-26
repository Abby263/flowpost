import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

const FACEBOOK_CLIENT_ID =
  process.env.FACEBOOK_CLIENT_ID || process.env.INSTAGRAM_CLIENT_ID!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/facebook/callback`;

export async function GET() {
  const { userId } = auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!FACEBOOK_CLIENT_ID) {
    return NextResponse.json(
      {
        error:
          "Facebook OAuth not configured. Please set FACEBOOK_CLIENT_ID or INSTAGRAM_CLIENT_ID in environment variables.",
      },
      { status: 500 },
    );
  }

  const state = Buffer.from(
    JSON.stringify({ userId, timestamp: Date.now() }),
  ).toString("base64");

  const authUrl = new URL("https://www.facebook.com/v18.0/dialog/oauth");
  authUrl.searchParams.append("client_id", FACEBOOK_CLIENT_ID);
  authUrl.searchParams.append("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.append("state", state);
  authUrl.searchParams.append(
    "scope",
    "pages_show_list,pages_read_engagement,pages_manage_posts,public_profile",
  );
  authUrl.searchParams.append("response_type", "code");

  return NextResponse.json({ authUrl: authUrl.toString() });
}
