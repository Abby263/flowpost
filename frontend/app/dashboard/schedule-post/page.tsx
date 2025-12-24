"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  CalendarPlus,
  Clock,
  Instagram,
  Twitter,
  Linkedin,
  Image as ImageIcon,
  Upload,
  Sparkles,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Calendar as CalendarIcon,
  FileText,
  Eye,
  Hash,
  Wand2,
  RefreshCw,
  X,
} from "lucide-react";
import { format } from "date-fns";

interface Connection {
  id: string;
  platform: string;
  profile_name: string;
}

interface ScheduledPost {
  id: string;
  content: string;
  platform: string;
  scheduled_at: string;
  status: string;
  image_url?: string;
  posted_at?: string;
}

export default function SchedulePostPage() {
  const { user } = useUser();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [postHistory, setPostHistory] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);

  // Form state
  const [content, setContent] = useState("");
  const [platform, setPlatform] = useState<string>("");
  const [connectionId, setConnectionId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState("09:00");
  const [imageUrl, setImageUrl] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");

  // Notification state
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const showNotification = (
    type: "success" | "error" | "info",
    message: string,
  ) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  useEffect(() => {
    if (user) {
      fetchConnections();
      fetchScheduledPosts();
      fetchPostHistory();
    }
  }, [user]);

  async function fetchConnections() {
    setLoading(true);
    try {
      const res = await fetch("/api/connections");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load connections");
      }
      setConnections(data.connections || []);
    } catch (error) {
      console.error("Error fetching connections:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchScheduledPosts() {
    try {
      const res = await fetch(
        "/api/posts?status=scheduled&order=scheduled_at&direction=asc&limit=10",
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load scheduled posts");
      }
      setScheduledPosts(data.posts || []);
    } catch (error) {
      console.error("Error fetching scheduled posts:", error);
    }
  }

  async function fetchPostHistory() {
    // Fetch all posts (not just scheduled) for history, excluding scheduled ones
    try {
      const res = await fetch(
        "/api/posts?excludeStatus=scheduled&workflowId=null&order=posted_at&direction=desc&limit=20",
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load post history");
      }
      setPostHistory(data.posts || []);
    } catch (error) {
      console.error("Error fetching post history:", error);
    }
  }

  const handlePlatformChange = (value: string) => {
    setPlatform(value);
    setConnectionId("");
  };

  const generateAIImage = async () => {
    if (!imagePrompt.trim()) {
      showNotification("error", "Please enter an image description");
      return;
    }

    setGeneratingImage(true);

    try {
      const response = await fetch("/api/schedule-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate-image",
          prompt: imagePrompt,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setImageUrl(data.imageUrl);
        showNotification("success", "Image generated successfully!");
      } else {
        showNotification("error", data.error || "Failed to generate image");
      }
    } catch (error) {
      showNotification("error", "Failed to generate image");
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleSubmit = async () => {
    if (!content.trim()) {
      showNotification("error", "Please enter post content");
      return;
    }
    if (!platform) {
      showNotification("error", "Please select a platform");
      return;
    }
    if (!connectionId) {
      showNotification("error", "Please select an account");
      return;
    }

    setSubmitting(true);
    const isInstantPost = !selectedDate;

    try {
      let scheduledAt: string;

      if (isInstantPost) {
        // Instant post - use current time
        scheduledAt = new Date().toISOString();
      } else {
        // Scheduled post - use selected date and time
        const dateTime = new Date(selectedDate);
        const [hours, minutes] = selectedTime.split(":");
        dateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        scheduledAt = dateTime.toISOString();
      }

      const response = await fetch("/api/schedule-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: isInstantPost ? "post-now" : "schedule",
          content,
          platform,
          connectionId,
          scheduledAt,
          imageUrl: imageUrl || undefined,
          source: "manual",
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Use the message from the API response
        const successMessage =
          data.message ||
          (isInstantPost
            ? "Post published successfully!"
            : "Post scheduled successfully!");
        showNotification("success", successMessage);
        // Reset form
        setContent("");
        setImageUrl("");
        setImagePrompt("");
        setSelectedDate(undefined);
        // Refresh both lists
        fetchScheduledPosts();
        fetchPostHistory();
      } else {
        showNotification(
          "error",
          data.error ||
            `Failed to ${isInstantPost ? "publish" : "schedule"} post`,
        );
      }
    } catch (error) {
      showNotification(
        "error",
        `Failed to ${isInstantPost ? "publish" : "schedule"} post`,
      );
    } finally {
      setSubmitting(false);
    }
  };

  const cancelScheduledPost = async (postId: string) => {
    try {
      const res = await fetch(`/api/posts?id=${postId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to cancel post");
      }
      setScheduledPosts(scheduledPosts.filter((p) => p.id !== postId));
      showNotification("success", "Scheduled post cancelled");
    } catch (error: any) {
      console.error(error);
      showNotification("error", "Failed to cancel post");
    }
  };

  const getPlatformIcon = (plat: string) => {
    switch (plat) {
      case "instagram":
        return <Instagram className="h-5 w-5 text-pink-600" />;
      case "twitter":
        return <Twitter className="h-5 w-5 text-blue-500" />;
      case "linkedin":
        return <Linkedin className="h-5 w-5 text-blue-700" />;
      default:
        return null;
    }
  };

  const getCharacterLimit = () => {
    switch (platform) {
      case "twitter":
        return 280;
      case "linkedin":
        return 3000;
      case "instagram":
        return 2200;
      default:
        return 2200;
    }
  };

  const filteredConnections = connections.filter(
    (c) => !platform || c.platform === platform,
  );

  return (
    <div className="space-y-8 px-6 py-6 max-w-[1400px]">
      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 duration-300">
          <div
            className={`flex items-center space-x-3 rounded-lg border-2 px-4 py-3 shadow-lg backdrop-blur-sm ${
              notification.type === "success"
                ? "bg-green-50 border-green-300 text-green-800"
                : notification.type === "error"
                  ? "bg-red-50 border-red-300 text-red-800"
                  : "bg-blue-50 border-blue-300 text-blue-800"
            }`}
          >
            {notification.type === "success" ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : notification.type === "error" ? (
              <AlertCircle className="h-5 w-5" />
            ) : (
              <AlertCircle className="h-5 w-5" />
            )}
            <span className="font-medium">{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              className="ml-4 text-lg font-semibold opacity-70 hover:opacity-100"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg">
            <CalendarPlus className="h-5 w-5 text-white" />
          </div>
          Schedule Post
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Create and schedule posts manually when you already have your content
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">
        {/* Post Creation Form */}
        <div className="space-y-6">
          {/* Content Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-600" />
                Post Content
              </CardTitle>
              <CardDescription>
                Write your post content and select the platform
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Platform & Account Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Platform</Label>
                  <Select value={platform} onValueChange={handlePlatformChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select platform" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="instagram">
                        <div className="flex items-center gap-2">
                          <Instagram className="h-4 w-4 text-pink-600" />
                          Instagram
                        </div>
                      </SelectItem>
                      <SelectItem value="twitter">
                        <div className="flex items-center gap-2">
                          <Twitter className="h-4 w-4 text-blue-500" />
                          Twitter
                        </div>
                      </SelectItem>
                      <SelectItem value="linkedin">
                        <div className="flex items-center gap-2">
                          <Linkedin className="h-4 w-4 text-blue-700" />
                          LinkedIn
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Account</Label>
                  <Select
                    value={connectionId}
                    onValueChange={setConnectionId}
                    disabled={!platform}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredConnections.map((conn) => (
                        <SelectItem key={conn.id} value={conn.id}>
                          @{conn.profile_name}
                        </SelectItem>
                      ))}
                      {filteredConnections.length === 0 && (
                        <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                          No {platform || ""} accounts connected
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Post Content */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="content">Content</Label>
                  <span
                    className={`text-xs ${content.length > getCharacterLimit() ? "text-red-500" : "text-muted-foreground"}`}
                  >
                    {content.length} / {getCharacterLimit()}
                  </span>
                </div>
                <Textarea
                  id="content"
                  placeholder="Write your post content here... Include emojis, hashtags, and a call-to-action!"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={6}
                  className="resize-none"
                />
              </div>
            </CardContent>
          </Card>

          {/* Image Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-purple-600" />
                Image{" "}
                {platform === "instagram" && (
                  <span className="text-pink-600">(Required)</span>
                )}
              </CardTitle>
              <CardDescription>
                {platform === "instagram"
                  ? "Upload an image, add a URL, or generate with AI. Images will be auto-cropped to fit Instagram's requirements."
                  : "Upload an image, add a URL, or generate one with AI"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* File Upload */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Upload Image
                </Label>
                <div className="flex items-center gap-4">
                  <label className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-center w-full h-32 border-2 border-dashed rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="text-center">
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <span className="text-sm text-muted-foreground">
                          Click to upload or drag and drop
                        </span>
                        <p className="text-xs text-muted-foreground mt-1">
                          PNG, JPG up to 10MB
                        </p>
                      </div>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          // Convert to base64 for preview
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const result = event.target?.result as string;
                            setImageUrl(result);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* Image URL Input */}
              <div className="space-y-2 border-t pt-4">
                <Label htmlFor="imageUrl">Or paste image URL</Label>
                <Input
                  id="imageUrl"
                  placeholder="https://example.com/image.jpg"
                  value={imageUrl.startsWith("data:") ? "" : imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                />
              </div>

              {/* AI Image Generation */}
              <div className="border-t pt-4">
                <Label className="flex items-center gap-2 mb-2">
                  <Wand2 className="h-4 w-4 text-purple-600" />
                  Or generate with AI
                </Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Describe the image you want to generate..."
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    onClick={generateAIImage}
                    disabled={!imagePrompt.trim() || generatingImage}
                    variant="secondary"
                  >
                    {generatingImage ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Image Preview */}
              {imageUrl && (
                <div className="relative mt-4 border-t pt-4">
                  <Label className="mb-2 block">Preview</Label>
                  <div className="relative inline-block">
                    <img
                      src={imageUrl}
                      alt="Post preview"
                      className="max-w-full max-h-64 object-contain rounded-lg border"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => setImageUrl("")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Scheduling Panel */}
        <div className="lg:sticky lg:top-6 space-y-4 h-fit">
          {/* Schedule Card - Compact */}
          <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-teal-50/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarIcon className="h-4 w-4 text-emerald-600" />
                Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {/* Compact Calendar */}
              <div className="flex justify-center [&_.rdp]:scale-[0.8] [&_.rdp]:origin-top [&_.rdp]:mx-auto">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => date < new Date()}
                  className="rounded-md border p-2"
                />
              </div>

              {/* Time Selection */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4" />
                  Time
                </Label>
                <Select value={selectedTime} onValueChange={setSelectedTime}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => {
                      const hour = i.toString().padStart(2, "0");
                      return (
                        <SelectItem key={`${hour}:00`} value={`${hour}:00`}>
                          {hour}:00
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Selected Date Display or Instant Post Info */}
              {selectedDate ? (
                <div className="bg-emerald-100 rounded-md p-3 text-center">
                  <p className="text-sm text-emerald-700 font-medium">
                    {format(selectedDate, "MMM d, yyyy")} at {selectedTime}
                  </p>
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-center">
                  <p className="text-sm text-blue-700 font-medium">
                    No date selected - Publishes immediately
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                {/* Schedule Button - Only when date is selected */}
                {selectedDate ? (
                  <Button
                    className="w-full h-12 text-base bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md"
                    onClick={handleSubmit}
                    disabled={
                      submitting || !content || !platform || !connectionId
                    }
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Scheduling...
                      </>
                    ) : (
                      <>
                        <CalendarIcon className="mr-2 h-5 w-5" />
                        Schedule Post
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    className="w-full h-12 text-base bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 shadow-md"
                    onClick={handleSubmit}
                    disabled={
                      submitting || !content || !platform || !connectionId
                    }
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Publishing...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-5 w-5" />
                        Post Now
                      </>
                    )}
                  </Button>
                )}

                {/* Clear date selection */}
                {selectedDate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-9 text-xs text-muted-foreground hover:bg-muted"
                    onClick={() => setSelectedDate(undefined)}
                  >
                    Clear date to post immediately instead
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Scheduled Posts Preview */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" />
                Upcoming Posts
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {scheduledPosts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CalendarPlus className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No scheduled posts yet</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {scheduledPosts.map((post) => (
                    <div
                      key={post.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors border"
                    >
                      <div className="shrink-0 mt-1">
                        {getPlatformIcon(post.platform)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm line-clamp-2 mb-1">
                          {post.content}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(post.scheduled_at), "MMM d, h:mm a")}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => cancelScheduledPost(post.id)}
                        className="shrink-0 h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Post History Section */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-purple-600" />
              Post History
            </CardTitle>
            <Badge variant="secondary">{postHistory.length} posts</Badge>
          </div>
          <CardDescription>
            Track all your manually created posts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {postHistory.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium">No posts yet</p>
              <p className="text-sm mt-1">Create a post above to see it here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {postHistory.map((post) => (
                <div
                  key={post.id}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {getPlatformIcon(post.platform)}
                      <div>
                        <Badge
                          variant="secondary"
                          className={
                            post.status === "published"
                              ? "bg-green-100 text-green-800"
                              : post.status === "failed"
                                ? "bg-red-100 text-red-800"
                                : post.status === "pending"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : post.status === "posting"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-gray-100 text-gray-800"
                          }
                        >
                          {post.status === "published" && (
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                          )}
                          {post.status === "failed" && (
                            <AlertCircle className="mr-1 h-3 w-3" />
                          )}
                          {post.status === "pending" && (
                            <Clock className="mr-1 h-3 w-3" />
                          )}
                          {post.status === "posting" && (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          )}
                          {post.status}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {post.posted_at &&
                          new Date(post.posted_at).getFullYear() > 1970
                            ? format(
                                new Date(post.posted_at),
                                "MMM d, yyyy 'at' h:mm a",
                              )
                            : "Date not recorded"}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => cancelScheduledPost(post.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-4">
                    {post.image_url && (
                      <div className="md:col-span-1">
                        <img
                          src={post.image_url}
                          alt="Post image"
                          className="w-full h-24 object-cover rounded-lg border"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
                          }}
                        />
                      </div>
                    )}
                    <div
                      className={
                        post.image_url ? "md:col-span-3" : "md:col-span-4"
                      }
                    >
                      <p className="text-sm whitespace-pre-wrap line-clamp-3">
                        {post.content}
                      </p>
                      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{post.content.length} characters</span>
                        <span>•</span>
                        <span className="capitalize">{post.platform}</span>
                      </div>
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
