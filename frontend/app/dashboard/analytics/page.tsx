"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Instagram,
  Twitter,
  Linkedin,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ExternalLink,
  FileText,
  ImageIcon,
  TrendingUp,
  Sparkles,
  CalendarClock,
  Workflow,
  Lightbulb,
  Zap,
} from "lucide-react";

interface Post {
  id: string;
  content: string;
  platform: string;
  status: string;
  image_url?: string;
  published_url?: string;
  posted_at?: string;
  scheduled_at?: string;
  created_at: string;
  connection_id: string;
  user_id: string;
  source?: string; // workflow, manual, trending, ai-generated
  like_count?: number;
  comment_count?: number;
  share_count?: number;
  impression_count?: number;
  reach_count?: number;
  save_count?: number;
  profile_visits?: number;
  link_clicks?: number;
  follower_delta?: number;
}

const platformIcons: Record<string, any> = {
  instagram: Instagram,
  twitter: Twitter,
  linkedin: Linkedin,
};

const platformColors: Record<string, string> = {
  instagram: "bg-gradient-to-r from-purple-500 to-pink-500",
  twitter: "bg-blue-500",
  linkedin: "bg-blue-700",
};

const statusColors: Record<string, string> = {
  published: "bg-green-100 text-green-800 border-green-300",
  scheduled: "bg-blue-100 text-blue-800 border-blue-300",
  failed: "bg-red-100 text-red-800 border-red-300",
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  posting: "bg-purple-100 text-purple-800 border-purple-300",
};

interface Connection {
  id: string;
  platform: string;
  profile_name: string;
}

