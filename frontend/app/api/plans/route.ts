import { NextResponse } from "next/server";
import { queryMany } from "@/lib/postgres";

export const dynamic = "force-dynamic";

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
  sort_order: number;
  stripe_price_id_monthly: string | null;
  stripe_price_id_yearly: string | null;
}

export async function GET() {
  try {
    const plans = await queryMany<Plan>(
      `SELECT * FROM plans
       WHERE is_active = true
       ORDER BY sort_order ASC`,
    );

    return NextResponse.json({ plans });
  } catch (error) {
    console.error("Plans API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch plans" },
      { status: 500 },
    );
  }
}
