# Scripts

Operator scripts for FlowPost. Anything that's run by hand (not by the app at runtime) lives here.

## Database migrations

Apply schema changes against the database configured by `DATABASE_URI`:

```bash
./scripts/run-migration.sh migrations/001_initial_schema.sql
./scripts/run-migration.sh migrations/002_analytics_cache.sql
./scripts/run-migration.sh migrations/003_approvals_learnings_engagement.sql
./scripts/run-migration.sh migrations/004_instagram_oauth.sql
./scripts/run-migration.sh migrations/005_cron_scheduling.sql
```

## QStash sweep schedule

After deploying for the first time, register the every-5-minute workflow sweep with Upstash QStash. Idempotent — re-run to update the cron.

```bash
QSTASH_TOKEN=...                            \
NEXT_PUBLIC_APP_URL=https://<your-domain>  \
CRON_SECRET=...                             \
yarn tsx scripts/qstash/setup-sweep-schedule.ts
```

See `qstash/setup-sweep-schedule.ts` for details.

## langgraph.json validation

```bash
yarn lint:langgraph-json
```

Confirms every graph registered in `langgraph.json` resolves to a real exported symbol.