export default function AnalyticsPage() {
  const { user } = useUser();
  const [posts, setPosts] = useState<Post[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<Post[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Account filter
  const [accountFilter, setAccountFilter] = useState<string>("all");

  useEffect(() => {
    if (user) {
      fetchPosts();
      fetchConnections();
    }
  }, [user]);

  useEffect(() => {
    applyFilters();
  }, [posts, accountFilter]);

  const fetchPosts = async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    }
    try {
      const res = await fetch("/api/posts");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch posts");
      }
      setPosts(data.posts || []);
      setLastUpdated(new Date().toISOString());
    } catch (error) {
      console.error("Error fetching posts:", error);
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  };

  const fetchConnections = async () => {
    try {
      const res = await fetch("/api/connections");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch connections");
      }
      setConnections(data.connections || []);
    } catch (error) {
      console.error("Error fetching connections:", error);
    }
  };

  const applyFilters = () => {
    let filtered = [...posts];

    if (accountFilter !== "all") {
      filtered = filtered.filter(
        (post) => post.connection_id === accountFilter,
      );
    }

    setFilteredPosts(filtered);
  };

  const openPostDetails = (post: Post) => {
    setSelectedPost(post);
    setDetailsDialogOpen(true);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCompactNumber = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  };

  const formatPercent = (value: number | null) => {
    if (value === null || Number.isNaN(value)) return "N/A";
    return `${value.toFixed(1)}%`;
  };

  const formatSignedCompactNumber = (value: number) => {
    if (value === 0) return "0";
    const sign = value > 0 ? "+" : "-";
    return `${sign}${formatCompactNumber(Math.abs(value))}`;
  };

  const formatDuration = (minutes: number | null) => {
    if (minutes === null || Number.isNaN(minutes)) return "N/A";
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    return `${hours}h ${remainingMinutes}m`;
  };

  const getPostSource = (post: Post) => {
    if (post.source) return post.source;
    // Try to infer from other fields if source not set
    if (post.scheduled_at && !post.posted_at) return "scheduled";
    return "manual";
  };

  const getAccountLabel = (connectionId?: string) => {
    if (!connectionId) return "Unknown account";
    const connection = connections.find((conn) => conn.id === connectionId);
    return connection?.profile_name
      ? `@${connection.profile_name}`
      : "Unknown account";
  };

  const getEngagementScore = (post: Post) => {
    return (
      (post.like_count || 0) +
      (post.comment_count || 0) +
      (post.share_count || 0) +
      (post.save_count || 0)
    );
  };

  const getDateKey = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate())
      .toISOString()
      .slice(0, 10);
  };

  const getBestDayLabel = (dayIndex: number) => {
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dayIndex] || "N/A";
  };

  const getBestHourLabel = (hour: number) => {
    const date = new Date();
    date.setHours(hour, 0, 0, 0);
    return date.toLocaleString("en-US", { hour: "numeric", hour12: true });
  };

  const sourceLabels: Record<
    string,
    { label: string; icon: any; color: string }
  > = {
    workflow: {
      label: "Workflow",
      icon: TrendingUp,
      color: "bg-blue-50 text-blue-700 border-blue-200",
    },
    manual: {
      label: "Manual",
      icon: FileText,
      color: "bg-gray-50 text-gray-700 border-gray-200",
    },
    trending: {
      label: "Trending Content",
      icon: TrendingUp,
      color: "bg-amber-50 text-amber-700 border-amber-200",
    },
    "ai-generated": {
      label: "AI Generated",
      icon: Sparkles,
      color: "bg-purple-50 text-purple-700 border-purple-200",
    },
    scheduled: {
      label: "Scheduled",
      icon: CalendarClock,
      color: "bg-indigo-50 text-indigo-700 border-indigo-200",
    },
  };

  // Calculate comprehensive stats
  const stats = {
    total: filteredPosts.length,
    published: filteredPosts.filter((p) => p.status === "published").length,
    scheduled: filteredPosts.filter((p) => p.status === "scheduled").length,
    failed: filteredPosts.filter((p) => p.status === "failed").length,
    // Source breakdown
    workflow: filteredPosts.filter((p) => p.source === "workflow").length,
    manual: filteredPosts.filter((p) => (p.source || "manual") === "manual")
      .length,
    trending: filteredPosts.filter((p) => p.source === "trending").length,
    aiGenerated: filteredPosts.filter((p) => p.source === "ai-generated")
      .length,
    // Platform breakdown
    instagram: filteredPosts.filter((p) => p.platform === "instagram").length,
    twitter: filteredPosts.filter((p) => p.platform === "twitter").length,
    linkedin: filteredPosts.filter((p) => p.platform === "linkedin").length,
  };

  const publishedPosts = filteredPosts.filter(
    (post) => post.status === "published" && post.posted_at,
  );
  const engagementSourcePosts = filteredPosts.filter(
    (post) => post.status === "published",
  );
  const engagementTotals = engagementSourcePosts.reduce(
    (acc, post) => {
      acc.likes += post.like_count || 0;
      acc.comments += post.comment_count || 0;
      acc.shares += post.share_count || 0;
      acc.saves += post.save_count || 0;
      acc.impressions += post.impression_count || 0;
      acc.reach += post.reach_count || 0;
      acc.profileVisits += post.profile_visits || 0;
      acc.linkClicks += post.link_clicks || 0;
      acc.followerDelta += post.follower_delta || 0;
      return acc;
    },
    {
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      impressions: 0,
      reach: 0,
      profileVisits: 0,
      linkClicks: 0,
      followerDelta: 0,
    },
  );

  const totalEngagements =
    engagementTotals.likes +
    engagementTotals.comments +
    engagementTotals.shares +
    engagementTotals.saves;

  const engagementRate =
    engagementTotals.impressions > 0
      ? (totalEngagements / engagementTotals.impressions) * 100
      : null;

  // Calculate success rate
  const totalAttempts = stats.published + stats.failed;
  const successRate =
    totalAttempts > 0
      ? ((stats.published / totalAttempts) * 100).toFixed(1)
      : "0";
  const failureRate =
    totalAttempts > 0 ? ((stats.failed / totalAttempts) * 100).toFixed(1) : "0";

  // Calculate AI vs Manual ratio
  const aiPosts = stats.aiGenerated + stats.workflow;
  const aiPercentage =
    stats.total > 0 ? ((aiPosts / stats.total) * 100).toFixed(1) : "0";

  const now = new Date();
  const last7Days = new Date();
  last7Days.setDate(now.getDate() - 6);
  last7Days.setHours(0, 0, 0, 0);
  const last28Days = new Date();
  last28Days.setDate(now.getDate() - 27);
  last28Days.setHours(0, 0, 0, 0);

  const postsLast7Days = publishedPosts.filter((post) => {
    if (!post.posted_at) return false;
    return new Date(post.posted_at) >= last7Days;
  }).length;

  const postsLast28Days = publishedPosts.filter((post) => {
    if (!post.posted_at) return false;
    return new Date(post.posted_at) >= last28Days;
  }).length;

  const avgPostsPerWeek = postsLast28Days > 0 ? postsLast28Days / 4 : 0;

  const uniquePostDays = new Set(
    publishedPosts.map((post) =>
      getDateKey(new Date(post.posted_at as string)),
    ),
  );
  let postingStreak = 0;
  const streakCursor = new Date();
  while (uniquePostDays.has(getDateKey(streakCursor))) {
    postingStreak += 1;
    streakCursor.setDate(streakCursor.getDate() - 1);
  }

  const dayScores = new Map<number, number>();
  const hourScores = new Map<number, number>();
  const useEngagementWeights = totalEngagements > 0;

  publishedPosts.forEach((post) => {
    if (!post.posted_at) return;
    const date = new Date(post.posted_at);
    const weight = useEngagementWeights ? getEngagementScore(post) : 1;
    const day = date.getDay();
    const hour = date.getHours();
    dayScores.set(day, (dayScores.get(day) || 0) + weight);
    hourScores.set(hour, (hourScores.get(hour) || 0) + weight);
  });

  const bestDayEntry = Array.from(dayScores.entries()).sort(
    (a, b) => b[1] - a[1],
  )[0];
  const bestHourEntry = Array.from(hourScores.entries()).sort(
    (a, b) => b[1] - a[1],
  )[0];

  const bestDay = bestDayEntry ? getBestDayLabel(bestDayEntry[0]) : "N/A";
  const bestHour = bestHourEntry ? getBestHourLabel(bestHourEntry[0]) : "N/A";

  const scheduledPublished = filteredPosts.filter(
    (post) => post.scheduled_at && post.posted_at,
  );
  const avgPublishDelayMinutes =
    scheduledPublished.length > 0
      ? scheduledPublished.reduce((acc, post) => {
          const scheduledAt = new Date(post.scheduled_at as string).getTime();
          const postedAt = new Date(post.posted_at as string).getTime();
          return acc + Math.max(0, postedAt - scheduledAt);
        }, 0) /
        scheduledPublished.length /
        60000
      : null;

  const topPosts = [...filteredPosts]
    .filter((post) => post.status === "published")
    .sort((a, b) => {
      const engagementDiff = getEngagementScore(b) - getEngagementScore(a);
      if (engagementDiff !== 0) return engagementDiff;
      const dateA = a.posted_at ? new Date(a.posted_at).getTime() : 0;
      const dateB = b.posted_at ? new Date(b.posted_at).getTime() : 0;
      return dateB - dateA;
    })
    .slice(0, 5);

  return (
    <div className="space-y-6 px-6 py-6 max-w-[1600px]">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            Analytics
          </h1>
          <p className="text-muted-foreground mt-2">
            Track performance, engagement, and insights across all your social
            media posts.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-[220px]">
            <Select value={accountFilter} onValueChange={setAccountFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Accounts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Accounts</SelectItem>
                {connections.map((conn) => (
                  <SelectItem key={conn.id} value={conn.id}>
                    <span className="flex items-center gap-2">
                      {conn.platform === "instagram" && (
                        <Instagram className="h-3 w-3" />
                      )}
                      {conn.platform === "twitter" && (
                        <Twitter className="h-3 w-3" />
                      )}
                      {conn.platform === "linkedin" && (
                        <Linkedin className="h-3 w-3" />
                      )}
                      @{conn.profile_name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div>Last updated</div>
            <div className="font-medium text-foreground">
              {lastUpdated ? formatDate(lastUpdated) : "Never"}
            </div>
          </div>
          <Button
            onClick={() => {
              fetchPosts();
              fetchConnections();
            }}
            variant="outline"
            disabled={loading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Row 1: Status Overview */}
        <Card className="border-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Total Posts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all platforms
            </p>
          </CardContent>
        </Card>
        <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-green-700 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Published
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-700">
              {stats.published}
            </div>
            <p className="text-xs text-green-600 mt-1">
              {successRate}% success rate
            </p>
          </CardContent>
        </Card>
        <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-blue-700 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Scheduled
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-700">
              {stats.scheduled}
            </div>
            <p className="text-xs text-blue-600 mt-1">Pending publication</p>
          </CardContent>
        </Card>
        <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-purple-700 flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              AI-Powered
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-700">{aiPosts}</div>
            <p className="text-xs text-purple-600 mt-1">
              {aiPercentage}% of all posts
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Engagement Overview */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Engagement Overview</h2>
          <span className="text-xs text-muted-foreground">
            Metrics populate when platform insights are available
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-700">
                Impressions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">
                {formatCompactNumber(engagementTotals.impressions)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Total impressions
              </p>
            </CardContent>
          </Card>
          <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-indigo-700">
                Reach
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-indigo-700">
                {formatCompactNumber(engagementTotals.reach)}
              </div>
              <p className="text-xs text-indigo-600 mt-1">Unique viewers</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-emerald-700">
                Engagements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-700">
                {formatCompactNumber(totalEngagements)}
              </div>
              <p className="text-xs text-emerald-600 mt-1">
                Likes, comments, shares, saves
              </p>
            </CardContent>
          </Card>
          <Card className="border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-amber-700">
                Engagement Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-700">
                {formatPercent(engagementRate)}
              </div>
              <p className="text-xs text-amber-600 mt-1">
                Engagements per impression
              </p>
            </CardContent>
          </Card>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Likes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold">
                {formatCompactNumber(engagementTotals.likes)}
              </div>
            </CardContent>
          </Card>
          <Card className="border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Comments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold">
                {formatCompactNumber(engagementTotals.comments)}
              </div>
            </CardContent>
          </Card>
          <Card className="border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Shares
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold">
                {formatCompactNumber(engagementTotals.shares)}
              </div>
            </CardContent>
          </Card>
          <Card className="border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Saves
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold">
                {formatCompactNumber(engagementTotals.saves)}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Growth & Audience */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Growth Signals</h2>
          <span className="text-xs text-muted-foreground">
            Audience and discovery trends
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-blue-700">
                Follower Change
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${engagementTotals.followerDelta >= 0 ? "text-blue-700" : "text-red-600"}`}
              >
                {formatSignedCompactNumber(engagementTotals.followerDelta)}
              </div>
              <p className="text-xs text-blue-600 mt-1">Net change</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-purple-700">
                Profile Visits
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-700">
                {formatCompactNumber(engagementTotals.profileVisits)}
              </div>
              <p className="text-xs text-purple-600 mt-1">Profile views</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-pink-200 bg-gradient-to-br from-pink-50 to-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-pink-700">
                Link Clicks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-pink-700">
                {formatCompactNumber(engagementTotals.linkClicks)}
              </div>
              <p className="text-xs text-pink-600 mt-1">Outbound traffic</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Cadence & Reliability */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Cadence & Reliability</h2>
          <span className="text-xs text-muted-foreground">
            Consistency, timing, and delivery
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Posts (7 days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold">
                {formatCompactNumber(postsLast7Days)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Last 7 days</p>
            </CardContent>
          </Card>
          <Card className="border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg Posts / Week
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold">
                {avgPostsPerWeek.toFixed(1)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Last 4 weeks</p>
            </CardContent>
          </Card>
          <Card className="border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Posting Streak
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold">{postingStreak} days</div>
              <p className="text-xs text-muted-foreground mt-1">
                Consecutive days
              </p>
            </CardContent>
          </Card>
          <Card className="border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Best Window
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold">{bestDay}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {bestHour} peak
              </p>
            </CardContent>
          </Card>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Failure Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold">{failureRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                Failed vs published
              </p>
            </CardContent>
          </Card>
          <Card className="border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg Publish Delay
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold">
                {formatDuration(avgPublishDelayMinutes)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Scheduled to published
              </p>
            </CardContent>
          </Card>
          <Card className="border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Published vs Scheduled
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-semibold">
                {stats.published} / {stats.scheduled}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Delivered ratio
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Detailed Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Source Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Post Sources
            </CardTitle>
            <CardDescription>How your content is being created</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-100">
              <div className="flex items-center gap-2">
                <Workflow className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Workflow</span>
              </div>
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                {stats.workflow}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-purple-50 border border-purple-100">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium">AI Generated</span>
              </div>
              <Badge
                variant="secondary"
                className="bg-purple-100 text-purple-700"
              >
                {stats.aiGenerated}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-100">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium">Trending Content</span>
              </div>
              <Badge
                variant="secondary"
                className="bg-amber-100 text-amber-700"
              >
                {stats.trending}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium">Manual</span>
              </div>
              <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                {stats.manual}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Platform Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-indigo-600" />
              Platform Distribution
            </CardTitle>
            <CardDescription>Where you're posting</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-100">
              <div className="flex items-center gap-2">
                <Instagram className="h-4 w-4 text-purple-600" />
                <span className="text-sm font-medium">Instagram</span>
              </div>
              <Badge
                variant="secondary"
                className="bg-purple-100 text-purple-700"
              >
                {stats.instagram}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-100">
              <div className="flex items-center gap-2">
                <Twitter className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Twitter</span>
              </div>
              <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                {stats.twitter}
              </Badge>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-200">
              <div className="flex items-center gap-2">
                <Linkedin className="h-4 w-4 text-blue-700" />
                <span className="text-sm font-medium">LinkedIn</span>
              </div>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                {stats.linkedin}
              </Badge>
            </div>
            {stats.failed > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-100 mt-4">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium">Failed Posts</span>
                </div>
                <Badge variant="secondary" className="bg-red-100 text-red-700">
                  {stats.failed}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Performing Posts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
            Top Performing Posts
          </CardTitle>
          <CardDescription>
            Highest engagement posts for this view
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {topPosts.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No published posts to rank yet.
            </div>
          ) : (
            topPosts.map((post) => {
              const PlatformIcon = platformIcons[post.platform] || FileText;
              return (
                <div
                  key={post.id}
                  className="flex items-start gap-4 rounded-lg border p-4 cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => openPostDetails(post)}
                >
                  <div
                    className={`h-10 w-10 rounded-lg flex items-center justify-center ${platformColors[post.platform] || "bg-gray-200"}`}
                  >
                    <PlatformIcon className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium line-clamp-2">
                        {post.content}
                      </p>
                      {post.published_url && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={(event) => {
                            event.stopPropagation();
                            window.open(post.published_url, "_blank");
                          }}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                      <Badge variant="secondary" className="text-xs capitalize">
                        {post.platform}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {getAccountLabel(post.connection_id)}
                      </Badge>
                      <span>
                        {post.posted_at ? formatDate(post.posted_at) : "N/A"}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-emerald-700">
                      {formatCompactNumber(getEngagementScore(post))}
                    </div>
                    <p className="text-xs text-muted-foreground">Engagements</p>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* AI Insights & Recommendations */}
      {stats.total > 5 && (
        <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-600" />
              AI Insights & Recommendations
            </CardTitle>
            <CardDescription>
              Data-driven suggestions to improve your social media performance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Performance Insight */}
              <div className="p-4 rounded-lg bg-white border border-indigo-100">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm mb-1">Success Rate</h4>
                    <p className="text-sm text-muted-foreground">
                      You have a {successRate}% success rate.
                      {parseFloat(successRate) >= 90
                        ? " Excellent! Your posting process is very reliable."
                        : parseFloat(successRate) >= 70
                          ? " Good performance! Check failed posts to identify issues."
                          : " Consider reviewing your connection settings and content format."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Automation Insight */}
              <div className="p-4 rounded-lg bg-white border border-indigo-100">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                    <Sparkles className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm mb-1">
                      Automation Level
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {parseFloat(aiPercentage)}% of your posts use
                      AI/Workflows.
                      {parseFloat(aiPercentage) >= 60
                        ? " Great! You're leveraging automation effectively."
                        : " Try using more workflows and AI-generated content to save time."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Content Mix Insight */}
              <div className="p-4 rounded-lg bg-white border border-indigo-100">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                    <Lightbulb className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm mb-1">
                      Content Diversity
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {stats.trending > 0 && stats.aiGenerated > 0
                        ? "You're using both trending and AI content - great mix!"
                        : stats.trending > 0
                          ? "Add AI-generated posts for more variety and creativity."
                          : "Try using trending content to stay relevant and timely."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Platform Strategy */}
              <div className="p-4 rounded-lg bg-white border border-indigo-100">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <ImageIcon className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm mb-1">
                      Platform Strategy
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {stats.instagram > 0 &&
                      stats.twitter > 0 &&
                      stats.linkedin > 0
                        ? "Multi-platform presence detected! Consider cross-posting similar content."
                        : stats.instagram + stats.twitter + stats.linkedin === 1
                          ? "Expand to other platforms to grow your audience."
                          : "Focus on your active platforms for consistency."}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Actionable Tips */}
            <div className="pt-4 border-t">
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                Quick Tips to Improve
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {stats.scheduled === 0 && (
                  <div className="text-xs p-2 rounded bg-blue-50 text-blue-700 border border-blue-100">
                    📅 Schedule posts in advance for consistent presence
                  </div>
                )}
                {stats.workflow === 0 && (
                  <div className="text-xs p-2 rounded bg-purple-50 text-purple-700 border border-purple-100">
                    🤖 Set up workflows to automate routine posting
                  </div>
                )}
                {stats.aiGenerated === 0 && (
                  <div className="text-xs p-2 rounded bg-pink-50 text-pink-700 border border-pink-100">
                    ✨ Try AI-generated posts for creative content ideas
                  </div>
                )}
                {stats.trending === 0 && (
                  <div className="text-xs p-2 rounded bg-amber-50 text-amber-700 border border-amber-100">
                    🔥 Use trending content to stay relevant
                  </div>
                )}
                {stats.instagram === 0 &&
                  connections.some((c) => c.platform === "instagram") && (
                    <div className="text-xs p-2 rounded bg-purple-50 text-purple-700 border border-purple-100">
                      📸 Start posting on Instagram - high engagement platform
                    </div>
                  )}
                {parseFloat(successRate) < 90 && stats.failed > 0 && (
                  <div className="text-xs p-2 rounded bg-red-50 text-red-700 border border-red-100">
                    ⚠️ Review failed posts to fix recurring issues
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Post Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Post Details
              {selectedPost && (
                <Badge
                  variant="outline"
                  className={`text-xs ${statusColors[selectedPost.status]}`}
                >
                  {selectedPost.status}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>Full details of your post</DialogDescription>
          </DialogHeader>

          {selectedPost && (
            <div className="space-y-4">
              {/* Image */}
              {selectedPost.image_url && (
                <div className="w-full h-64 rounded-lg overflow-hidden bg-gray-100">
                  <img
                    src={selectedPost.image_url}
                    alt="Post"
                    className="w-full h-full object-contain"
                  />
                </div>
              )}

              {/* Content */}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm text-muted-foreground">
                  Content:
                </h4>
                <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-md">
                  {selectedPost.content}
                </p>
              </div>

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground mb-1">
                    Platform:
                  </h4>
                  <Badge variant="secondary" className="text-xs capitalize">
                    {platformIcons[selectedPost.platform] &&
                      (() => {
                        const Icon = platformIcons[selectedPost.platform];
                        return <Icon className="h-3 w-3 mr-1" />;
                      })()}
                    {selectedPost.platform}
                  </Badge>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground mb-1">
                    Source:
                  </h4>
                  <Badge
                    variant="outline"
                    className={`text-xs ${sourceLabels[getPostSource(selectedPost)]?.color || ""}`}
                  >
                    {sourceLabels[getPostSource(selectedPost)]?.label ||
                      "Unknown"}
                  </Badge>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground mb-1">
                    Account:
                  </h4>
                  <p className="text-sm">
                    {getAccountLabel(selectedPost.connection_id)}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground mb-1">
                    Likes:
                  </h4>
                  <p className="text-sm">
                    {formatCompactNumber(selectedPost.like_count || 0)}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground mb-1">
                    Comments:
                  </h4>
                  <p className="text-sm">
                    {formatCompactNumber(selectedPost.comment_count || 0)}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground mb-1">
                    Shares:
                  </h4>
                  <p className="text-sm">
                    {formatCompactNumber(selectedPost.share_count || 0)}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground mb-1">
                    Impressions:
                  </h4>
                  <p className="text-sm">
                    {formatCompactNumber(selectedPost.impression_count || 0)}
                  </p>
                </div>
                {selectedPost.posted_at && (
                  <div>
                    <h4 className="font-semibold text-sm text-muted-foreground mb-1">
                      Posted At:
                    </h4>
                    <p className="text-sm">
                      {formatDate(selectedPost.posted_at)}
                    </p>
                  </div>
                )}
                {selectedPost.scheduled_at && (
                  <div>
                    <h4 className="font-semibold text-sm text-muted-foreground mb-1">
                      Scheduled At:
                    </h4>
                    <p className="text-sm">
                      {formatDate(selectedPost.scheduled_at)}
                    </p>
                  </div>
                )}
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground mb-1">
                    Created At:
                  </h4>
                  <p className="text-sm">
                    {formatDate(selectedPost.created_at)}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground mb-1">
                    Post ID:
                  </h4>
                  <p className="text-xs font-mono text-muted-foreground">
                    {selectedPost.id.substring(0, 8)}...
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
