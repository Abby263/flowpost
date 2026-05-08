"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Facebook,
  Instagram,
  Linkedin,
  Loader2,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  Twitter,
} from "lucide-react";

interface Connection {
  id: string;
  platform: "instagram" | "twitter" | "linkedin";
  profile_name: string;
  ig_business_account_id: string | null;
  connection_status: "active" | "expired" | "revoked" | "pending" | null;
  token_expires_at: string | null;
  created_at: string;
}

interface PageCandidate {
  pageId: string;
  pageName: string;
  igUserId: string;
}

export default function ConnectionsPage() {
  return (
    <Suspense fallback={null}>
      <ConnectionsPageInner />
    </Suspense>
  );
}

function ConnectionsPageInner() {
  const { user } = useUser();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState<
    "instagram" | "twitter" | "linkedin"
  >("instagram");
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [pageCandidates, setPageCandidates] = useState<PageCandidate[]>([]);
  const [pickingPage, setPickingPage] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const showNote = useCallback(
    (type: "success" | "error" | "info", message: string) => {
      setNotification({ type, message });
      setTimeout(() => setNotification(null), 5000);
    },
    [],
  );

  const fetchConnections = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/connections");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setConnections(data.connections || []);
    } catch (err) {
      showNote(
        "error",
        err instanceof Error ? err.message : "Failed to load connections",
      );
    } finally {
      setLoading(false);
    }
  }, [showNote]);

  const fetchPageCandidates = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/instagram/select-page");
      const data = await res.json();
      setPageCandidates(data.candidates || []);
    } catch {
      setPageCandidates([]);
    }
  }, []);

  useEffect(() => {
    if (user) void fetchConnections();
  }, [user, fetchConnections]);

  // Surface OAuth callback results from query params.
  useEffect(() => {
    const connected = searchParams.get("ig_connected");
    const error = searchParams.get("ig_error");
    const pick = searchParams.get("ig_pick");

    if (connected) {
      showNote("success", `Instagram connected as @${connected}`);
      router.replace("/dashboard/connections");
      void fetchConnections();
    } else if (error) {
      showNote("error", `Instagram connection failed: ${error}`);
      router.replace("/dashboard/connections");
    } else if (pick) {
      void fetchPageCandidates();
    }
  }, [searchParams, router, showNote, fetchConnections, fetchPageCandidates]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  }

  function startInstagramOAuth() {
    window.location.href = "/api/auth/instagram/start";
  }

  async function selectPage(pageId: string) {
    setPickingPage(true);
    try {
      const res = await fetch("/api/auth/instagram/select-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save selection");
      showNote("success", `Instagram connected as @${data.profileName}`);
      setPageCandidates([]);
      await fetchConnections();
    } catch (err) {
      showNote(
        "error",
        err instanceof Error ? err.message : "Failed to save Page selection",
      );
    } finally {
      setPickingPage(false);
    }
  }

  async function addNonInstagramConnection() {
    if (!user) return;
    let credentials: Record<string, string> = {};
    let profileName = "";

    if (platform === "twitter") {
      if (
        !formData.apiKey ||
        !formData.apiKeySecret ||
        !formData.accessToken ||
        !formData.accessTokenSecret
      ) {
        showNote("error", "Please fill in all fields");
        return;
      }
      credentials = {
        apiKey: formData.apiKey,
        apiKeySecret: formData.apiKeySecret,
        accessToken: formData.accessToken,
        accessTokenSecret: formData.accessTokenSecret,
      };
      profileName = "Twitter API";
    } else if (platform === "linkedin") {
      if (!formData.accessToken || !formData.personUrn) {
        showNote("error", "Please fill in all fields");
        return;
      }
      credentials = {
        accessToken: formData.accessToken,
        personUrn: formData.personUrn,
        organizationId: formData.organizationId || "",
      };
      profileName = formData.personUrn;
    }

    const isDuplicate = connections.some(
      (c) => c.platform === platform && c.profile_name === profileName,
    );
    if (isDuplicate) {
      showNote("info", "This connection already exists.");
      return;
    }

    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          profile_name: profileName,
          credentials,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add connection");
      setConnections([data.connection as Connection, ...connections]);
      setFormData({});
      showNote("success", `${platform} connected`);
    } catch (err) {
      showNote(
        "error",
        err instanceof Error ? err.message : "Failed to add connection",
      );
    }
  }

  async function deleteConnection(id: string) {
    if (!confirm("Remove this connection?")) return;
    try {
      const res = await fetch(`/api/connections?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      setConnections(connections.filter((c) => c.id !== id));
      showNote("success", "Connection removed");
    } catch (err) {
      showNote(
        "error",
        err instanceof Error ? err.message : "Failed to delete connection",
      );
    }
  }

  function getPlatformColor(p: string) {
    switch (p) {
      case "instagram":
        return "bg-gradient-to-br from-purple-500 to-pink-500";
      case "twitter":
        return "bg-gradient-to-br from-blue-400 to-blue-600";
      case "linkedin":
        return "bg-gradient-to-br from-blue-600 to-blue-800";
      default:
        return "bg-gray-500";
    }
  }

  function statusBadge(conn: Connection) {
    const status = conn.connection_status || "active";
    if (status === "active") {
      return (
        <Badge
          variant="outline"
          className="bg-green-50 text-green-700 border-green-200 text-[10px] sm:text-xs px-1.5 sm:px-2"
        >
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Active
        </Badge>
      );
    }
    if (status === "expired") {
      return (
        <Badge
          variant="outline"
          className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] sm:text-xs px-1.5 sm:px-2"
        >
          <AlertCircle className="mr-1 h-3 w-3" />
          Token expired
        </Badge>
      );
    }
    return (
      <Badge
        variant="outline"
        className="bg-red-50 text-red-700 border-red-200 text-[10px] sm:text-xs px-1.5 sm:px-2"
      >
        <AlertCircle className="mr-1 h-3 w-3" />
        {status}
      </Badge>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 px-4 sm:px-6 py-4 sm:py-6 max-w-[1400px]">
      {notification && (
        <div className="fixed top-4 right-4 z-50">
          <div
            className={`rounded-lg border px-4 py-2.5 text-sm shadow-lg ${
              notification.type === "success"
                ? "bg-green-50 dark:bg-green-950/40 border-green-300 dark:border-green-700 dark:border-green-700 text-green-800 dark:text-green-200"
                : notification.type === "error"
                  ? "bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-700 dark:border-red-700 text-red-800 dark:text-red-200"
                  : "bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 dark:border-blue-700 text-blue-800 dark:text-blue-200"
            }`}
          >
            {notification.message}
          </div>
        </div>
      )}

      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg">
            <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
          </div>
          Connections
        </h1>
        <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
          Connect your social media accounts to automate content posting
        </p>
      </div>

      {pageCandidates.length > 0 && (
        <Card className="border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Pick the Instagram account to connect
            </CardTitle>
            <CardDescription className="text-xs">
              You manage multiple Facebook Pages. Choose which Instagram
              Business account this connection should publish to.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {pageCandidates.map((p) => (
              <div
                key={p.pageId}
                className="flex items-center justify-between rounded-md border bg-card p-3"
              >
                <div>
                  <p className="text-sm font-medium">{p.pageName}</p>
                  <p className="text-xs text-muted-foreground">
                    IG ID: {p.igUserId}
                  </p>
                </div>
                <Button
                  size="sm"
                  disabled={pickingPage}
                  onClick={() => selectPage(p.pageId)}
                >
                  {pickingPage ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                  )}
                  Use this account
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card className="lg:col-span-1 shadow-md hover:shadow-lg transition-shadow">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Plus className="h-4 w-4 sm:h-5 sm:w-5" />
              Add New Connection
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Connect a new social media account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="space-y-2">
              <Label htmlFor="platform" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Platform
              </Label>
              <Select
                value={platform}
                onValueChange={(
                  value: "instagram" | "twitter" | "linkedin",
                ) => {
                  setPlatform(value);
                  setFormData({});
                }}
              >
                <SelectTrigger id="platform">
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

            {platform === "instagram" && (
              <div className="space-y-3">
                <div className="rounded-md border bg-blue-50/60 p-3 text-xs text-blue-900 space-y-1">
                  <p className="font-medium">Requirements</p>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] leading-relaxed">
                    <li>Instagram Business or Creator account</li>
                    <li>Connected to a Facebook Page you admin</li>
                    <li>You&apos;ll grant publishing + insights permissions</li>
                  </ul>
                </div>
                <Button
                  onClick={startInstagramOAuth}
                  className="w-full bg-[#1877F2] hover:bg-[#166fe0] text-white"
                >
                  <Facebook className="mr-2 h-4 w-4" />
                  Connect with Facebook
                </Button>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  We never see your Instagram password. The Meta Graph API
                  issues a token scoped to publishing and insights for the
                  account you choose.
                </p>
              </div>
            )}

            {platform === "twitter" && (
              <>
                <Input
                  name="apiKey"
                  placeholder="API Key"
                  value={formData.apiKey || ""}
                  onChange={handleInputChange}
                />
                <Input
                  name="apiKeySecret"
                  type="password"
                  placeholder="API Key Secret"
                  value={formData.apiKeySecret || ""}
                  onChange={handleInputChange}
                />
                <Input
                  name="accessToken"
                  placeholder="Access Token"
                  value={formData.accessToken || ""}
                  onChange={handleInputChange}
                />
                <Input
                  name="accessTokenSecret"
                  type="password"
                  placeholder="Access Token Secret"
                  value={formData.accessTokenSecret || ""}
                  onChange={handleInputChange}
                />
                <Button
                  onClick={addNonInstagramConnection}
                  className="w-full h-9 sm:h-10 text-sm"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Connect Account
                </Button>
              </>
            )}

            {platform === "linkedin" && (
              <>
                <Input
                  name="accessToken"
                  type="password"
                  placeholder="Access Token"
                  value={formData.accessToken || ""}
                  onChange={handleInputChange}
                />
                <Input
                  name="personUrn"
                  placeholder="Person URN"
                  value={formData.personUrn || ""}
                  onChange={handleInputChange}
                />
                <Input
                  name="organizationId"
                  placeholder="Organization ID (Optional)"
                  value={formData.organizationId || ""}
                  onChange={handleInputChange}
                />
                <Button
                  onClick={addNonInstagramConnection}
                  className="w-full h-9 sm:h-10 text-sm"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Connect Account
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-semibold">
              Your Connections
            </h2>
            <Badge variant="secondary" className="text-xs sm:text-sm">
              {connections.length}{" "}
              {connections.length === 1 ? "account" : "accounts"}
            </Badge>
          </div>

          {loading ? (
            <Card className="p-8 sm:p-12">
              <div className="flex items-center justify-center space-x-3 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Loading connections...</span>
              </div>
            </Card>
          ) : connections.length === 0 ? (
            <Card className="p-8 sm:p-12 border-2 border-dashed">
              <div className="text-center">
                <Shield className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground mb-3 sm:mb-4" />
                <p className="text-muted-foreground text-base sm:text-lg mb-2">
                  No connections yet
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Connect your first social media account to get started
                </p>
              </div>
            </Card>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {connections.map((conn) => (
                <Card
                  key={conn.id}
                  className="hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center p-3 sm:p-4 gap-3 sm:gap-4">
                    <div
                      className={`w-10 h-10 sm:w-14 sm:h-14 rounded-xl ${getPlatformColor(conn.platform)} flex items-center justify-center shadow-md shrink-0`}
                    >
                      <div className="text-white">
                        {conn.platform === "instagram" && (
                          <Instagram className="h-5 w-5 sm:h-7 sm:w-7" />
                        )}
                        {conn.platform === "twitter" && (
                          <Twitter className="h-5 w-5 sm:h-7 sm:w-7" />
                        )}
                        {conn.platform === "linkedin" && (
                          <Linkedin className="h-5 w-5 sm:h-7 sm:w-7" />
                        )}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
                        <h3 className="font-semibold capitalize text-sm sm:text-lg">
                          {conn.platform}
                        </h3>
                        {statusBadge(conn)}
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">
                        @{conn.profile_name}
                      </p>
                      {conn.platform === "instagram" &&
                        conn.token_expires_at && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Token expires{" "}
                            {new Date(
                              conn.token_expires_at,
                            ).toLocaleDateString()}
                          </p>
                        )}
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      {conn.platform === "instagram" &&
                        conn.connection_status &&
                        conn.connection_status !== "active" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 sm:h-9"
                            onClick={startInstagramOAuth}
                          >
                            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                            Reconnect
                          </Button>
                        )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 sm:h-9 sm:w-auto p-0 sm:px-3"
                        onClick={() =>
                          window.open(
                            `https://${conn.platform}.com/${conn.profile_name}`,
                            "_blank",
                          )
                        }
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 sm:h-9 sm:w-auto p-0 sm:px-3 hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => deleteConnection(conn.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
