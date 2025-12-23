"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar as CalendarIcon, Repeat, Check } from "lucide-react";

interface ScheduleWorkflowDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (scheduleData: ScheduleData) => void;
  workflowName: string;
}

export interface ScheduleData {
  date: Date;
  time: string;
  repeatType: "once" | "daily" | "weekly" | "monthly" | "yearly";
  repeatDays?: string[]; // For weekly: ["monday", "wednesday", etc]
}

export function ScheduleWorkflowDialog({
  isOpen,
  onClose,
  onSchedule,
  workflowName,
}: ScheduleWorkflowDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date(),
  );
  const [selectedTime, setSelectedTime] = useState("09:00");
  const [repeatType, setRepeatType] = useState<
    "once" | "daily" | "weekly" | "monthly" | "yearly"
  >("once");
  const [selectedDays, setSelectedDays] = useState<string[]>([]);

  const hours = Array.from({ length: 24 }, (_, i) =>
    i.toString().padStart(2, "0"),
  );
  const minutes = ["00", "15", "30", "45"];
  const weekDays = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  const toggleDay = (day: string) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter((d) => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleSchedule = () => {
    if (!selectedDate) {
      alert("Please select a date");
      return;
    }

    if (repeatType === "weekly" && selectedDays.length === 0) {
      alert("Please select at least one day for weekly repeat");
      return;
    }

    const scheduleData: ScheduleData = {
      date: selectedDate,
      time: selectedTime,
      repeatType,
      repeatDays: repeatType === "weekly" ? selectedDays : undefined,
    };

    onSchedule(scheduleData);
    onClose();
  };

  const getScheduleSummary = () => {
    if (!selectedDate) return "";

    const dateStr = selectedDate.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    switch (repeatType) {
      case "once":
        return `${dateStr} at ${selectedTime}`;
      case "daily":
        return `Every day at ${selectedTime}, starting ${dateStr}`;
      case "weekly":
        if (selectedDays.length === 0) return "Select days below";
        return `Every ${selectedDays.join(", ")} at ${selectedTime}`;
      case "monthly":
        return `Every month on day ${selectedDate.getDate()} at ${selectedTime}`;
      case "yearly":
        return `Every year on ${selectedDate.toLocaleDateString("en-US", { month: "long", day: "numeric" })} at ${selectedTime}`;
      default:
        return "";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Schedule Workflow Run
          </DialogTitle>
          <DialogDescription>
            Schedule "{workflowName}" to run automatically
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Date Selector */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              Select Date
            </Label>
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={(date) =>
                  date < new Date(new Date().setHours(0, 0, 0, 0))
                }
                className="rounded-md border shadow-sm"
              />
            </div>
          </div>

          {/* Time Selector */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Select Time
            </Label>
            <div className="flex gap-2">
              <Select
                value={selectedTime.split(":")[0]}
                onValueChange={(h) =>
                  setSelectedTime(`${h}:${selectedTime.split(":")[1]}`)
                }
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue placeholder="Hour" />
                </SelectTrigger>
                <SelectContent>
                  {hours.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="flex items-center text-2xl font-bold">:</span>
              <Select
                value={selectedTime.split(":")[1]}
                onValueChange={(m) =>
                  setSelectedTime(`${selectedTime.split(":")[0]}:${m}`)
                }
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue placeholder="Minute" />
                </SelectTrigger>
                <SelectContent>
                  {minutes.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Repeat Options */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Repeat className="h-4 w-4" />
              Repeat
            </Label>
            <Select
              value={repeatType}
              onValueChange={(value: any) => setRepeatType(value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select repeat type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="once">Does not repeat</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Weekly Day Selector */}
          {repeatType === "weekly" && (
            <div className="space-y-2">
              <Label>Repeat on</Label>
              <div className="flex flex-wrap gap-2">
                {weekDays.map((day) => (
                  <Badge
                    key={day}
                    variant={selectedDays.includes(day) ? "default" : "outline"}
                    className="cursor-pointer hover:bg-primary/80 px-3 py-1"
                    onClick={() => toggleDay(day)}
                  >
                    {selectedDays.includes(day) && (
                      <Check className="mr-1 h-3 w-3" />
                    )}
                    {day.slice(0, 3)}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Schedule Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm font-medium text-blue-900 mb-1">
              Schedule Summary
            </p>
            <p className="text-sm text-blue-800">{getScheduleSummary()}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSchedule}>
            <Clock className="mr-2 h-4 w-4" />
            Schedule Workflow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
