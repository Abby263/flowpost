import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { queryOne, insert, upsert, query } from "@/lib/postgres";

interface UserCredits {
  id: string;
  user_id: string;
  credits_balance: number;
  bonus_credits: number;
  credits_used_this_month: number;
  last_reset_at: string | null;
  next_reset_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Plan {
  id: string;
  credits_per_month: number;
}

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user credits
    const credits = await queryOne<UserCredits>(
      `SELECT * FROM user_credits WHERE user_id = $1`,
      [userId],
    );

    // If no credits record exists, initialize user with free plan
    if (!credits) {
      // Get free plan
      const plan = await queryOne<Plan>(
        `SELECT id, credits_per_month FROM plans WHERE slug = $1`,
        ["free"],
      );

      const initialCredits = plan?.credits_per_month || 10;
      const nextReset = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      // Create user credits
      await insert("user_credits", {
        user_id: userId,
        credits_balance: initialCredits,
        credits_used_this_month: 0,
        bonus_credits: 0,
        next_reset_at: nextReset.toISOString(),
      });

      // Create user subscription
      await upsert(
        "user_subscriptions",
        {
          user_id: userId,
          plan_id: plan?.id,
          status: "active",
          current_period_start: new Date().toISOString(),
          current_period_end: nextReset.toISOString(),
        },
        "user_id",
      );

      return NextResponse.json({
        credits_balance: initialCredits,
        bonus_credits: 0,
        total_credits: initialCredits,
        credits_used_this_month: 0,
        next_reset_at: nextReset.toISOString(),
      });
    }

    return NextResponse.json({
      credits_balance: credits.credits_balance,
      bonus_credits: credits.bonus_credits,
      total_credits: credits.credits_balance + credits.bonus_credits,
      credits_used_this_month: credits.credits_used_this_month,
      next_reset_at: credits.next_reset_at,
    });
  } catch (error) {
    console.error("Credits API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// Deduct credits (called by backend when workflow runs)
export async function POST(request: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { amount, reference_type, reference_id, description } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid credit amount" },
        { status: 400 },
      );
    }

    // Get current credits
    const credits = await queryOne<UserCredits>(
      `SELECT * FROM user_credits WHERE user_id = $1`,
      [userId],
    );

    if (!credits) {
      return NextResponse.json(
        { error: "Credits record not found" },
        { status: 404 },
      );
    }

    const totalCredits = credits.credits_balance + credits.bonus_credits;
    if (totalCredits < amount) {
      return NextResponse.json(
        { error: "Insufficient credits" },
        { status: 402 },
      );
    }

    // Deduct from bonus credits first, then regular credits
    let remainingDeduct = amount;
    let newBonusCredits = credits.bonus_credits;
    let newCreditsBalance = credits.credits_balance;

    if (credits.bonus_credits > 0) {
      const bonusDeduct = Math.min(credits.bonus_credits, remainingDeduct);
      newBonusCredits = credits.bonus_credits - bonusDeduct;
      remainingDeduct -= bonusDeduct;
    }

    if (remainingDeduct > 0) {
      newCreditsBalance = credits.credits_balance - remainingDeduct;
    }

    // Update credits
    await query(
      `UPDATE user_credits
       SET credits_balance = $1, bonus_credits = $2, credits_used_this_month = credits_used_this_month + $3, updated_at = NOW()
       WHERE user_id = $4`,
      [newCreditsBalance, newBonusCredits, amount, userId],
    );

    // Log transaction
    await insert("credit_transactions", {
      user_id: userId,
      amount: -amount,
      balance_after: newCreditsBalance + newBonusCredits,
      transaction_type: "usage",
      reference_type: reference_type || null,
      reference_id: reference_id || null,
      description: description || "Workflow execution",
    });

    return NextResponse.json({
      success: true,
      remaining_credits: newCreditsBalance + newBonusCredits,
    });
  } catch (error) {
    console.error("Credits deduction error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
