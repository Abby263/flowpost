"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Loader2, Save, ThumbsDown, ThumbsUp, XCircle } from "lucide-react";

export interface PendingDraft {
  id: string;
  workflow_id: string | null;
  workflow_name?: string | null;
  content: string | null;
  image_url: string | null;
  platform: string | null;
  created_at: string;
}

interface Props {
  draft: PendingDraft;
  onChange?: () => void;
  showWorkflowLabel?: boolean;
}

/**
 * Inline approval UI for one pending_approval post.
 *
 * Used by the workflow detail page (lists this workflow's pending drafts)
 * and reusable for any other surface that wants per-draft approve/reject
 * controls. Talks directly to the existing /api/posts/[id]/{approve,reject}
 * + /api/posts/[id] (PATCH) endpoints.
 */
export function PendingDraftCard({
  draft,
  onChange,
  showWorkflowLabel,
}: Props) {
  const [caption, setCaption] = useState(draft.content || "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<null | "save" | "approve" | "reject">(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | "approved" | "rejected">(null);

  if (done) {
    return (
      <Card className="border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20">
        <CardContent className="p-4 flex items-center gap-3">
          <ThumbsUp
            className={`h-4 w-4 ${
              done === "approved"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            }`}
          />
          <span className="text-sm">
            Draft {done === "approved" ? "approved & published" : "rejected"}.
          </span>
        </CardContent>
      </Card>
    );
  }

  const dirty = caption !== (draft.content || "");

  async function save() {
    setBusy("save");
    setError(null);
    try {
      const res = await fetch(`/api/posts/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: caption }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Save failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(null);
    }
  }

  async function approve() {
    setBusy("approve");
    setError(null);
    try {
      const res = await fetch(`/api/posts/${draft.id}/approve`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Publish failed");
      setDone("approved");
      onChange?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setBusy(null);
    }
  }

  async function reject() {
    if (reason.trim().length < 3) {
      setError("Add a short reason (≥ 3 chars) so the agent learns from it");
      return;
    }
    setBusy("reject");
    setError(null);
    try {
      const res = await fetch(`/api/posts/${draft.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Reject failed");
      setDone("rejected");
      onChange?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reject failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50"
            >
              Pending review
            </Badge>
            {showWorkflowLabel && draft.workflow_name && (
              <Badge variant="outline" className="text-xs">
                {draft.workflow_name}
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {new Date(draft.created_at).toLocaleString()}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-[260px_1fr]">
          <div className="rounded-lg border bg-muted/40 overflow-hidden flex items-center justify-center min-h-[220px]">
            {draft.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={draft.image_url}
                alt="Draft preview"
                className="w-full h-auto object-cover max-h-[360px]"
              />
            ) : (
              <p className="text-sm text-muted-foreground">No image</p>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Caption (editable)
              </label>
              <Textarea
                rows={6}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {caption.length} / 2200 chars
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!dirty || !!busy}
                onClick={save}
              >
                {busy === "save" ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1.5" />
                )}
                Save edit
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={!!busy}
                onClick={approve}
              >
                {busy === "approve" ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <ThumbsUp className="h-4 w-4 mr-1.5" />
                )}
                Approve & publish
              </Button>
            </div>

            <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/40 dark:bg-red-950/20 p-3 space-y-2">
              <label className="text-xs font-medium text-red-900 dark:text-red-300 flex items-center gap-1.5">
                <ThumbsDown className="h-3.5 w-3.5" />
                Reject reason (saved as a learning)
              </label>
              <Textarea
                rows={2}
                placeholder="e.g. caption is too salesy; image looks like a stock photo"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="text-sm bg-background"
              />
              <Button
                size="sm"
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/50"
                disabled={!!busy}
                onClick={reject}
              >
                {busy === "reject" ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4 mr-1.5" />
                )}
                Reject
              </Button>
            </div>

            {error && (
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
