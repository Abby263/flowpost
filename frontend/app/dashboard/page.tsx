"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ElementType } from "react";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Circle,
  Clock,
  Coins,
  FileText,
  Lightbulb,
  Link2,
  Loader2,
  RefreshCw,
  Shield,
  Sparkles,
  Workflow,
  Zap,
} from "lucide-react";

interface Connection {
  id: string;
  platform: string;
  profile_name: string;
}

interface WorkflowSummary {
  id: string;
  name: string;
  platform: string | null;
  is_active: boolean;
  run_status?: string | null;
  created_at: string;
  posts?: { id: string; posted_at: string | null }[];
}

interface PostSummary {
  id: string;
  content: string | null;
  platform: string | null;
  status: string;
  scheduled_at: string | null;
  posted_at: string | null;
  created_at: string;
}

interface CreditsData {
  credits_balance: number;
  bonus_credits: number;
  total_credits: number;
  credits_used_this_month: number;
  next_reset_at: string | null;
}

interface DashboardData {
  connections: Connection[];
  workflows: WorkflowSummary[];
  posts: PostSummary[];
  scheduledPosts: PostSummary[];
  credits: CreditsData | null;
}

const defaultData: DashboardData = {
  connections: [],
  workflows: [],
  posts: [],
  scheduledPosts: [],
  credits: null,
};

const quickActions = [
  {
    title: "Connect account",
    description: "Add Instagram, X, or LinkedIn credentials.",
    href: "/dashboard/connections",
    icon: Shield,
  },
  {
    title: "Create workflow",
    description: "Automate a topic, cadence, and platform.",
    href: "/dashboard/workflows",
    icon: Workflow,
  },
  {
    title: "Schedule post",
    description: "Draft one-off posts with optional AI images.",
    href: "/dashboard/schedule-post",
    icon: CalendarClock,
  },
  {
    title: "Find ideas",
    description: "Turn trending topics into ready-to-use captions.",
    href: "/dashboard/content-ideas",
    icon: Lightbulb,
  },
];

