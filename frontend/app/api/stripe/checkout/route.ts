import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import Stripe from "stripe";

// Initialize Stripe (will be undefined if not configured)
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!stripe) {
      return NextResponse.json(
        { error: "Stripe is not configured. Please set STRIPE_SECRET_KEY." },
        { status: 500 },
      );
    }

    const body = await request.json();
    const { plan_slug, billing_cycle = "monthly", credit_package_id } = body;

    // Get or create Stripe customer
    let { data: subscription } = await supabaseAdmin
      .from("user_subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .single();

    let customerId = subscription?.stripe_customer_id;

    if (!customerId) {
      // Create Stripe customer
      const customer = await stripe.customers.create({
        metadata: {
          user_id: userId,
        },
      });
      customerId = customer.id;

      // Save customer ID
      await supabaseAdmin.from("user_subscriptions").upsert({
        user_id: userId,
        stripe_customer_id: customerId,
      });
    }

    // Handle credit package purchase
    if (credit_package_id) {
      const { data: creditPackage } = await supabaseAdmin
        .from("credit_packages")
        .select("*")
        .eq("id", credit_package_id)
        .single();

      if (!creditPackage) {
        return NextResponse.json(
          { error: "Invalid credit package" },
          { status: 400 },
        );
      }

      // Create checkout session for one-time credit purchase
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: creditPackage.name,
                description: `${creditPackage.credits} credits${creditPackage.bonus_credits > 0 ? ` + ${creditPackage.bonus_credits} bonus credits` : ""}`,
              },
              unit_amount: Math.round(creditPackage.price * 100),
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?success=true&credits=${creditPackage.credits + creditPackage.bonus_credits}`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?canceled=true`,
        metadata: {
          user_id: userId,
          type: "credit_purchase",
          credit_package_id: creditPackage.id,
          credits: creditPackage.credits,
          bonus_credits: creditPackage.bonus_credits,
        },
      });

      return NextResponse.json({ url: session.url });
    }

    // Handle subscription
    const { data: plan } = await supabaseAdmin
      .from("plans")
      .select("*")
      .eq("slug", plan_slug)
      .single();

    if (!plan) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const priceId =
      billing_cycle === "yearly"
        ? plan.stripe_price_id_yearly
        : plan.stripe_price_id_monthly;

    if (!priceId) {
      // Create price dynamically if not configured
      const price =
        billing_cycle === "yearly" ? plan.price_yearly : plan.price_monthly;

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `FlowPost ${plan.name} Plan`,
                description: `${plan.credits_per_month} credits/month, ${plan.max_workflows === -1 ? "Unlimited" : plan.max_workflows} workflows`,
              },
              unit_amount: Math.round(price * 100),
              recurring: {
                interval: billing_cycle === "yearly" ? "year" : "month",
              },
            },
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?success=true&plan=${plan_slug}`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?canceled=true`,
        metadata: {
          user_id: userId,
          type: "subscription",
          plan_id: plan.id,
          plan_slug: plan_slug,
          billing_cycle: billing_cycle,
        },
        subscription_data: {
          metadata: {
            user_id: userId,
            plan_id: plan.id,
            plan_slug: plan_slug,
          },
          trial_period_days: 14,
        },
      });

      return NextResponse.json({ url: session.url });
    }

    // Use existing price ID
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing?success=true&plan=${plan_slug}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing?canceled=true`,
      metadata: {
        user_id: userId,
        type: "subscription",
        plan_id: plan.id,
        plan_slug: plan_slug,
        billing_cycle: billing_cycle,
      },
      subscription_data: {
        metadata: {
          user_id: userId,
          plan_id: plan.id,
          plan_slug: plan_slug,
        },
        trial_period_days: 14,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
}
