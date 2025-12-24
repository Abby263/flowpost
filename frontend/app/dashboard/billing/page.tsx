"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Coins,
  Zap,
  Check,
  CreditCard,
  Calendar,
  TrendingUp,
  Package,
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

const creditPackages = [
  { id: "1", name: "Starter Pack", credits: 50, price: 9.99, bonus: 0 },
  { id: "2", name: "Growth Pack", credits: 150, price: 24.99, bonus: 15 },
  { id: "3", name: "Power Pack", credits: 500, price: 69.99, bonus: 75 },
  {
    id: "4",
    name: "Enterprise Pack",
    credits: 2000,
    price: 199.99,
    bonus: 500,
  },
];

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
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "monthly",
  );
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState<string | null>(null);

  const success = searchParams.get("success");
  const canceled = searchParams.get("canceled");

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch credits, subscription, and plans in parallel
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
          billing_cycle: billingCycle,
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

  const handleBuyCredits = async (packageId: string) => {
    setIsPurchasing(packageId);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credit_package_id: packageId,
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
      setIsPurchasing(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 rounded w-48"></div>
          <div className="grid md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-slate-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Success/Cancel Messages */}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          <div>
            <p className="font-medium text-green-800">Payment Successful!</p>
            <p className="text-sm text-green-600">
              Your account has been updated. Thank you for your purchase!
            </p>
          </div>
        </div>
      )}
      {canceled && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600" />
          <div>
            <p className="font-medium text-amber-800">Payment Canceled</p>
            <p className="text-sm text-amber-600">
              Your payment was canceled. No charges were made.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Billing & Usage</h1>
        <p className="text-slate-600 mt-1">
          Manage your subscription and credits
        </p>
      </div>

      {/* Current Plan & Credits Overview */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {/* Current Plan Card */}
        <Card className="border-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Current Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 mb-3">
              {currentPlan && planIcons[currentPlan.slug] && (
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                  {(() => {
                    const Icon = planIcons[currentPlan.slug];
                    return <Icon className="h-5 w-5 text-white" />;
                  })()}
                </div>
              )}
              <div>
                <p className="text-xl font-bold text-slate-900">
                  {currentPlan?.name || "Free"}
                </p>
                <p className="text-sm text-slate-500">
                  {subscription?.status === "active"
                    ? `${subscription.billing_cycle} billing`
                    : "Free tier"}
                </p>
              </div>
            </div>
            {subscription?.current_period_end && (
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Renews {formatDate(subscription.current_period_end)}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Credits Balance Card */}
        <Card className="border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-purple-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-violet-600 flex items-center gap-2">
              <Coins className="h-4 w-4" />
              Credits Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-4xl font-bold text-violet-900">
                {credits?.total_credits || 0}
              </span>
              <span className="text-sm text-violet-600">credits</span>
            </div>
            <div className="space-y-1 text-xs text-violet-600">
              <p>Monthly: {credits?.credits_balance || 0}</p>
              <p>Bonus: {credits?.bonus_credits || 0}</p>
            </div>
          </CardContent>
        </Card>

        {/* Usage This Month Card */}
        <Card className="border-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Usage This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-4xl font-bold text-slate-900">
                {credits?.credits_used_this_month || 0}
              </span>
              <span className="text-sm text-slate-500">credits used</span>
            </div>
            {credits?.next_reset_at && (
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Resets {formatDate(credits.next_reset_at)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Buy More Credits Section */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Buy More Credits
            </h2>
            <p className="text-sm text-slate-600">
              One-time purchase. Bonus credits never expire!
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {creditPackages.map((pkg) => (
            <Card
              key={pkg.id}
              className="hover:shadow-lg transition-all border-2 hover:border-violet-300"
            >
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="h-5 w-5 text-violet-600" />
                  <h3 className="font-semibold text-slate-900">{pkg.name}</h3>
                </div>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-3xl font-bold text-slate-900">
                    {pkg.credits}
                  </span>
                  <span className="text-slate-500">credits</span>
                </div>
                {pkg.bonus > 0 && (
                  <div className="inline-block bg-emerald-100 text-emerald-700 text-xs font-medium px-2 py-1 rounded-full mb-3">
                    +{pkg.bonus} bonus
                  </div>
                )}
                <div className="text-2xl font-bold text-slate-900 mb-4">
                  ${pkg.price}
                </div>
                <Button
                  onClick={() => handleBuyCredits(pkg.id)}
                  disabled={isPurchasing === pkg.id}
                  className="w-full bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
                >
                  {isPurchasing === pkg.id ? "Processing..." : "Buy Now"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Upgrade Plan Section */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Subscription Plans
            </h2>
            <p className="text-sm text-slate-600">
              Upgrade for more credits and features
            </p>
          </div>
          <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-full">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                billingCycle === "monthly"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1 ${
                billingCycle === "yearly"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600"
              }`}
            >
              Yearly
              <span className="bg-emerald-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                -17%
              </span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((plan) => {
            const isCurrentPlan = currentPlan?.slug === plan.slug;
            const Icon = planIcons[plan.slug] || Sparkles;
            const price =
              billingCycle === "monthly"
                ? plan.price_monthly
                : plan.price_yearly;
            const monthlyPrice =
              billingCycle === "yearly"
                ? Math.round(plan.price_yearly / 12)
                : plan.price_monthly;

            return (
              <Card
                key={plan.id}
                className={`relative transition-all ${
                  isCurrentPlan
                    ? "border-2 border-violet-500 shadow-lg shadow-violet-500/10"
                    : "border hover:shadow-lg hover:border-slate-300"
                }`}
              >
                {isCurrentPlan && (
                  <div className="absolute -top-3 left-4 bg-violet-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                    CURRENT PLAN
                  </div>
                )}
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    <h3 className="font-bold text-slate-900">{plan.name}</h3>
                  </div>
                  <p className="text-sm text-slate-500 mb-4">
                    {plan.description}
                  </p>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-3xl font-bold text-slate-900">
                      ${monthlyPrice}
                    </span>
                    <span className="text-slate-500">/mo</span>
                  </div>
                  {billingCycle === "yearly" && price > 0 && (
                    <p className="text-xs text-slate-500 mb-4">
                      ${price} billed yearly
                    </p>
                  )}
                  <div className="bg-slate-50 rounded-lg p-3 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">
                        Credits/month
                      </span>
                      <span className="font-bold text-slate-900">
                        {plan.credits_per_month.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleUpgrade(plan.slug)}
                    disabled={
                      isCurrentPlan || isUpgrading || plan.slug === "free"
                    }
                    variant={isCurrentPlan ? "outline" : "default"}
                    className={`w-full ${
                      !isCurrentPlan && plan.slug !== "free"
                        ? "bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
                        : ""
                    }`}
                  >
                    {isCurrentPlan ? (
                      <>
                        <Check className="h-4 w-4 mr-1" />
                        Current Plan
                      </>
                    ) : plan.slug === "free" ? (
                      "Free"
                    ) : (
                      <>
                        Upgrade
                        <ArrowUpRight className="h-4 w-4 ml-1" />
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Help Section */}
      <div className="mt-12 p-6 bg-slate-50 rounded-xl border">
        <h3 className="font-semibold text-slate-900 mb-2">Need Help?</h3>
        <p className="text-sm text-slate-600 mb-4">
          Have questions about billing or need to cancel your subscription?
        </p>
        <div className="flex gap-3">
          <Button variant="outline" size="sm">
            Contact Support
          </Button>
          <Button variant="ghost" size="sm">
            View FAQ
          </Button>
        </div>
      </div>
    </div>
  );
}
