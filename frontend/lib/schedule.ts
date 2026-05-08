import "server-only";
import { CronExpressionParser } from "cron-parser";

/**
 * Schedule helpers — translate workflow cadence settings into a concrete
 * `next_run_at` UTC timestamp.
 *
 * Two modes:
 *   - cron      : cron_expression + timezone (IANA). e.g. "0 9 * * 1-5" in
 *                 America/New_York → next 9am NY weekday in UTC.
 *   - frequency : daily / weekly / monthly cadence; fires from "now" + step.
 *
 * Falls back to a 1-day default if the cron expression is invalid, so a bad
 * value never silently disables the workflow forever.
 */

export type SchedulingMode = "cron" | "frequency";
export type Frequency = "daily" | "weekly" | "monthly";

export interface ScheduleSettings {
  mode: SchedulingMode;
  cronExpression: string | null;
  timezone: string; // IANA, e.g. "America/New_York"
  frequency: Frequency | null;
}

const DEFAULT_TZ = "UTC";

const FREQUENCY_INTERVAL_MS: Record<Frequency, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

export function computeNextRunAt(
  settings: ScheduleSettings,
  from: Date = new Date(),
): Date {
  if (settings.mode === "cron" && settings.cronExpression) {
    try {
      const parsed = CronExpressionParser.parse(settings.cronExpression, {
        currentDate: from,
        tz: settings.timezone || DEFAULT_TZ,
      });
      return parsed.next().toDate();
    } catch (err) {
      console.warn(
        `[schedule] invalid cron "${settings.cronExpression}" in ${settings.timezone}: ${
          err instanceof Error ? err.message : String(err)
        }. Falling back to +1 day.`,
      );
      return new Date(from.getTime() + FREQUENCY_INTERVAL_MS.daily);
    }
  }

  const freq: Frequency = settings.frequency || "daily";
  return new Date(from.getTime() + FREQUENCY_INTERVAL_MS[freq]);
}

export function isValidCronExpression(expr: string, timezone: string): boolean {
  try {
    CronExpressionParser.parse(expr, {
      currentDate: new Date(),
      tz: timezone || DEFAULT_TZ,
    });
    return true;
  } catch {
    return false;
  }
}

export function isValidTimezone(tz: string): boolean {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Render a human-friendly summary of a schedule, used by the UI.
 *
 * Examples:
 *   "Daily" / "Weekly" / "Monthly"
 *   "Cron: 0 9 * * 1-5 (America/New_York)"
 */
export function describeSchedule(settings: ScheduleSettings): string {
  if (settings.mode === "cron" && settings.cronExpression) {
    return `Cron: ${settings.cronExpression} (${settings.timezone || DEFAULT_TZ})`;
  }
  const f = settings.frequency || "daily";
  return f.charAt(0).toUpperCase() + f.slice(1);
}
