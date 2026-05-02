import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/postgres";

export const dynamic = "force-dynamic";

// Admin user IDs - add your Clerk user ID here
const ADMIN_USER_IDS =
  process.env.ADMIN_USER_IDS?.split(",").map((id) => id.trim()) || [];

// Cache for user emails to avoid repeated Clerk API calls
const userEmailCache = new Map<string, { email: string; name: string }>();

interface Subscription {
  id: string;
  user_id: string;
  status: string;
  billing_cycle: string;
  created_at: string;
  canceled_at: string | null;
  plan_id: string;
  plan_name: string;
  plan_slug: string;
  price_monthly: number;
  price_yearly: number;
}

interface Plan {
  id: string;
  name: string;
  slug: string;
  price_monthly: number;
  price_yearly: number;
  sort_order: number;
}

interface Post {
  id: string;
  user_id: string;
  platform: string;
  status: string;
  created_at: string;
  content: string;
  source: string;
}

interface Workflow {
  id: string;
  user_id: string;
  name: string;
  type: string;
  created_at: string;
}

interface UserCredits {
  credits_used_this_month: number;
  credits_balance: number;
  bonus_credits: number;
}

interface CreditTransaction {
  transaction_type: string;
  amount: number;
}

interface Connection {
  platform: string;
}

