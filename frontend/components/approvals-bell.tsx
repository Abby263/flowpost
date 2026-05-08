"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ApprovalSummary {
  id: string;
  workflow_id: string | null;
  workflow_name: string | null;
  content: string | null;
}

/**
 * Bell-with-badge that shows the user how many drafts are awaiting their
 * review across all workflows. Clicking jumps to /dashboard/workflows where
 * pending counts are shown per workflow.
 *
 * Polls every 60s while signed in. Could move to SSE/websockets later;
 * polling is fine for the volume we expect.
 */
export function ApprovalsBell() {
  const { isSignedIn } = useUser();
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      const res = await fetch("/api/approvals");
      if (!res.ok) return;
      const data = (await res.json()) as { approvals?: ApprovalSummary[] };
      setCount(data.approvals?.length || 0);
    } catch {
      // Silent — bell just won't update; not worth surfacing.
    }
  }, [isSignedIn]);

  useEffect(() => {
    void fetchCount();
    if (!isSignedIn) return;
    const id = setInterval(fetchCount, 60000);
    return () => clearInterval(id);
  }, [isSignedIn, fetchCount]);

  if (!isSignedIn) return null;

  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      className="h-9 w-9 p-0 relative"
      aria-label={
        count > 0
          ? `${count} draft${count === 1 ? "" : "s"} awaiting review`
          : "No drafts awaiting review"
      }
      title={
        count > 0
          ? `${count} draft${count === 1 ? "" : "s"} awaiting review`
          : "No drafts awaiting review"
      }
    >
      <Link href="/dashboard/workflows">
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold leading-none text-white">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </Link>
    </Button>
  );
}
