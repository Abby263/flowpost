import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID!;
const TWITTER_CLIENT_SECRET = process.env.TWITTER_CLIENT_SECRET!;
const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "");
const REDIRECT_URI = `${BASE_URL}/api/auth/twitter/callback`;

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
    // Decode state to get user ID and code verifier
    const stateData = JSON.parse(Buffer.from(state, "base64").toString());
    const { userId, codeVerifier } = stateData;

    if (!userId || !codeVerifier) {
      throw new Error("Invalid state");
    }

    // Exchange code for access token
    const basicAuth = Buffer.from(
      `${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`,
    ).toString("base64");

    const tokenResponse = await fetch(
      "https://api.twitter.com/2/oauth2/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${basicAuth}`,
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: REDIRECT_URI,
          code_verifier: codeVerifier,
        }),
      },
    );

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error("Twitter token error:", errorData);
      throw new Error("Failed to get access token");
    }

    const tokenData = await tokenResponse.json();

    // Fetch user profile
    const userResponse = await fetch("https://api.twitter.com/2/users/me", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userResponse.ok) {
      throw new Error("Failed to get user info");
    }

    const userData = await userResponse.json();
    const user = userData.data;

    // Calculate token expiry
    const expiresAt = new Date(
      Date.now() + (tokenData.expires_in || 7200) * 1000,
    ).toISOString();

    // Store the connection in the database
    const { error: dbError } = await supabaseAdmin.from("connections").insert({
      user_id: userId,
      platform: "twitter",
      profile_name: user.username,
      profile_image: user.profile_image_url,
      credentials: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        twitterUserId: user.id,
        expiresAt,
      },
    });

    if (dbError) {
      console.error("Database error:", dbError);
      throw new Error("Failed to save connection");
    }

    return NextResponse.redirect(
      new URL("/dashboard/connections?success=twitter", request.url),
    );
  } catch (err: any) {
    console.error("Twitter OAuth error:", err);
    return NextResponse.redirect(
      new URL(
        `/dashboard/connections?error=${encodeURIComponent(err.message)}`,
        request.url,
      ),
    );
  }
}
