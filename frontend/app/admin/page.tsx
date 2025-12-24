"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Workflow,
  FileText,
  CreditCard,
  Zap,
  Instagram,
  Twitter,
  Linkedin,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  BarChart3,
  PieChart,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Coins,
  Server,
  Brain,
  Image,
  Globe,
  Loader2,
  ShieldAlert,
  Hash,
} from "lucide-react";

interface AdminStats {
  userStats: {
    totalUsers: number;
    newUsersToday: number;
    newUsersThisWeek: number;
    newUsersThisMonth: number;
    newUsersLastMonth: number;
    growthRate: number;
    dailySignups: { date: string; count: number }[];
  };
  subscriptionStats: {
    planBreakdown: {
      name: string;
      slug: string;
      count: number;
      price: number;
    }[];
    statusBreakdown: Record<string, number>;
    freeUsers: number;
    paidUsers: number;
    conversionRate: number;
    churnRate: number;
  };
  revenueStats: {
    mrr: number;
    arr: number;
    arpu: number;
    revenueByPlan: { name: string; revenue: number }[];
    paidSubscribers: number;
  };
  usageStats: {
    totalWorkflows: number;
    activeWorkflows: number;
    totalPosts: number;
    publishedPosts: number;
    scheduledPosts: number;
    failedPosts: number;
    totalConnections: number;
    sourceBreakdown: Record<string, number>;
    successRate: number;
  };
  recentActivity: {
    recentSubscriptions: any[];
    recentPosts: any[];
    recentWorkflows: any[];
  };
  creditStats: {
    totalCreditsUsed: number;
    totalCreditsRemaining: number;
    transactionBreakdown: Record<string, number>;
  };
  platformStats: {
    connectionsByPlatform: Record<string, number>;
    postsByPlatform: Record<string, number>;
  };
  costTracking: {
    totalCost: number;
    costByService: Record<string, { cost: number; calls: number }>;
    costByServiceType: Record<string, number>;
    dailyCosts: { date: string; amount: number }[];
    estimatedMonthly: number;
    apiCalls: number;
    totalTokens: { input: number; output: number };
  };
  userCostBreakdown: {
    userCosts: {
      userId: string;
      email: string;
      name: string;
      totalCost: number;
      apiCalls: number;
      tokensInput: number;
      tokensOutput: number;
      services: Record<string, number>;
    }[];
    topUsers: any[];
    avgCostPerUser: number;
    totalTrackedUsers: number;
  };
  generatedAt: string;
}

const platformIcons: Record<string, any> = {
  instagram: Instagram,
  twitter: Twitter,
  linkedin: Linkedin,
  slack: Hash,
};

const platformColors: Record<string, string> = {
  instagram: "bg-gradient-to-r from-purple-500 to-pink-500",
  twitter: "bg-sky-500",
  linkedin: "bg-blue-600",
  slack: "bg-[#4A154B]",
};

const serviceTypeIcons: Record<string, any> = {
  ai_model: Brain,
  image_generation: Image,
  web_scraping: Globe,
  infrastructure: Server,
  storage: Server,
  other: Zap,
};

