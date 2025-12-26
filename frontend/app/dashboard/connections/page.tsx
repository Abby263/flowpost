"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Instagram,
  Twitter,
  Linkedin,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  Sparkles,
  Zap,
  Edit3,
  X,
  Check,
  RefreshCw,
  Link2,
  Youtube,
  Facebook,
  AtSign,
  Info,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Connection {
  id: string;
  platform:
    | "instagram"
    | "twitter"
    | "linkedin"
    | "threads"
    | "facebook"
    | "youtube";
  profile_name: string;
  profile_image?: string;
  display_name?: string;
  connection_status: "active" | "expired" | "error" | "pending";
  created_at: string;
  token_expires_at?: string;
  last_used_at?: string;
}

// Threads icon component (not available in lucide)
const ThreadsIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.59 12c.025 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.96-.065-1.182.408-2.256 1.33-3.022.88-.73 2.082-1.168 3.59-1.304 1.2-.11 2.503-.058 3.762.136l.005-.005c-.004-.322-.023-.64-.066-.953-.168-1.2-.628-2.1-1.37-2.674-.779-.604-1.86-.906-3.212-.906h-.096c-1.104.013-2.007.312-2.681.886l-1.33-1.53c1.011-.858 2.328-1.31 3.915-1.345h.143c1.834 0 3.354.472 4.52 1.404 1.2.959 1.891 2.298 2.108 3.974.04.287.068.58.085.878a8.29 8.29 0 0 1 2.146 1.143c1.2.858 2.048 1.998 2.457 3.3.512 1.633.345 3.602-1.026 4.945-1.807 1.77-4.097 2.575-7.21 2.6Zm-1.04-7.063c-.93.053-1.663.336-2.12.821-.396.422-.558.96-.483 1.604.084.645.439 1.168 1.057 1.559.655.414 1.455.603 2.255.555 1.094-.063 1.94-.472 2.513-1.219.508-.665.79-1.593.84-2.762a13.366 13.366 0 0 0-4.062-.558Z" />
  </svg>
);

const PLATFORM_CONFIG = {
  instagram: {
    name: "Instagram",
    icon: Instagram,
    color: "from-pink-500 via-purple-500 to-orange-400",
    bgLight: "bg-gradient-to-br from-pink-50 to-purple-50",
    borderColor: "border-pink-200",
    textColor: "text-pink-600",
    description: "Connect your Instagram Business or Creator account",
    features: ["Photo & video posts", "Stories", "Reels"],
    requiresModal: true,
  },
  threads: {
    name: "Threads",
    icon: ThreadsIcon,
    color: "from-gray-900 to-black",
    bgLight: "bg-gradient-to-br from-gray-50 to-slate-100",
    borderColor: "border-gray-300",
    textColor: "text-gray-900",
    description: "Connect your Threads account via Instagram",
    features: ["Text posts", "Image threads", "Replies"],
    requiresModal: false,
  },
  twitter: {
    name: "Twitter / X",
    icon: Twitter,
    color: "from-gray-900 to-gray-700",
    bgLight: "bg-gradient-to-br from-gray-50 to-slate-50",
    borderColor: "border-gray-200",
    textColor: "text-gray-900",
    description: "Connect your Twitter account for automated posting",
    features: ["Tweets & threads", "Media uploads", "Scheduling"],
    requiresModal: false,
  },
  linkedin: {
    name: "LinkedIn",
    icon: Linkedin,
    color: "from-blue-600 to-blue-800",
    bgLight: "bg-gradient-to-br from-blue-50 to-indigo-50",
    borderColor: "border-blue-200",
    textColor: "text-blue-700",
    description: "Connect your LinkedIn profile or company page",
    features: ["Posts & articles", "Image sharing", "Professional network"],
    requiresModal: false,
  },
  facebook: {
    name: "Facebook",
    icon: Facebook,
    color: "from-blue-500 to-blue-700",
    bgLight: "bg-gradient-to-br from-blue-50 to-sky-50",
    borderColor: "border-blue-200",
    textColor: "text-blue-600",
    description: "Connect your Facebook Page for business posting",
    features: ["Page posts", "Photo & video", "Engagement"],
    requiresModal: false,
  },
  youtube: {
    name: "YouTube",
    icon: Youtube,
    color: "from-red-500 to-red-700",
    bgLight: "bg-gradient-to-br from-red-50 to-orange-50",
    borderColor: "border-red-200",
    textColor: "text-red-600",
    description: "Connect your YouTube channel",
    features: ["Video uploads", "Community posts", "Shorts"],
    requiresModal: false,
  },
};