interface CostTracking {
  service: string;
  service_type: string;
  amount: number;
  api_calls: number;
  tokens_input: number;
  tokens_output: number;
  created_at: string;
  user_id: string;
}

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
      userCostBreakdown,
    ] = await Promise.all([
      getUserStats(),
      getSubscriptionStats(),
      getRevenueStats(),
      getUsageStats(),
      getRecentActivity(),
      getCreditStats(),
      getPlatformStats(),
      getCostTracking(),
      getUserCostBreakdown(),
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
      userCostBreakdown,
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

// Helper function to get user email from Clerk
async function getUserEmail(
  userId: string,
): Promise<{ email: string; name: string }> {
  // Check cache first
  if (userEmailCache.has(userId)) {
    return userEmailCache.get(userId)!;
  }

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const result = {
      email: user.emailAddresses[0]?.emailAddress || userId,
      name:
        `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
        user.emailAddresses[0]?.emailAddress ||
        userId,
    };
    userEmailCache.set(userId, result);
    return result;
  } catch (error) {
    console.error(`Failed to fetch user ${userId}:`, error);
    return { email: userId, name: userId };
  }
}

// Batch fetch user emails
async function batchGetUserEmails(
  userIds: string[],
): Promise<Map<string, { email: string; name: string }>> {
  const uniqueIds = [...new Set(userIds)];
  const results = new Map<string, { email: string; name: string }>();

  // Check cache and collect missing IDs
  const missingIds: string[] = [];
  for (const id of uniqueIds) {
    if (userEmailCache.has(id)) {
      results.set(id, userEmailCache.get(id)!);
    } else {
      missingIds.push(id);
    }
  }

  // Fetch missing users from Clerk (in parallel with limit)
  if (missingIds.length > 0) {
    const batchSize = 10;
    for (let i = 0; i < missingIds.length; i += batchSize) {
      const batch = missingIds.slice(i, i + batchSize);
      const fetchPromises = batch.map((id) => getUserEmail(id));
      const fetchedUsers = await Promise.all(fetchPromises);
      batch.forEach((id, index) => {
        results.set(id, fetchedUsers[index]);
      });
    }
  }

  return results;
}

async function getUserStats() {
  // Get unique users from user_subscriptions table
  const { rows: uniqueUsers } = await query<{
    user_id: string;
    created_at: string;
  }>(`SELECT user_id, created_at FROM user_subscriptions`);

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
  // Get all subscriptions with plan info using a JOIN
  const { rows: subscriptions } = await query<Subscription>(
    `SELECT us.id, us.user_id, us.status, us.billing_cycle, us.created_at, us.canceled_at, us.plan_id,
            p.name as plan_name, p.slug as plan_slug, p.price_monthly, p.price_yearly
     FROM user_subscriptions us
     LEFT JOIN plans p ON us.plan_id = p.id`,
  );

  const { rows: plans } = await query<Plan>(
    `SELECT * FROM plans ORDER BY sort_order`,
  );

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
    subscriptions?.filter(
      (s) => s.plan_slug === "free" && s.status === "active",
    ).length || 0;

  const paidUsers =
    subscriptions?.filter(
      (s) => s.plan_slug !== "free" && s.status === "active",
    ).length || 0;

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
  // Get active paid subscriptions with plan info
  const { rows: subscriptions } = await query<Subscription>(
    `SELECT us.id, us.status, us.billing_cycle, us.plan_id,
            p.name as plan_name, p.price_monthly, p.price_yearly
     FROM user_subscriptions us
     LEFT JOIN plans p ON us.plan_id = p.id
     WHERE us.status = 'active'`,
  );

  let mrr = 0;
  subscriptions?.forEach((sub) => {
    if (sub.price_monthly > 0) {
      if (sub.billing_cycle === "yearly") {
        mrr += sub.price_yearly / 12;
      } else {
        mrr += sub.price_monthly;
      }
    }
  });

  const arr = mrr * 12;

  // Average Revenue Per User
  const paidCount =
    subscriptions?.filter((s) => s.price_monthly > 0).length || 0;
  const arpu = paidCount > 0 ? mrr / paidCount : 0;

  // Revenue by plan
  const revenueByPlan: { name: string; revenue: number }[] = [];
  const planRevenue: Record<string, number> = {};

  subscriptions?.forEach((sub) => {
    if (sub.price_monthly > 0) {
      const revenue =
        sub.billing_cycle === "yearly"
          ? sub.price_yearly / 12
          : sub.price_monthly;
      planRevenue[sub.plan_name] = (planRevenue[sub.plan_name] || 0) + revenue;
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
  const totalWorkflowsResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM workflows`,
  );
  const totalWorkflows = parseInt(totalWorkflowsResult?.count || "0");

  const activeWorkflowsResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM workflows WHERE is_active = true`,
  );
  const activeWorkflows = parseInt(activeWorkflowsResult?.count || "0");

  // Get post counts
  const totalPostsResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM posts`,
  );
  const totalPosts = parseInt(totalPostsResult?.count || "0");

  const publishedPostsResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM posts WHERE status = 'published'`,
  );
  const publishedPosts = parseInt(publishedPostsResult?.count || "0");

  const scheduledPostsResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM posts WHERE status = 'scheduled'`,
  );
  const scheduledPosts = parseInt(scheduledPostsResult?.count || "0");

  const failedPostsResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM posts WHERE status = 'failed'`,
  );
  const failedPosts = parseInt(failedPostsResult?.count || "0");

  // Get connection counts
  const totalConnectionsResult = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM connections`,
  );
  const totalConnections = parseInt(totalConnectionsResult?.count || "0");

  // Posts by source
  const { rows: postsBySource } = await query<{ source: string }>(
    `SELECT source FROM posts`,
  );

  const sourceBreakdown: Record<string, number> = {};
  postsBySource?.forEach((post) => {
    const source = post.source || "manual";
    sourceBreakdown[source] = (sourceBreakdown[source] || 0) + 1;
  });

  return {
    totalWorkflows,
    activeWorkflows,
    totalPosts,
    publishedPosts,
    scheduledPosts,
    failedPosts,
    totalConnections,
    sourceBreakdown,
    successRate:
      totalPosts > 0 ? Math.round((publishedPosts / totalPosts) * 100) : 0,
  };
}

