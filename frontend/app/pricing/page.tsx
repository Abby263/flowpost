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
      "10 AI generations/month",
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
      "100 AI generations/month",
      "5 workflows",
      "3 social connections",
      "Priority email support",
      "Analytics dashboard",
      "No watermark",
    ],
    limitations: [],
    cta: "Start Free Trial",
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
      "500 AI generations/month",
      "20 workflows",
      "10 social connections",
      "Priority support",
      "Advanced analytics",
      "Custom branding",
      "API access",
      "Bulk scheduling",
    ],
    limitations: [],
    cta: "Start Free Trial",
    popular: true,
    gradient: "from-violet-500 to-purple-600",
  },
  {
    name: "Enterprise",
    slug: "enterprise",
    icon: Building2,
    description: "Unlimited power for teams",
    price: { monthly: 149, yearly: 1490 },
    credits: 2000,
    features: [
      "2000 AI generations/month",
      "Unlimited workflows",
      "Unlimited connections",
      "Dedicated account manager",
      "Custom integrations",
      "Team collaboration",
      "SLA guarantee",
      "Advanced security",
      "Custom AI training",
    ],
    limitations: [],
    cta: "Contact Sales",
    popular: false,
    gradient: "from-amber-500 to-orange-600",
  },
];

const creditPackages = [
  { name: "Starter Pack", credits: 50, price: 9.99, bonus: 0 },
  { name: "Growth Pack", credits: 150, price: 24.99, bonus: 15 },
  { name: "Power Pack", credits: 500, price: 69.99, bonus: 75 },
  { name: "Enterprise Pack", credits: 2000, price: 199.99, bonus: 500 },
];

