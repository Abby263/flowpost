"use client";

import { useState } from "react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Check,
  Sparkles,
  Zap,
  Crown,
  Building2,
  ArrowRight,
  ChevronDown,
} from "lucide-react";

const plans = [
  {
    name: "Free",
    slug: "free",
    icon: Sparkles,
    price: { monthly: 0, yearly: 0 },
    credits: 10,
    features: [
      "10 credits/month",
      "1 workflow",
      "1 connection",
      "Community support",
    ],
    color: "zinc",
    gradient: "from-zinc-400 to-zinc-600",
  },
  {
    name: "Starter",
    slug: "starter",
    icon: Zap,
    price: { monthly: 19, yearly: 190 },
    credits: 100,
    features: [
      "100 credits/month",
      "5 workflows",
      "3 connections",
      "Email support",
      "Analytics",
    ],
    color: "cyan",
    gradient: "from-cyan-400 to-cyan-600",
  },
  {
    name: "Pro",
    slug: "pro",
    icon: Crown,
    price: { monthly: 49, yearly: 490 },
    credits: 500,
    features: [
      "500 credits/month",
      "20 workflows",
      "10 connections",
      "Priority support",
      "Advanced analytics",
      "API access",
    ],
    color: "purple",
    gradient: "from-purple-400 to-purple-600",
    popular: true,
  },
  {
    name: "Enterprise",
    slug: "enterprise",
    icon: Building2,
    price: { monthly: 149, yearly: 1490 },
    credits: 2000,
    features: [
      "2000 credits/month",
      "Unlimited workflows",
      "Unlimited connections",
      "Dedicated support",
      "Custom integrations",
      "SLA",
    ],
    color: "pink",
    gradient: "from-pink-400 to-pink-600",
  },
];

const creditPackages = [
  { credits: 50, price: 9.99, bonus: 5 },
  { credits: 150, price: 24.99, bonus: 15 },
  { credits: 500, price: 69.99, bonus: 75 },
  { credits: 2000, price: 199.99, bonus: 500 },
];

const faqs = [
  {
    q: "What counts as a credit?",
    a: "1 workflow run = 1 credit. Only charged on success.",
  },
  {
    q: "Can I change plans?",
    a: "Yes, upgrade instantly or downgrade at cycle end.",
  },
  {
    q: "Do credits roll over?",
    a: "Subscription credits reset monthly. Purchased credits never expire.",
  },
  {
    q: "Free trial?",
    a: "10 free credits, no card required. Paid plans have 14-day trial.",
  },
];

export default function PricingPage() {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f]">
      <Navbar />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative py-20 px-4 overflow-hidden">
          {/* Background */}
          <div className="absolute inset-0">
            <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[128px]" />
            <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-cyan-500/20 rounded-full blur-[128px]" />
          </div>

          <div className="relative max-w-4xl mx-auto text-center">
            <h1 className="text-5xl md:text-6xl font-black text-white mb-4">
              Simple pricing
            </h1>
            <p className="text-xl text-zinc-400 mb-10">
              Start free. Scale when ready.
            </p>

            {/* Toggle */}
            <div className="inline-flex items-center gap-1 p-1.5 bg-white/5 backdrop-blur-sm rounded-full border border-white/10">
              <button
                onClick={() => setBilling("monthly")}
                className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${
                  billing === "monthly"
                    ? "bg-white text-black"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBilling("yearly")}
                className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${
                  billing === "yearly"
                    ? "bg-white text-black"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                Yearly
                <span className="bg-emerald-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                  -17%
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* Pricing Cards */}
        <section className="px-4 pb-24">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {plans.map((plan) => {
                const Icon = plan.icon;
                const price =
                  billing === "yearly"
                    ? Math.round(plan.price.yearly / 12)
                    : plan.price.monthly;

                return (
                  <div
                    key={plan.slug}
                    className={`relative p-6 rounded-3xl border transition-all hover:-translate-y-2 ${
                      plan.popular
                        ? "bg-gradient-to-b from-purple-500/10 to-transparent border-purple-500/50"
                        : "bg-white/5 border-white/10 hover:border-white/20"
                    }`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold px-4 py-1 rounded-full">
                          POPULAR
                        </span>
                      </div>
                    )}

                    <div
                      className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${plan.gradient} flex items-center justify-center mb-4`}
                    >
                      <Icon className="h-6 w-6 text-white" />
                    </div>

                    <h3 className="text-xl font-bold text-white mb-1">
                      {plan.name}
                    </h3>

                    <div className="flex items-baseline gap-1 mb-4">
                      <span className="text-4xl font-black text-white">
                        ${price}
                      </span>
                      <span className="text-zinc-500">/mo</span>
                    </div>

                    <div className="mb-6 py-2 px-3 bg-white/5 rounded-lg">
                      <span className="text-sm text-zinc-400">
                        {plan.credits} credits/month
                      </span>
                    </div>

                    <Link
                      href={
                        plan.slug === "enterprise"
                          ? "/contact"
                          : `/sign-up?plan=${plan.slug}`
                      }
                    >
                      <Button
                        className={`w-full mb-6 h-11 font-semibold ${
                          plan.popular
                            ? "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white"
                            : "bg-white/10 hover:bg-white/20 text-white"
                        }`}
                      >
                        {plan.slug === "enterprise"
                          ? "Contact Sales"
                          : "Get Started"}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>

                    <ul className="space-y-2">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                          <span className="text-sm text-zinc-400">
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Credit Packs */}
        <section className="py-20 px-4 border-y border-white/5">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-black text-white mb-2">
                Need more credits?
              </h2>
              <p className="text-zinc-500">One-time purchase. Never expires.</p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {creditPackages.map((pkg, i) => (
                <div
                  key={i}
                  className="group p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-cyan-500/50 transition-all hover:-translate-y-1"
                >
                  <div className="text-3xl font-black text-white mb-1">
                    {pkg.credits}
                    <span className="text-lg font-normal text-zinc-500 ml-1">
                      credits
                    </span>
                  </div>
                  {pkg.bonus > 0 && (
                    <div className="text-emerald-400 text-sm mb-4">
                      +{pkg.bonus} bonus
                    </div>
                  )}
                  <div className="text-2xl font-bold text-white mb-4">
                    ${pkg.price}
                  </div>
                  <Button
                    variant="outline"
                    className="w-full border-white/20 text-white hover:bg-white/10"
                  >
                    Buy Now
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-20 px-4">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-black text-white text-center mb-10">
              FAQ
            </h2>

            <div className="space-y-2">
              {faqs.map((faq, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-white/10 overflow-hidden"
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                  >
                    <span className="font-medium text-white">{faq.q}</span>
                    <ChevronDown
                      className={`h-5 w-5 text-zinc-500 transition-transform ${
                        openFaq === i ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {openFaq === i && (
                    <div className="px-5 pb-4 text-zinc-400">{faq.a}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 px-4 relative overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-pink-500/20 rounded-full blur-[100px]" />
          </div>

          <div className="relative max-w-2xl mx-auto text-center">
            <h2 className="text-4xl font-black text-white mb-4">
              Ready to start?
            </h2>
            <p className="text-zinc-400 mb-8">
              10 free credits. No credit card. Go.
            </p>
            <Link href="/sign-up">
              <Button
                size="lg"
                className="h-14 px-10 text-lg bg-white text-black hover:bg-zinc-100 font-bold rounded-xl"
              >
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-white/5 text-center">
        <p className="text-zinc-600 text-sm">© 2025 FlowPost</p>
      </footer>
    </div>
  );
}