export default function AdminDashboard() {
  // Server-side auth already verified in layout.tsx - user is guaranteed to be admin
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setRefreshing(true);
      const response = await fetch("/api/admin/stats");

      if (response.status === 403) {
        setError("Access denied. Admin privileges required.");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to fetch stats");
      }

      const data = await response.json();
      setStats(data);
      setError(null);
    } catch (err) {
      setError("Failed to load admin statistics");
      console.error(err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-emerald-500 mx-auto mb-4" />
          <p className="text-slate-400">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <Card className="bg-slate-900 border-red-500/30 max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <ShieldAlert className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">
              Error Loading Data
            </h2>
            <p className="text-slate-400 mb-6">{error}</p>
            <Button
              onClick={fetchStats}
              className="bg-slate-800 hover:bg-slate-700"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!stats) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-US").format(num);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Calculate max for chart scaling
  const maxDailySignup = Math.max(
    ...stats.userStats.dailySignups.map((d) => d.count),
    1,
  );

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">
                  Admin Dashboard
                </h1>
                <p className="text-sm text-slate-400">
                  Last updated: {formatDateTime(stats.generatedAt)}
                </p>
              </div>
            </div>
            <Button
              onClick={fetchStats}
              disabled={refreshing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        {/* Key Metrics Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Users */}
          <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700/50 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <CardContent className="pt-6 relative">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm font-medium">
                  Total Users
                </span>
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <Users className="h-5 w-5 text-emerald-400" />
                </div>
              </div>
              <div className="text-3xl font-bold text-white mb-1">
                {formatNumber(stats.userStats.totalUsers)}
              </div>
              <div className="flex items-center gap-1 text-sm">
                {stats.userStats.growthRate >= 0 ? (
                  <>
                    <ArrowUpRight className="h-4 w-4 text-emerald-400" />
                    <span className="text-emerald-400">
                      +{stats.userStats.growthRate}%
                    </span>
                  </>
                ) : (
                  <>
                    <ArrowDownRight className="h-4 w-4 text-red-400" />
                    <span className="text-red-400">
                      {stats.userStats.growthRate}%
                    </span>
                  </>
                )}
                <span className="text-slate-500">vs last month</span>
              </div>
            </CardContent>
          </Card>

          {/* MRR */}
          <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700/50 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <CardContent className="pt-6 relative">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm font-medium">
                  Monthly Revenue
                </span>
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-blue-400" />
                </div>
              </div>
              <div className="text-3xl font-bold text-white mb-1">
                {formatCurrency(stats.revenueStats.mrr)}
              </div>
              <div className="text-sm text-slate-500">
                ARR: {formatCurrency(stats.revenueStats.arr)}
              </div>
            </CardContent>
          </Card>

          {/* Paid Users */}
          <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700/50 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <CardContent className="pt-6 relative">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm font-medium">
                  Paid Subscribers
                </span>
                <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-violet-400" />
                </div>
              </div>
              <div className="text-3xl font-bold text-white mb-1">
                {formatNumber(stats.subscriptionStats.paidUsers)}
              </div>
              <div className="flex items-center gap-1 text-sm">
                <span className="text-violet-400">
                  {stats.subscriptionStats.conversionRate}%
                </span>
                <span className="text-slate-500">conversion rate</span>
              </div>
            </CardContent>
          </Card>

          {/* Total Posts */}
          <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700/50 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <CardContent className="pt-6 relative">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm font-medium">
                  Total Posts
                </span>
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-amber-400" />
                </div>
              </div>
              <div className="text-3xl font-bold text-white mb-1">
                {formatNumber(stats.usageStats.totalPosts)}
              </div>
              <div className="flex items-center gap-1 text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="text-emerald-400">
                  {stats.usageStats.successRate}%
                </span>
                <span className="text-slate-500">success rate</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* User Growth Chart */}
          <Card className="bg-slate-900 border-slate-800 lg:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white">User Growth</CardTitle>
                  <CardDescription className="text-slate-400">
                    Daily signups over the last 30 days
                  </CardDescription>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-slate-400">New Users</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[200px] flex items-end gap-1">
                {stats.userStats.dailySignups.map((day, i) => (
                  <div
                    key={day.date}
                    className="flex-1 flex flex-col items-center group"
                  >
                    <div className="relative w-full">
                      <div
                        className="w-full bg-emerald-500/80 rounded-t transition-all hover:bg-emerald-400"
                        style={{
                          height: `${Math.max((day.count / maxDailySignup) * 160, 4)}px`,
                        }}
                      />
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 px-2 py-1 rounded text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                        {day.count} users
                      </div>
                    </div>
                    {i % 5 === 0 && (
                      <span className="text-[10px] text-slate-500 mt-2">
                        {formatDate(day.date)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-800">
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">
                    {stats.userStats.newUsersToday}
                  </p>
                  <p className="text-xs text-slate-400">Today</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">
                    {stats.userStats.newUsersThisWeek}
                  </p>
                  <p className="text-xs text-slate-400">This Week</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">
                    {stats.userStats.newUsersThisMonth}
                  </p>
                  <p className="text-xs text-slate-400">This Month</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">
                    {stats.userStats.newUsersLastMonth}
                  </p>
                  <p className="text-xs text-slate-400">Last Month</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Subscription Breakdown */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-white">Subscriptions</CardTitle>
              <CardDescription className="text-slate-400">
                Plan distribution
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.subscriptionStats.planBreakdown.map((plan) => {
                  const total =
                    stats.subscriptionStats.freeUsers +
                    stats.subscriptionStats.paidUsers;
                  const percentage = total > 0 ? (plan.count / total) * 100 : 0;
                  const colors: Record<string, string> = {
                    free: "bg-slate-500",
                    starter: "bg-emerald-500",
                    pro: "bg-blue-500",
                    enterprise: "bg-violet-500",
                  };
                  return (
                    <div key={plan.slug}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">
                            {plan.name}
                          </span>
                          {plan.price > 0 && (
                            <span className="text-xs text-slate-500">
                              ${plan.price}/mo
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-bold text-white">
                          {plan.count}
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2">
                        <div
                          className={`${colors[plan.slug] || "bg-slate-500"} h-2 rounded-full transition-all`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800 grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                  <p className="text-xl font-bold text-white">
                    {stats.subscriptionStats.conversionRate}%
                  </p>
                  <p className="text-xs text-slate-400">Conversion</p>
                </div>
                <div className="text-center p-3 bg-slate-800/50 rounded-lg">
                  <p className="text-xl font-bold text-white">
                    {stats.subscriptionStats.churnRate}%
                  </p>
                  <p className="text-xs text-slate-400">Churn Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Revenue & Cost Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue by Plan */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-white">Revenue by Plan</CardTitle>
              <CardDescription className="text-slate-400">
                Monthly recurring revenue breakdown
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.revenueStats.revenueByPlan.map((plan) => {
                  const percentage =
                    stats.revenueStats.mrr > 0
                      ? (plan.revenue / stats.revenueStats.mrr) * 100
                      : 0;
                  return (
                    <div key={plan.name} className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium text-white">
                            {plan.name}
                          </span>
                          <span className="text-sm font-bold text-emerald-400">
                            {formatCurrency(plan.revenue)}
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-emerald-500 to-teal-500 h-2 rounded-full"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-xs text-slate-500 w-12 text-right">
                        {percentage.toFixed(0)}%
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 p-4 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-xl border border-emerald-500/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">
                      Avg. Revenue Per User
                    </p>
                    <p className="text-2xl font-bold text-white">
                      {formatCurrency(stats.revenueStats.arpu)}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-emerald-400" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cost Tracking */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-white">Cost Tracking</CardTitle>
              <CardDescription className="text-slate-400">
                AI & Infrastructure costs (last 30 days)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stats.costTracking.totalCost > 0 ? (
                <>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="p-4 bg-slate-800/50 rounded-xl">
                      <p className="text-sm text-slate-400 mb-1">Total Cost</p>
                      <p className="text-2xl font-bold text-red-400">
                        {formatCurrency(stats.costTracking.totalCost)}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {formatNumber(stats.costTracking.apiCalls)} API calls
                      </p>
                    </div>
                    <div className="p-4 bg-slate-800/50 rounded-xl">
                      <p className="text-sm text-slate-400 mb-1">
                        Est. Monthly
                      </p>
                      <p className="text-2xl font-bold text-amber-400">
                        {formatCurrency(stats.costTracking.estimatedMonthly)}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Based on daily avg
                      </p>
                    </div>
                  </div>

                  {/* Cost by Service */}
                  <p className="text-xs text-slate-500 uppercase mb-3">
                    Cost by Service
                  </p>
                  <div className="space-y-3 mb-6">
                    {Object.entries(stats.costTracking.costByService || {}).map(
                      ([service, data]) => {
                        const serviceData = data as {
                          cost: number;
                          calls: number;
                        };
                        const percentage =
                          stats.costTracking.totalCost > 0
                            ? (serviceData.cost /
                                stats.costTracking.totalCost) *
                              100
                            : 0;
                        const serviceIcons: Record<string, any> = {
                          gemini: Brain,
                          openai: Brain,
                          anthropic: Brain,
                          firecrawl: Globe,
                          azure: Server,
                          "dall-e": Image,
                          flux: Image,
                        };
                        const ServiceIcon =
                          serviceIcons[service.toLowerCase()] || Server;
                        return (
                          <div
                            key={service}
                            className="flex items-center gap-3"
                          >
                            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
                              <ServiceIcon className="h-4 w-4 text-slate-400" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <div>
                                  <span className="text-sm text-white capitalize">
                                    {service}
                                  </span>
                                  <span className="text-xs text-slate-500 ml-2">
                                    ({formatNumber(serviceData.calls)} calls)
                                  </span>
                                </div>
                                <span className="text-sm text-slate-400">
                                  {formatCurrency(serviceData.cost)}
                                </span>
                              </div>
                              <div className="w-full bg-slate-800 rounded-full h-1.5">
                                <div
                                  className="bg-gradient-to-r from-red-500 to-orange-500 h-1.5 rounded-full"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>

                  {/* Token Usage */}
                  {(stats.costTracking.totalTokens?.input > 0 ||
                    stats.costTracking.totalTokens?.output > 0) && (
                    <div className="p-3 bg-slate-800/30 rounded-lg mb-4">
                      <p className="text-xs text-slate-500 uppercase mb-2">
                        Token Usage
                      </p>
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div>
                          <p className="text-lg font-bold text-white">
                            {formatNumber(stats.costTracking.totalTokens.input)}
                          </p>
                          <p className="text-xs text-slate-400">Input Tokens</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-white">
                            {formatNumber(
                              stats.costTracking.totalTokens.output,
                            )}
                          </p>
                          <p className="text-xs text-slate-400">
                            Output Tokens
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8">
                  <Server className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">No cost data available</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Costs will appear when using AI services
                  </p>
                </div>
              )}

              {/* Profit Margin Calculator */}
              {stats.costTracking.totalCost > 0 &&
                stats.revenueStats.mrr > 0 && (
                  <div className="mt-6 p-4 bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-xl border border-green-500/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-400">
                          Gross Profit Margin
                        </p>
                        <p className="text-2xl font-bold text-emerald-400">
                          {(
                            ((stats.revenueStats.mrr -
                              stats.costTracking.estimatedMonthly) /
                              stats.revenueStats.mrr) *
                            100
                          ).toFixed(1)}
                          %
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-400">
                          Est. Monthly Profit
                        </p>
                        <p className="text-lg font-bold text-white">
                          {formatCurrency(
                            stats.revenueStats.mrr -
                              stats.costTracking.estimatedMonthly,
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
            </CardContent>
          </Card>
        </div>

        {/* User Cost Breakdown */}
        {stats.userCostBreakdown &&
          stats.userCostBreakdown.topUsers.length > 0 && (
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white">
                      User Cost Analysis
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                      Cost breakdown per user (last 30 days) •{" "}
                      {stats.userCostBreakdown.totalTrackedUsers} users tracked
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-400">Avg Cost/User</p>
                    <p className="text-xl font-bold text-amber-400">
                      {formatCurrency(stats.userCostBreakdown.avgCostPerUser)}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-800">
                        <th className="text-left text-xs text-slate-500 uppercase py-3 px-2">
                          User
                        </th>
                        <th className="text-right text-xs text-slate-500 uppercase py-3 px-2">
                          API Calls
                        </th>
                        <th className="text-right text-xs text-slate-500 uppercase py-3 px-2">
                          Tokens
                        </th>
                        <th className="text-right text-xs text-slate-500 uppercase py-3 px-2">
                          Cost
                        </th>
                        <th className="text-right text-xs text-slate-500 uppercase py-3 px-2">
                          % of Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.userCostBreakdown.topUsers.map(
                        (user: any, index: number) => {
                          const totalCost =
                            stats.userCostBreakdown.userCosts.reduce(
                              (sum: number, u: any) => sum + u.totalCost,
                              0,
                            );
                          const percentage =
                            totalCost > 0
                              ? (user.totalCost / totalCost) * 100
                              : 0;
                          return (
                            <tr
                              key={user.userId}
                              className="border-b border-slate-800/50 hover:bg-slate-800/30"
                            >
                              <td className="py-3 px-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                                    {index + 1}
                                  </div>
                                  <div>
                                    <p
                                      className="text-sm text-white truncate max-w-[200px]"
                                      title={user.email}
                                    >
                                      {user.email}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      {Object.keys(user.services || {}).join(
                                        ", ",
                                      ) || "No services"}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="text-right py-3 px-2">
                                <span className="text-sm text-white">
                                  {formatNumber(user.apiCalls)}
                                </span>
                              </td>
                              <td className="text-right py-3 px-2">
                                <span className="text-sm text-slate-400">
                                  {formatNumber(
                                    user.tokensInput + user.tokensOutput,
                                  )}
                                </span>
                              </td>
                              <td className="text-right py-3 px-2">
                                <span className="text-sm font-medium text-amber-400">
                                  {formatCurrency(user.totalCost)}
                                </span>
                              </td>
                              <td className="text-right py-3 px-2">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-16 bg-slate-800 rounded-full h-1.5">
                                    <div
                                      className="bg-amber-500 h-1.5 rounded-full"
                                      style={{
                                        width: `${Math.min(percentage, 100)}%`,
                                      }}
                                    />
                                  </div>
                                  <span className="text-xs text-slate-400 w-12 text-right">
                                    {percentage.toFixed(1)}%
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        },
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Cost Savings Insight */}
                {stats.revenueStats.mrr > 0 &&
                  stats.costTracking.estimatedMonthly > 0 && (
                    <div className="mt-6 p-4 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-xl border border-blue-500/20">
                      <div className="flex items-center gap-3 mb-3">
                        <TrendingUp className="h-5 w-5 text-blue-400" />
                        <p className="text-sm font-medium text-white">
                          Cost Efficiency Analysis
                        </p>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                        <div>
                          <p className="text-lg font-bold text-white">
                            {formatCurrency(
                              stats.revenueStats.mrr /
                                Math.max(stats.userStats.totalUsers, 1),
                            )}
                          </p>
                          <p className="text-xs text-slate-400">Revenue/User</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-white">
                            {formatCurrency(
                              stats.userCostBreakdown.avgCostPerUser,
                            )}
                          </p>
                          <p className="text-xs text-slate-400">Cost/User</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-emerald-400">
                            {formatCurrency(
                              stats.revenueStats.mrr /
                                Math.max(stats.userStats.totalUsers, 1) -
                                stats.userCostBreakdown.avgCostPerUser,
                            )}
                          </p>
                          <p className="text-xs text-slate-400">Profit/User</p>
                        </div>
                        <div>
                          <p className="text-lg font-bold text-blue-400">
                            {(
                              stats.revenueStats.mrr /
                              Math.max(stats.userStats.totalUsers, 1) /
                              Math.max(
                                stats.userCostBreakdown.avgCostPerUser,
                                0.01,
                              )
                            ).toFixed(1)}
                            x
                          </p>
                          <p className="text-xs text-slate-400">ROI Multiple</p>
                        </div>
                      </div>
                    </div>
                  )}
              </CardContent>
            </Card>
          )}

        {/* Platform & Usage Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Platform Stats */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-white">Platform Usage</CardTitle>
              <CardDescription className="text-slate-400">
                Connections & posts by platform
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(stats.platformStats.connectionsByPlatform).map(
                  ([platform, count]) => {
                    const Icon = platformIcons[platform] || Hash;
                    const posts =
                      stats.platformStats.postsByPlatform[platform] || 0;
                    return (
                      <div
                        key={platform}
                        className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg"
                      >
                        <div
                          className={`w-10 h-10 rounded-lg ${platformColors[platform] || "bg-slate-700"} flex items-center justify-center`}
                        >
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-white capitalize">
                            {platform}
                          </p>
                          <p className="text-xs text-slate-400">
                            {count} connections
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-white">
                            {posts}
                          </p>
                          <p className="text-xs text-slate-400">posts</p>
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            </CardContent>
          </Card>

          {/* Usage Stats */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-white">Usage Overview</CardTitle>
              <CardDescription className="text-slate-400">
                Workflows, posts & connections
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-800/50 rounded-lg text-center">
                  <Workflow className="h-6 w-6 text-blue-400 mx-auto mb-2" />
                  <p className="text-xl font-bold text-white">
                    {stats.usageStats.totalWorkflows}
                  </p>
                  <p className="text-xs text-slate-400">Workflows</p>
                </div>
                <div className="p-3 bg-slate-800/50 rounded-lg text-center">
                  <Activity className="h-6 w-6 text-emerald-400 mx-auto mb-2" />
                  <p className="text-xl font-bold text-white">
                    {stats.usageStats.activeWorkflows}
                  </p>
                  <p className="text-xs text-slate-400">Active</p>
                </div>
                <div className="p-3 bg-slate-800/50 rounded-lg text-center">
                  <CheckCircle2 className="h-6 w-6 text-green-400 mx-auto mb-2" />
                  <p className="text-xl font-bold text-white">
                    {stats.usageStats.publishedPosts}
                  </p>
                  <p className="text-xs text-slate-400">Published</p>
                </div>
                <div className="p-3 bg-slate-800/50 rounded-lg text-center">
                  <Clock className="h-6 w-6 text-amber-400 mx-auto mb-2" />
                  <p className="text-xl font-bold text-white">
                    {stats.usageStats.scheduledPosts}
                  </p>
                  <p className="text-xs text-slate-400">Scheduled</p>
                </div>
                <div className="p-3 bg-slate-800/50 rounded-lg text-center">
                  <XCircle className="h-6 w-6 text-red-400 mx-auto mb-2" />
                  <p className="text-xl font-bold text-white">
                    {stats.usageStats.failedPosts}
                  </p>
                  <p className="text-xs text-slate-400">Failed</p>
                </div>
                <div className="p-3 bg-slate-800/50 rounded-lg text-center">
                  <Zap className="h-6 w-6 text-violet-400 mx-auto mb-2" />
                  <p className="text-xl font-bold text-white">
                    {stats.usageStats.totalConnections}
                  </p>
                  <p className="text-xs text-slate-400">Connections</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Credit Stats */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-white">Credit Usage</CardTitle>
              <CardDescription className="text-slate-400">
                Platform-wide credit statistics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-br from-violet-500/10 to-purple-500/10 rounded-xl border border-violet-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-400">
                      Total Credits Used
                    </span>
                    <Coins className="h-5 w-5 text-violet-400" />
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {formatNumber(stats.creditStats.totalCreditsUsed)}
                  </p>
                </div>

                <div className="p-4 bg-slate-800/50 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-400">
                      Credits Remaining
                    </span>
                    <Zap className="h-5 w-5 text-amber-400" />
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {formatNumber(stats.creditStats.totalCreditsRemaining)}
                  </p>
                </div>

                {Object.keys(stats.creditStats.transactionBreakdown).length >
                  0 && (
                  <div className="pt-4 border-t border-slate-800">
                    <p className="text-xs text-slate-500 uppercase mb-2">
                      Transaction Types (30d)
                    </p>
                    {Object.entries(stats.creditStats.transactionBreakdown).map(
                      ([type, amount]) => (
                        <div
                          key={type}
                          className="flex items-center justify-between py-1"
                        >
                          <span className="text-sm text-slate-400 capitalize">
                            {type.replace(/_/g, " ")}
                          </span>
                          <span className="text-sm font-medium text-white">
                            {formatNumber(amount)}
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Subscriptions */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-base">
                Recent Subscriptions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {stats.recentActivity.recentSubscriptions.length > 0 ? (
                  stats.recentActivity.recentSubscriptions.map((sub: any) => (
                    <div
                      key={sub.id}
                      className="flex items-center gap-3 p-2 bg-slate-800/30 rounded-lg"
                    >
                      <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center">
                        <Users className="h-4 w-4 text-violet-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm text-white truncate"
                          title={sub.user_email}
                        >
                          {sub.user_email || sub.user_id}
                        </p>
                        <p className="text-xs text-slate-400">
                          {sub.plans?.name || "Free"} •{" "}
                          {formatDateTime(sub.created_at)}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          sub.status === "active"
                            ? "border-emerald-500/50 text-emerald-400"
                            : "border-slate-600 text-slate-400"
                        }`}
                      >
                        {sub.status}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 text-center py-4">
                    No recent subscriptions
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Posts */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-base">
                Recent Posts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {stats.recentActivity.recentPosts.length > 0 ? (
                  stats.recentActivity.recentPosts.map((post: any) => {
                    const Icon = platformIcons[post.platform] || FileText;
                    return (
                      <div
                        key={post.id}
                        className="flex items-center gap-3 p-2 bg-slate-800/30 rounded-lg"
                      >
                        <div
                          className={`w-8 h-8 rounded-lg ${platformColors[post.platform] || "bg-slate-700"} flex items-center justify-center`}
                        >
                          <Icon className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-xs text-slate-400 truncate"
                            title={post.user_email}
                          >
                            {post.user_email || "Unknown"}
                          </p>
                          <p className="text-sm text-white truncate">
                            {post.content?.substring(0, 30) || "No content"}...
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            post.status === "published"
                              ? "border-emerald-500/50 text-emerald-400"
                              : post.status === "failed"
                                ? "border-red-500/50 text-red-400"
                                : "border-amber-500/50 text-amber-400"
                          }`}
                        >
                          {post.status}
                        </Badge>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-slate-500 text-center py-4">
                    No recent posts
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Workflows */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-base">
                Recent Workflows
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {stats.recentActivity.recentWorkflows.length > 0 ? (
                  stats.recentActivity.recentWorkflows.map((workflow: any) => (
                    <div
                      key={workflow.id}
                      className="flex items-center gap-3 p-2 bg-slate-800/30 rounded-lg"
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <Workflow className="h-4 w-4 text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-xs text-slate-400 truncate"
                          title={workflow.user_email}
                        >
                          {workflow.user_email || "Unknown"}
                        </p>
                        <p className="text-sm text-white truncate">
                          {workflow.name}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 text-center py-4">
                    No recent workflows
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Subscription Status Breakdown */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-white">
              Subscription Status Overview
            </CardTitle>
            <CardDescription className="text-slate-400">
              All subscription statuses across the platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {Object.entries(stats.subscriptionStats.statusBreakdown).map(
                ([status, count]) => {
                  const statusConfig: Record<
                    string,
                    { color: string; icon: any }
                  > = {
                    active: {
                      color:
                        "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
                      icon: CheckCircle2,
                    },
                    canceled: {
                      color: "text-red-400 bg-red-500/10 border-red-500/20",
                      icon: XCircle,
                    },
                    past_due: {
                      color:
                        "text-amber-400 bg-amber-500/10 border-amber-500/20",
                      icon: AlertCircle,
                    },
                    trialing: {
                      color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
                      icon: Clock,
                    },
                    paused: {
                      color:
                        "text-slate-400 bg-slate-500/10 border-slate-500/20",
                      icon: Clock,
                    },
                  };
                  const config = statusConfig[status] || statusConfig.paused;
                  const Icon = config.icon;
                  return (
                    <div
                      key={status}
                      className={`p-4 rounded-xl border ${config.color}`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="h-4 w-4" />
                        <span className="text-sm capitalize">
                          {status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="text-2xl font-bold text-white">{count}</p>
                    </div>
                  );
                },
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