async function readJson<T>(response: Response, fallback: T): Promise<T> {
  if (!response.ok) return fallback;

  try {
    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not scheduled";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatPlatform(platform: string | null) {
  if (!platform) return "Unknown";
  return platform === "twitter"
    ? "X / Twitter"
    : platform.charAt(0).toUpperCase() + platform.slice(1);
}

function metricLabel(value: number, singular: string, plural?: string) {
  return value === 1 ? singular : plural || `${singular}s`;
}

export default function DashboardPage() {
  const { user } = useUser();
  const userId = user?.id;
  const [data, setData] = useState<DashboardData>(defaultData);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const loadDashboard = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!userId) return;
      if (options?.silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setErrors([]);

      try {
        const [
          connectionsRes,
          workflowsRes,
          postsRes,
          scheduledRes,
          creditsRes,
        ] = await Promise.all([
          fetch("/api/connections"),
          fetch("/api/workflows?includePosts=true"),
          fetch("/api/posts?order=created_at&direction=desc&limit=8"),
          fetch(
            "/api/posts?status=scheduled&order=scheduled_at&direction=asc&limit=6",
          ),
          fetch("/api/credits"),
        ]);

        const nextErrors = [
          !connectionsRes.ok ? "Connections could not be loaded." : null,
          !workflowsRes.ok ? "Workflows could not be loaded." : null,
          !postsRes.ok ? "Recent posts could not be loaded." : null,
          !scheduledRes.ok ? "Publishing queue could not be loaded." : null,
          !creditsRes.ok ? "Credit balance could not be loaded." : null,
        ].filter(Boolean) as string[];

        const [
          connectionsData,
          workflowsData,
          postsData,
          scheduledData,
          credits,
        ] = await Promise.all([
          readJson<{ connections?: Connection[] }>(connectionsRes, {}),
          readJson<{ workflows?: WorkflowSummary[] }>(workflowsRes, {}),
          readJson<{ posts?: PostSummary[] }>(postsRes, {}),
          readJson<{ posts?: PostSummary[] }>(scheduledRes, {}),
          readJson<CreditsData | null>(creditsRes, null),
        ]);

        setData({
          connections: connectionsData.connections || [],
          workflows: workflowsData.workflows || [],
          posts: postsData.posts || [],
          scheduledPosts: scheduledData.posts || [],
          credits,
        });
        setErrors(nextErrors);
      } catch {
        setErrors(["Dashboard data could not be loaded."]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const insights = useMemo(() => {
    const activeWorkflows = data.workflows.filter(
      (workflow) => workflow.is_active,
    );
    const runningWorkflows = data.workflows.filter(
      (workflow) => workflow.run_status === "running",
    );
    const publishedPosts = data.posts.filter(
      (post) => post.status === "published" || post.posted_at,
    );
    const connectedPlatforms = new Set(
      data.connections.map((connection) => connection.platform),
    );
    const workflowPosts = data.workflows.reduce(
      (total, workflow) => total + (workflow.posts?.length || 0),
      0,
    );

    return {
      activeWorkflows,
      runningWorkflows,
      publishedPosts,
      connectedPlatforms,
      workflowPosts,
    };
  }, [data]);

  const setupSteps = [
    {
      title: "Connect a social account",
      complete: data.connections.length > 0,
      href: "/dashboard/connections",
    },
    {
      title: "Create your first workflow",
      complete: data.workflows.length > 0,
      href: "/dashboard/workflows",
    },
    {
      title: "Queue or publish content",
      complete:
        data.scheduledPosts.length > 0 || insights.publishedPosts.length > 0,
      href: "/dashboard/schedule-post",
    },
    {
      title: "Review performance",
      complete: data.posts.length > 0,
      href: "/dashboard/analytics",
    },
  ];
  const completedSteps = setupSteps.filter((step) => step.complete).length;
  const setupPercent = Math.round((completedSteps / setupSteps.length) * 100);

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center px-4">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] space-y-6 px-4 py-4 sm:space-y-8 sm:px-6 sm:py-6">
      <section className="overflow-hidden rounded-lg border bg-neutral-950 text-white shadow-sm">
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1.2fr_0.8fr] lg:p-8">
          <div className="space-y-5">
            <div>
              <Badge className="mb-3 border-white/15 bg-white/10 text-white hover:bg-white/10">
                Command center
              </Badge>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Keep every publishing workflow in view.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-300 sm:text-base">
                Monitor setup progress, scheduled posts, workflow runs, and AI
                credit usage from one place before moving into the detailed
                tools.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                asChild
                className="bg-white text-neutral-950 hover:bg-neutral-100"
              >
                <Link href="/dashboard/workflows">
                  <Workflow className="h-4 w-4" />
                  Build workflow
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/dashboard/content-ideas">
                  <Sparkles className="h-4 w-4" />
                  Generate ideas
                </Link>
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.06] p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-white">Setup progress</p>
                <p className="text-xs text-neutral-400">
                  {completedSteps} of {setupSteps.length} steps complete
                </p>
              </div>
              <span className="text-2xl font-semibold">{setupPercent}%</span>
            </div>
            <div className="mt-4 h-2 rounded-full bg-white/10">
              <div
                className="h-2 rounded-full bg-emerald-400 transition-all"
                style={{ width: `${setupPercent}%` }}
              />
            </div>
            <div className="mt-4 space-y-3">
              {setupSteps.map((step) => (
                <Link
                  key={step.title}
                  href={step.href}
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm transition hover:bg-white/10"
                >
                  <span className="flex items-center gap-2">
                    {step.complete ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                    ) : (
                      <Circle className="h-4 w-4 text-neutral-500" />
                    )}
                    {step.title}
                  </span>
                  <ArrowRight className="h-4 w-4 text-neutral-500" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {errors.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Some dashboard data is unavailable.</p>
              <p className="mt-1">{errors.join(" ")}</p>
            </div>
          </div>
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Link2}
          label="Connections"
          value={data.connections.length}
          detail={`${insights.connectedPlatforms.size} ${metricLabel(
            insights.connectedPlatforms.size,
            "platform",
          )}`}
        />
        <MetricCard
          icon={Workflow}
          label="Active workflows"
          value={insights.activeWorkflows.length}
          detail={`${insights.runningWorkflows.length} running now`}
        />
        <MetricCard
          icon={CalendarClock}
          label="Queued posts"
          value={data.scheduledPosts.length}
          detail={
            data.scheduledPosts[0]
              ? `Next ${formatDate(data.scheduledPosts[0].scheduled_at)}`
              : "No upcoming posts"
          }
        />
        <MetricCard
          icon={Coins}
          label="AI credits"
          value={data.credits?.total_credits ?? 0}
          detail={`${data.credits?.credits_used_this_month ?? 0} used this month`}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-lg border bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold tracking-tight">Quick actions</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Move directly into the next useful setup or publishing task.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadDashboard({ silent: true })}
              disabled={refreshing}
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group rounded-lg border bg-muted/40 p-4 transition hover:border-border hover:bg-white hover:shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-white text-neutral-900 shadow-sm">
                      <Icon className="h-4 w-4" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-neutral-900" />
                  </div>
                  <h3 className="mt-3 text-sm font-semibold">{action.title}</h3>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">
                    {action.description}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold tracking-tight">
                Publishing pipeline
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Recent posts and upcoming scheduled work.
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/analytics">
                <Activity className="h-4 w-4" />
                Analytics
              </Link>
            </Button>
          </div>

          <div className="mt-5 space-y-3">
            {[...data.scheduledPosts, ...data.posts].slice(0, 6).map((post) => (
              <div
                key={`${post.status}-${post.id}`}
                className="flex items-start justify-between gap-4 rounded-lg border bg-muted/40 p-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="bg-background text-xs">
                      {formatPlatform(post.platform)}
                    </Badge>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {formatDate(
                        post.scheduled_at || post.posted_at || post.created_at,
                      )}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm leading-5">
                    {post.content || "Post content is pending."}
                  </p>
                </div>
                <StatusBadge status={post.status} />
              </div>
            ))}

            {data.scheduledPosts.length === 0 && data.posts.length === 0 && (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">No posts yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create a workflow or schedule a post to start the pipeline.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-lg border bg-white p-4 shadow-sm sm:p-5 xl:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold tracking-tight">
                Workflow performance
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Active automations and recent output volume.
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/workflows">
                Manage
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <PipelineStat
              label="Total workflows"
              value={data.workflows.length}
              icon={Workflow}
            />
            <PipelineStat
              label="Workflow posts"
              value={insights.workflowPosts}
              icon={Zap}
            />
            <PipelineStat
              label="Published posts"
              value={insights.publishedPosts.length}
              icon={CheckCircle2}
            />
          </div>

          <div className="mt-5 space-y-3">
            {data.workflows.slice(0, 4).map((workflow) => (
              <div
                key={workflow.id}
                className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium">
                      {workflow.name}
                    </p>
                    <Badge
                      variant={workflow.is_active ? "secondary" : "outline"}
                    >
                      {workflow.is_active ? "Active" : "Paused"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatPlatform(workflow.platform)}
                    {" - "}
                    {workflow.posts?.length || 0} generated{" "}
                    {metricLabel(workflow.posts?.length || 0, "post")}
                  </p>
                </div>
                <StatusBadge status={workflow.run_status || "idle"} />
              </div>
            ))}

            {data.workflows.length === 0 && (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <Workflow className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">No workflows yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Connect an account, then create a repeatable content flow.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border bg-neutral-950 p-4 text-white shadow-sm sm:p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-300" />
            <h2 className="font-semibold tracking-tight">Recommended next</h2>
          </div>
          <div className="mt-5 space-y-4">
            <Recommendation
              complete={data.connections.length > 0}
              title="Add one publishing account"
              description="Workflows need at least one connected destination."
              href="/dashboard/connections"
            />
            <Recommendation
              complete={data.workflows.some((workflow) => workflow.is_active)}
              title="Keep an active workflow"
              description="Active workflows are ready to run on their schedule."
              href="/dashboard/workflows"
            />
            <Recommendation
              complete={(data.credits?.total_credits || 0) > 0}
              title="Maintain AI credits"
              description="Credits power generated ideas, images, and runs."
              href="/dashboard/billing"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: ElementType;
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-neutral-100 text-neutral-900">
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-2xl font-semibold">{value}</span>
      </div>
      <p className="mt-3 text-sm font-medium">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function PipelineStat({
  icon: Icon,
  label,
  value,
}: {
  icon: ElementType;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border bg-muted/40 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const isGood = ["published", "completed", "ready", "idle"].includes(
    normalized,
  );
  const isWarning = ["scheduled", "pending", "running", "starting"].includes(
    normalized,
  );
  const className = isGood
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : isWarning
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-red-200 bg-red-50 text-red-700";

  return (
    <Badge variant="outline" className={`shrink-0 capitalize ${className}`}>
      {status.replaceAll("_", " ")}
    </Badge>
  );
}

function Recommendation({
  complete,
  title,
  description,
  href,
}: {
  complete: boolean;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-white/10 bg-white/[0.06] p-3 transition hover:bg-white/[0.1]"
    >
      <div className="flex items-start gap-3">
        {complete ? (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
        ) : (
          <Circle className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
        )}
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-1 text-xs leading-5 text-neutral-400">
            {description}
          </p>
        </div>
      </div>
    </Link>
  );
}
