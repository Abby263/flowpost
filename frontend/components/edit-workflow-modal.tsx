import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  ScheduleEditor,
  type ScheduleValue,
} from "@/components/schedule-editor";

interface EditWorkflowModalProps {
  workflow: any;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedWorkflow: any) => Promise<void>;
}

export function EditWorkflowModal({
  workflow,
  isOpen,
  onClose,
  onSave,
}: EditWorkflowModalProps) {
  const [formData, setFormData] = useState({
    name: workflow.name,
    search_query: workflow.search_query,
    requires_approval: workflow.requires_approval,
  });
  const [schedule, setSchedule] = useState<ScheduleValue>({
    scheduling_mode: workflow.scheduling_mode === "cron" ? "cron" : "frequency",
    frequency: (workflow.frequency || "daily") as ScheduleValue["frequency"],
    cron_expression: workflow.cron_expression || "",
    timezone: workflow.timezone || "UTC",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave({
        ...workflow,
        ...formData,
        scheduling_mode: schedule.scheduling_mode,
        frequency: schedule.frequency,
        cron_expression: schedule.cron_expression || null,
        timezone: schedule.timezone,
      });
      onClose();
    } catch (error) {
      console.error("Failed to update workflow", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Workflow</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="search_query">Search Query</Label>
            <Textarea
              id="search_query"
              value={formData.search_query}
              onChange={(e) =>
                setFormData({ ...formData, search_query: e.target.value })
              }
            />
          </div>

          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-sm font-medium">Schedule</p>
            <ScheduleEditor value={schedule} onChange={setSchedule} />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="requires_approval"
              checked={formData.requires_approval}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, requires_approval: checked })
              }
            />
            <Label htmlFor="requires_approval">Require Approval (HITL)</Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
