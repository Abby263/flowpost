/**
 * Register the every-5-minute sweep as a QStash Schedule.
 *
 * Why this exists: Vercel Hobby caps cron jobs at daily. The scheduler v3
 * needs sub-day granularity (otherwise "Mon-Fri at 9am" can't fire at the
 * right minute). Upstash QStash has its own scheduling primitive, so we
 * use it to drive the sweep — same vendor as the queue, no Vercel Pro
 * required.
 *
 * Run once after deploying:
 *
 *   QSTASH_TOKEN=...                       \
 *   NEXT_PUBLIC_APP_URL=https://app.url   \
 *   CRON_SECRET=...                        \
 *   yarn tsx scripts/qstash/setup-sweep-schedule.ts
 *
 * The script is idempotent — running it twice updates the existing schedule
 * if the destination URL matches.
 */

import "dotenv/config";
import { Client } from "@upstash/qstash";

async function main() {
  const token = process.env.QSTASH_TOKEN;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const cronSecret = process.env.CRON_SECRET;

  if (!token) throw new Error("QSTASH_TOKEN is not set");
  if (!appUrl?.startsWith("https://"))
    throw new Error("NEXT_PUBLIC_APP_URL must be a public https URL");
  if (!cronSecret) throw new Error("CRON_SECRET must be set");

  const destination = `${appUrl}/api/cron/run-due-workflows`;
  const cron = process.env.SWEEP_CRON || "*/5 * * * *";

  const client = new Client({ token });
  const schedules = await client.schedules.list();
  const existing = schedules.find((s) => s.destination === destination);

  if (existing) {
    console.log(`Schedule already exists for ${destination}`);
    console.log(`  id:   ${existing.scheduleId}`);
    console.log(`  cron: ${existing.cron}`);
    if (existing.cron === cron) {
      console.log("Cron matches; nothing to do.");
      return;
    }
    console.log(`Updating cron → ${cron}...`);
    await client.schedules.delete(existing.scheduleId);
  }

  const created = await client.schedules.create({
    destination,
    cron,
    headers: {
      Authorization: `Bearer ${cronSecret}`,
    },
    retries: 0,
  });
  console.log(
    `Created QStash schedule ${created.scheduleId} → ${destination} (cron: ${cron}).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
