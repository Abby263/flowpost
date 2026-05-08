"use client";

import { useCallback, useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Inbox,
  Loader2,
  Save,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from "lucide-react";

interface Approval {
  id: string;
  workflow_id: string | null;
  workflow_name: string | null;
  content: string | null;
  image_url: string | null;
  platform: string | null;
  draft_metadata: Record<string, unknown> | null;
  created_at: string;
}

interface Notification {
  type: "success" | "error" | "info";
  message: string;
}

export default function ApprovalsPage() {
  const { user } = useUser();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>(
    {},
  );
  const [notification, setNotification] = useState<Notification | null>(null);

  const showNote = useCallback(
    (type: Notification["type"], message: string) => {
      setNotification({ type, message });
      setTimeout(() => setNotification(null), 4000);
    },
    [],
  );

  const fetchApprovals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/approvals");
      const data = await res.json();
      setApprovals(data.approvals || []);
    } catch {
      showNote("error", "Failed to load approvals");
    } finally {
      setLoading(false);
    }
  }, [showNote]);

  useEffect(() => {
    if (user) void fetchApprovals();
  }, [user, fetchApprovals]);

  async function saveEdit(id: string) {
    const content = edits[id];
    if (typeof content !== "string") return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/posts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error((await res.json())?.error || "Edit failed");
      showNote("success", "Caption updated");
      setApprovals((prev) =>
        prev.map((a) => (a.id === id ? { ...a, content } : a)),
      );
    } catch (err) {
      showNote(
        "error",
        err instanceof Error ? err.message : "Failed to save edit",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function approve(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/posts/${id}/approve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Approval failed");
      showNote("success", "Published to Instagram");
      setApprovals((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      showNote(
        "error",
        err instanceof Error ? err.message : "Failed to publish",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    const reason = (rejectReasons[id] || "").trim();
    if (reason.length < 3) {
      showNote(
        "info",
        "Add a short reason (at least 3 chars) so the agent can learn from it",
      );
      return;
    }
    setBusyId(id);
    try {
      const res = await fetch(`/api/posts/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Reject failed");
      showNote("success", "Draft rejected — learning saved");
      setApprovals((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      showNote(
        "error",
        err instanceof Error ? err.message : "Failed to reject",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6 px-4 sm:px-6 py-4 sm:py-6 max-w-[1100px]">
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
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
            <Inbox className="h-5 w-5 text-white" />
          </div>
          Approval Inbox
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Drafts the agent generated for you. Approve to publish, or reject with
          a reason so the agent learns what to avoid.
        </p>
      </div>

      {loading ? (
        <Card className="p-12">
          <div className="flex items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading drafts...</span>
          </div>
        </Card>
      ) : approvals.length === 0 ? (
        <Card className="p-12 border-2 border-dashed">
          <div className="text-center">
            <Inbox className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-base font-medium">Nothing waiting for review</p>
            <p className="text-sm text-muted-foreground mt-1">
              When a workflow with &quot;Require Approval&quot; runs, drafts
              will show up here.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {approvals.map((a) => {
            const captionValue = edits[a.id] ?? a.content ?? "";
            const isBusy = busyId === a.id;
            return (
              <Card key={a.id} className="overflow-hidden">
                <CardHeader>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <CardTitle className="text-base">
                        {a.workflow_name || "Manual draft"}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {new Date(a.created_at).toLocaleString()}
                      </CardDescription>
                    </div>
                    <Badge
                      variant="outline"
                      className="bg-amber-50 text-amber-700 border-amber-200"
                    >
                      pending approval · {a.platform || "—"}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-[280px_1fr]">
                    <div className="rounded-lg border bg-muted/40 overflow-hidden flex items-center justify-center min-h-[280px]">
                      {a.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={a.image_url}
                          alt="Draft preview"
                          className="w-full h-auto object-cover max-h-[400px]"
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No image
                        </p>
                      )}
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground mb-1 block">
                          Caption (editable)
                        </label>
                        <Textarea
                          rows={8}
                          value={captionValue}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [a.id]: e.target.value,
                            }))
                          }
                          className="text-sm"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          {captionValue.length} / 2200 chars
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={
                            isBusy ||
                            typeof edits[a.id] === "undefined" ||
                            edits[a.id] === a.content
                          }
                          onClick={() => saveEdit(a.id)}
                        >
                          <Save className="h-4 w-4 mr-1.5" />
                          Save edit
                        </Button>
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                          disabled={isBusy}
                          onClick={() => approve(a.id)}
                        >
                          {isBusy ? (
                            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                          ) : (
                            <ThumbsUp className="h-4 w-4 mr-1.5" />
                          )}
                          Approve & publish
                        </Button>
                      </div>

                      <div className="rounded-lg border bg-red-50/50 p-3 space-y-2">
                        <label className="text-xs font-medium text-red-900 flex items-center gap-1.5">
                          <ThumbsDown className="h-3.5 w-3.5" />
                          Reject reason (saved as a learning)
                        </label>
                        <Textarea
                          rows={2}
                          placeholder="e.g. caption is too salesy; image looks like a stock photo; tone is off-brand"
                          value={rejectReasons[a.id] || ""}
                          onChange={(e) =>
                            setRejectReasons((prev) => ({
                              ...prev,
                              [a.id]: e.target.value,
                            }))
                          }
                          className="text-sm bg-card"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-300 text-red-700 hover:bg-red-100"
                          disabled={isBusy}
                          onClick={() => reject(a.id)}
                        >
                          <XCircle className="h-4 w-4 mr-1.5" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
