"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface ScheduleValue {
  scheduling_mode: "frequency" | "cron";
  frequency: "daily" | "weekly" | "monthly";
  cron_expression: string;
  timezone: string;
}

const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

export function ScheduleEditor({
  value,
  onChange,
}: {
  value: ScheduleValue;
  onChange: (next: ScheduleValue) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1 rounded-md border p-1 bg-muted/30">
        <Button
          type="button"
          variant={value.scheduling_mode === "frequency" ? "default" : "ghost"}
          size="sm"
          className="h-8 text-xs"
          onClick={() => onChange({ ...value, scheduling_mode: "frequency" })}
        >
          Simple
        </Button>
        <Button
          type="button"
          variant={value.scheduling_mode === "cron" ? "default" : "ghost"}
          size="sm"
          className="h-8 text-xs"
          onClick={() => onChange({ ...value, scheduling_mode: "cron" })}
        >
          Advanced (cron)
        </Button>
      </div>

      {value.scheduling_mode === "frequency" ? (
        <div className="space-y-2">
          <Label className="text-xs">Frequency</Label>
          <Select
            value={value.frequency}
            onValueChange={(v) =>
              onChange({
                ...value,
                frequency: v as ScheduleValue["frequency"],
              })
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
          <p className="text-[11px] text-muted-foreground">
            Fires the first time{" "}
            {value.frequency === "daily" ? "tomorrow" : "in the next cycle"} and
            every {value.frequency.replace(/ly$/, "")} after that.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <Label className="text-xs">Cron expression</Label>
          <Input
            value={value.cron_expression}
            onChange={(e) =>
              onChange({ ...value, cron_expression: e.target.value })
            }
            placeholder="0 9 * * 1-5"
            className="font-mono text-sm"
          />
          <p className="text-[11px] text-muted-foreground">
            Standard 5-field cron. Examples: <code>0 9 * * *</code> (daily at
            09:00), <code>0 9 * * 1-5</code> (weekdays at 09:00),{" "}
            <code>30 18 * * 0</code> (Sun at 18:30).
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-xs">Timezone</Label>
        <Select
          value={value.timezone}
          onValueChange={(v) => onChange({ ...value, timezone: v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Timezone" />
          </SelectTrigger>
          <SelectContent>
            {COMMON_TIMEZONES.map((tz) => (
              <SelectItem key={tz} value={tz}>
                {tz}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