async function getRecentActivity() {
  // Recent subscriptions with plan info
  const { rows: recentSubscriptions } = await query<{
    id: string;
    user_id: string;
    status: string;
    created_at: string;
    plan_name: string;
  }>(
    `SELECT us.id, us.user_id, us.status, us.created_at, p.name as plan_name
     FROM user_subscriptions us
     LEFT JOIN plans p ON us.plan_id = p.id
     ORDER BY us.created_at DESC
     LIMIT 10`,
  );

  // Recent posts
  const { rows: recentPosts } = await query<Post>(
    `SELECT id, user_id, platform, status, created_at, content
     FROM posts
     ORDER BY created_at DESC
     LIMIT 10`,
  );

  // Recent workflows
  const { rows: recentWorkflows } = await query<Workflow>(
    `SELECT id, user_id, name, type, created_at
     FROM workflows
     ORDER BY created_at DESC
     LIMIT 10`,
  );

  // Collect all user IDs
  const allUserIds = [
    ...(recentSubscriptions?.map((s) => s.user_id) || []),
    ...(recentPosts?.map((p) => p.user_id) || []),
    ...(recentWorkflows?.map((w) => w.user_id) || []),
  ];

  // Batch fetch user emails
  const userEmails = await batchGetUserEmails(allUserIds);

  // Enrich data with emails
  const enrichedSubscriptions =
    recentSubscriptions?.map((s) => ({
      ...s,
      plans: { name: s.plan_name },
      user_email: userEmails.get(s.user_id)?.email || s.user_id,
      user_name: userEmails.get(s.user_id)?.name || s.user_id,
    })) || [];

  const enrichedPosts =
    recentPosts?.map((p) => ({
      ...p,
      user_email: userEmails.get(p.user_id)?.email || p.user_id,
      user_name: userEmails.get(p.user_id)?.name || p.user_id,
    })) || [];

  const enrichedWorkflows =
    recentWorkflows?.map((w) => ({
      ...w,
      user_email: userEmails.get(w.user_id)?.email || w.user_id,
      user_name: userEmails.get(w.user_id)?.name || w.user_id,
    })) || [];

  return {
    recentSubscriptions: enrichedSubscriptions,
    recentPosts: enrichedPosts,
    recentWorkflows: enrichedWorkflows,
  };
}

