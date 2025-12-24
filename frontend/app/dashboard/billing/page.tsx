"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Coins,
  Zap,
  Check,
  Calendar,
  ArrowUpRight,
  Sparkles,
  Crown,
  Building2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

interface CreditsData {
  credits_balance: number;
  bonus_credits: number;
  total_credits: number;
  credits_used_this_month: number;
  next_reset_at: string;
}

interface Subscription {
  id: string;
  status: string;
  billing_cycle: string;
  current_period_start: string;
  current_period_end: string;
}

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  credits_per_month: number;
  max_workflows: number;
  max_connections: number;
  features: string[];
}

const planIcons: { [key: string]: React.ElementType } = {
  free: Sparkles,
  starter: Zap,
  pro: Crown,
  enterprise: Building2,
};

export default function BillingPage() {
  const searchParams = useSearchParams();
  const [credits, setCredits] = useState<CreditsData | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpgrading, setIsUpgrading] = useState(false);

  const success = searchParams.get("success");
  const canceled = searchParams.get("canceled");

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [creditsRes, subscriptionRes, plansRes] = await Promise.all([
          fetch("/api/credits"),
          fetch("/api/subscriptions"),
          fetch("/api/plans"),
        ]);

        if (creditsRes.ok) {
          const creditsData = await creditsRes.json();
          setCredits(creditsData);
        }

        if (subscriptionRes.ok) {
          const subData = await subscriptionRes.json();
          setSubscription(subData.subscription);
          setCurrentPlan(subData.plan);
        }

        if (plansRes.ok) {
          const plansData = await plansRes.json();
          setPlans(plansData.plans || []);
        }
      } catch (error) {
        console.error("Error fetching billing data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [success]);

  const handleUpgrade = async (planSlug: string) => {
    if (planSlug === "free") return;

    setIsUpgrading(true);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_slug: planSlug,
          billing_cycle: "monthly",
        }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.error) {
        alert(data.error);
      }
    } catch (error) {
      console.error("Error creating checkout:", error);
      alert("Failed to start checkout. Please try again.");
    } finally {
      setIsUpgrading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 rounded w-48"></div>
          <div className="grid md:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <div key={i} className="h-40 bg-slate-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const PlanIcon = currentPlan
    ? planIcons[currentPlan.slug] || Sparkles
    : Sparkles;

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto">
      {/* Status Messages */}
      {success && (
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <p className="text-xs sm:text-sm text-emerald-800">
            <span className="font-medium">Payment successful!</span> Your
            account has been updated.
          </p>
        </div>
      )}
      {canceled && (
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
          <p className="text-xs sm:text-sm text-amber-800">
            Payment canceled. No charges were made.
          </p>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
          Billing
        </h1>
        <p className="text-slate-500 text-xs sm:text-sm mt-1">
          Manage your plan and credits
        </p>
      </div>

      {/* Top Section: Plan + Credits */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 mb-6 sm:mb-8">
        {/* Current Plan */}
        <Card className="border-2">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shrink-0">
                  <PlanIcon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-bold text-slate-900">
                    {currentPlan?.name || "Free"} Plan
                  </p>
                  <p className="text-xs text-slate-500">
                    {subscription?.status === "active"
                      ? `${subscription.billing_cycle} billing`
                      : "Free tier"}
                  </p>
                </div>
              </div>
              {currentPlan?.slug !== "enterprise" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUpgrade("pro")}
                  disabled={isUpgrading}
                  className="text-blue-600 border-blue-200 hover:bg-blue-50 w-full sm:w-auto"
                >
                  <ArrowUpRight className="h-3 w-3 mr-1" />
                  Upgrade
                </Button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-4 border-t">
              <div className="text-center sm:text-left">
                <p className="text-[10px] sm:text-xs text-slate-500 mb-1">
                  Credits/mo
                </p>
                <p className="font-semibold text-sm sm:text-base text-slate-900">
                  {currentPlan?.credits_per_month || 10}
                </p>
              </div>
              <div className="text-center sm:text-left">
                <p className="text-[10px] sm:text-xs text-slate-500 mb-1">
                  Workflows
                </p>
                <p className="font-semibold text-sm sm:text-base text-slate-900">
                  {currentPlan?.max_workflows === 999
                    ? "∞"
                    : currentPlan?.max_workflows || 1}
                </p>
              </div>
              <div className="text-center sm:text-left">
                <p className="text-[10px] sm:text-xs text-slate-500 mb-1">
                  Connections
                </p>
                <p className="font-semibold text-sm sm:text-base text-slate-900">
                  {currentPlan?.max_connections === 999
                    ? "∞"
                    : currentPlan?.max_connections || 1}
                </p>
              </div>
            </div>

            {subscription?.current_period_end && (
              <p className="text-xs text-slate-500 mt-4 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Renews {formatDate(subscription.current_period_end)}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Credits Balance */}
        <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-blue-700">
                <Coins className="h-5 w-5" />
                <span className="font-semibold text-sm sm:text-base">
                  Credit Balance
                </span>
              </div>
            </div>

            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-3xl sm:text-4xl font-bold text-blue-900">
                {credits?.total_credits || 0}
              </span>
              <span className="text-xs sm:text-sm text-blue-600">
                available
              </span>
            </div>

            <div className="w-full bg-blue-200 rounded-full h-2 mb-3">
              <div
                className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full transition-all"
                style={{
                  width: `${Math.min(100, ((credits?.total_credits || 0) / ((credits?.total_credits || 0) + (credits?.credits_used_this_month || 1))) * 100)}%`,
                }}
              />
            </div>

            <div className="flex flex-wrap justify-between gap-1 text-[10px] sm:text-xs text-blue-700">
              <span>Monthly: {credits?.credits_balance || 0}</span>
              <span>Bonus: {credits?.bonus_credits || 0}</span>
              <span>Used: {credits?.credits_used_this_month || 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upgrade Plans - Compact */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base sm:text-lg font-bold text-slate-900">
            All Plans
          </h2>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {plans.map((plan) => {
            const isCurrentPlan = currentPlan?.slug === plan.slug;
            const Icon = planIcons[plan.slug] || Sparkles;

            return (
              <div
                key={plan.id}
                className={`p-3 sm:p-4 rounded-xl border-2 transition-all ${
                  isCurrentPlan
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center gap-1.5 sm:gap-2 mb-2">
                  <div
                    className={`w-6 h-6 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center ${
                      isCurrentPlan ? "bg-blue-600" : "bg-slate-100"
                    }`}
                  >
                    <Icon
                      className={`h-3 w-3 sm:h-4 sm:w-4 ${
                        isCurrentPlan ? "text-white" : "text-slate-600"
                      }`}
                    />
                  </div>
                  <span className="font-semibold text-xs sm:text-sm text-slate-900 truncate">
                    {plan.name}
                  </span>
                </div>

                <div className="flex items-baseline gap-0.5 sm:gap-1 mb-1 sm:mb-2">
                  <span className="text-lg sm:text-xl font-bold text-slate-900">
                    ${plan.price_monthly}
                  </span>
                  <span className="text-[10px] sm:text-xs text-slate-500">
                    /mo
                  </span>
                </div>

                <p className="text-[10px] sm:text-xs text-slate-500 mb-2 sm:mb-3">
                  {plan.credits_per_month} credits/mo
                </p>

                {isCurrentPlan ? (
                  <div className="text-[10px] sm:text-xs font-medium text-blue-600 flex items-center gap-1">
                    <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    Current
                  </div>
                ) : plan.slug === "free" ? (
                  <span className="text-[10px] sm:text-xs text-slate-400">
                    Free tier
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleUpgrade(plan.slug)}
                    disabled={isUpgrading}
                    className="w-full h-6 sm:h-7 text-[10px] sm:text-xs"
                  >
                    {plan.slug === "enterprise" ? "Contact" : "Upgrade"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Help Link */}
      <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t text-center">
        <p className="text-xs sm:text-sm text-slate-500">
          Need help?{" "}
          <a href="#" className="text-blue-600 hover:underline">
            Contact support
          </a>{" "}
          or{" "}
          <a href="/pricing" className="text-blue-600 hover:underline">
            view full pricing
          </a>
        </p>
      </div>
    </div>
  );
}
