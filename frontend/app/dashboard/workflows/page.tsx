"use client";

import { useState, useEffect } from "react";
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
import { Plus, AlertCircle, CheckCircle2, Info, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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

  // Status polling state
  const [workflowStatuses, setWorkflowStatuses] = useState<
    Record<string, string>
  >({});
  const [activeRuns, setActiveRuns] = useState<
    Record<string, { threadId: string; runId: string }>
  >({});

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
    if (!user) return;
    fetchWorkflows();
    fetchConnections();
  }, [user]);

  // Auto-refresh for active runs (threadless runs can't be polled, so we refresh workflows list)
  useEffect(() => {
    if (Object.keys(activeRuns).length === 0) return;

    // For threadless streaming runs, we can't poll the LangGraph API directly
    // Instead, refresh the workflows list periodically to check for new posts
    const interval = setInterval(() => {
      fetchWorkflows();
    }, 10000); // Refresh every 10 seconds

    // Auto-complete running status after 60 seconds (typical run duration)
    const timeout = setTimeout(() => {
      for (const workflowId of Object.keys(activeRuns)) {
        setWorkflowStatuses((prev) => {
          const status = prev[workflowId];
          // Only update if still running
          if (status === "running") {
            return { ...prev, [workflowId]: "completed" };
          }
          return prev;
        });
      }
      setActiveRuns({});
      fetchWorkflows();
      showNotification(
        "info",
        "Workflow processing complete. Check posts for results.",
      );
    }, 60000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [activeRuns]);

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
    setWorkflowStatuses((prev) => ({ ...prev, [workflow.id]: "starting" }));

    // Get connection details
    const connection = connections.find((c) => c.id === workflow.connection_id);
    if (!connection) {
      showNotification("error", "Connection not found for this workflow");
      setWorkflowStatuses((prev) => ({ ...prev, [workflow.id]: "error" }));
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
      if (data.success) {
        // Store threadId and runId to poll status
        setActiveRuns((prev) => ({
          ...prev,
          [workflow.id]: { threadId: data.threadId, runId: data.runId },
        }));
        setWorkflowStatuses((prev) => ({ ...prev, [workflow.id]: "running" }));
        showNotification(
          "success",
          `Workflow "${workflow.name}" is now running!`,
        );
      } else {
        setWorkflowStatuses((prev) => ({ ...prev, [workflow.id]: "error" }));
        showNotification("error", "Failed to start workflow: " + data.error);
      }
    } catch (e) {
      setWorkflowStatuses((prev) => ({ ...prev, [workflow.id]: "error" }));
      console.error(e);
      showNotification(
        "error",
        "Failed to trigger workflow. Check console for details.",
      );
    }
  }

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
          <h1 className="text-3xl font-bold tracking-tight">Workflows</h1>
          <p className="text-muted-foreground mt-1">
            Manage and monitor your content automation workflows.
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
              status={workflowStatuses[workflow.id] || "idle"}
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
