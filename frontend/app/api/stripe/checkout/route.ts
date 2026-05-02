import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { queryOne, upsert } from "@/lib/postgres";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

// Initialize Stripe (will be undefined if not configured)
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

interface UserSubscription {
  stripe_customer_id: string | null;
}

interface Plan {
  id: string;
  name: string;
  slug: string;
  price_monthly: number;
  price_yearly: number;
  credits_per_month: number;
  max_workflows: number;
  stripe_price_id_monthly: string | null;
  stripe_price_id_yearly: string | null;
}

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  bonus_credits: number;
  price: number;
}

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

    // Determine base URL
    const origin = request.headers.get("origin");
    let baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || origin || "https://flowpost.xyz";

    // Remove trailing slash if present
    if (baseUrl.endsWith("/")) {
      baseUrl = baseUrl.slice(0, -1);
    }

    // Get or create Stripe customer
    const subscription = await queryOne<UserSubscription>(
      `SELECT stripe_customer_id FROM user_subscriptions WHERE user_id = $1`,
      [userId],
    );

    let customerId = subscription?.stripe_customer_id;

    if (!customerId) {
      // Get user email
      const user = await currentUser();
      const email = user?.emailAddresses[0]?.emailAddress;

      // Create Stripe customer
      const customer = await stripe.customers.create({
        email: email,
        metadata: {
          user_id: userId,
        },
      });
      customerId = customer.id;

      // Save customer ID
      await upsert(
        "user_subscriptions",
        {
          user_id: userId,
          stripe_customer_id: customerId,
        },
        "user_id",
      );
    }

    // Handle credit package purchase
    if (credit_package_id) {
      const creditPackage = await queryOne<CreditPackage>(
        `SELECT * FROM credit_packages WHERE id = $1`,
        [credit_package_id],
      );

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
        success_url: `${baseUrl}/dashboard/billing?success=true&credits=${creditPackage.credits + creditPackage.bonus_credits}`,
        cancel_url: `${baseUrl}/pricing?canceled=true`,
        metadata: {
          user_id: userId,
          type: "credit_purchase",
          credit_package_id: creditPackage.id,
          credits: String(creditPackage.credits),
          bonus_credits: String(creditPackage.bonus_credits),
        },
      });

      return NextResponse.json({ url: session.url });
    }

    // Handle subscription
    const plan = await queryOne<Plan>(`SELECT * FROM plans WHERE slug = $1`, [
      plan_slug,
    ]);

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
        success_url: `${baseUrl}/dashboard/billing?success=true&plan=${plan_slug}`,
        cancel_url: `${baseUrl}/pricing?canceled=true`,
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
      success_url: `${baseUrl}/dashboard/billing?success=true&plan=${plan_slug}`,
      cancel_url: `${baseUrl}/pricing?canceled=true`,
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
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to create checkout session: ${errorMessage}` },
      { status: 500 },
    );
  }
}
