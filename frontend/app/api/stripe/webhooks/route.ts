import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { queryOne, query, insert, upsert } from "@/lib/postgres";
import Stripe from "stripe";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY.trim())
  : null;

// Trim webhook secret to remove any accidental whitespace/newlines from env vars
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

interface Plan {
  id: string;
  name: string;
  slug: string;
  credits_per_month: number;
}

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

          // Get current credits
          const currentCredits = await queryOne<{
            bonus_credits: number;
            credits_balance: number;
          }>(
            `SELECT bonus_credits, credits_balance FROM user_credits WHERE user_id = $1`,
            [userId],
          );

          const newBonusCredits =
            (currentCredits?.bonus_credits || 0) + totalCredits;
          const newBalance = currentCredits?.credits_balance || 0;

          // Add credits to user (purchased credits go to bonus_credits)
          await upsert(
            "user_credits",
            {
              user_id: userId,
              bonus_credits: newBonusCredits,
              credits_balance: newBalance,
            },
            "user_id",
          );

          // Log transaction
          await insert("credit_transactions", {
            user_id: userId,
            amount: totalCredits,
            balance_after: newBalance + newBonusCredits,
            transaction_type: "purchase",
            description: `Purchased ${credits} credits${bonusCredits > 0 ? ` + ${bonusCredits} bonus` : ""}`,
          });

          console.log(`Added ${totalCredits} credits to user ${userId}`);
        } else if (type === "subscription") {
          // Handle subscription
          const planId = session.metadata?.plan_id;
          const planSlug = session.metadata?.plan_slug;
          const billingCycle = session.metadata?.billing_cycle || "monthly";

          // Get plan details
          const plan = await queryOne<Plan>(
            `SELECT * FROM plans WHERE id = $1`,
            [planId],
          );

          if (plan) {
            // Update subscription
            await upsert(
              "user_subscriptions",
              {
                user_id: userId,
                plan_id: planId,
                stripe_customer_id: session.customer as string,
                stripe_subscription_id: session.subscription as string,
                status: "active",
                billing_cycle: billingCycle,
                current_period_start: new Date().toISOString(),
                current_period_end: new Date(
                  Date.now() +
                    (billingCycle === "yearly" ? 365 : 30) *
                      24 *
                      60 *
                      60 *
                      1000,
                ).toISOString(),
              },
              "user_id",
            );

            // Set credits for the new plan
            await upsert(
              "user_credits",
              {
                user_id: userId,
                credits_balance: plan.credits_per_month,
                credits_used_this_month: 0,
                next_reset_at: new Date(
                  Date.now() + 30 * 24 * 60 * 60 * 1000,
                ).toISOString(),
              },
              "user_id",
            );

            // Log transaction
            await insert("credit_transactions", {
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

          await query(
            `UPDATE user_subscriptions
             SET status = $1, current_period_start = $2, current_period_end = $3, updated_at = NOW()
             WHERE user_id = $4`,
            [
              subscription.status === "active" ? "active" : subscription.status,
              periodStart
                ? new Date(periodStart * 1000).toISOString()
                : new Date().toISOString(),
              periodEnd
                ? new Date(periodEnd * 1000).toISOString()
                : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              userId,
            ],
          );
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const userId = subscription.metadata?.user_id;

        if (userId) {
          // Get free plan
          const freePlan = await queryOne<Plan>(
            `SELECT id, credits_per_month FROM plans WHERE slug = $1`,
            ["free"],
          );

          // Downgrade to free plan
          await query(
            `UPDATE user_subscriptions
             SET plan_id = $1, status = 'canceled', stripe_subscription_id = NULL, canceled_at = NOW(), updated_at = NOW()
             WHERE user_id = $2`,
            [freePlan?.id, userId],
          );

          // Reset credits to free plan
          await query(
            `UPDATE user_credits
             SET credits_balance = $1, credits_used_this_month = 0, updated_at = NOW()
             WHERE user_id = $2`,
            [freePlan?.credits_per_month || 10, userId],
          );

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
          const stripeSubscription =
            await stripe.subscriptions.retrieve(subscriptionId);
          const userId = stripeSubscription.metadata?.user_id;
          const planId = stripeSubscription.metadata?.plan_id;

          if (userId && planId) {
            // Get plan details
            const plan = await queryOne<Plan>(
              `SELECT credits_per_month, name FROM plans WHERE id = $1`,
              [planId],
            );

            if (plan) {
              // Reset monthly credits
              await query(
                `UPDATE user_credits
                 SET credits_balance = $1, credits_used_this_month = 0, last_reset_at = NOW(), next_reset_at = $2, updated_at = NOW()
                 WHERE user_id = $3`,
                [
                  plan.credits_per_month,
                  new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                  userId,
                ],
              );

              // Log transaction
              await insert("credit_transactions", {
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
          const stripeSubscription =
            await stripe.subscriptions.retrieve(subscriptionId);
          const userId = stripeSubscription.metadata?.user_id;

          if (userId) {
            await query(
              `UPDATE user_subscriptions
               SET status = 'past_due', updated_at = NOW()
               WHERE user_id = $1`,
              [userId],
            );

            console.log(`Payment failed for user ${userId}`);
          }
        }
        break;
      }

      case "customer.created":
        console.log("Customer created");
        break;

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
