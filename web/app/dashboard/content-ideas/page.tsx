"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
    Lightbulb,
    TrendingUp,
    Search,
    Sparkles,
    ExternalLink,
    RefreshCw,
    Loader2,
    Wand2,
    Clock,
    Tag,
    ArrowRight,
    Zap,
    Copy,
    Check,
    Plus,
    Globe,
    Newspaper,
    Hash,
    Share2,
    Instagram,
    Twitter,
    Linkedin
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ContentIdea {
    title: string;
    snippet: string;
    link: string;
    source?: string;
    date?: string;
    imageUrl?: string;
}

interface GeneratedIdea {
    title: string;
    caption: string;
    hashtags: string[];
    style: string;
    imageUrl?: string;
}

interface Connection {
    id: string;
    platform: string;
    profile_name: string;
}

const SUGGESTED_CATEGORIES = [
    { label: "Technology", icon: "💻" },
    { label: "AI & Machine Learning", icon: "🤖" },
    { label: "Business & Startups", icon: "🚀" },
    { label: "Sports", icon: "⚽" },
    { label: "Entertainment", icon: "🎬" },
    { label: "Travel", icon: "✈️" },
    { label: "Food & Cooking", icon: "🍕" },
    { label: "Health & Fitness", icon: "💪" },
    { label: "Fashion & Style", icon: "👗" },
    { label: "Finance & Investing", icon: "💰" },
    { label: "News & Politics", icon: "📰" },
    { label: "Gaming", icon: "🎮" },
    { label: "Music", icon: "🎵" },
    { label: "Books & Literature", icon: "📚" },
    { label: "Science", icon: "🔬" },
    { label: "Photography", icon: "📸" },
];

