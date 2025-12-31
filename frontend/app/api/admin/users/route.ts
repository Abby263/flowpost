import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { query } from "@/lib/postgres";

// Admin user IDs - add your Clerk user ID here
const ADMIN_USER_IDS =
  process.env.ADMIN_USER_IDS?.split(",").map((id) => id.trim()) || [];

interface UserWithCredits {
  user_id: string;
  credits_balance: number;
  credits_used_this_month: number;
  bonus_credits: number;
  plan_name: string | null;
  plan_slug: string | null;
  subscription_status: string | null;
  created_at: string;
}

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    if (!ADMIN_USER_IDS.includes(userId)) {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 },
      );
    }

    // Fetch all users with their credits and subscription info
    const { rows: users } = await query<UserWithCredits>(`
      SELECT 
        uc.user_id,
        uc.credits_balance,
        uc.credits_used_this_month,
        uc.bonus_credits,
        p.name as plan_name,
        p.slug as plan_slug,
        us.status as subscription_status,
        us.created_at
      FROM user_credits uc
      LEFT JOIN user_subscriptions us ON uc.user_id = us.user_id
      LEFT JOIN plans p ON us.plan_id = p.id
      ORDER BY uc.credits_balance DESC
    `);

    // Enrich with Clerk user data
    const client = await clerkClient();
    const enrichedUsers = await Promise.all(
      (users || []).map(async (user) => {
        try {
          const clerkUser = await client.users.getUser(user.user_id);
          return {
            ...user,
            email: clerkUser.emailAddresses[0]?.emailAddress || user.user_id,
            name:
              `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() ||
              clerkUser.emailAddresses[0]?.emailAddress ||
              "Unknown",
            imageUrl: clerkUser.imageUrl,
          };
        } catch {
          return {
            ...user,
            email: user.user_id,
            name: "Unknown",
            imageUrl: null,
          };
        }
      }),
    );

    return NextResponse.json({ users: enrichedUsers });
  } catch (error) {
    console.error("Admin users error:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 },
    );
  }
}
