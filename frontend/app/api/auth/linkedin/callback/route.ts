import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID!;
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/linkedin/callback`;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/dashboard/connections?error=${error}`, request.url),
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard/connections?error=missing_params", request.url),
    );
  }

  try {
    // Decode state to get user ID
    const stateData = JSON.parse(Buffer.from(state, "base64").toString());
    const { userId } = stateData;

    if (!userId) {
      throw new Error("Invalid state: missing userId");
    }

    // Exchange code for access token
    const tokenResponse = await fetch(
      "https://www.linkedin.com/oauth/v2/accessToken",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: LINKEDIN_CLIENT_ID,
          client_secret: LINKEDIN_CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
        }),
      },
    );

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error("LinkedIn token error:", errorData);
      throw new Error("Failed to get access token");
    }

    const tokenData = await tokenResponse.json();

    // Fetch user profile using OpenID Connect
    const userInfoResponse = await fetch(
      "https://api.linkedin.com/v2/userinfo",
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      },
    );

    if (!userInfoResponse.ok) {
      throw new Error("Failed to get user info");
    }

    const userInfo = await userInfoResponse.json();

    // Calculate token expiry
    const expiresAt = new Date(
      Date.now() + (tokenData.expires_in || 5184000) * 1000,
    ).toISOString();

    // Store the connection in the database
    const { error: dbError } = await supabaseAdmin.from("connections").insert({
      user_id: userId,
      platform: "linkedin",
      profile_name: userInfo.name || userInfo.email,
      profile_image: userInfo.picture,
      credentials: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        personUrn: userInfo.sub,
        email: userInfo.email,
        expiresAt,
      },
    });

    if (dbError) {
      console.error("Database error:", dbError);
      throw new Error("Failed to save connection");
    }

    return NextResponse.redirect(
      new URL("/dashboard/connections?success=linkedin", request.url),
    );
  } catch (err: any) {
    console.error("LinkedIn OAuth error:", err);
    return NextResponse.redirect(
      new URL(
        `/dashboard/connections?error=${encodeURIComponent(err.message)}`,
        request.url,
      ),
    );
  }
}