export default function ContentIdeasPage() {
    const { user } = useUser();
    const [customQuery, setCustomQuery] = useState("");
    const [trendingContent, setTrendingContent] = useState<ContentIdea[]>([]);
    const [generatedIdeas, setGeneratedIdeas] = useState<GeneratedIdea[]>([]);
    const [loading, setLoading] = useState(false);
    const [generatingIdeas, setGeneratingIdeas] = useState(false);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
    const [userInterests, setUserInterests] = useState<string[]>([]);
    const [newInterest, setNewInterest] = useState("");
    const [searchQueries, setSearchQueries] = useState<string[]>([]);
    const [publishingContent, setPublishingContent] = useState<ContentIdea | null>(null);

    // Publishing state
    const [connections, setConnections] = useState<Connection[]>([]);
    const [publishingIdea, setPublishingIdea] = useState<GeneratedIdea | null>(null);
    const [publishPlatform, setPublishPlatform] = useState<string>("");
    const [publishConnectionId, setPublishConnectionId] = useState<string>("");
    const [isPublishing, setIsPublishing] = useState(false);
    const [publishDialogOpen, setPublishDialogOpen] = useState(false);
    const [publishStatus, setPublishStatus] = useState<string>("");

    useEffect(() => {
        const savedInterests = localStorage.getItem("user_interests");
        if (savedInterests) {
            setUserInterests(JSON.parse(savedInterests));
        } else {
            // Default interests if none saved
            setUserInterests(["AI Trends", "Tech News", "Startup Growth"]);
        }

        if (user) {
            fetchConnections();
        }
    }, [user]);

    const fetchConnections = async () => {
        const { data, error } = await supabase
            .from("connections")
            .select("id, platform, profile_name")
            .eq("user_id", user?.id);

        if (data) setConnections(data);
    };

    const saveInterests = (interests: string[]) => {
        setUserInterests(interests);
        localStorage.setItem("user_interests", JSON.stringify(interests));
    };

    const addInterest = () => {
        if (newInterest.trim() && !userInterests.includes(newInterest.trim())) {
            saveInterests([...userInterests, newInterest.trim()]);
            setNewInterest("");
        }
    };

    const addSuggestedCategory = (category: string) => {
        if (!userInterests.includes(category)) {
            saveInterests([...userInterests, category]);
        }
    };

    const removeInterest = (interest: string) => {
        saveInterests(userInterests.filter(i => i !== interest));
    };

    const fetchTrendingContent = async (query?: string) => {
        setLoading(true);
        setTrendingContent([]);
        setGeneratedIdeas([]); // Clear previous ideas
        setSearchQueries([]);

        try {
            const body: any = { action: "fetch" };
            if (query) {
                body.query = query;
            } else {
                body.interests = userInterests;
            }

            const response = await fetch("/api/content-ideas", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            const data = await response.json();

            if (data.success) {
                const content = data.content || [];
                setTrendingContent(content);
                if (data.queries) setSearchQueries(data.queries);

                // Auto-generate ideas if we have content
                if (content.length > 0) {
                    await generateContentIdeas(content, query);
                }
            } else {
                console.error("Failed to fetch content:", data.error);
            }
        } catch (error) {
            console.error("Error fetching trending content:", error);
        } finally {
            setLoading(false);
        }
    };

    const generateContentIdeas = async (content: ContentIdea[], query?: string) => {
        setGeneratingIdeas(true);

        try {
            const response = await fetch("/api/content-ideas", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "generate",
                    content: content,
                    interests: userInterests,
                    category: query || customQuery
                }),
            });

            const data = await response.json();

            if (data.success) {
                setGeneratedIdeas(data.ideas || []);
            } else {
                console.error("Failed to generate ideas:", data.error);
            }
        } catch (error) {
            console.error("Error generating ideas:", error);
        } finally {
            setGeneratingIdeas(false);
        }
    };

    const handleCustomSearch = () => {
        if (customQuery.trim()) {
            fetchTrendingContent(customQuery);
        }
    };

    const copyToClipboard = async (text: string, index: number) => {
        await navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    const openPublishDialog = (idea: GeneratedIdea) => {
        setPublishingIdea(idea);
        setPublishingContent(null);
        setPublishPlatform("");
        setPublishConnectionId("");
        setPublishStatus("");
        setPublishDialogOpen(true);
    };

    const openPublishDialogForContent = (content: ContentIdea) => {
        setPublishingContent(content);
        setPublishingIdea(null);
        setPublishPlatform("");
        setPublishConnectionId("");
        setPublishStatus("");
        setPublishDialogOpen(true);
    };

    const handlePublish = async () => {
        if ((!publishingIdea && !publishingContent) || !publishPlatform || !publishConnectionId) return;

        setIsPublishing(true);
        setPublishStatus("");
        
        try {
            let postContent = "";
            let imageUrl = "";
            
            if (publishingIdea) {
                postContent = `${publishingIdea.caption}\n\n${publishingIdea.hashtags.join(" ")}`;
                imageUrl = publishingIdea.imageUrl || "";
            } else if (publishingContent) {
                postContent = `${publishingContent.title}\n\n${publishingContent.snippet}\n\nRead more: ${publishingContent.link}`;
                imageUrl = publishingContent.imageUrl || "";
            }

            // If Instagram and no image, generate one
            if (publishPlatform === "instagram" && !imageUrl) {
                try {
                    setPublishStatus("🎨 Generating AI image for Instagram...");
                    const imageGenResponse = await fetch("/api/schedule-post", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            action: "generate-image",
                            prompt: postContent.substring(0, 200), // Use first 200 chars as prompt
                        }),
                    });

                    const imageData = await imageGenResponse.json();
                    if (imageData.success && imageData.imageUrl) {
                        imageUrl = imageData.imageUrl;
                        setPublishStatus("✅ Image generated!");
                    } else {
                        alert("Failed to generate image for Instagram. Please try another platform or add an image manually.");
                        setIsPublishing(false);
                        setPublishStatus("");
                        return;
                    }
                } catch (imgError) {
                    console.error("Image generation error:", imgError);
                    alert("Failed to generate image for Instagram. Please try another platform.");
                    setIsPublishing(false);
                    setPublishStatus("");
                    return;
                }
            }

            setPublishStatus("📤 Publishing your post...");
            
            // Determine source
            const source = publishingIdea ? "ai-generated" : "trending";
            
            const response = await fetch("/api/schedule-post", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "post-now",
                    content: postContent,
                    platform: publishPlatform,
                    connectionId: publishConnectionId,
                    userId: user?.id,
                    imageUrl: imageUrl || undefined,
                    source: source,
                }),
            });

            const data = await response.json();

            if (data.success) {
                setPublishStatus("✨ Published successfully!");
                setTimeout(() => {
                    setPublishDialogOpen(false);
                    setPublishStatus("");
                }, 1500);
            } else {
                alert(`Failed to publish: ${data.error}`);
                setPublishStatus("");
            }
        } catch (error) {
            console.error("Error publishing post:", error);
            alert("Failed to publish post");
            setPublishStatus("");
        } finally {
            setIsPublishing(false);
        }
    };

    return (
        <div className="space-y-8 px-6 py-6 max-w-[1400px]">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
                            <Lightbulb className="h-6 w-6 text-white" />
                        </div>
                        Content Ideas
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Discover trending content and generate AI-powered post ideas based on your interests.
                    </p>
                </div>
            </div>

            {/* User Interests Section */}
            <Card className="border-2 border-dashed border-amber-200 bg-gradient-to-br from-amber-50/50 to-orange-50/50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Tag className="h-5 w-5 text-amber-600" />
                        Your Interests
                    </CardTitle>
                    <CardDescription>
                        Select categories or add custom topics you care about. We'll find trending content for these.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Current Interests */}
                    {userInterests.length > 0 && (
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-muted-foreground">Active Interests:</Label>
                            <div className="flex flex-wrap gap-2">
                                {userInterests.map((interest, index) => (
                                    <Badge key={index} variant="secondary" className="px-3 py-2 text-sm bg-amber-100 border-amber-300 text-amber-900 flex items-center gap-2">
                                        {interest}
                                        <button onClick={() => removeInterest(interest)} className="hover:text-red-600 transition-colors">
                                            <span className="sr-only">Remove</span>
                                            ×
                                        </button>
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Suggested Categories */}
                    <div className="space-y-2">
                        <Label className="text-sm font-medium text-muted-foreground">Suggested Categories:</Label>
                        <div className="flex flex-wrap gap-2">
                            {SUGGESTED_CATEGORIES.map((category, index) => {
                                const isAdded = userInterests.includes(category.label);
                                return (
                                    <Button
                                        key={index}
                                        variant={isAdded ? "secondary" : "outline"}
                                        size="sm"
                                        onClick={() => addSuggestedCategory(category.label)}
                                        disabled={isAdded}
                                        className={`text-xs ${isAdded ? 'opacity-50 cursor-not-allowed' : 'hover:bg-amber-50 hover:border-amber-300'}`}
                                    >
                                        <span className="mr-1.5">{category.icon}</span>
                                        {category.label}
                                    </Button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Custom Interest Input */}
                    <div className="space-y-2">
                        <Label className="text-sm font-medium text-muted-foreground">Or add custom interest:</Label>
                        <div className="flex gap-2 max-w-md">
                            <Input
                                placeholder="e.g. Quantum Computing, K-Pop..."
                                value={newInterest}
                                onChange={(e) => setNewInterest(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && addInterest()}
                            />
                            <Button onClick={addInterest} variant="outline" size="icon">
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 pt-4 border-t mt-4">
                        <Button
                            onClick={() => fetchTrendingContent()}
                            disabled={loading || userInterests.length === 0}
                            className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white shadow-md"
                        >
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TrendingUp className="mr-2 h-4 w-4" />}
                            Find Trending Posts
                        </Button>

                        <div className="flex-1 ml-4 border-l pl-4">
                            <Label htmlFor="custom-search" className="text-sm text-muted-foreground mb-2 block">
                                Or search specifically:
                            </Label>
                            <div className="flex gap-2">
                                <Input
                                    id="custom-search"
                                    placeholder="e.g., SpaceX updates..."
                                    value={customQuery}
                                    onChange={(e) => setCustomQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleCustomSearch()}
                                    className="flex-1"
                                />
                                <Button onClick={handleCustomSearch} disabled={!customQuery.trim() || loading} variant="secondary">
                                    <Search className="h-4 w-4 mr-2" />
                                    Search
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Trending Content Section */}
            <div className="space-y-6">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-green-600" />
                            Trending Content
                        </h2>
                        {trendingContent.length > 0 && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => fetchTrendingContent(customQuery || undefined)}
                                disabled={loading}
                            >
                                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                                Refresh
                            </Button>
                        )}
                    </div>

                    {/* Show what queries were run */}
                    {searchQueries.length > 0 && (
                        <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-md">
                            <span className="font-medium">Searched for: </span>
                            {searchQueries.join(", ")}
                        </div>
                    )}

                    {loading ? (
                        <Card className="p-12">
                            <div className="flex flex-col items-center justify-center space-y-4">
                                <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
                                <p className="text-muted-foreground">Searching for trending content...</p>
                            </div>
                        </Card>
                    ) : trendingContent.length === 0 ? (
                        <Card className="p-12 border-2 border-dashed">
                            <div className="text-center">
                                <Globe className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                <p className="text-muted-foreground text-lg mb-2">No content yet</p>
                                <p className="text-sm text-muted-foreground">
                                    Add interests above and click "Discover" to find content.
                                </p>
                            </div>
                        </Card>
                    ) : (
                        <div className="space-y-4">
                            {trendingContent.map((item, index) => (
                                <Card key={index} className="hover:shadow-lg transition-all overflow-hidden border-2 hover:border-amber-200">
                                    <div className="flex gap-4 p-5">
                                        {/* Image Placeholder */}
                                        <div className="shrink-0 w-32 h-32 rounded-lg overflow-hidden bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                                            {item.imageUrl ? (
                                                <img 
                                                    src={item.imageUrl} 
                                                    alt={item.title}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <Newspaper className="h-12 w-12 text-amber-400" />
                                            )}
                                        </div>
                                        
                                        {/* Content */}
                                        <div className="flex-1 min-w-0 space-y-2">
                                            <h3 className="font-semibold text-lg mb-2 line-clamp-2 leading-tight">
                                                {item.title}
                                            </h3>
                                            <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                                                {item.snippet}
                                            </p>
                                            <div className="flex items-center gap-3 pt-2">
                                                {item.source && (
                                                    <Badge variant="secondary" className="text-xs">
                                                        <Newspaper className="h-3 w-3 mr-1" />
                                                        {item.source}
                                                    </Badge>
                                                )}
                                                {item.date && (
                                                    <span className="text-xs text-muted-foreground flex items-center">
                                                        <Clock className="h-3 w-3 mr-1" />
                                                        {item.date}
                                                    </span>
                                                )}
                                                <div className="ml-auto flex gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => window.open(item.link, '_blank')}
                                                    >
                                                        <ExternalLink className="h-3 w-3 mr-2" />
                                                        Read
                                                    </Button>
                                                    <Button
                                                        variant="default"
                                                        size="sm"
                                                        className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                                                        onClick={() => openPublishDialogForContent(item)}
                                                    >
                                                        <Share2 className="h-3 w-3 mr-2" />
                                                        Publish
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>

                {/* Generated Ideas Section */}
                {generatedIdeas.length > 0 && (
                    <div className="space-y-6 mt-8">
                        <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-md">
                                <Sparkles className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold">AI-Powered Post Ideas</h2>
                                <p className="text-sm text-muted-foreground">Ready-to-publish content crafted from trending topics</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-6">
                            {generatedIdeas.map((idea, index) => (
                                <Card key={index} className="flex flex-col md:flex-row border-2 border-purple-100 hover:border-purple-300 hover:shadow-xl transition-all overflow-hidden">
                                    {/* Image Section */}
                                    <div className="md:w-64 h-48 md:h-auto shrink-0 bg-gradient-to-br from-purple-100 via-pink-100 to-indigo-100 flex items-center justify-center relative overflow-hidden">
                                        {idea.imageUrl ? (
                                            <img 
                                                src={idea.imageUrl} 
                                                alt={idea.title}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="text-center p-6">
                                                <Wand2 className="h-16 w-16 text-purple-400 mx-auto mb-2" />
                                                <p className="text-xs text-purple-600 font-medium">AI Generated</p>
                                            </div>
                                        )}
                                        <div className="absolute top-3 left-3">
                                            <Badge variant="secondary" className="text-xs font-medium bg-white/90 text-purple-700 border-purple-200 shadow-sm">
                                                {idea.style}
                                            </Badge>
                                        </div>
                                    </div>
                                    
                                    {/* Content Section */}
                                    <div className="flex-1 flex flex-col p-6 space-y-4">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                                <h3 className="text-xl font-bold mb-3 text-gray-900">{idea.title}</h3>
                                                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed mb-4">
                                                    {idea.caption}
                                                </p>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-9 w-9 text-muted-foreground hover:text-foreground shrink-0"
                                                onClick={() => copyToClipboard(`${idea.title}\n\n${idea.caption}\n\n${idea.hashtags.join(" ")}`, index)}
                                            >
                                                {copiedIndex === index ? <Check className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5" />}
                                            </Button>
                                        </div>
                                        
                                        <div className="flex flex-wrap gap-2">
                                            {idea.hashtags.map((tag, i) => (
                                                <span key={i} className="text-xs text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full font-medium border border-blue-200">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                        
                                        <div className="flex gap-2 pt-2">
                                            <Button
                                                className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md"
                                                onClick={() => openPublishDialog(idea)}
                                            >
                                                <Share2 className="mr-2 h-4 w-4" />
                                                Publish Now
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Publish Dialog */}
            <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Publish Post</DialogTitle>
                        <DialogDescription>
                            Choose where you want to publish this post.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Platform</Label>
                            <Select value={publishPlatform} onValueChange={(val) => {
                                setPublishPlatform(val);
                                setPublishConnectionId("");
                            }}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select platform" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="instagram">Instagram</SelectItem>
                                    <SelectItem value="twitter">Twitter</SelectItem>
                                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                                </SelectContent>
                            </Select>
                            {publishPlatform === "instagram" && !publishingIdea?.imageUrl && !publishingContent?.imageUrl && (
                                <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                                    <Sparkles className="h-3 w-3" />
                                    An AI image will be automatically generated for this post
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>Account</Label>
                            <Select
                                value={publishConnectionId}
                                onValueChange={setPublishConnectionId}
                                disabled={!publishPlatform}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select account" />
                                </SelectTrigger>
                                <SelectContent>
                                    {connections
                                        .filter(c => c.platform === publishPlatform)
                                        .map(conn => (
                                            <SelectItem key={conn.id} value={conn.id}>
                                                @{conn.profile_name}
                                            </SelectItem>
                                        ))
                                    }
                                    {connections.filter(c => c.platform === publishPlatform).length === 0 && (
                                        <div className="p-2 text-sm text-muted-foreground text-center">
                                            No accounts connected
                                        </div>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="bg-muted p-3 rounded-md text-sm">
                            <p className="font-medium mb-1">Preview:</p>
                            {publishingIdea && (
                                <>
                                    <p className="text-muted-foreground line-clamp-4">
                                        {publishingIdea.caption}
                                    </p>
                                    <p className="text-blue-600 mt-1">
                                        {publishingIdea.hashtags.join(" ")}
                                    </p>
                                </>
                            )}
                            {publishingContent && (
                                <>
                                    <p className="font-semibold mb-1">{publishingContent.title}</p>
                                    <p className="text-muted-foreground line-clamp-3 mb-2">
                                        {publishingContent.snippet}
                                    </p>
                                    <a href={publishingContent.link} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-xs hover:underline flex items-center gap-1">
                                        <ExternalLink className="h-3 w-3" />
                                        Read more: {publishingContent.link}
                                    </a>
                                </>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <div className="flex items-center justify-between w-full">
                            <div className="flex-1">
                                {publishStatus && (
                                    <p className="text-sm text-muted-foreground animate-pulse">
                                        {publishStatus}
                                    </p>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setPublishDialogOpen(false)} disabled={isPublishing}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handlePublish}
                                    disabled={!publishPlatform || !publishConnectionId || isPublishing}
                                >
                                    {isPublishing ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Publishing...
                                        </>
                                    ) : (
                                        <>
                                            <Share2 className="mr-2 h-4 w-4" />
                                            Publish Now
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

