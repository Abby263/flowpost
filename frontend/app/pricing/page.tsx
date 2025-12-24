"use client";

import { useState } from "react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import Link from "next/link";
import {
  Check,
  Sparkles,
  Zap,
  Crown,
  Building2,
  ArrowRight,
  HelpCircle,
  ChevronDown,
} from "lucide-react";

const plans = [
  {
    name: "Free",
    slug: "free",
    icon: Sparkles,
    description: "Get started with FlowPost",
    price: { monthly: 0, yearly: 0 },
    credits: 10,
    features: [
      "10 AI credits/month",
      "1 workflow",
      "1 social connection",
      "Community support",
    ],
    limitations: ["Basic analytics", "FlowPost watermark"],
    cta: "Start Free",
    popular: false,
    gradient: "from-slate-500 to-slate-600",
  },
  {
    name: "Starter",
    slug: "starter",
    icon: Zap,
    description: "Perfect for creators",
    price: { monthly: 19, yearly: 190 },
    credits: 100,
    features: [
      "100 AI credits/month",
      "5 workflows",
      "3 social connections",
      "Priority email support",
      "Analytics dashboard",
      "No watermark",
    ],
    limitations: [],
    cta: "Start Trial",
    popular: false,
    gradient: "from-blue-500 to-blue-600",
  },
  {
    name: "Pro",
    slug: "pro",
    icon: Crown,
    description: "For growing businesses",
    price: { monthly: 49, yearly: 490 },
    credits: 500,
    features: [
      "500 AI credits/month",
      "20 workflows",
      "10 social connections",
      "Priority support",
      "Advanced analytics",
      "Custom branding",
      "API access",
    ],
    limitations: [],
    cta: "Start Trial",
    popular: true,
    gradient: "from-blue-600 to-indigo-600",
  },
  {
    name: "Enterprise",
    slug: "enterprise",
    icon: Building2,
    description: "For large teams",
    price: { monthly: 149, yearly: 1490 },
    credits: 2000,
    features: [
      "2000 AI credits/month",
      "Unlimited workflows",
      "Unlimited connections",
      "Dedicated support",
      "Custom integrations",
      "Team collaboration",
      "SLA guarantee",
    ],
    limitations: [],
    cta: "Contact Sales",
    popular: false,
    gradient: "from-indigo-600 to-purple-600",
  },
];

