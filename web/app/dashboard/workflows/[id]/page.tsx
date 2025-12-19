"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
    ArrowLeft, 
    Calendar, 
    Clock, 
    MapPin, 
    Sparkles, 
    Activity,
    ExternalLink,
    Image as ImageIcon,
    CheckCircle2,
    XCircle,
    AlertCircle
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface Post {
    id: string;
    content: string;
    image_url?: string;
    published_url?: string;
    status: string;
    posted_at: string;
    platform: string;
}

interface Workflow {
    id: string;
    name: string;
    search_query: string;
    location?: string;
    style_prompt?: string;
    platform: string;
    frequency: string;
    schedule?: string;
    is_active: boolean;
    requires_approval: boolean;
    created_at: string;
    connection_id?: string;
}

export default function WorkflowDetailPage() {
    const params = useParams();
    const router = useRouter();
    const workflowId = params.id as string;

    const [workflow, setWorkflow] = useState<Workflow | null>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalRuns: 0,
        successfulRuns: 0,
        failedRuns: 0,
        lastRun: null as string | null,
    });

    useEffect(() => {
        fetchWorkflowDetails();
    }, [workflowId]);

    async function fetchWorkflowDetails() {
        setLoading(true);
        try {
            const res = await fetch(`/api/workflows/${workflowId}`);
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to fetch workflow");
            }

            const workflowData = data.workflow;
            const postsData = data.posts || [];

            setWorkflow(workflowData);
            setPosts(postsData);

            const successful = postsData?.filter((p: Post) => p.status === "published").length || 0;
            const failed = postsData?.filter((p: Post) => p.status === "failed").length || 0;
            const lastPost = postsData && postsData.length > 0 ? postsData[0].posted_at : null;

            setStats({
                totalRuns: postsData?.length || 0,
                successfulRuns: successful,
                failedRuns: failed,
                lastRun: lastPost,
            });
        } catch (error) {
            console.error("Error fetching workflow:", error);
        } finally {
            setLoading(false);
        }
    }


    const getPlatformEmoji = (platform: string) => {
        switch (platform) {
            case "instagram": return "📸";
            case "twitter": return "🐦";
            case "linkedin": return "💼";
            default: return "📱";
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "published": return "bg-green-100 text-green-800 border-green-300";
            case "failed": return "bg-red-100 text-red-800 border-red-300";
            default: return "bg-gray-100 text-gray-800 border-gray-300";
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-4 text-muted-foreground">Loading workflow details...</p>
                </div>
            </div>
        );
    }

    if (!workflow) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                    <p className="text-lg font-semibold">Workflow not found</p>
                    <Button onClick={() => router.push("/dashboard/workflows")} className="mt-4">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Workflows
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 px-6 py-6 max-w-[1400px]">
            {/* Header */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => router.push("/dashboard/workflows")}
                        className="shrink-0"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex items-center gap-3 min-w-0">
                        <span className="text-4xl shrink-0">{getPlatformEmoji(workflow.platform)}</span>
                        <div className="min-w-0">
                            <h1 className="text-3xl font-bold truncate">{workflow.name}</h1>
                            <p className="text-sm text-muted-foreground mt-0.5">
                                Created {format(new Date(workflow.created_at), "MMM d, yyyy")}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {workflow.is_active ? (
                        <Badge className="bg-green-600">
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Active
                        </Badge>
                    ) : (
                        <Badge variant="secondary">Paused</Badge>
                    )}
                    {workflow.requires_approval && (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                            Approval Required
                        </Badge>
                    )}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Runs</CardTitle>
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                            <Activity className="h-5 w-5 text-blue-600" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{stats.totalRuns}</div>
                        <p className="text-xs text-muted-foreground mt-1">All time executions</p>
                    </CardContent>
                </Card>
                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Successful</CardTitle>
                        <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-green-600">{stats.successfulRuns}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {stats.totalRuns > 0 
                                ? `${Math.round((stats.successfulRuns / stats.totalRuns) * 100)}% success rate`
                                : "No runs yet"
                            }
                        </p>
                    </CardContent>
                </Card>
                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Failed</CardTitle>
                        <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                            <XCircle className="h-5 w-5 text-red-600" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-red-600">{stats.failedRuns}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {stats.totalRuns > 0 
                                ? `${Math.round((stats.failedRuns / stats.totalRuns) * 100)}% failure rate`
                                : "No failures"
                            }
                        </p>
                    </CardContent>
                </Card>
                <Card className="hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Last Run</CardTitle>
                        <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                            <Clock className="h-5 w-5 text-purple-600" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {stats.lastRun 
                                ? formatDistanceToNow(new Date(stats.lastRun), { addSuffix: true }).replace('about ', '')
                                : "Never"
                            }
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {stats.lastRun ? format(new Date(stats.lastRun), "MMM d, h:mm a") : "Not yet executed"}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Workflow Configuration */}
            <Card className="shadow-md">
                <CardHeader className="border-b bg-slate-50">
                    <CardTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-blue-600" />
                        Workflow Configuration
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <div className="space-y-6">
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200">
                                <p className="text-xs font-semibold text-blue-900 mb-2 flex items-center gap-1">
                                    Platform
                                </p>
                                <p className="text-lg font-bold capitalize flex items-center gap-2">
                                    <span className="text-2xl">{getPlatformEmoji(workflow.platform)}</span> 
                                    {workflow.platform}
                                </p>
                            </div>
                            <div className="p-4 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200">
                                <p className="text-xs font-semibold text-green-900 mb-2 flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    Frequency
                                </p>
                                <p className="text-lg font-bold capitalize">
                                    {workflow.frequency}
                                </p>
                            </div>
                            {workflow.schedule && (
                                <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200">
                                    <p className="text-xs font-semibold text-purple-900 mb-2 flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        Schedule
                                    </p>
                                    <p className="text-lg font-bold">
                                        {workflow.schedule}
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="p-5 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200">
                            <p className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                                🔍 Search Query
                            </p>
                            <p className="text-base font-medium text-blue-800 leading-relaxed">{workflow.search_query}</p>
                        </div>

                        {(workflow.location || workflow.style_prompt) && (
                            <div className="grid gap-4 md:grid-cols-2">
                                {workflow.location && (
                                    <div className="p-4 rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200">
                                        <p className="text-xs font-semibold text-orange-900 mb-2 flex items-center gap-1">
                                            <MapPin className="h-3 w-3" />
                                            Location
                                        </p>
                                        <p className="text-base font-bold text-orange-900">
                                            {workflow.location}
                                        </p>
                                    </div>
                                )}
                                {workflow.style_prompt && (
                                    <div className="p-4 rounded-xl bg-gradient-to-br from-pink-50 to-rose-50 border border-pink-200">
                                        <p className="text-xs font-semibold text-pink-900 mb-2 flex items-center gap-1">
                                            <Sparkles className="h-3 w-3" />
                                            Style
                                        </p>
                                        <p className="text-base font-bold text-pink-900">
                                            {workflow.style_prompt}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Run History */}
            <Card className="shadow-md">
                <CardHeader className="border-b bg-slate-50">
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                            <Activity className="h-5 w-5 text-blue-600" />
                            Run History
                        </CardTitle>
                        <Badge variant="secondary" className="text-sm px-3 py-1">
                            {posts.length} {posts.length === 1 ? 'run' : 'runs'}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    {posts.length === 0 ? (
                        <div className="text-center py-16">
                            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                                <Activity className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <p className="text-lg font-medium text-muted-foreground">No runs yet</p>
                            <p className="text-sm text-muted-foreground mt-2">
                                Click "Run Now" to execute this workflow
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {posts.map((post) => (
                                <div
                                    key={post.id}
                                    className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                                >
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center space-x-3 flex-wrap">
                                            <Badge className={`border-2 ${getStatusColor(post.status)}`}>
                                                {post.status === "published" ? (
                                                    <CheckCircle2 className="mr-1 h-3 w-3" />
                                                ) : (
                                                    <XCircle className="mr-1 h-3 w-3" />
                                                )}
                                                {post.status === "published" ? "Published" : "Failed"}
                                            </Badge>
                                            <span className="text-sm text-muted-foreground">
                                                {format(new Date(post.posted_at), "MMM d, yyyy 'at' h:mm a")}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                ({formatDistanceToNow(new Date(post.posted_at), { addSuffix: true })})
                                            </span>
                                        </div>
                                        {post.published_url && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => window.open(post.published_url!, "_blank")}
                                            >
                                                <ExternalLink className="mr-2 h-3 w-3" />
                                                View on Instagram
                                            </Button>
                                        )}
                                    </div>

                                    <div className="grid gap-6 md:grid-cols-5">
                                        {post.image_url && (
                                            <div className="md:col-span-2">
                                                <p className="text-sm font-semibold mb-3 flex items-center">
                                                    <ImageIcon className="mr-2 h-4 w-4" />
                                                    Generated Image
                                                </p>
                                                <div className="relative aspect-square rounded-xl overflow-hidden border-2 shadow-sm bg-muted/30">
                                                    <img
                                                        src={post.image_url}
                                                        alt="Post image"
                                                        className="object-cover w-full h-full"
                                                        onError={(e) => {
                                                            // Show placeholder when image fails to load (e.g., expired DALL-E URL)
                                                            const target = e.target as HTMLImageElement;
                                                            target.onerror = null;
                                                            target.src = '';
                                                            target.style.display = 'none';
                                                            const parent = target.parentElement;
                                                            if (parent && !parent.querySelector('.image-error-placeholder')) {
                                                                const placeholder = document.createElement('div');
                                                                placeholder.className = 'image-error-placeholder flex flex-col items-center justify-center w-full h-full text-muted-foreground';
                                                                placeholder.innerHTML = `
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mb-2 opacity-50"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
                                                                    <span class="text-xs">Image expired</span>
                                                                `;
                                                                parent.appendChild(placeholder);
                                                            }
                                                        }}
                                                    />
                                                </div>
                                                {post.published_url && (
                                                    <p className="text-xs text-muted-foreground mt-2 text-center">
                                                        Posted to {workflow?.platform}
                                                    </p>
                                                )}
                                                {post.image_url && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="w-full mt-2"
                                                        onClick={() => window.open(post.image_url!, "_blank")}
                                                    >
                                                        <ExternalLink className="mr-2 h-3 w-3" />
                                                        Open Image
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                        <div className={post.image_url ? "md:col-span-3" : "md:col-span-5"}>
                                            <p className="text-sm font-semibold mb-3">Posted Content:</p>
                                            <div className="bg-muted/30 p-4 rounded-xl border">
                                                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                                                    {post.content}
                                                </p>
                                            </div>
                                            {post.content && (
                                                <div className="mt-3 flex items-center space-x-4 text-xs text-muted-foreground">
                                                    <span>{post.content.length} characters</span>
                                                    <span>•</span>
                                                    <span>{post.content.split('\n').filter(l => l.trim()).length} lines</span>
                                                    <span>•</span>
                                                    <span>{(post.content.match(/#\w+/g) || []).length} hashtags</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
