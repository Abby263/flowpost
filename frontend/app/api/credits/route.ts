import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user credits
    const { data: credits, error: creditsError } = await supabaseAdmin
      .from("user_credits")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (creditsError && creditsError.code !== "PGRST116") {
      console.error("Error fetching credits:", creditsError);
      return NextResponse.json(
        { error: "Failed to fetch credits" },
        { status: 500 },
      );
    }

    // If no credits record exists, initialize user with free plan
    if (!credits) {
      // Initialize user credits
      const { error: initError } = await supabaseAdmin.rpc(
        "initialize_user_credits",
        {
          p_user_id: userId,
          p_plan_slug: "free",
        },
      );

      if (initError) {
        console.error("Error initializing credits:", initError);
        // Fallback: create credits manually
        const { data: plan } = await supabaseAdmin
          .from("plans")
          .select("id, credits_per_month")
          .eq("slug", "free")
          .single();

        const initialCredits = plan?.credits_per_month || 10;

        await supabaseAdmin.from("user_credits").insert({
          user_id: userId,
          credits_balance: initialCredits,
          credits_used_this_month: 0,
          bonus_credits: 0,
        });

        await supabaseAdmin.from("user_subscriptions").insert({
          user_id: userId,
          plan_id: plan?.id,
          status: "active",
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        });

        return NextResponse.json({
          credits_balance: initialCredits,
          bonus_credits: 0,
          total_credits: initialCredits,
          credits_used_this_month: 0,
          next_reset_at: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        });
      }

      // Fetch the newly created credits
      const { data: newCredits } = await supabaseAdmin
        .from("user_credits")
        .select("*")
        .eq("user_id", userId)
        .single();

      return NextResponse.json({
        credits_balance: newCredits?.credits_balance || 10,
        bonus_credits: newCredits?.bonus_credits || 0,
        total_credits:
          (newCredits?.credits_balance || 10) +
          (newCredits?.bonus_credits || 0),
        credits_used_this_month: newCredits?.credits_used_this_month || 0,
        next_reset_at: newCredits?.next_reset_at,
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

    // Use the deduct_credits function
    const { data, error } = await supabaseAdmin.rpc("deduct_credits", {
      p_user_id: userId,
      p_amount: amount,
      p_reference_type: reference_type || null,
      p_reference_id: reference_id || null,
      p_description: description || "Workflow execution",
    });

    if (error) {
      console.error("Error deducting credits:", error);
      return NextResponse.json(
        { error: "Failed to deduct credits" },
        { status: 500 },
      );
    }

    if (data === false) {
      return NextResponse.json(
        { error: "Insufficient credits" },
        { status: 402 },
      );
    }

    // Get updated balance
    const { data: credits } = await supabaseAdmin
      .from("user_credits")
      .select("credits_balance, bonus_credits")
      .eq("user_id", userId)
      .single();

    return NextResponse.json({
      success: true,
      remaining_credits:
        (credits?.credits_balance || 0) + (credits?.bonus_credits || 0),
    });
  } catch (error) {
    console.error("Credits deduction error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