const faqs = [
  {
    question: "What counts as an AI credit?",
    answer:
      "Each workflow run uses 1 credit. Generating content ideas also uses 1 credit per generation. Credits are only charged on successful completion.",
  },
  {
    question: "Can I upgrade or downgrade anytime?",
    answer:
      "Yes! Change your plan anytime. Upgrades take effect immediately, downgrades at the end of your billing cycle.",
  },
  {
    question: "Do unused credits roll over?",
    answer:
      "Monthly subscription credits reset each cycle. Purchased credit packs and bonus credits never expire.",
  },
  {
    question: "Is there a free trial?",
    answer:
      "Yes! Start with 10 free credits. No credit card required. Paid plans include a 14-day trial.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept all major credit cards through Stripe. Enterprise customers can request invoicing.",
  },
];

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "monthly",
  );
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-10 sm:py-16 px-4 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
          <div className="max-w-4xl mx-auto text-center relative">
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold mb-3 sm:mb-4 text-white">
              Simple, Transparent Pricing
            </h1>
            <p className="text-sm sm:text-lg text-slate-300 mb-6 sm:mb-8 max-w-xl mx-auto px-2">
              Start free and scale as you grow. No hidden fees.
            </p>

            {/* Billing Toggle */}
            <div className="inline-flex items-center gap-1 p-1 bg-white/10 backdrop-blur-sm rounded-full border border-white/10">
              <button
                onClick={() => setBillingCycle("monthly")}
                className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all ${
                  billingCycle === "monthly"
                    ? "bg-white text-slate-900"
                    : "text-white hover:bg-white/10"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle("yearly")}
                className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all flex items-center gap-1 sm:gap-2 ${
                  billingCycle === "yearly"
                    ? "bg-white text-slate-900"
                    : "text-white hover:bg-white/10"
                }`}
              >
                Yearly
                <span className="bg-emerald-500 text-white text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full">
                  -17%
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* Pricing Cards */}
        <section className="px-3 sm:px-4 py-8 sm:py-16 -mt-4 sm:-mt-8">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
              {plans.map((plan) => {
                const Icon = plan.icon;
                const price =
                  billingCycle === "monthly"
                    ? plan.price.monthly
                    : plan.price.yearly;
                const perMonth =
                  billingCycle === "yearly"
                    ? Math.round(plan.price.yearly / 12)
                    : plan.price.monthly;

                return (
                  <Card
                    key={plan.slug}
                    className={`relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 bg-white ${
                      plan.popular
                        ? "border-2 border-blue-500 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/20 order-first sm:order-none"
                        : "border border-slate-200"
                    }`}
                  >
                    {plan.popular && (
                      <div className="absolute top-0 right-0">
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-1 rounded-bl-lg">
                          POPULAR
                        </div>
                      </div>
                    )}

                    <CardHeader className="pb-3 sm:pb-4 p-4 sm:p-6">
                      <div
                        className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br ${plan.gradient} flex items-center justify-center mb-2 sm:mb-3`}
                      >
                        <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                      </div>

                      <h3 className="text-base sm:text-lg font-bold text-slate-900">
                        {plan.name}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-500">
                        {plan.description}
                      </p>

                      <div className="mt-2 sm:mt-3">
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                            ${perMonth}
                          </span>
                          <span className="text-slate-500 text-xs sm:text-sm">
                            /mo
                          </span>
                        </div>
                        {billingCycle === "yearly" && price > 0 && (
                          <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5">
                            ${price} billed yearly
                          </p>
                        )}
                      </div>

                      <div className="mt-2 sm:mt-3 py-2 px-2.5 sm:px-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center justify-between text-xs sm:text-sm">
                          <span className="text-slate-600">AI Credits</span>
                          <span className="font-bold text-slate-900">
                            {plan.credits}/mo
                          </span>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-0 px-4 pb-4 sm:px-6 sm:pb-6">
                      <Link
                        href={
                          plan.slug === "enterprise"
                            ? "/contact"
                            : `/sign-up?plan=${plan.slug}`
                        }
                      >
                        <Button
                          className={`w-full mb-3 sm:mb-4 h-9 sm:h-10 text-sm ${
                            plan.popular
                              ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                              : ""
                          }`}
                          variant={plan.popular ? "default" : "outline"}
                        >
                          {plan.cta}
                          <ArrowRight className="ml-1.5 sm:ml-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                      </Link>

                      <ul className="space-y-1.5 sm:space-y-2">
                        {plan.features.map((feature, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-1.5 sm:gap-2"
                          >
                            <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-500 shrink-0 mt-0.5" />
                            <span className="text-xs sm:text-sm text-slate-600">
                              {feature}
                            </span>
                          </li>
                        ))}
                        {plan.limitations.map((limitation, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-1.5 sm:gap-2 text-slate-400"
                          >
                            <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 mt-0.5 opacity-50" />
                            <span className="text-xs sm:text-sm">
                              {limitation}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-10 sm:py-16 px-4 bg-white">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-6 sm:mb-10">
              <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-blue-50 text-blue-700 text-xs sm:text-sm font-medium mb-2 sm:mb-3">
                <HelpCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                FAQ
              </div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900">
                Common Questions
              </h2>
            </div>

            <div className="space-y-2 sm:space-y-3">
              {faqs.map((faq, i) => (
                <div
                  key={i}
                  className="border border-slate-200 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full px-4 sm:px-5 py-3 sm:py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors gap-3"
                  >
                    <span className="font-medium text-slate-900 text-xs sm:text-sm">
                      {faq.question}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 text-slate-500 transition-transform shrink-0 ${
                        openFaq === i ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {openFaq === i && (
                    <div className="px-4 sm:px-5 pb-3 sm:pb-4 text-xs sm:text-sm text-slate-600">
                      {faq.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-10 sm:py-16 px-4 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-3 sm:mb-4">
              Start Growing Today
            </h2>
            <p className="text-sm sm:text-base text-slate-300 mb-6 sm:mb-8">
              10 free credits. No card required.
            </p>
            <Link href="/sign-up">
              <Button
                size="lg"
                className="bg-white text-slate-900 hover:bg-slate-100 font-semibold px-6 sm:px-8 h-10 sm:h-11 text-sm sm:text-base"
              >
                Get Started Free
                <ArrowRight className="ml-1.5 sm:ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="py-6 sm:py-8 px-4 bg-slate-900 text-slate-400 text-center text-xs sm:text-sm border-t border-slate-800">
        <p>© 2025 FlowPost. All rights reserved.</p>
      </footer>
    </div>
  );
}
