import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Admin user IDs - add your Clerk user ID here
const ADMIN_USER_IDS = process.env.ADMIN_USER_IDS?.split(",") || [];

export async function GET() {
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

    // Fetch all stats in parallel
    const [
      userStats,
      subscriptionStats,
      revenueStats,
      usageStats,
      recentActivity,
      creditStats,
      platformStats,
      costTracking,
    ] = await Promise.all([
      getUserStats(),
      getSubscriptionStats(),
      getRevenueStats(),
      getUsageStats(),
      getRecentActivity(),
      getCreditStats(),
      getPlatformStats(),
      getCostTracking(),
    ]);

    return NextResponse.json({
      userStats,
      subscriptionStats,
      revenueStats,
      usageStats,
      recentActivity,
      creditStats,
      platformStats,
      costTracking,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch admin stats" },
      { status: 500 },
    );
  }
}

async function getUserStats() {
  // Get unique users from various tables
  const { data: uniqueUsers } = await supabaseAdmin
    .from("user_subscriptions")
    .select("user_id, created_at");

  const totalUsers = uniqueUsers?.length || 0;

  // Calculate new users in different periods
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const newUsersToday =
    uniqueUsers?.filter((u) => new Date(u.created_at) >= today).length || 0;

  const newUsersThisWeek =
    uniqueUsers?.filter((u) => new Date(u.created_at) >= thisWeek).length || 0;

  const newUsersThisMonth =
    uniqueUsers?.filter((u) => new Date(u.created_at) >= thisMonth).length || 0;

  const newUsersLastMonth =
    uniqueUsers?.filter((u) => {
      const date = new Date(u.created_at);
      return date >= lastMonth && date < thisMonth;
    }).length || 0;

  // Calculate growth rate
  const growthRate =
    newUsersLastMonth > 0
      ? ((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth) * 100
      : newUsersThisMonth > 0
        ? 100
        : 0;

  // Daily signups for the chart (last 30 days)
  const dailySignups: { date: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);
    const count =
      uniqueUsers?.filter((u) => {
        const createdAt = new Date(u.created_at);
        return createdAt >= date && createdAt < nextDate;
      }).length || 0;
    dailySignups.push({
      date: date.toISOString().split("T")[0],
      count,
    });
  }

  return {
    totalUsers,
    newUsersToday,
    newUsersThisWeek,
    newUsersThisMonth,
    newUsersLastMonth,
    growthRate: Math.round(growthRate * 10) / 10,
    dailySignups,
  };
}

async function getSubscriptionStats() {
  // Get all subscriptions with plan info
  const { data: subscriptions } = await supabaseAdmin.from("user_subscriptions")
    .select(`
      id,
      user_id,
      status,
      billing_cycle,
      created_at,
      canceled_at,
      plan_id,
      plans (
        name,
        slug,
        price_monthly,
        price_yearly
      )
    `);

  const { data: plans } = await supabaseAdmin
    .from("plans")
    .select("*")
    .order("sort_order");

  // Count by plan
  const planBreakdown =
    plans?.map((plan) => {
      const count =
        subscriptions?.filter(
          (s) => s.plan_id === plan.id && s.status === "active",
        ).length || 0;
      return {
        name: plan.name,
        slug: plan.slug,
        count,
        price: plan.price_monthly,
      };
    }) || [];

  // Count by status
  const statusBreakdown = {
    active: subscriptions?.filter((s) => s.status === "active").length || 0,
    canceled: subscriptions?.filter((s) => s.status === "canceled").length || 0,
    past_due: subscriptions?.filter((s) => s.status === "past_due").length || 0,
    trialing: subscriptions?.filter((s) => s.status === "trialing").length || 0,
    paused: subscriptions?.filter((s) => s.status === "paused").length || 0,
  };

  // Free vs Paid
  const freeUsers =
    subscriptions?.filter((s) => {
      const plan = s.plans as any;
      return plan?.slug === "free" && s.status === "active";
    }).length || 0;

  const paidUsers =
    subscriptions?.filter((s) => {
      const plan = s.plans as any;
      return plan?.slug !== "free" && s.status === "active";
    }).length || 0;

  const conversionRate =
    freeUsers + paidUsers > 0 ? (paidUsers / (freeUsers + paidUsers)) * 100 : 0;

  // Calculate churn (canceled in last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentlyCanceled =
    subscriptions?.filter((s) => {
      if (!s.canceled_at) return false;
      return new Date(s.canceled_at) >= thirtyDaysAgo;
    }).length || 0;

  const churnRate = paidUsers > 0 ? (recentlyCanceled / paidUsers) * 100 : 0;

  return {
    planBreakdown,
    statusBreakdown,
    freeUsers,
    paidUsers,
    conversionRate: Math.round(conversionRate * 10) / 10,
    churnRate: Math.round(churnRate * 10) / 10,
  };
}

