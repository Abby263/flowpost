import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user subscription with plan details
    const { data: subscription, error: subError } = await supabaseAdmin
      .from("user_subscriptions")
      .select(
        `
        *,
        plan:plans(*)
      `,
      )
      .eq("user_id", userId)
      .single();

    if (subError && subError.code !== "PGRST116") {
      console.error("Error fetching subscription:", subError);
      return NextResponse.json(
        { error: "Failed to fetch subscription" },
        { status: 500 },
      );
    }

    // If no subscription exists, return free plan info
    if (!subscription) {
      const { data: freePlan } = await supabaseAdmin
        .from("plans")
        .select("*")
        .eq("slug", "free")
        .single();

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
    const { data: plan, error: planError } = await supabaseAdmin
      .from("plans")
      .select("*")
      .eq("slug", plan_slug)
      .single();

    if (planError || !plan) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    // For free plan, just update the subscription
    if (plan_slug === "free") {
      const { error: updateError } = await supabaseAdmin
        .from("user_subscriptions")
        .upsert({
          user_id: userId,
          plan_id: plan.id,
          status: "active",
          billing_cycle: "monthly",
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        });

      if (updateError) {
        console.error("Error updating subscription:", updateError);
        return NextResponse.json(
          { error: "Failed to update subscription" },
          { status: 500 },
        );
      }

      // Reset credits to free plan amount
      await supabaseAdmin.from("user_credits").upsert({
        user_id: userId,
        credits_balance: plan.credits_per_month,
        credits_used_this_month: 0,
      });

      return NextResponse.json({ success: true, plan });
    }

    // For paid plans, redirect to Stripe checkout
    // This would normally create a Stripe checkout session
    // For now, return the checkout URL placeholder
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
