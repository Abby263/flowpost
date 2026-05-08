import Link from "next/link";
import type { ElementType } from "react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import {
  Activity,
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileText,
  Globe2,
  Lightbulb,
  Link2,
  LockKeyhole,
  Play,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Workflow,
} from "lucide-react";

const metrics = [
  { value: "3", label: "connected platforms" },
  { value: "10", label: "starter AI credits" },
  { value: "1", label: "command center" },
  { value: "24/7", label: "scheduled queue" },
];

const workflowRows = [
  {
    title: "AI and creator economy briefs",
    platform: "LinkedIn",
    status: "Scheduled",
    time: "Today, 4:30 PM",
    accent: "bg-amber-400",
  },
  {
    title: "Product launch visual thread",
    platform: "X / Twitter",
    status: "Draft ready",
    time: "Needs approval",
    accent: "bg-sky-400",
  },
  {
    title: "Weekly growth tactics carousel",
    platform: "Instagram",
    status: "Published",
    time: "2 hours ago",
    accent: "bg-emerald-400",
  },
];

const featureCards = [
  {
    title: "Connect social accounts",
    description:
      "Keep Instagram, X, and LinkedIn destinations organized before creating automations.",
    icon: Link2,
  },
  {
    title: "Generate content ideas",
    description:
      "Turn interests and trending topics into captions, hashtags, and creative angles.",
    icon: Lightbulb,
  },
  {
    title: "Build reusable workflows",
    description:
      "Define the platform, search query, cadence, approval mode, and content style once.",
    icon: Workflow,
  },
  {
    title: "Schedule or publish",
    description:
      "Queue manual posts or let active workflows keep a predictable content calendar.",
    icon: CalendarClock,
  },
  {
    title: "Track output",
    description:
      "Review cached analytics, publishing history, statuses, and generated workflow posts.",
    icon: BarChart3,
  },
  {
    title: "Control spend",
    description:
      "Use lightweight serverless hosting and visible AI credit balances to avoid surprise usage.",
    icon: ShieldCheck,
  },
];