const faqs = [
  {
    question: "What counts as an AI generation?",
    answer:
      "Each workflow run that uses AI to discover content, generate images, or create captions counts as one AI generation. A single workflow run typically uses 1-3 credits depending on the features used.",
  },
  {
    question: "Can I upgrade or downgrade my plan?",
    answer:
      "Yes! You can change your plan at any time. When upgrading, you'll get immediate access to the new features. When downgrading, the change takes effect at the end of your billing cycle.",
  },
  {
    question: "Do unused credits roll over?",
    answer:
      "Monthly subscription credits reset each billing cycle. However, any bonus credits or credits purchased separately never expire.",
  },
  {
    question: "Is there a free trial?",
    answer:
      "Yes! All paid plans come with a 14-day free trial. No credit card required to start. You can explore all features before committing.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept all major credit cards (Visa, MasterCard, American Express) and PayPal through our secure payment processor, Stripe.",
  },
  {
    question: "Can I cancel anytime?",
    answer:
      "Absolutely. There are no long-term contracts. Cancel anytime from your dashboard and you'll retain access until the end of your billing period.",
  },
];

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "monthly",
  );
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-50 via-white to-slate-50">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative py-20 px-4 overflow-hidden">
          {/* Background decorations */}
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob" />
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000" />
          <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000" />

          <div className="max-w-5xl mx-auto text-center relative">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-100 text-violet-700 text-sm font-medium mb-6">
              <Sparkles className="h-4 w-4" />
              Simple, transparent pricing
            </div>

            <h1 className="text-5xl md:text-6xl font-extrabold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-violet-900 to-slate-900">
              Choose Your Plan
            </h1>

            <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto">
              Start free and scale as you grow. No hidden fees, no surprises.
              Cancel anytime.
            </p>

            {/* Billing Toggle */}
            <div className="inline-flex items-center gap-4 p-1.5 bg-slate-100 rounded-full mb-12">
              <button
                onClick={() => setBillingCycle("monthly")}
                className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all ${
                  billingCycle === "monthly"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle("yearly")}
                className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                  billingCycle === "yearly"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Yearly
                <span className="bg-gradient-to-r from-emerald-500 to-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                  Save 17%
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* Pricing Cards */}
        <section className="px-4 pb-20 -mt-4">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                    className={`relative overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 ${
                      plan.popular
                        ? "border-2 border-violet-500 shadow-xl shadow-violet-500/10"
                        : "border border-slate-200"
                    }`}
                  >
                    {plan.popular && (
                      <div className="absolute top-0 right-0">
                        <div className="bg-gradient-to-r from-violet-500 to-purple-600 text-white text-xs font-bold px-4 py-1 rounded-bl-lg">
                          MOST POPULAR
                        </div>
                      </div>
                    )}

                    <CardHeader className="pb-4">
                      <div
                        className={`w-12 h-12 rounded-xl bg-gradient-to-br ${plan.gradient} flex items-center justify-center mb-4`}
                      >
                        <Icon className="h-6 w-6 text-white" />
                      </div>

                      <h3 className="text-xl font-bold text-slate-900">
                        {plan.name}
                      </h3>
                      <p className="text-sm text-slate-500">
                        {plan.description}
                      </p>

                      <div className="mt-4">
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-extrabold text-slate-900">
                            ${perMonth}
                          </span>
                          <span className="text-slate-500">/month</span>
                        </div>
                        {billingCycle === "yearly" && price > 0 && (
                          <p className="text-sm text-slate-500 mt-1">
                            ${price} billed yearly
                          </p>
                        )}
                      </div>

                      <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-600">
                            AI Credits
                          </span>
                          <span className="text-lg font-bold text-slate-900">
                            {plan.credits.toLocaleString()}/mo
                          </span>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent>
                      <Link
                        href={
                          plan.slug === "enterprise"
                            ? "/contact"
                            : `/sign-up?plan=${plan.slug}`
                        }
                      >
                        <Button
                          className={`w-full mb-6 ${
                            plan.popular
                              ? "bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
                              : ""
                          }`}
                          variant={plan.popular ? "default" : "outline"}
                        >
                          {plan.cta}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </Link>

                      <ul className="space-y-3">
                        {plan.features.map((feature, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <Check className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                            <span className="text-sm text-slate-600">
                              {feature}
                            </span>
                          </li>
                        ))}
                        {plan.limitations.map((limitation, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-3 text-slate-400"
                          >
                            <Check className="h-5 w-5 shrink-0 mt-0.5 opacity-50" />
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

        {/* Credit Packs Section */}
        <section className="py-20 px-4 bg-slate-900 text-white">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Need More Credits?
              </h2>
              <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                Running a big campaign? Purchase additional credits anytime.
                Bonus credits never expire!
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {creditPackages.map((pkg, i) => (
                <Card
                  key={i}
                  className="bg-slate-800 border-slate-700 hover:border-violet-500/50 transition-all"
                >
                  <CardContent className="pt-6">
                    <h3 className="text-lg font-semibold text-white mb-2">
                      {pkg.name}
                    </h3>
                    <div className="flex items-baseline gap-2 mb-4">
                      <span className="text-3xl font-bold text-white">
                        {pkg.credits}
                      </span>
                      <span className="text-slate-400">credits</span>
                    </div>
                    {pkg.bonus > 0 && (
                      <div className="bg-emerald-500/20 text-emerald-400 text-sm px-3 py-1 rounded-full inline-block mb-4">
                        +{pkg.bonus} bonus credits
                      </div>
                    )}
                    <div className="text-2xl font-bold text-white mb-4">
                      ${pkg.price}
                    </div>
                    <Button
                      variant="secondary"
                      className="w-full bg-slate-700 hover:bg-slate-600 text-white"
                    >
                      Buy Now
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-20 px-4">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 text-blue-700 text-sm font-medium mb-4">
                <HelpCircle className="h-4 w-4" />
                FAQs
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                Frequently Asked Questions
              </h2>
              <p className="text-lg text-slate-600">
                Everything you need to know about FlowPost pricing
              </p>
            </div>

            <div className="space-y-4">
              {faqs.map((faq, i) => (
                <div
                  key={i}
                  className="border border-slate-200 rounded-xl overflow-hidden"
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                  >
                    <span className="font-medium text-slate-900">
                      {faq.question}
                    </span>
                    <ChevronDown
                      className={`h-5 w-5 text-slate-500 transition-transform ${
                        openFaq === i ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {openFaq === i && (
                    <div className="px-6 pb-4 text-slate-600">{faq.answer}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-4 bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 text-white">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Ready to Automate Your Social Media?
            </h2>
            <p className="text-xl mb-10 opacity-90">
              Start with 10 free credits. No credit card required.
            </p>
            <div className="flex justify-center gap-4 flex-wrap">
              <Link href="/sign-up">
                <Button
                  size="lg"
                  className="text-lg px-10 h-14 bg-white text-violet-700 hover:bg-slate-100"
                >
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/contact">
                <Button
                  size="lg"
                  variant="outline"
                  className="text-lg px-10 h-14 border-2 border-white/30 text-white hover:bg-white/10"
                >
                  Talk to Sales
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-8 px-4 bg-slate-900 text-slate-400 text-center text-sm">
        <p>© 2024 FlowPost. All rights reserved.</p>
      </footer>
    </div>
  );
}