export default function ConnectionsPage() {
  const { user } = useUser();
  const searchParams = useSearchParams();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(
    null,
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [connectionToDelete, setConnectionToDelete] =
    useState<Connection | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [instagramModalOpen, setInstagramModalOpen] = useState(false);

  const fetchConnections = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/connections");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load connections");
      }
      setConnections(data.connections || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchConnections();
    }
  }, [user, fetchConnections]);

  // Handle OAuth callback messages
  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");

    if (success) {
      const platformName =
        PLATFORM_CONFIG[success as keyof typeof PLATFORM_CONFIG]?.name ||
        success;
      setSuccessMessage(`Successfully connected your ${platformName} account!`);
      window.history.replaceState({}, "", "/dashboard/connections");
      fetchConnections();
    }

    if (error) {
      setErrorMessage(decodeURIComponent(error));
      window.history.replaceState({}, "", "/dashboard/connections");
    }
  }, [searchParams, fetchConnections]);

  // Clear messages after 5 seconds
  useEffect(() => {
    if (successMessage || errorMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
        setErrorMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, errorMessage]);

  function handleConnectClick(platform: string) {
    if (platform === "instagram") {
      setInstagramModalOpen(true);
    } else {
      initiateOAuth(platform);
    }
  }

  async function initiateOAuth(platform: string, accountType?: string) {
    setConnectingPlatform(platform);
    setInstagramModalOpen(false);

    try {
      const url = accountType
        ? `/api/auth/${platform}?type=${accountType}`
        : `/api/auth/${platform}`;

      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to start OAuth flow");
      }

      // Redirect to OAuth provider
      window.location.href = data.authUrl;
    } catch (error: any) {
      console.error(error);
      setErrorMessage(error.message || "Failed to connect account");
      setConnectingPlatform(null);
    }
  }

  async function updateDisplayName(id: string) {
    try {
      const res = await fetch("/api/connections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, display_name: editDisplayName }),
      });

      if (!res.ok) {
        throw new Error("Failed to update");
      }

      setConnections(
        connections.map((c) =>
          c.id === id ? { ...c, display_name: editDisplayName } : c,
        ),
      );
      setEditingId(null);
      setEditDisplayName("");
    } catch (error) {
      console.error(error);
    }
  }

  async function deleteConnection(connection: Connection) {
    try {
      const res = await fetch(`/api/connections?id=${connection.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete connection");
      }

      setConnections(connections.filter((c) => c.id !== connection.id));
      setSuccessMessage(`Disconnected ${connection.profile_name}`);
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to delete connection");
    } finally {
      setDeleteDialogOpen(false);
      setConnectionToDelete(null);
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Connected
          </Badge>
        );
      case "expired":
        return (
          <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
            <Clock className="w-3 h-3 mr-1" />
            Needs Reconnect
          </Badge>
        );
      case "error":
        return (
          <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">
            <AlertCircle className="w-3 h-3 mr-1" />
            Error
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  const getConnectionsByPlatform = (platform: string) =>
    connections.filter((c) => c.platform === platform);

  const getProfileUrl = (platform: string, profileName: string) => {
    const urls: Record<string, string> = {
      instagram: `https://instagram.com/${profileName}`,
      twitter: `https://x.com/${profileName}`,
      linkedin: `https://linkedin.com/in/${profileName}`,
      threads: `https://threads.net/@${profileName}`,
      facebook: `https://facebook.com/${profileName}`,
      youtube: `https://youtube.com/@${profileName}`,
    };
    return urls[platform] || "#";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-200">
              <Link2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                Connections
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base">
                Connect your social media accounts with one click
              </p>
            </div>
          </div>
        </div>

        {/* Success/Error Messages */}
        {successMessage && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 animate-in slide-in-from-top-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <span className="text-emerald-800">{successMessage}</span>
            <button
              onClick={() => setSuccessMessage(null)}
              className="ml-auto text-emerald-600 hover:text-emerald-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3 animate-in slide-in-from-top-2">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
            <span className="text-red-800">{errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              className="ml-auto text-red-600 hover:text-red-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Platform Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
          {(
            Object.keys(PLATFORM_CONFIG) as Array<keyof typeof PLATFORM_CONFIG>
          ).map((platform) => {
            const config = PLATFORM_CONFIG[platform];
            const Icon = config.icon;
            const platformConnections = getConnectionsByPlatform(platform);
            const isConnecting = connectingPlatform === platform;

            return (
              <Card
                key={platform}
                className={`relative overflow-hidden border-2 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${config.borderColor} ${config.bgLight} flex flex-col`}
              >
                {/* Decorative gradient overlay */}
                <div
                  className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${config.color} opacity-10 rounded-full -translate-y-16 translate-x-16`}
                />

                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div
                      className={`w-12 h-12 rounded-xl bg-gradient-to-br ${config.color} flex items-center justify-center shadow-lg`}
                    >
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    {platformConnections.length > 0 && (
                      <Badge
                        variant="secondary"
                        className="bg-white/80 backdrop-blur text-xs"
                      >
                        {platformConnections.length} connected
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-lg mt-3">{config.name}</CardTitle>
                  <CardDescription className="text-xs leading-relaxed">
                    {config.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex flex-col flex-1 pt-0">
                  {/* Features */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {config.features.map((feature) => (
                      <span
                        key={feature}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-white/60 text-gray-600"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>

                  {/* Spacer to push button to bottom */}
                  <div className="flex-1" />

                  {/* Connect Button */}
                  <Button
                    onClick={() => handleConnectClick(platform)}
                    disabled={isConnecting}
                    className={`w-full bg-gradient-to-r ${config.color} hover:opacity-90 transition-opacity text-white shadow-md`}
                  >
                    {isConnecting ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Connecting...
                      </>
                    ) : platformConnections.length > 0 ? (
                      <>
                        <Zap className="mr-2 h-4 w-4" />
                        Add Another Account
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Connect {config.name}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Connected Accounts Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
                Your Connected Accounts
              </h2>
              <p className="text-muted-foreground text-sm">
                Manage your social media connections
              </p>
            </div>
            <Badge
              variant="outline"
              className="text-sm px-3 py-1 bg-white shadow-sm"
            >
              {connections.length}{" "}
              {connections.length === 1 ? "account" : "accounts"}
            </Badge>
          </div>

          {loading ? (
            <Card className="p-12 bg-white/50 backdrop-blur">
              <div className="flex flex-col items-center justify-center space-y-4 text-muted-foreground">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full border-4 border-violet-200 border-t-violet-600 animate-spin" />
                </div>
                <span className="text-sm">Loading your connections...</span>
              </div>
            </Card>
          ) : connections.length === 0 ? (
            <Card className="p-12 border-2 border-dashed bg-white/50 backdrop-blur">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center">
                  <Link2 className="h-10 w-10 text-violet-500" />
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  No accounts connected yet
                </h3>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                  Connect your first social media account above to start
                  automating your content
                </p>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {connections.map((conn) => {
                const config = PLATFORM_CONFIG[conn.platform];
                const Icon = config?.icon || Link2;
                const isEditing = editingId === conn.id;

                return (
                  <Card
                    key={conn.id}
                    className="group relative overflow-hidden bg-white hover:shadow-lg transition-all duration-300 border border-gray-100"
                  >
                    {/* Status indicator bar */}
                    <div
                      className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${config?.color || "from-gray-400 to-gray-600"}`}
                    />

                    <div className="p-5">
                      <div className="flex items-start gap-4">
                        {/* Profile Image or Platform Icon */}
                        <div className="relative">
                          {conn.profile_image ? (
                            <img
                              src={conn.profile_image}
                              alt={conn.profile_name}
                              className="w-14 h-14 rounded-xl object-cover shadow-md"
                            />
                          ) : (
                            <div
                              className={`w-14 h-14 rounded-xl bg-gradient-to-br ${config?.color || "from-gray-400 to-gray-600"} flex items-center justify-center shadow-md`}
                            >
                              <Icon className="h-7 w-7 text-white" />
                            </div>
                          )}
                          {/* Platform badge overlay */}
                          <div
                            className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-br ${config?.color || "from-gray-400 to-gray-600"} flex items-center justify-center shadow-sm border-2 border-white`}
                          >
                            <Icon className="h-3 w-3 text-white" />
                          </div>
                        </div>

                        {/* Account Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {isEditing ? (
                              <div className="flex items-center gap-1 flex-1">
                                <Input
                                  value={editDisplayName}
                                  onChange={(e) =>
                                    setEditDisplayName(e.target.value)
                                  }
                                  placeholder="Display name"
                                  className="h-7 text-sm"
                                  autoFocus
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0"
                                  onClick={() => updateDisplayName(conn.id)}
                                >
                                  <Check className="h-4 w-4 text-emerald-600" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0"
                                  onClick={() => {
                                    setEditingId(null);
                                    setEditDisplayName("");
                                  }}
                                >
                                  <X className="h-4 w-4 text-gray-400" />
                                </Button>
                              </div>
                            ) : (
                              <>
                                <h3 className="font-semibold text-gray-900 truncate">
                                  {conn.display_name || conn.profile_name}
                                </h3>
                                <button
                                  onClick={() => {
                                    setEditingId(conn.id);
                                    setEditDisplayName(
                                      conn.display_name || conn.profile_name,
                                    );
                                  }}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Edit3 className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600" />
                                </button>
                              </>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            @{conn.profile_name}
                          </p>
                          <div className="mt-2">
                            {getStatusBadge(conn.connection_status)}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                        <span className="text-xs text-muted-foreground">
                          Connected{" "}
                          {new Date(conn.created_at).toLocaleDateString()}
                        </span>
                        <div className="flex items-center gap-1">
                          {conn.connection_status === "expired" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs"
                              onClick={() => handleConnectClick(conn.platform)}
                            >
                              <RefreshCw className="h-3 w-3 mr-1" />
                              Reconnect
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() =>
                              window.open(
                                getProfileUrl(conn.platform, conn.profile_name),
                                "_blank",
                              )
                            }
                          >
                            <ExternalLink className="h-4 w-4 text-gray-400" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                            onClick={() => {
                              setConnectionToDelete(conn);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Instagram Connection Modal */}
        <Dialog open={instagramModalOpen} onOpenChange={setInstagramModalOpen}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader className="text-center pb-2">
              <div className="flex justify-center mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 via-purple-500 to-orange-400 flex items-center justify-center">
                    <Instagram className="h-4 w-4 text-white" />
                  </div>
                </div>
              </div>
              <DialogTitle className="text-xl">
                How would you like to connect your Instagram Account?
              </DialogTitle>
              <DialogDescription>
                Features depend on the type of Instagram account you have and
                the connection you choose.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              {/* Professional Account Option */}
              <div className="border-2 border-blue-200 rounded-xl p-5 bg-blue-50/50 hover:border-blue-400 transition-colors">
                <div className="mb-3">
                  <h3 className="font-semibold text-lg">Professional</h3>
                  <p className="text-xs text-muted-foreground">
                    (Business & Creator)
                  </p>
                </div>

                <Badge className="bg-blue-100 text-blue-700 border-blue-200 mb-4 text-xs">
                  <Zap className="w-3 h-3 mr-1" />
                  Automatic & Notification-based Posting
                </Badge>

                <ul className="space-y-2.5 text-sm mb-5">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                    <span>
                      <strong>Automatic posting</strong> - You schedule and
                      we&apos;ll post
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                    <span>
                      <strong>Notifications</strong> - We notify you, then you
                      finish in app
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                    <span>
                      <strong>Community</strong> - Easily reply to comments
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                    <span>
                      <strong>Post Metrics</strong> - View past post performance
                    </span>
                  </li>
                </ul>

                <Button
                  onClick={() => initiateOAuth("instagram", "professional")}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={connectingPlatform === "instagram"}
                >
                  {connectingPlatform === "instagram" ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    "Connect to Instagram"
                  )}
                </Button>

                <p className="text-[11px] text-muted-foreground mt-3 flex items-start gap-1.5">
                  <Info className="h-3 w-3 mt-0.5 shrink-0" />
                  Instagram will prompt you to easily convert to a professional
                  account if needed.
                </p>
              </div>

              {/* Personal Account Option */}
              <div className="border-2 border-gray-200 rounded-xl p-5 bg-gray-50/50 hover:border-gray-300 transition-colors">
                <div className="mb-3">
                  <h3 className="font-semibold text-lg">Personal</h3>
                </div>

                <Badge variant="secondary" className="mb-4 text-xs">
                  <AtSign className="w-3 h-3 mr-1" />
                  Notification-Based Posting Only
                </Badge>

                <ul className="space-y-2.5 text-sm mb-5">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-gray-500 mt-0.5 shrink-0" />
                    <span>
                      <strong>Notifications</strong> - We notify you, then you
                      finish in app
                    </span>
                  </li>
                </ul>

                <div className="flex-1" />

                <Button
                  variant="outline"
                  onClick={() => initiateOAuth("instagram", "personal")}
                  className="w-full mt-auto"
                  disabled={connectingPlatform === "instagram"}
                >
                  Setup a Personal Account
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Disconnect Account?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to disconnect{" "}
                <span className="font-medium">
                  @{connectionToDelete?.profile_name}
                </span>
                ? This will remove the connection and you&apos;ll need to
                reconnect to use this account again.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  connectionToDelete && deleteConnection(connectionToDelete)
                }
                className="bg-red-600 hover:bg-red-700"
              >
                Disconnect
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
