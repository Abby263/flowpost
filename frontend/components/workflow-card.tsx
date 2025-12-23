import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Play,
  Trash2,
  Edit,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Calendar,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";
import {
  ScheduleWorkflowDialog,
  ScheduleData,
} from "@/components/schedule-workflow-dialog";

interface WorkflowCardProps {
  workflow: any;
  status: string;
  postCount: number;
  lastPostedAt: string | null;
  onRun: () => void;
  onToggleActive: (active: boolean) => void;
  onDelete: () => void;
  onEdit: () => void;
}

export function WorkflowCard({
  workflow,
  status,
  postCount,
  lastPostedAt,
  onRun,
  onToggleActive,
  onDelete,
  onEdit,
}: WorkflowCardProps) {
  const router = useRouter();
  const isRunning = status === "running" || status === "starting";
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);

  const handleSchedule = (scheduleData: ScheduleData) => {
    console.log("Scheduling workflow:", workflow.name, scheduleData);
    // TODO: Implement actual scheduling logic with backend API
    alert(
      `Workflow scheduled!\n\nDate: ${scheduleData.date.toLocaleDateString()}\nTime: ${scheduleData.time}\nRepeat: ${scheduleData.repeatType}`,
    );
  };

  const getStatusBadge = () => {
    switch (status) {
      case "running":
      case "starting":
        return (
          <Badge
            variant="secondary"
            className="bg-blue-100 text-blue-800 hover:bg-blue-100"
          >
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            Running
          </Badge>
        );
      case "success":
        return (
          <Badge
            variant="secondary"
            className="bg-green-100 text-green-800 hover:bg-green-100"
          >
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Success
          </Badge>
        );
      case "error":
        return (
          <Badge
            variant="secondary"
            className="bg-red-100 text-red-800 hover:bg-red-100"
          >
            <XCircle className="mr-1 h-3 w-3" />
            Failed
          </Badge>
        );
      default:
        return null;
    }
  };

  const getPlatformIcon = () => {
    switch (workflow.platform) {
      case "instagram":
        return "📸";
      case "twitter":
        return "🐦";
      case "linkedin":
        return "💼";
      default:
        return "📱";
    }
  };

  return (
    <Card
      className="w-full transition-all hover:shadow-md hover:border-primary/40 cursor-pointer group"
      onClick={() => router.push(`/dashboard/workflows/${workflow.id}`)}
    >
      <div className="flex items-center p-5 gap-6">
        {/* Left: Icon and Title */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <span className="text-4xl transition-transform group-hover:scale-110 shrink-0">
            {getPlatformIcon()}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <h3 className="text-lg font-semibold truncate">
                {workflow.name}
              </h3>
              <Badge variant="outline" className="text-xs capitalize shrink-0">
                {workflow.platform}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span className="capitalize">{workflow.frequency}</span>
              {getStatusBadge()}
            </div>
          </div>
        </div>

        {/* Center: Stats */}
        <div className="hidden md:flex items-center gap-8 px-6 border-x shrink-0">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Total Runs</p>
            <p className="text-2xl font-bold">{postCount}</p>
          </div>
          <div className="text-center min-w-[120px]">
            <p className="text-xs text-muted-foreground mb-1">Last Run</p>
            <p className="text-sm font-medium">
              {lastPostedAt
                ? formatDistanceToNow(new Date(lastPostedAt), {
                    addSuffix: true,
                  })
                : "Never"}
            </p>
          </div>
        </div>

        {/* Right: Status and Actions */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex flex-col gap-1.5">
            <Badge
              variant={workflow.is_active ? "default" : "secondary"}
              className={
                workflow.is_active
                  ? "bg-green-600 text-xs justify-center"
                  : "text-xs justify-center"
              }
            >
              {workflow.is_active ? "Active" : "Paused"}
            </Badge>
            {workflow.requires_approval && (
              <Badge
                variant="secondary"
                className="bg-amber-100 text-amber-800 text-xs justify-center"
              >
                Approval
              </Badge>
            )}
          </div>

          <div
            className="flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/40">
              <Switch
                checked={workflow.is_active}
                onCheckedChange={onToggleActive}
              />
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {workflow.is_active ? "Enabled" : "Disabled"}
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsScheduleDialogOpen(true)}
              disabled={!workflow.is_active}
            >
              <Calendar className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              className="hover:bg-destructive hover:text-destructive-foreground"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              onClick={onRun}
              disabled={isRunning || !workflow.is_active}
              className={isRunning ? "animate-pulse" : ""}
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Running
                </>
              ) : (
                <>
                  <Play className="mr-1.5 h-3.5 w-3.5" />
                  Run
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <ScheduleWorkflowDialog
        isOpen={isScheduleDialogOpen}
        onClose={() => setIsScheduleDialogOpen(false)}
        onSchedule={handleSchedule}
        workflowName={workflow.name}
      />
    </Card>
  );
}
