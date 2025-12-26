import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const FACEBOOK_CLIENT_ID =
  process.env.FACEBOOK_CLIENT_ID || process.env.INSTAGRAM_CLIENT_ID!;
const FACEBOOK_CLIENT_SECRET =
  process.env.FACEBOOK_CLIENT_SECRET || process.env.INSTAGRAM_CLIENT_SECRET!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/facebook/callback`;

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

    // Exchange code for access token
    const tokenUrl = new URL(
      "https://graph.facebook.com/v18.0/oauth/access_token",
    );
    tokenUrl.searchParams.append("client_id", FACEBOOK_CLIENT_ID);
    tokenUrl.searchParams.append("client_secret", FACEBOOK_CLIENT_SECRET);
    tokenUrl.searchParams.append("redirect_uri", REDIRECT_URI);
    tokenUrl.searchParams.append("code", code);

    const tokenResponse = await fetch(tokenUrl.toString());

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error("Facebook token error:", errorData);
      throw new Error("Failed to get access token");
    }

    const tokenData = await tokenResponse.json();

    // Get long-lived token
    const longLivedTokenUrl = new URL(
      "https://graph.facebook.com/v18.0/oauth/access_token",
    );
    longLivedTokenUrl.searchParams.append("grant_type", "fb_exchange_token");
    longLivedTokenUrl.searchParams.append("client_id", FACEBOOK_CLIENT_ID);
    longLivedTokenUrl.searchParams.append(
      "client_secret",
      FACEBOOK_CLIENT_SECRET,
    );
    longLivedTokenUrl.searchParams.append(
      "fb_exchange_token",
      tokenData.access_token,
    );

    const longLivedResponse = await fetch(longLivedTokenUrl.toString());
    const longLivedData = await longLivedResponse.json();

    const userAccessToken =
      longLivedData.access_token || tokenData.access_token;

    // Get user's Facebook pages
    const pagesResponse = await fetch(
      `https://graph.facebook.com/v18.0/me/accounts?access_token=${userAccessToken}`,
    );
    const pagesData = await pagesResponse.json();

    if (!pagesData.data || pagesData.data.length === 0) {
      throw new Error(
        "No Facebook Pages found. You need a Facebook Page to connect.",
      );
    }

    // Use the first page (you could extend this to let user choose)
    const page = pagesData.data[0];

    // Get page details with picture
    const pageDetailsResponse = await fetch(
      `https://graph.facebook.com/v18.0/${page.id}?fields=id,name,picture&access_token=${page.access_token}`,
    );
    const pageDetails = await pageDetailsResponse.json();

    const expiresAt = new Date(
      Date.now() + (longLivedData.expires_in || 5184000) * 1000,
    ).toISOString();

    // Store the connection
    const { error: dbError } = await supabaseAdmin.from("connections").insert({
      user_id: userId,
      platform: "facebook",
      profile_name: page.name,
      profile_image: pageDetails.picture?.data?.url,
      credentials: {
        accessToken: page.access_token, // Page access token
        pageId: page.id,
        expiresAt,
      },
    });

    if (dbError) {
      console.error("Database error:", dbError);
      throw new Error("Failed to save connection");
    }

    return NextResponse.redirect(
      new URL("/dashboard/connections?success=facebook", request.url),
    );
  } catch (err: any) {
    console.error("Facebook OAuth error:", err);
    return NextResponse.redirect(
      new URL(
        `/dashboard/connections?error=${encodeURIComponent(err.message)}`,
        request.url,
      ),
    );
  }
}