async function getRevenueStats() {
  // Get active paid subscriptions
  const { data: subscriptions } = await supabaseAdmin
    .from("user_subscriptions")
    .select(
      `
      id,
      status,
      billing_cycle,
      plans (
        name,
        price_monthly,
        price_yearly
      )
    `,
    )
    .eq("status", "active");

  let mrr = 0;
  subscriptions?.forEach((sub) => {
    const plan = sub.plans as any;
    if (plan && plan.price_monthly > 0) {
      if (sub.billing_cycle === "yearly") {
        mrr += plan.price_yearly / 12;
      } else {
        mrr += plan.price_monthly;
      }
    }
  });

  const arr = mrr * 12;

  // Average Revenue Per User
  const paidCount =
    subscriptions?.filter((s) => {
      const plan = s.plans as any;
      return plan?.price_monthly > 0;
    }).length || 0;
  const arpu = paidCount > 0 ? mrr / paidCount : 0;

  // Revenue by plan
  const revenueByPlan: { name: string; revenue: number }[] = [];
  const planRevenue: Record<string, number> = {};

  subscriptions?.forEach((sub) => {
    const plan = sub.plans as any;
    if (plan && plan.price_monthly > 0) {
      const revenue =
        sub.billing_cycle === "yearly"
          ? plan.price_yearly / 12
          : plan.price_monthly;
      planRevenue[plan.name] = (planRevenue[plan.name] || 0) + revenue;
    }
  });

  Object.entries(planRevenue).forEach(([name, revenue]) => {
    revenueByPlan.push({ name, revenue: Math.round(revenue * 100) / 100 });
  });

  return {
    mrr: Math.round(mrr * 100) / 100,
    arr: Math.round(arr * 100) / 100,
    arpu: Math.round(arpu * 100) / 100,
    revenueByPlan,
    paidSubscribers: paidCount,
  };
}

async function getUsageStats() {
  // Get workflow counts
  const { count: totalWorkflows } = await supabaseAdmin
    .from("workflows")
    .select("*", { count: "exact", head: true });

  const { count: activeWorkflows } = await supabaseAdmin
    .from("workflows")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);

  // Get post counts
  const { count: totalPosts } = await supabaseAdmin
    .from("posts")
    .select("*", { count: "exact", head: true });

  const { count: publishedPosts } = await supabaseAdmin
    .from("posts")
    .select("*", { count: "exact", head: true })
    .eq("status", "published");

  const { count: scheduledPosts } = await supabaseAdmin
    .from("posts")
    .select("*", { count: "exact", head: true })
    .eq("status", "scheduled");

  const { count: failedPosts } = await supabaseAdmin
    .from("posts")
    .select("*", { count: "exact", head: true })
    .eq("status", "failed");

  // Get connection counts
  const { count: totalConnections } = await supabaseAdmin
    .from("connections")
    .select("*", { count: "exact", head: true });

  // Posts by source
  const { data: postsBySource } = await supabaseAdmin
    .from("posts")
    .select("source");

  const sourceBreakdown: Record<string, number> = {};
  postsBySource?.forEach((post) => {
    const source = post.source || "manual";
    sourceBreakdown[source] = (sourceBreakdown[source] || 0) + 1;
  });

  return {
    totalWorkflows: totalWorkflows || 0,
    activeWorkflows: activeWorkflows || 0,
    totalPosts: totalPosts || 0,
    publishedPosts: publishedPosts || 0,
    scheduledPosts: scheduledPosts || 0,
    failedPosts: failedPosts || 0,
    totalConnections: totalConnections || 0,
    sourceBreakdown,
    successRate:
      totalPosts && totalPosts > 0
        ? Math.round(((publishedPosts || 0) / totalPosts) * 100)
        : 0,
  };
}

