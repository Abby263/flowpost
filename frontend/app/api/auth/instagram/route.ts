import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

// Instagram API with Instagram Login
const INSTAGRAM_APP_ID = process.env.INSTAGRAM_CLIENT_ID!;

// Clean the base URL by removing trailing slashes
const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "");
const REDIRECT_URI = `${BASE_URL}/api/auth/instagram/callback`;

export async function GET(request: NextRequest) {
  const { userId } = auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if credentials are configured
  if (!INSTAGRAM_APP_ID) {
    return NextResponse.json(
      {
        error:
          "Instagram OAuth not configured. Please set INSTAGRAM_CLIENT_ID in environment variables.",
      },
      { status: 500 },
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const accountType = searchParams.get("type") || "professional";

  const state = Buffer.from(
    JSON.stringify({ userId, accountType, timestamp: Date.now() }),
  ).toString("base64");

  // Scopes for Instagram API with Instagram Login
  // business_basic - Access profile info
  // business_content_publish - Publish content
  // business_manage_comments - Manage comments
  const scopes =
    accountType === "professional"
      ? "business_basic,business_content_publish,business_manage_comments"
      : "business_basic";

  // Use the direct Instagram OAuth authorize endpoint
  // This is the standard OAuth 2.0 flow for Instagram
  const authUrl = new URL("https://www.instagram.com/oauth/authorize");
  authUrl.searchParams.append("client_id", INSTAGRAM_APP_ID);
  authUrl.searchParams.append("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.append("response_type", "code");
  authUrl.searchParams.append("scope", scopes);
  authUrl.searchParams.append("state", state);

  console.log("Instagram OAuth URL:", authUrl.toString());
  console.log("Redirect URI:", REDIRECT_URI);

  return NextResponse.json({ authUrl: authUrl.toString() });
}
