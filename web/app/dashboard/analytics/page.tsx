"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    Loader2,
    Calendar,
    RefreshCw,
    ExternalLink,
    Filter,
    FileText,
    ImageIcon,
    TrendingUp,
    Sparkles,
    CalendarClock,
    History,
    Workflow,
    Lightbulb,
    Zap,
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Post {
    id: string;
    content: string;
    platform: string;
    status: string;
    image_url?: string;
    posted_at?: string;
    scheduled_at?: string;
    created_at: string;
    connection_id: string;
    user_id: string;
    source?: string; // workflow, manual, trending, ai-generated
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

const statusIcons: Record<string, any> = {
    published: CheckCircle2,
    scheduled: Clock,
    failed: XCircle,
    pending: Loader2,
    posting: Loader2,
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

    // Filters
    const [platformFilter, setPlatformFilter] = useState<string>("all");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [accountFilter, setAccountFilter] = useState<string>("all");
    const [sourceFilter, setSourceFilter] = useState<string>("all");

    useEffect(() => {
        if (user) {
            fetchPosts();
            fetchConnections();
        }
    }, [user]);

    useEffect(() => {
        applyFilters();
    }, [posts, platformFilter, statusFilter, accountFilter, sourceFilter]);

    const fetchPosts = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("posts")
                .select("*")
                .eq("user_id", user?.id)
                .order("created_at", { ascending: false });

            if (error) throw error;

            setPosts(data || []);
        } catch (error) {
            console.error("Error fetching posts:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchConnections = async () => {
        try {
            const { data, error } = await supabase
                .from("connections")
                .select("id, platform, profile_name")
                .eq("user_id", user?.id);

            if (error) throw error;

            setConnections(data || []);
        } catch (error) {
            console.error("Error fetching connections:", error);
        }
    };

    const applyFilters = () => {
        let filtered = [...posts];

        if (platformFilter !== "all") {
            filtered = filtered.filter(post => post.platform === platformFilter);
        }

        if (statusFilter !== "all") {
            filtered = filtered.filter(post => post.status === statusFilter);
        }

        if (accountFilter !== "all") {
            filtered = filtered.filter(post => post.connection_id === accountFilter);
        }

        if (sourceFilter !== "all") {
            filtered = filtered.filter(post => (post.source || "manual") === sourceFilter);
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

    const getPostSource = (post: Post) => {
        if (post.source) return post.source;
        // Try to infer from other fields if source not set
        if (post.scheduled_at && !post.posted_at) return "scheduled";
        return "manual";
    };

    const sourceLabels: Record<string, { label: string; icon: any; color: string }> = {
        workflow: { label: "Workflow", icon: TrendingUp, color: "bg-blue-50 text-blue-700 border-blue-200" },
        manual: { label: "Manual", icon: FileText, color: "bg-gray-50 text-gray-700 border-gray-200" },
        trending: { label: "Trending Content", icon: TrendingUp, color: "bg-amber-50 text-amber-700 border-amber-200" },
        "ai-generated": { label: "AI Generated", icon: Sparkles, color: "bg-purple-50 text-purple-700 border-purple-200" },
        scheduled: { label: "Scheduled", icon: CalendarClock, color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    };

    // Calculate comprehensive stats
    const stats = {
        total: filteredPosts.length,
        published: filteredPosts.filter(p => p.status === "published").length,
        scheduled: filteredPosts.filter(p => p.status === "scheduled").length,
        failed: filteredPosts.filter(p => p.status === "failed").length,
        // Source breakdown
        workflow: filteredPosts.filter(p => p.source === "workflow").length,
        manual: filteredPosts.filter(p => (p.source || "manual") === "manual").length,
        trending: filteredPosts.filter(p => p.source === "trending").length,
        aiGenerated: filteredPosts.filter(p => p.source === "ai-generated").length,
        // Platform breakdown
        instagram: filteredPosts.filter(p => p.platform === "instagram").length,
        twitter: filteredPosts.filter(p => p.platform === "twitter").length,
        linkedin: filteredPosts.filter(p => p.platform === "linkedin").length,
    };

    // Calculate success rate
    const totalAttempts = stats.published + stats.failed;
    const successRate = totalAttempts > 0 ? ((stats.published / totalAttempts) * 100).toFixed(1) : "0";
    
    // Calculate AI vs Manual ratio
    const aiPosts = stats.aiGenerated + stats.workflow;
    const manualPosts = stats.manual + stats.trending;
    const aiPercentage = stats.total > 0 ? ((aiPosts / stats.total) * 100).toFixed(1) : "0";

    return (
        <div className="space-y-6 px-6 py-6 max-w-[1600px]">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                            <TrendingUp className="h-6 w-6 text-white" />
                        </div>
                        Analytics
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Track performance, engagement, and insights across all your social media posts.
                    </p>
                </div>
                <Button onClick={fetchPosts} variant="outline" disabled={loading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
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
                        <div className="text-3xl font-bold text-green-700">{stats.published}</div>
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
                        <div className="text-3xl font-bold text-blue-700">{stats.scheduled}</div>
                        <p className="text-xs text-blue-600 mt-1">
                            Pending publication
                        </p>
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
                            <Badge variant="secondary" className="bg-blue-100 text-blue-700">{stats.workflow}</Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-purple-50 border border-purple-100">
                            <div className="flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-purple-600" />
                                <span className="text-sm font-medium">AI Generated</span>
                            </div>
                            <Badge variant="secondary" className="bg-purple-100 text-purple-700">{stats.aiGenerated}</Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-100">
                            <div className="flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-amber-600" />
                                <span className="text-sm font-medium">Trending Content</span>
                            </div>
                            <Badge variant="secondary" className="bg-amber-100 text-amber-700">{stats.trending}</Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-100">
                            <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-gray-600" />
                                <span className="text-sm font-medium">Manual</span>
                            </div>
                            <Badge variant="secondary" className="bg-gray-100 text-gray-700">{stats.manual}</Badge>
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
                            <Badge variant="secondary" className="bg-purple-100 text-purple-700">{stats.instagram}</Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-100">
                            <div className="flex items-center gap-2">
                                <Twitter className="h-4 w-4 text-blue-600" />
                                <span className="text-sm font-medium">Twitter</span>
                            </div>
                            <Badge variant="secondary" className="bg-blue-100 text-blue-700">{stats.twitter}</Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-200">
                            <div className="flex items-center gap-2">
                                <Linkedin className="h-4 w-4 text-blue-700" />
                                <span className="text-sm font-medium">LinkedIn</span>
                            </div>
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800">{stats.linkedin}</Badge>
                        </div>
                        {stats.failed > 0 && (
                            <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-100 mt-4">
                                <div className="flex items-center gap-2">
                                    <XCircle className="h-4 w-4 text-red-600" />
                                    <span className="text-sm font-medium">Failed Posts</span>
                                </div>
                                <Badge variant="secondary" className="bg-red-100 text-red-700">{stats.failed}</Badge>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* AI Insights & Recommendations */}
            {stats.total > 5 && (
                <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-indigo-600" />
                            AI Insights & Recommendations
                        </CardTitle>
                        <CardDescription>Data-driven suggestions to improve your social media performance</CardDescription>
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
                                        <h4 className="font-semibold text-sm mb-1">Automation Level</h4>
                                        <p className="text-sm text-muted-foreground">
                                            {parseFloat(aiPercentage)}% of your posts use AI/Workflows. 
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
                                        <h4 className="font-semibold text-sm mb-1">Content Diversity</h4>
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
                                        <h4 className="font-semibold text-sm mb-1">Platform Strategy</h4>
                                        <p className="text-sm text-muted-foreground">
                                            {stats.instagram > 0 && stats.twitter > 0 && stats.linkedin > 0
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
                                {stats.instagram === 0 && connections.some(c => c.platform === "instagram") && (
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

            {/* Filters */}
            <Card>
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Filter className="h-5 w-5" />
                        Filters
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <Select value={platformFilter} onValueChange={setPlatformFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="All Platforms" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Platforms</SelectItem>
                                <SelectItem value="instagram">Instagram</SelectItem>
                                <SelectItem value="twitter">Twitter</SelectItem>
                                <SelectItem value="linkedin">LinkedIn</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Select value={accountFilter} onValueChange={setAccountFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="All Accounts" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Accounts</SelectItem>
                                {connections.map((conn) => (
                                    <SelectItem key={conn.id} value={conn.id}>
                                        <span className="flex items-center gap-2">
                                            {conn.platform === "instagram" && <Instagram className="h-3 w-3" />}
                                            {conn.platform === "twitter" && <Twitter className="h-3 w-3" />}
                                            {conn.platform === "linkedin" && <Linkedin className="h-3 w-3" />}
                                            @{conn.profile_name}
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Select value={sourceFilter} onValueChange={setSourceFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="All Sources" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Sources</SelectItem>
                                <SelectItem value="workflow">Workflow</SelectItem>
                                <SelectItem value="manual">Manual</SelectItem>
                                <SelectItem value="trending">Trending Content</SelectItem>
                                <SelectItem value="ai-generated">AI Generated</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger>
                                <SelectValue placeholder="All Statuses" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="published">Published</SelectItem>
                                <SelectItem value="scheduled">Scheduled</SelectItem>
                                <SelectItem value="failed">Failed</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="posting">Posting</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Posts List */}
            <div className="space-y-4">
                {loading ? (
                    <Card className="p-12">
                        <div className="flex flex-col items-center justify-center space-y-4">
                            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                            <p className="text-muted-foreground">Loading posts...</p>
                        </div>
                    </Card>
                ) : filteredPosts.length === 0 ? (
                    <Card className="p-12 border-2 border-dashed">
                        <div className="text-center">
                            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <p className="text-muted-foreground text-lg mb-2">No posts found</p>
                            <p className="text-sm text-muted-foreground">
                                {posts.length === 0
                                    ? "Start creating posts from workflows, trending content, or manual scheduling."
                                    : "Try adjusting your filters to see more posts."}
                            </p>
                        </div>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {filteredPosts.map((post) => {
                            const PlatformIcon = platformIcons[post.platform] || FileText;
                            const StatusIcon = statusIcons[post.status] || Clock;
                            const source = getPostSource(post);
                            const sourceInfo = sourceLabels[source] || sourceLabels.manual;
                            const SourceIcon = sourceInfo.icon;

                            return (
                                <Card
                                    key={post.id}
                                    className="hover:shadow-lg transition-all overflow-hidden border-2 hover:border-blue-200 cursor-pointer"
                                    onClick={() => openPostDetails(post)}
                                >
                                    <div className="flex gap-4 p-5">
                                        {/* Image or Platform Icon */}
                                        <div className="shrink-0 w-24 h-24 rounded-lg overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                                            {post.image_url ? (
                                                <img
                                                    src={post.image_url}
                                                    alt="Post"
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className={`w-full h-full flex items-center justify-center ${platformColors[post.platform]}`}>
                                                    <PlatformIcon className="h-10 w-10 text-white" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0 space-y-2">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1">
                                                    <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed mb-2">
                                                        {post.content}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 flex-wrap">
                                                {/* Platform Badge */}
                                                <Badge variant="secondary" className="text-xs capitalize">
                                                    <PlatformIcon className="h-3 w-3 mr-1" />
                                                    {post.platform}
                                                </Badge>

                                                {/* Status Badge */}
                                                <Badge variant="outline" className={`text-xs ${statusColors[post.status]}`}>
                                                    <StatusIcon className={`h-3 w-3 mr-1 ${post.status === 'pending' || post.status === 'posting' ? 'animate-spin' : ''}`} />
                                                    {post.status}
                                                </Badge>

                                                {/* Source Badge */}
                                                <Badge variant="outline" className={`text-xs ${sourceInfo.color}`}>
                                                    <SourceIcon className="h-3 w-3 mr-1" />
                                                    {sourceInfo.label}
                                                </Badge>

                                                {/* Date */}
                                                <span className="text-xs text-muted-foreground flex items-center ml-auto">
                                                    <Calendar className="h-3 w-3 mr-1" />
                                                    {post.status === "scheduled" && post.scheduled_at
                                                        ? `Scheduled: ${formatDate(post.scheduled_at)}`
                                                        : post.posted_at
                                                        ? `Posted: ${formatDate(post.posted_at)}`
                                                        : `Created: ${formatDate(post.created_at)}`}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Post Details Dialog */}
            <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            Post Details
                            {selectedPost && (
                                <Badge variant="outline" className={`text-xs ${statusColors[selectedPost.status]}`}>
                                    {selectedPost.status}
                                </Badge>
                            )}
                        </DialogTitle>
                        <DialogDescription>
                            Full details of your post
                        </DialogDescription>
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
                                <h4 className="font-semibold text-sm text-muted-foreground">Content:</h4>
                                <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-md">
                                    {selectedPost.content}
                                </p>
                            </div>

                            {/* Metadata */}
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                                <div>
                                    <h4 className="font-semibold text-sm text-muted-foreground mb-1">Platform:</h4>
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
                                    <h4 className="font-semibold text-sm text-muted-foreground mb-1">Source:</h4>
                                    <Badge variant="outline" className={`text-xs ${sourceLabels[getPostSource(selectedPost)]?.color || ''}`}>
                                        {sourceLabels[getPostSource(selectedPost)]?.label || "Unknown"}
                                    </Badge>
                                </div>
                                {selectedPost.posted_at && (
                                    <div>
                                        <h4 className="font-semibold text-sm text-muted-foreground mb-1">Posted At:</h4>
                                        <p className="text-sm">{formatDate(selectedPost.posted_at)}</p>
                                    </div>
                                )}
                                {selectedPost.scheduled_at && (
                                    <div>
                                        <h4 className="font-semibold text-sm text-muted-foreground mb-1">Scheduled At:</h4>
                                        <p className="text-sm">{formatDate(selectedPost.scheduled_at)}</p>
                                    </div>
                                )}
                                <div>
                                    <h4 className="font-semibold text-sm text-muted-foreground mb-1">Created At:</h4>
                                    <p className="text-sm">{formatDate(selectedPost.created_at)}</p>
                                </div>
                                <div>
                                    <h4 className="font-semibold text-sm text-muted-foreground mb-1">Post ID:</h4>
                                    <p className="text-xs font-mono text-muted-foreground">{selectedPost.id.substring(0, 8)}...</p>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

