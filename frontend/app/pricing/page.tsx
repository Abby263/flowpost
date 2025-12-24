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

const creditPackages = [
  { name: "Small", credits: 50, price: 9.99, bonus: 5 },
  { name: "Growth", credits: 150, price: 24.99, bonus: 15 },
  { name: "Power", credits: 500, price: 69.99, bonus: 75 },
  { name: "Enterprise", credits: 2000, price: 199.99, bonus: 500 },
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
        <section className="py-16 px-4 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
          <div className="max-w-4xl mx-auto text-center relative">
            <h1 className="text-4xl md:text-5xl font-extrabold mb-4 text-white">
              Simple, Transparent Pricing
            </h1>
            <p className="text-lg text-slate-300 mb-8 max-w-xl mx-auto">
              Start free and scale as you grow. No hidden fees.
            </p>

            {/* Billing Toggle */}
            <div className="inline-flex items-center gap-1 p-1 bg-white/10 backdrop-blur-sm rounded-full border border-white/10">
              <button
                onClick={() => setBillingCycle("monthly")}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                  billingCycle === "monthly"
                    ? "bg-white text-slate-900"
                    : "text-white hover:bg-white/10"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle("yearly")}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                  billingCycle === "yearly"
                    ? "bg-white text-slate-900"
                    : "text-white hover:bg-white/10"
                }`}
              >
                Yearly
                <span className="bg-emerald-500 text-white text-xs px-2 py-0.5 rounded-full">
                  -17%
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* Pricing Cards */}
        <section className="px-4 py-16 -mt-8">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
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
                        ? "border-2 border-blue-500 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/20"
                        : "border border-slate-200"
                    }`}
                  >
                    {plan.popular && (
                      <div className="absolute top-0 right-0">
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                          POPULAR
                        </div>
                      </div>
                    )}

                    <CardHeader className="pb-4">
                      <div
                        className={`w-11 h-11 rounded-xl bg-gradient-to-br ${plan.gradient} flex items-center justify-center mb-3`}
                      >
                        <Icon className="h-5 w-5 text-white" />
                      </div>

                      <h3 className="text-lg font-bold text-slate-900">
                        {plan.name}
                      </h3>
                      <p className="text-sm text-slate-500">
                        {plan.description}
                      </p>

                      <div className="mt-3">
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-extrabold text-slate-900">
                            ${perMonth}
                          </span>
                          <span className="text-slate-500 text-sm">/mo</span>
                        </div>
                        {billingCycle === "yearly" && price > 0 && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            ${price} billed yearly
                          </p>
                        )}
                      </div>

                      <div className="mt-3 py-2 px-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600">AI Credits</span>
                          <span className="font-bold text-slate-900">
                            {plan.credits}/mo
                          </span>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-0">
                      <Link
                        href={
                          plan.slug === "enterprise"
                            ? "/contact"
                            : `/sign-up?plan=${plan.slug}`
                        }
                      >
                        <Button
                          className={`w-full mb-4 ${
                            plan.popular
                              ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                              : ""
                          }`}
                          variant={plan.popular ? "default" : "outline"}
                        >
                          {plan.cta}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </Link>

                      <ul className="space-y-2">
                        {plan.features.map((feature, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                            <span className="text-sm text-slate-600">
                              {feature}
                            </span>
                          </li>
                        ))}
                        {plan.limitations.map((limitation, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-slate-400"
                          >
                            <Check className="h-4 w-4 shrink-0 mt-0.5 opacity-50" />
                            <span className="text-sm">{limitation}</span>
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

        {/* Credit Packs - Simplified */}
        <section className="py-16 px-4 bg-slate-900">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
                Need More Credits?
              </h2>
              <p className="text-slate-400">
                Purchase additional credits anytime. Bonus credits never expire.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {creditPackages.map((pkg, i) => (
                <div
                  key={i}
                  className="bg-slate-800 rounded-xl p-5 border border-slate-700 hover:border-blue-500/50 transition-all group"
                >
                  <div className="text-sm text-slate-400 mb-1">{pkg.name}</div>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-2xl font-bold text-white">
                      {pkg.credits}
                    </span>
                    <span className="text-slate-400 text-sm">credits</span>
                  </div>
                  {pkg.bonus > 0 && (
                    <div className="text-emerald-400 text-xs mb-3">
                      +{pkg.bonus} bonus
                    </div>
                  )}
                  <div className="text-xl font-bold text-white mb-3">
                    ${pkg.price}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full bg-slate-700 hover:bg-slate-600 text-white"
                  >
                    Buy Now
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 text-sm font-medium mb-3">
                <HelpCircle className="h-4 w-4" />
                FAQ
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
                Common Questions
              </h2>
            </div>

            <div className="space-y-3">
              {faqs.map((faq, i) => (
                <div
                  key={i}
                  className="border border-slate-200 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                  >
                    <span className="font-medium text-slate-900 text-sm">
                      {faq.question}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 text-slate-500 transition-transform ${
                        openFaq === i ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {openFaq === i && (
                    <div className="px-5 pb-4 text-sm text-slate-600">
                      {faq.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 px-4 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              Start Growing Today
            </h2>
            <p className="text-slate-300 mb-8">
              10 free credits. No card required.
            </p>
            <Link href="/sign-up">
              <Button
                size="lg"
                className="bg-white text-slate-900 hover:bg-slate-100 font-semibold px-8"
              >
                Get Started Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="py-8 px-4 bg-slate-900 text-slate-400 text-center text-sm border-t border-slate-800">
        <p>© 2025 FlowPost. All rights reserved.</p>
      </footer>
    </div>
  );
}