async function getCreditStats() {
  // Total credits used
  const { rows: creditUsage } = await query<UserCredits>(
    `SELECT credits_used_this_month, credits_balance, bonus_credits FROM user_credits`,
  );

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

  // Get transaction breakdown (last 30 days)
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { rows: transactions } = await query<CreditTransaction>(
    `SELECT transaction_type, amount FROM credit_transactions WHERE created_at >= $1`,
    [thirtyDaysAgo],
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
  const { rows: connections } = await query<Connection>(
    `SELECT platform FROM connections`,
  );

  const connectionsByPlatform: Record<string, number> = {};
  connections?.forEach((c) => {
    connectionsByPlatform[c.platform] =
      (connectionsByPlatform[c.platform] || 0) + 1;
  });

  // Posts by platform
  const { rows: posts } = await query<{ platform: string }>(
    `SELECT platform FROM posts`,
  );

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
  // Get cost tracking data (last 30 days)
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { rows: costs } = await query<CostTracking>(
    `SELECT * FROM cost_tracking WHERE created_at >= $1 ORDER BY created_at DESC`,
    [thirtyDaysAgo],
  );

  // If no data, return empty
  if (!costs || costs.length === 0) {
    return {
      totalCost: 0,
      costByService: {},
      costByServiceType: {},
      dailyCosts: [],
      estimatedMonthly: 0,
      apiCalls: 0,
      totalTokens: { input: 0, output: 0 },
    };
  }

  const totalCost = costs.reduce((sum, c) => sum + (c.amount || 0), 0);
  const apiCalls = costs.reduce((sum, c) => sum + (c.api_calls || 1), 0);
  const totalTokensInput = costs.reduce(
    (sum, c) => sum + (c.tokens_input || 0),
    0,
  );
  const totalTokensOutput = costs.reduce(
    (sum, c) => sum + (c.tokens_output || 0),
    0,
  );

  // Cost by service (gemini, openai, firecrawl, etc.)
  const costByService: Record<string, { cost: number; calls: number }> = {};
  costs.forEach((c) => {
    if (!costByService[c.service]) {
      costByService[c.service] = { cost: 0, calls: 0 };
    }
    costByService[c.service].cost += c.amount || 0;
    costByService[c.service].calls += c.api_calls || 1;
  });

  // Cost by service type
  const costByServiceType: Record<string, number> = {};
  costs.forEach((c) => {
    costByServiceType[c.service_type] =
      (costByServiceType[c.service_type] || 0) + (c.amount || 0);
  });

  // Group by date for chart
  const costsByDate: Record<string, number> = {};
  costs.forEach((c) => {
    const date = new Date(c.created_at).toISOString().split("T")[0];
    costsByDate[date] = (costsByDate[date] || 0) + (c.amount || 0);
  });

  const dailyCosts = Object.entries(costsByDate)
    .map(([date, amount]) => ({
      date,
      amount: Math.round(amount * 10000) / 10000,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Estimate monthly cost based on daily average
  const daysWithData = Object.keys(costsByDate).length || 1;
  const avgDailyCost = totalCost / daysWithData;
  const estimatedMonthly = avgDailyCost * 30;

  return {
    totalCost: Math.round(totalCost * 10000) / 10000,
    costByService,
    costByServiceType,
    dailyCosts,
    estimatedMonthly: Math.round(estimatedMonthly * 100) / 100,
    apiCalls,
    totalTokens: { input: totalTokensInput, output: totalTokensOutput },
  };
}

async function getUserCostBreakdown() {
  // Get costs grouped by user (last 30 days)
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { rows: costs } = await query<CostTracking>(
    `SELECT user_id, service, service_type, amount, tokens_input, tokens_output, api_calls
     FROM cost_tracking
     WHERE created_at >= $1`,
    [thirtyDaysAgo],
  );

  if (!costs || costs.length === 0) {
    return {
      userCosts: [],
      topUsers: [],
      avgCostPerUser: 0,
    };
  }

  // Aggregate costs per user
  const userCostMap: Record<
    string,
    {
      totalCost: number;
      apiCalls: number;
      tokensInput: number;
      tokensOutput: number;
      services: Record<string, number>;
    }
  > = {};

  costs.forEach((c) => {
    const userId = c.user_id || "anonymous";
    if (!userCostMap[userId]) {
      userCostMap[userId] = {
        totalCost: 0,
        apiCalls: 0,
        tokensInput: 0,
        tokensOutput: 0,
        services: {},
      };
    }
    userCostMap[userId].totalCost += c.amount || 0;
    userCostMap[userId].apiCalls += c.api_calls || 1;
    userCostMap[userId].tokensInput += c.tokens_input || 0;
    userCostMap[userId].tokensOutput += c.tokens_output || 0;
    userCostMap[userId].services[c.service] =
      (userCostMap[userId].services[c.service] || 0) + (c.amount || 0);
  });

  // Get user emails for top users
  const userIds = Object.keys(userCostMap).filter((id) => id !== "anonymous");
  const userEmails = await batchGetUserEmails(userIds);

  // Build user costs array
  const userCosts = Object.entries(userCostMap)
    .map(([userId, data]) => ({
      userId,
      email:
        userId === "anonymous"
          ? "Anonymous"
          : userEmails.get(userId)?.email || userId,
      name:
        userId === "anonymous"
          ? "Anonymous"
          : userEmails.get(userId)?.name || userId,
      totalCost: Math.round(data.totalCost * 10000) / 10000,
      apiCalls: data.apiCalls,
      tokensInput: data.tokensInput,
      tokensOutput: data.tokensOutput,
      services: data.services,
    }))
    .sort((a, b) => b.totalCost - a.totalCost);

  // Top 10 users by cost
  const topUsers = userCosts.slice(0, 10);

  // Average cost per user
  const totalUsers = userCosts.length || 1;
  const totalCost = userCosts.reduce((sum, u) => sum + u.totalCost, 0);
  const avgCostPerUser = totalCost / totalUsers;

  return {
    userCosts,
    topUsers,
    avgCostPerUser: Math.round(avgCostPerUser * 10000) / 10000,
    totalTrackedUsers: totalUsers,
  };
}
