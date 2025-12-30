import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { query, queryOne, insert } from "@/lib/postgres";

// Admin user IDs - add your Clerk user ID here
const ADMIN_USER_IDS =
  process.env.ADMIN_USER_IDS?.split(",").map((id) => id.trim()) || [];

interface UserCredits {
  id: string;
  user_id: string;
  credits_balance: number;
  bonus_credits: number;
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { targetUserId, creditsToAdd, reason } = body;

    if (!targetUserId) {
      return NextResponse.json(
        { error: "Target user ID is required" },
        { status: 400 },
      );
    }

    if (typeof creditsToAdd !== "number") {
      return NextResponse.json(
        { error: "Credits amount must be a number" },
        { status: 400 },
      );
    }

    // Get current user credits
    const userCredits = await queryOne<UserCredits>(
      `SELECT * FROM user_credits WHERE user_id = $1`,
      [targetUserId],
    );

    if (!userCredits) {
      // Create user credits record if it doesn't exist
      const newCredits = await queryOne<UserCredits>(
        `INSERT INTO user_credits (user_id, credits_balance, bonus_credits, credits_used_this_month)
         VALUES ($1, $2, 0, 0)
         RETURNING *`,
        [targetUserId, Math.max(0, creditsToAdd)],
      );

      // Log the transaction
      await insert("credit_transactions", {
        user_id: targetUserId,
        amount: creditsToAdd,
        balance_after: Math.max(0, creditsToAdd),
        transaction_type: "adjustment",
        description: reason || `Admin adjustment by ${userId}`,
        metadata: JSON.stringify({
          admin_user_id: userId,
          reason: reason || "Admin credit adjustment",
        }),
      });

      return NextResponse.json({
        success: true,
        user: newCredits,
        message: `Created user credits with ${creditsToAdd} credits`,
      });
    }

    // Calculate new balance
    const newBalance = Math.max(0, userCredits.credits_balance + creditsToAdd);

    // Update credits
    const updatedCredits = await queryOne<UserCredits>(
      `UPDATE user_credits 
       SET credits_balance = $1, updated_at = NOW()
       WHERE user_id = $2
       RETURNING *`,
      [newBalance, targetUserId],
    );

    // Log the transaction
    await insert("credit_transactions", {
      user_id: targetUserId,
      amount: creditsToAdd,
      balance_after: newBalance,
      transaction_type: "adjustment",
      description: reason || `Admin adjustment by ${userId}`,
      metadata: JSON.stringify({
        admin_user_id: userId,
        previous_balance: userCredits.credits_balance,
        reason: reason || "Admin credit adjustment",
      }),
    });

    return NextResponse.json({
      success: true,
      user: updatedCredits,
      previousBalance: userCredits.credits_balance,
      newBalance,
      message: `Updated credits from ${userCredits.credits_balance} to ${newBalance}`,
    });
  } catch (error) {
    console.error("Admin update credits error:", error);
    return NextResponse.json(
      { error: "Failed to update user credits" },
      { status: 500 },
    );
  }
}

// Set credits to a specific value (instead of adding/subtracting)
export async function PUT(request: NextRequest) {
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

    const body = await request.json();
    const { targetUserId, newCredits, reason } = body;

    if (!targetUserId) {
      return NextResponse.json(
        { error: "Target user ID is required" },
        { status: 400 },
      );
    }

    if (typeof newCredits !== "number" || newCredits < 0) {
      return NextResponse.json(
        { error: "Credits must be a non-negative number" },
        { status: 400 },
      );
    }

    // Get current user credits
    const userCredits = await queryOne<UserCredits>(
      `SELECT * FROM user_credits WHERE user_id = $1`,
      [targetUserId],
    );

    const previousBalance = userCredits?.credits_balance || 0;
    const creditsDiff = newCredits - previousBalance;

    if (!userCredits) {
      // Create user credits record if it doesn't exist
      await query(
        `INSERT INTO user_credits (user_id, credits_balance, bonus_credits, credits_used_this_month)
         VALUES ($1, $2, 0, 0)`,
        [targetUserId, newCredits],
      );
    } else {
      // Update credits
      await query(
        `UPDATE user_credits 
         SET credits_balance = $1, updated_at = NOW()
         WHERE user_id = $2`,
        [newCredits, targetUserId],
      );
    }

    // Log the transaction
    await insert("credit_transactions", {
      user_id: targetUserId,
      amount: creditsDiff,
      balance_after: newCredits,
      transaction_type: "adjustment",
      description: reason || `Admin set credits to ${newCredits} by ${userId}`,
      metadata: JSON.stringify({
        admin_user_id: userId,
        previous_balance: previousBalance,
        reason: reason || "Admin credit adjustment",
        action: "set_credits",
      }),
    });

    return NextResponse.json({
      success: true,
      previousBalance,
      newBalance: newCredits,
      message: `Set credits from ${previousBalance} to ${newCredits}`,
    });
  } catch (error) {
    console.error("Admin set credits error:", error);
    return NextResponse.json(
      { error: "Failed to set user credits" },
      { status: 500 },
    );
  }
}
