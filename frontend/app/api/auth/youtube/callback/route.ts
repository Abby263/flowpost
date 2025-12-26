import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/youtube/callback`;

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

    // Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error("Google token error:", errorData);
      throw new Error("Failed to get access token");
    }

    const tokenData = await tokenResponse.json();

    // Get YouTube channel info
    const channelResponse = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&mine=true",
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      },
    );

    if (!channelResponse.ok) {
      throw new Error("Failed to get YouTube channel info");
    }

    const channelData = await channelResponse.json();

    if (!channelData.items || channelData.items.length === 0) {
      throw new Error(
        "No YouTube channel found. Please create a YouTube channel first.",
      );
    }

    const channel = channelData.items[0];

    const expiresAt = new Date(
      Date.now() + (tokenData.expires_in || 3600) * 1000,
    ).toISOString();

    // Store the connection
    const { error: dbError } = await supabaseAdmin.from("connections").insert({
      user_id: userId,
      platform: "youtube",
      profile_name:
        channel.snippet.customUrl?.replace("@", "") || channel.snippet.title,
      profile_image: channel.snippet.thumbnails?.default?.url,
      credentials: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        channelId: channel.id,
        expiresAt,
      },
    });

    if (dbError) {
      console.error("Database error:", dbError);
      throw new Error("Failed to save connection");
    }

    return NextResponse.redirect(
      new URL("/dashboard/connections?success=youtube", request.url),
    );
  } catch (err: any) {
    console.error("YouTube OAuth error:", err);
    return NextResponse.redirect(
      new URL(
        `/dashboard/connections?error=${encodeURIComponent(err.message)}`,
        request.url,
      ),
    );
  }
}