const setupSteps = [
  {
    title: "Connect",
    description: "Add at least one publishing account.",
    icon: Link2,
  },
  {
    title: "Create",
    description: "Choose a topic, platform, cadence, and tone.",
    icon: Sparkles,
  },
  {
    title: "Review",
    description: "Approve generated ideas or queue manual posts.",
    icon: FileText,
  },
  {
    title: "Publish",
    description: "Monitor status, history, and analytics.",
    icon: Activity,
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <main>
        <section className="overflow-hidden border-b bg-card">
          <div className="mx-auto grid min-h-[calc(100vh-72px)] max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:py-12">
            <div className="min-w-0 space-y-8">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1.5 text-sm font-medium text-neutral-700">
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                  AI-assisted social publishing
                </div>
                <div>
                  <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">
                    FlowPost
                  </h1>
                  <p className="mt-5 max-w-xl text-base leading-7 text-neutral-600 sm:text-lg">
                    A focused command center for finding content ideas,
                    generating post drafts, scheduling publishing work, and
                    keeping AI usage visible.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="w-full sm:w-auto">
                  <Link href="/sign-up">
                    Start with 10 credits
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  <Link href="/dashboard">
                    <Play className="h-4 w-4" />
                    Open dashboard
                  </Link>
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {metrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-lg border bg-card p-3"
                  >
                    <p className="text-2xl font-semibold">{metric.value}</p>
                    <p className="mt-1 text-xs leading-4 text-neutral-500">
                      {metric.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="min-w-0 overflow-hidden rounded-lg border bg-neutral-950 p-3 shadow-2xl shadow-neutral-950/15">
              <div className="min-w-0 rounded-md border border-white/10 bg-white/[0.04]">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-white">
                      Publishing command center
                    </p>
                    <p className="text-xs text-neutral-400">
                      Live workflow and queue overview
                    </p>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
                    <span className="h-2 w-2 rounded-full bg-emerald-300" />
                    Ready
                  </div>
                </div>

                <div className="grid gap-3 p-4 lg:grid-cols-[0.88fr_1.12fr]">
                  <div className="min-w-0 space-y-3">
                    <div className="rounded-lg border border-white/10 bg-white/[0.06] p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-white">
                          Setup progress
                        </p>
                        <span className="text-xl font-semibold text-white">
                          75%
                        </span>
                      </div>
                      <div className="mt-4 h-2 rounded-full bg-white/10">
                        <div className="h-2 w-3/4 rounded-full bg-emerald-300" />
                      </div>
                      <div className="mt-4 space-y-2 text-sm text-neutral-300">
                        <PreviewCheck done label="Accounts connected" />
                        <PreviewCheck done label="Workflow created" />
                        <PreviewCheck done label="Post scheduled" />
                        <PreviewCheck label="Analytics reviewed" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <PreviewMetric label="AI credits" value="10" />
                      <PreviewMetric label="Active flows" value="4" />
                    </div>
                  </div>

                  <div className="min-w-0 space-y-3">
                    {workflowRows.map((row) => (
                      <div
                        key={row.title}
                        className="min-w-0 rounded-lg border border-white/10 bg-card p-3 text-foreground"
                      >
                        <div className="flex min-w-0 items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={`h-2.5 w-2.5 rounded-full ${row.accent}`}
                              />
                              <p className="truncate text-sm font-semibold">
                                {row.title}
                              </p>
                            </div>
                            <p className="mt-2 text-xs text-neutral-500">
                              {row.platform}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full border bg-muted/40 px-2.5 py-1 text-xs font-medium">
                            {row.status}
                          </span>
                        </div>
                        <div className="mt-3 flex items-center gap-2 text-xs text-neutral-500">
                          <Clock className="h-3.5 w-3.5" />
                          {row.time}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          className="border-b bg-muted/40 px-4 py-14 sm:px-6"
          id="features"
        >
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">
                  Product surface
                </p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                  Everything needed to keep content moving.
                </h2>
              </div>
              <p className="max-w-xl text-sm leading-6 text-neutral-600">
                FlowPost is organized around daily publishing operations:
                account setup, workflow creation, manual scheduling, content
                ideas, analytics, and credit visibility.
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featureCards.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.title}
                    className="rounded-lg border bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-5 font-semibold">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-neutral-600">
                      {feature.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-card px-4 py-14 sm:px-6" id="how-it-works">
          <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">
                Workflow
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                From idea to scheduled post without losing control.
              </h2>
              <p className="mt-4 text-sm leading-6 text-neutral-600">
                The app keeps automation explicit. Users can connect accounts,
                generate ideas, approve work, publish manually, or let active
                workflows run.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:flex-col">
                <Button asChild>
                  <Link href="/sign-up">
                    Create account
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/pricing">View pricing</Link>
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {setupSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="rounded-lg border p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-neutral-950 text-white">
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="text-sm font-semibold text-neutral-400">
                        0{index + 1}
                      </span>
                    </div>
                    <h3 className="mt-5 font-semibold">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-neutral-600">
                      {step.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border-y bg-neutral-950 px-4 py-14 text-white sm:px-6">
          <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <p className="text-sm font-semibold uppercase tracking-wider text-emerald-300">
                Operational guardrails
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                Built to stay lightweight.
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-3 lg:col-span-2">
              <Guardrail
                icon={Globe2}
                title="Vercel hosting"
                text="Serverless deployment keeps the app simple to run and scale."
              />
              <Guardrail
                icon={LockKeyhole}
                title="Clerk sign in"
                text="Authentication stays managed by Clerk instead of custom auth code."
              />
              <Guardrail
                icon={TrendingUp}
                title="Credit visibility"
                text="Users can see remaining AI credits before running more generation."
              />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t bg-card px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-foreground">
            <Sparkles className="h-4 w-4" />
            <span className="font-semibold">FlowPost</span>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link href="/pricing" className="hover:text-foreground">
              Pricing
            </Link>
            <Link href="/sign-up" className="hover:text-foreground">
              Get started
            </Link>
            <Link href="/dashboard" className="hover:text-foreground">
              Dashboard
            </Link>
          </div>
          <p>2026 FlowPost. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function PreviewCheck({
  done = false,
  label,
}: {
  done?: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {done ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-300" />
      ) : (
        <span className="h-4 w-4 rounded-full border border-neutral-500" />
      )}
      <span>{label}</span>
    </div>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.06] p-3">
      <p className="text-2xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-neutral-400">{label}</p>
    </div>
  );
}

function Guardrail({
  icon: Icon,
  title,
  text,
}: {
  icon: ElementType;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.06] p-5">
      <Icon className="h-5 w-5 text-emerald-300" />
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-neutral-400">{text}</p>
    </div>
  );
}
