import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import Stripe from "stripe";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: Request) {
  if (!stripe || !webhookSecret) {
    console.error("Stripe not configured");
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 500 },
    );
  }

  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 },
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        const type = session.metadata?.type;

        if (!userId) {
          console.error("No user_id in session metadata");
          break;
        }

        if (type === "credit_purchase") {
          // Handle credit purchase
          const credits = parseInt(session.metadata?.credits || "0");
          const bonusCredits = parseInt(session.metadata?.bonus_credits || "0");
          const totalCredits = credits + bonusCredits;

          // Add credits to user
          await supabaseAdmin.rpc("add_credits", {
            p_user_id: userId,
            p_amount: totalCredits,
            p_transaction_type: "purchase",
            p_description: `Purchased ${credits} credits${bonusCredits > 0 ? ` + ${bonusCredits} bonus` : ""}`,
            p_is_bonus: true,
          });

          console.log(`Added ${totalCredits} credits to user ${userId}`);
        } else if (type === "subscription") {
          // Handle subscription
          const planId = session.metadata?.plan_id;
          const planSlug = session.metadata?.plan_slug;
          const billingCycle = session.metadata?.billing_cycle || "monthly";

          // Get plan details
          const { data: plan } = await supabaseAdmin
            .from("plans")
            .select("*")
            .eq("id", planId)
            .single();

          if (plan) {
            // Update subscription
            await supabaseAdmin.from("user_subscriptions").upsert({
              user_id: userId,
              plan_id: planId,
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: session.subscription as string,
              status: "active",
              billing_cycle: billingCycle,
              current_period_start: new Date().toISOString(),
              current_period_end: new Date(
                Date.now() +
                  (billingCycle === "yearly" ? 365 : 30) * 24 * 60 * 60 * 1000,
              ).toISOString(),
            });

            // Set credits for the new plan
            await supabaseAdmin.from("user_credits").upsert({
              user_id: userId,
              credits_balance: plan.credits_per_month,
              credits_used_this_month: 0,
              next_reset_at: new Date(
                Date.now() + 30 * 24 * 60 * 60 * 1000,
              ).toISOString(),
            });

            // Log transaction
            await supabaseAdmin.from("credit_transactions").insert({
              user_id: userId,
              amount: plan.credits_per_month,
              balance_after: plan.credits_per_month,
              transaction_type: "subscription_credit",
              description: `Upgraded to ${plan.name} plan`,
            });

            console.log(`User ${userId} subscribed to ${planSlug} plan`);
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object;
        const userId = subscription.metadata?.user_id;

        if (userId) {
          // Update subscription status - use type assertion for period dates
          const periodStart = (subscription as any).current_period_start;
          const periodEnd = (subscription as any).current_period_end;

          await supabaseAdmin
            .from("user_subscriptions")
            .update({
              status:
                subscription.status === "active"
                  ? "active"
                  : subscription.status,
              current_period_start: periodStart
                ? new Date(periodStart * 1000).toISOString()
                : new Date().toISOString(),
              current_period_end: periodEnd
                ? new Date(periodEnd * 1000).toISOString()
                : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const userId = subscription.metadata?.user_id;

        if (userId) {
          // Get free plan
          const { data: freePlan } = await supabaseAdmin
            .from("plans")
            .select("id, credits_per_month")
            .eq("slug", "free")
            .single();

          // Downgrade to free plan
          await supabaseAdmin
            .from("user_subscriptions")
            .update({
              plan_id: freePlan?.id,
              status: "canceled",
              stripe_subscription_id: null,
              canceled_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);

          // Reset credits to free plan
          await supabaseAdmin
            .from("user_credits")
            .update({
              credits_balance: freePlan?.credits_per_month || 10,
              credits_used_this_month: 0,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);

          console.log(
            `User ${userId} subscription canceled, downgraded to free`,
          );
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        // Use type assertion for subscription property (changed in Stripe SDK v20)
        const subscriptionId = (invoice as any).subscription as string | null;
        const billingReason = (invoice as any).billing_reason as string | null;

        if (subscriptionId && billingReason === "subscription_cycle") {
          // Get subscription from Stripe
          const subscription =
            await stripe.subscriptions.retrieve(subscriptionId);
          const userId = subscription.metadata?.user_id;
          const planId = subscription.metadata?.plan_id;

          if (userId && planId) {
            // Get plan details
            const { data: plan } = await supabaseAdmin
              .from("plans")
              .select("credits_per_month, name")
              .eq("id", planId)
              .single();

            if (plan) {
              // Reset monthly credits
              await supabaseAdmin
                .from("user_credits")
                .update({
                  credits_balance: plan.credits_per_month,
                  credits_used_this_month: 0,
                  last_reset_at: new Date().toISOString(),
                  next_reset_at: new Date(
                    Date.now() + 30 * 24 * 60 * 60 * 1000,
                  ).toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq("user_id", userId);

              // Log transaction
              await supabaseAdmin.from("credit_transactions").insert({
                user_id: userId,
                amount: plan.credits_per_month,
                balance_after: plan.credits_per_month,
                transaction_type: "subscription_credit",
                description: `Monthly credit reset - ${plan.name} plan`,
              });

              console.log(`Reset credits for user ${userId}`);
            }
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        // Use type assertion for subscription property (changed in Stripe SDK v20)
        const subscriptionId = (invoice as any).subscription as string | null;

        if (subscriptionId) {
          const subscription =
            await stripe.subscriptions.retrieve(subscriptionId);
          const userId = subscription.metadata?.user_id;

          if (userId) {
            await supabaseAdmin
              .from("user_subscriptions")
              .update({
                status: "past_due",
                updated_at: new Date().toISOString(),
              })
              .eq("user_id", userId);

            console.log(`Payment failed for user ${userId}`);
          }
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 },
    );
  }
}
