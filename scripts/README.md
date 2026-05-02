# Scripts

Utility scripts for local development, migrations, and LangGraph operations.

## Database Migrations

Run migrations against the database configured by `DATABASE_URI`:

```bash
./scripts/run-migration.sh migrations/001_initial_schema.sql
./scripts/run-migration.sh migrations/002_analytics_cache.sql
```

For Vercel deployments, use the same Supabase pooled Postgres URL in Vercel's `DATABASE_URI` environment variable.

## LangGraph Helpers

These scripts expect `LANGGRAPH_API_URL` and any provider keys required by the graph.

```bash
yarn generate_post
yarn cron:create
yarn cron:list
yarn cron:delete
yarn get:scheduled_runs
yarn get:used_links
```
