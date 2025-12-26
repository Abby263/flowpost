import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const INSTAGRAM_APP_ID = process.env.INSTAGRAM_CLIENT_ID!;
const INSTAGRAM_APP_SECRET = process.env.INSTAGRAM_CLIENT_SECRET!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/instagram/callback`;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorReason = searchParams.get("error_reason");
  const errorDescription = searchParams.get("error_description");

  if (error) {
    const errorMsg = errorDescription || errorReason || error;
    return NextResponse.redirect(
      new URL(
        `/dashboard/connections?error=${encodeURIComponent(errorMsg)}`,
        request.url,
      ),
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
    const { userId, accountType } = stateData;

    if (!userId) {
      throw new Error("Invalid state: missing userId");
    }

    // Exchange code for short-lived access token using Instagram API
    const tokenResponse = await fetch(
      "https://api.instagram.com/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: INSTAGRAM_APP_ID,
          client_secret: INSTAGRAM_APP_SECRET,
          grant_type: "authorization_code",
          redirect_uri: REDIRECT_URI,
          code,
        }),
      },
    );

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error("Instagram token error:", errorData);
      throw new Error(errorData.error_message || "Failed to get access token");
    }

    const tokenData = await tokenResponse.json();
    const shortLivedToken = tokenData.access_token;
    const instagramUserId = tokenData.user_id;

    // Exchange short-lived token for long-lived token (60 days)
    const longLivedTokenUrl = new URL(
      "https://graph.instagram.com/access_token",
    );
    longLivedTokenUrl.searchParams.append("grant_type", "ig_exchange_token");
    longLivedTokenUrl.searchParams.append(
      "client_secret",
      INSTAGRAM_APP_SECRET,
    );
    longLivedTokenUrl.searchParams.append("access_token", shortLivedToken);

    const longLivedResponse = await fetch(longLivedTokenUrl.toString());

    let accessToken = shortLivedToken;
    let expiresIn = 3600; // 1 hour for short-lived

    if (longLivedResponse.ok) {
      const longLivedData = await longLivedResponse.json();
      accessToken = longLivedData.access_token;
      expiresIn = longLivedData.expires_in || 5184000; // ~60 days
    }

    // Get user profile information
    const profileResponse = await fetch(
      `https://graph.instagram.com/v21.0/me?fields=user_id,username,name,profile_picture_url,account_type&access_token=${accessToken}`,
    );

    if (!profileResponse.ok) {
      const profileError = await profileResponse.json();
      console.error("Instagram profile error:", profileError);
      throw new Error("Failed to get Instagram profile");
    }

    const profileData = await profileResponse.json();

    // Calculate token expiry
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Store the connection in the database
    const { error: dbError } = await supabaseAdmin.from("connections").insert({
      user_id: userId,
      platform: "instagram",
      profile_name: profileData.username,
      profile_image: profileData.profile_picture_url,
      credentials: {
        accessToken,
        instagramUserId: profileData.user_id || instagramUserId,
        accountType: profileData.account_type || accountType,
        expiresAt,
      },
    });

    if (dbError) {
      console.error("Database error:", dbError);
      throw new Error("Failed to save connection");
    }

    return NextResponse.redirect(
      new URL("/dashboard/connections?success=instagram", request.url),
    );
  } catch (err: any) {
    console.error("Instagram OAuth error:", err);
    return NextResponse.redirect(
      new URL(
        `/dashboard/connections?error=${encodeURIComponent(err.message)}`,
        request.url,
      ),
    );
  }
}
