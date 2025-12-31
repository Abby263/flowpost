import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { queryOne, upsert, query } from "@/lib/postgres";

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  credits_per_month: number;
  max_workflows: number;
  features: string[];
  is_active: boolean;
}

interface UserSubscription {
  id: string;
  user_id: string;
  plan_id: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: string;
  billing_cycle: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_end: string | null;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user subscription with plan details
    const subscription = await queryOne<UserSubscription & { plan: Plan }>(
      `SELECT us.*, row_to_json(p) as plan
       FROM user_subscriptions us
       LEFT JOIN plans p ON us.plan_id = p.id
       WHERE us.user_id = $1`,
      [userId],
    );

    // If no subscription exists, return free plan info
    if (!subscription) {
      const freePlan = await queryOne<Plan>(
        `SELECT * FROM plans WHERE slug = $1`,
        ["free"],
      );

      return NextResponse.json({
        subscription: null,
        plan: freePlan,
        status: "none",
      });
    }

    return NextResponse.json({
      subscription: {
        id: subscription.id,
        status: subscription.status,
        billing_cycle: subscription.billing_cycle,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        trial_end: subscription.trial_end,
        canceled_at: subscription.canceled_at,
      },
      plan: subscription.plan,
      status: subscription.status,
    });
  } catch (error) {
    console.error("Subscription API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// Update subscription (upgrade/downgrade)
export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { plan_slug, billing_cycle } = body;

    // Get the plan
    const plan = await queryOne<Plan>(`SELECT * FROM plans WHERE slug = $1`, [
      plan_slug,
    ]);

    if (!plan) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    // For free plan, just update the subscription
    if (plan_slug === "free") {
      const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      await upsert(
        "user_subscriptions",
        {
          user_id: userId,
          plan_id: plan.id,
          status: "active",
          billing_cycle: "monthly",
          current_period_start: new Date().toISOString(),
          current_period_end: periodEnd.toISOString(),
        },
        "user_id",
      );

      // Reset credits to free plan amount
      await upsert(
        "user_credits",
        {
          user_id: userId,
          credits_balance: plan.credits_per_month,
          credits_used_this_month: 0,
        },
        "user_id",
      );

      return NextResponse.json({ success: true, plan });
    }

    // For paid plans, redirect to Stripe checkout
    return NextResponse.json({
      requires_payment: true,
      checkout_url: `/api/stripe/checkout?plan=${plan_slug}&billing=${billing_cycle || "monthly"}`,
    });
  } catch (error) {
    console.error("Subscription update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