async function getRecentActivity() {
  // Recent subscriptions
  const { data: recentSubscriptions } = await supabaseAdmin
    .from("user_subscriptions")
    .select(
      `
      id,
      user_id,
      status,
      created_at,
      plans (name)
    `,
    )
    .order("created_at", { ascending: false })
    .limit(10);

  // Recent posts
  const { data: recentPosts } = await supabaseAdmin
    .from("posts")
    .select("id, user_id, platform, status, created_at, content")
    .order("created_at", { ascending: false })
    .limit(10);

  // Recent workflows
  const { data: recentWorkflows } = await supabaseAdmin
    .from("workflows")
    .select("id, user_id, name, type, created_at")
    .order("created_at", { ascending: false })
    .limit(10);

  return {
    recentSubscriptions: recentSubscriptions || [],
    recentPosts: recentPosts || [],
    recentWorkflows: recentWorkflows || [],
  };
}

async function getCreditStats() {
  // Total credits used
  const { data: creditUsage } = await supabaseAdmin
    .from("user_credits")
    .select("credits_used_this_month, credits_balance, bonus_credits");

  const totalCreditsUsed =
    creditUsage?.reduce(
      (sum, c) => sum + (c.credits_used_this_month || 0),
      0,
    ) || 0;

  const totalCreditsRemaining =
    creditUsage?.reduce(
      (sum, c) => sum + (c.credits_balance || 0) + (c.bonus_credits || 0),
      0,
    ) || 0;

  // Get transaction breakdown
  const { data: transactions } = await supabaseAdmin
    .from("credit_transactions")
    .select("transaction_type, amount")
    .gte(
      "created_at",
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    );

  const transactionBreakdown: Record<string, number> = {};
  transactions?.forEach((t) => {
    transactionBreakdown[t.transaction_type] =
      (transactionBreakdown[t.transaction_type] || 0) + Math.abs(t.amount);
  });

  return {
    totalCreditsUsed,
    totalCreditsRemaining,
    transactionBreakdown,
  };
}

async function getPlatformStats() {
  // Connections by platform
  const { data: connections } = await supabaseAdmin
    .from("connections")
    .select("platform");

  const connectionsByPlatform: Record<string, number> = {};
  connections?.forEach((c) => {
    connectionsByPlatform[c.platform] =
      (connectionsByPlatform[c.platform] || 0) + 1;
  });

  // Posts by platform
  const { data: posts } = await supabaseAdmin.from("posts").select("platform");

  const postsByPlatform: Record<string, number> = {};
  posts?.forEach((p) => {
    if (p.platform) {
      postsByPlatform[p.platform] = (postsByPlatform[p.platform] || 0) + 1;
    }
  });

  return {
    connectionsByPlatform,
    postsByPlatform,
  };
}

async function getCostTracking() {
  // Get cost tracking data if table exists
  const { data: costs } = await supabaseAdmin
    .from("cost_tracking")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);

  if (!costs || costs.length === 0) {
    return {
      totalCost: 0,
      costBreakdown: {},
      dailyCosts: [],
      estimatedMonthly: 0,
    };
  }

  const totalCost = costs.reduce((sum, c) => sum + (c.amount || 0), 0);

  const costBreakdown: Record<string, number> = {};
  costs.forEach((c) => {
    costBreakdown[c.service] =
      (costBreakdown[c.service] || 0) + (c.amount || 0);
  });

  // Group by date
  const dailyCosts: { date: string; amount: number }[] = [];
  const costsByDate: Record<string, number> = {};
  costs.forEach((c) => {
    const date = new Date(c.created_at).toISOString().split("T")[0];
    costsByDate[date] = (costsByDate[date] || 0) + (c.amount || 0);
  });

  Object.entries(costsByDate).forEach(([date, amount]) => {
    dailyCosts.push({ date, amount: Math.round(amount * 100) / 100 });
  });

  // Estimate monthly cost based on daily average
  const avgDailyCost = totalCost / Math.max(costs.length, 1);
  const estimatedMonthly = avgDailyCost * 30;

  return {
    totalCost: Math.round(totalCost * 100) / 100,
    costBreakdown,
    dailyCosts: dailyCosts.sort((a, b) => a.date.localeCompare(b.date)),
    estimatedMonthly: Math.round(estimatedMonthly * 100) / 100,
  };
}
