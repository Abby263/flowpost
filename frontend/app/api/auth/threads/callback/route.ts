import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const THREADS_APP_ID = process.env.INSTAGRAM_CLIENT_ID!;
const THREADS_APP_SECRET = process.env.INSTAGRAM_CLIENT_SECRET!;
const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "");
const REDIRECT_URI = `${BASE_URL}/api/auth/threads/callback`;

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
    const stateData = JSON.parse(Buffer.from(state, "base64").toString());
    const { userId } = stateData;

    if (!userId) {
      throw new Error("Invalid state: missing userId");
    }

    // Exchange code for short-lived access token
    const tokenResponse = await fetch(
      "https://graph.threads.net/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: THREADS_APP_ID,
          client_secret: THREADS_APP_SECRET,
          grant_type: "authorization_code",
          redirect_uri: REDIRECT_URI,
          code,
        }),
      },
    );

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error("Threads token error:", errorData);
      throw new Error("Failed to get access token");
    }

    const tokenData = await tokenResponse.json();

    // Exchange for long-lived token
    const longLivedTokenUrl = new URL("https://graph.threads.net/access_token");
    longLivedTokenUrl.searchParams.append("grant_type", "th_exchange_token");
    longLivedTokenUrl.searchParams.append("client_secret", THREADS_APP_SECRET);
    longLivedTokenUrl.searchParams.append(
      "access_token",
      tokenData.access_token,
    );

    const longLivedResponse = await fetch(longLivedTokenUrl.toString());
    const longLivedData = await longLivedResponse.json();

    const accessToken = longLivedData.access_token || tokenData.access_token;
    const threadsUserId = tokenData.user_id;

    // Get user profile
    const profileResponse = await fetch(
      `https://graph.threads.net/v1.0/${threadsUserId}?fields=id,username,threads_profile_picture_url,name&access_token=${accessToken}`,
    );
    const profileData = await profileResponse.json();

    const expiresAt = new Date(
      Date.now() + (longLivedData.expires_in || 5184000) * 1000,
    ).toISOString();

    // Store the connection
    const { error: dbError } = await supabaseAdmin.from("connections").insert({
      user_id: userId,
      platform: "threads",
      profile_name: profileData.username,
      profile_image: profileData.threads_profile_picture_url,
      credentials: {
        accessToken,
        threadsUserId,
        expiresAt,
      },
    });

    if (dbError) {
      console.error("Database error:", dbError);
      throw new Error("Failed to save connection");
    }

    return NextResponse.redirect(
      new URL("/dashboard/connections?success=threads", request.url),
    );
  } catch (err: any) {
    console.error("Threads OAuth error:", err);
    return NextResponse.redirect(
      new URL(
        `/dashboard/connections?error=${encodeURIComponent(err.message)}`,
        request.url,
      ),
    );
  }
}
