"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WorkflowCard } from "@/components/workflow-card";
import { EditWorkflowModal } from "@/components/edit-workflow-modal";
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  AlertCircle,
  CheckCircle2,
  Info,
  Loader2,
  Workflow,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Track workflows being triggered to prevent duplicate clicks
const pendingTriggers = new Set<string>();

export default function WorkflowsPage() {
  const { user } = useUser();
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [connections, setConnections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingWorkflow, setEditingWorkflow] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Form state for creating new workflow
  const [newWorkflow, setNewWorkflow] = useState({
    name: "",
    platform: "",
    connection_id: "",
    search_query: "",
    location: "",
    style_prompt: "",
    schedule: "",
    frequency: "daily",
    requires_approval: false,
  });

  // Status polling state - track which workflows are being polled
  const [workflowStatuses, setWorkflowStatuses] = useState<
    Record<string, { status: string; error?: string }>
  >({});
  const pollingIntervals = useRef<Record<string, NodeJS.Timeout>>({});

  // Notification state
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const showNotification = useCallback(
    (type: "success" | "error" | "info", message: string) => {
      setNotification({ type, message });
      setTimeout(() => setNotification(null), 5000);
    },
    [],
  );

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      Object.values(pollingIntervals.current).forEach(clearInterval);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchWorkflows();
    fetchConnections();
  }, [user]);

  // Poll status for running workflows
  const startPollingStatus = useCallback(
    (workflowId: string) => {
      // Don't start duplicate polling
      if (pollingIntervals.current[workflowId]) return;

      const pollStatus = async () => {
        try {
          const res = await fetch(
            `/api/workflow-status?workflowId=${workflowId}`,
          );
          const data = await res.json();

          if (data.status === "completed" || data.status === "failed") {
            // Stop polling
            if (pollingIntervals.current[workflowId]) {
              clearInterval(pollingIntervals.current[workflowId]);
              delete pollingIntervals.current[workflowId];
            }

            setWorkflowStatuses((prev) => ({
              ...prev,
              [workflowId]: {
                status: data.status,
                error: data.error,
              },
            }));

            // Show notification
            if (data.status === "completed") {
              showNotification(
                "success",
                "Workflow completed successfully! Check posts for results.",
              );
            } else {
              showNotification(
                "error",
                data.error || "Workflow failed. Check logs for details.",
              );
            }

            // Refresh workflows to get latest post data
            fetchWorkflows();
          } else {
            setWorkflowStatuses((prev) => ({
              ...prev,
              [workflowId]: { status: data.status || "running" },
            }));
          }
        } catch (error) {
          console.error("Failed to poll status:", error);
        }
      };

      // Initial poll
      pollStatus();

      // Start interval polling (every 5 seconds)
      pollingIntervals.current[workflowId] = setInterval(pollStatus, 5000);
    },
    [showNotification],
  );

  async function fetchWorkflows() {
    setLoading(true);
    try {
      const res = await fetch("/api/workflows?includePosts=true");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch workflows");
      }
      const workflowsData = data.workflows || [];
      const processed = workflowsData.map((wf: any) => {
        const posts = wf.posts || [];
        const lastPost = posts.sort(
          (a: any, b: any) =>
            new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime(),
        )[0];

        // Update local status from database
        if (wf.run_status === "running") {
          setWorkflowStatuses((prev) => ({
            ...prev,
            [wf.id]: { status: "running" },
          }));
          // Start polling if not already
          startPollingStatus(wf.id);
        }

        return {
          ...wf,
          post_count: posts.length,
          last_posted_at: lastPost ? lastPost.posted_at : null,
        };
      });
      setWorkflows(processed);
    } catch (error) {
      console.error("Error fetching workflows:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchConnections() {
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
  }

  async function createWorkflow() {
    if (
      !newWorkflow.name ||
      !newWorkflow.platform ||
      !newWorkflow.connection_id ||
      !newWorkflow.search_query
    ) {
      showNotification("error", "Please fill in all required fields");
      return;
    }

    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newWorkflow),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create workflow");
      }
      setWorkflows([data.workflow, ...workflows]);
      setIsCreateModalOpen(false);
      showNotification(
        "success",
        `Workflow "${newWorkflow.name}" created successfully!`,
      );
      setNewWorkflow({
        name: "",
        platform: "",
        connection_id: "",
        search_query: "",
        location: "",
        style_prompt: "",
        schedule: "",
        frequency: "daily",
        requires_approval: false,
      });
    } catch (error: any) {
      showNotification(
        "error",
        "Failed to create workflow: " + (error?.message || "Unknown error"),
      );
    }
  }

  async function deleteWorkflow(id: string) {
    if (!confirm("Are you sure you want to delete this workflow?")) return;

    const workflowName = workflows.find((w) => w.id === id)?.name || "workflow";
    try {
      const res = await fetch(`/api/workflows?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete workflow");
      }
      setWorkflows(workflows.filter((w) => w.id !== id));
      showNotification("success", `"${workflowName}" deleted successfully`);
    } catch (error) {
      showNotification("error", "Failed to delete workflow");
    }
  }

  async function toggleWorkflowActive(id: string, currentStatus: boolean) {
    try {
      const res = await fetch("/api/workflows", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, is_active: !currentStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update workflow");
      }
      setWorkflows(
        workflows.map((w) =>
          w.id === id ? { ...w, is_active: !currentStatus } : w,
        ),
      );
      showNotification(
        "success",
        `Workflow ${!currentStatus ? "enabled" : "paused"}`,
      );
    } catch (error) {
      showNotification("error", "Failed to update workflow status");
    }
  }

  async function resetWorkflowStatus(id: string) {
    if (
      !confirm(
        "This will reset the workflow status to idle. Use this if the workflow is stuck in 'Running' state. Continue?",
      )
    )
      return;

    try {
      const res = await fetch("/api/workflow-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowId: id,
          status: "idle",
          error: "Manually reset by user",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to reset workflow");
      }

      // Stop polling for this workflow
      if (pollingIntervals.current[id]) {
        clearInterval(pollingIntervals.current[id]);
        delete pollingIntervals.current[id];
      }

      // Clear local status
      setWorkflowStatuses((prev) => {
        const newStatuses = { ...prev };
        delete newStatuses[id];
        return newStatuses;
      });

      // Update workflow in state
      setWorkflows(
        workflows.map((w) => (w.id === id ? { ...w, run_status: "idle" } : w)),
      );

      showNotification("success", "Workflow status reset successfully");
    } catch (error) {
      showNotification("error", "Failed to reset workflow status");
    }
  }

  async function updateWorkflow(updatedWorkflow: any) {
    const res = await fetch("/api/workflows", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: updatedWorkflow.id,
        name: updatedWorkflow.name,
        search_query: updatedWorkflow.search_query,
        schedule: updatedWorkflow.schedule,
        frequency: updatedWorkflow.frequency,
        requires_approval: updatedWorkflow.requires_approval,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to update workflow");
    }
    setWorkflows(
      workflows.map((w) => (w.id === updatedWorkflow.id ? updatedWorkflow : w)),
    );
  }

  async function runWorkflow(workflow: any) {
    // Prevent duplicate triggers with client-side guard
    if (pendingTriggers.has(workflow.id)) {
      showNotification("info", "Workflow is being started, please wait...");
      return;
    }

    // Check if already running based on local state
    const currentStatus = workflowStatuses[workflow.id]?.status;
    if (currentStatus === "running" || currentStatus === "starting") {
      showNotification(
        "info",
        "Workflow is already running. Please wait for it to complete.",
      );
      return;
    }

    // Mark as pending
    pendingTriggers.add(workflow.id);
    setWorkflowStatuses((prev) => ({
      ...prev,
      [workflow.id]: { status: "starting" },
    }));

    // Get connection details
    const connection = connections.find((c) => c.id === workflow.connection_id);
    if (!connection) {
      pendingTriggers.delete(workflow.id);
      showNotification("error", "Connection not found for this workflow");
      setWorkflowStatuses((prev) => ({
        ...prev,
        [workflow.id]: { status: "error", error: "Connection not found" },
      }));
      return;
    }

    try {
      showNotification("info", `Starting workflow "${workflow.name}"...`);
      const res = await fetch("/api/trigger-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowId: workflow.id,
        }),
      });
      const data = await res.json();

      if (res.status === 409) {
        // Workflow is already running (conflict)
        setWorkflowStatuses((prev) => ({
          ...prev,
          [workflow.id]: { status: "running" },
        }));
        showNotification(
          "info",
          data.error ||
            "Workflow is already running. Please wait for it to complete.",
        );
        // Start polling since we now know it's running
        startPollingStatus(workflow.id);
        return;
      }

      if (data.success) {
        setWorkflowStatuses((prev) => ({
          ...prev,
          [workflow.id]: { status: "running" },
        }));
        showNotification(
          "success",
          `Workflow "${workflow.name}" is now running!`,
        );
        // Start polling for status
        startPollingStatus(workflow.id);
      } else {
        setWorkflowStatuses((prev) => ({
          ...prev,
          [workflow.id]: { status: "error", error: data.error },
        }));
        showNotification("error", "Failed to start workflow: " + data.error);
      }
    } catch (e: any) {
      setWorkflowStatuses((prev) => ({
        ...prev,
        [workflow.id]: { status: "error", error: e.message },
      }));
      console.error(e);
      showNotification(
        "error",
        "Failed to trigger workflow. Check console for details.",
      );
    } finally {
      // Clear pending guard after a short delay to prevent rapid re-clicks
      setTimeout(() => {
        pendingTriggers.delete(workflow.id);
      }, 2000);
    }
  }

  // Get display status for workflow card
  const getWorkflowStatus = (workflowId: string, dbStatus?: string) => {
    const localStatus = workflowStatuses[workflowId]?.status;
    // Prefer local status if we're tracking it, otherwise use DB status
    if (localStatus) return localStatus;
    if (dbStatus === "running") return "running";
    return "idle";
  };

  return (
    <div className="space-y-8 relative px-6 py-4 max-w-[1400px]">
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
              <Info className="h-5 w-5" />
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

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg">
              <Workflow className="h-5 w-5 text-white" />
            </div>
            Workflows
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage and monitor your content automation workflows
          </p>
        </div>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button className="shrink-0">
              <Plus className="mr-2 h-4 w-4" />
              New Workflow
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create New Workflow</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={newWorkflow.name}
                  onChange={(e) =>
                    setNewWorkflow({ ...newWorkflow, name: e.target.value })
                  }
                  placeholder="e.g., Weekly Tech News"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="platform">Platform</Label>
                  <Select
                    value={newWorkflow.platform}
                    onValueChange={(value) =>
                      setNewWorkflow({ ...newWorkflow, platform: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select platform" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="twitter">Twitter</SelectItem>
                      <SelectItem value="linkedin">LinkedIn</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="connection">Connection</Label>
                  <Select
                    value={newWorkflow.connection_id}
                    onValueChange={(value) =>
                      setNewWorkflow({ ...newWorkflow, connection_id: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {connections
                        .filter(
                          (c) =>
                            !newWorkflow.platform ||
                            c.platform === newWorkflow.platform,
                        )
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.profile_name} ({c.platform})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="search_query">Search Query</Label>
                <Textarea
                  id="search_query"
                  value={newWorkflow.search_query}
                  onChange={(e) =>
                    setNewWorkflow({
                      ...newWorkflow,
                      search_query: e.target.value,
                    })
                  }
                  placeholder="e.g., SpaceX updates, AI news, Tech events..."
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="location">Location (Optional)</Label>
                  <Input
                    id="location"
                    value={newWorkflow.location}
                    onChange={(e) =>
                      setNewWorkflow({
                        ...newWorkflow,
                        location: e.target.value,
                      })
                    }
                    placeholder="e.g., San Francisco, New York..."
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="style_prompt">Style/Tone (Optional)</Label>
                  <Input
                    id="style_prompt"
                    value={newWorkflow.style_prompt}
                    onChange={(e) =>
                      setNewWorkflow({
                        ...newWorkflow,
                        style_prompt: e.target.value,
                      })
                    }
                    placeholder="e.g., Professional, Casual..."
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="frequency">Frequency</Label>
                  <Select
                    value={newWorkflow.frequency}
                    onValueChange={(value) =>
                      setNewWorkflow({ ...newWorkflow, frequency: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="schedule">Time (Cron/Text)</Label>
                  <Input
                    id="schedule"
                    value={newWorkflow.schedule}
                    onChange={(e) =>
                      setNewWorkflow({
                        ...newWorkflow,
                        schedule: e.target.value,
                      })
                    }
                    placeholder="e.g., 9:00 AM or 0 9 * * *"
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="requires_approval"
                  checked={newWorkflow.requires_approval}
                  onCheckedChange={(checked) =>
                    setNewWorkflow({
                      ...newWorkflow,
                      requires_approval: checked,
                    })
                  }
                />
                <Label htmlFor="requires_approval">
                  Require Approval (Human in the Loop)
                </Label>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={createWorkflow}>Create Workflow</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="flex items-center space-x-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading workflows...</span>
          </div>
        </div>
      ) : workflows.length === 0 ? (
        <div className="text-center p-12 border-2 border-dashed rounded-lg bg-muted/10">
          <Plus className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-lg">
            No workflows found. Create one to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {workflows.map((workflow) => (
            <WorkflowCard
              key={workflow.id}
              workflow={workflow}
              status={getWorkflowStatus(workflow.id, workflow.run_status)}
              postCount={workflow.post_count}
              lastPostedAt={workflow.last_posted_at}
              onRun={() => runWorkflow(workflow)}
              onToggleActive={() =>
                toggleWorkflowActive(workflow.id, workflow.is_active)
              }
              onDelete={() => deleteWorkflow(workflow.id)}
              onEdit={() => {
                setEditingWorkflow(workflow);
                setIsEditModalOpen(true);
              }}
              onResetStatus={() => resetWorkflowStatus(workflow.id)}
            />
          ))}
        </div>
      )}

      {editingWorkflow && (
        <EditWorkflowModal
          workflow={editingWorkflow}
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingWorkflow(null);
          }}
          onSave={updateWorkflow}
        />
      )}
    </div>
  );
}
