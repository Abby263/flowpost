# Database Migrations

This folder contains SQL migrations for FlowPost's Postgres schema. Production deployments should use Supabase Postgres and set `DATABASE_URI` to the pooled Supabase connection string.

## Run Migrations

```bash
export DATABASE_URI="postgresql://postgres.project_ref:password@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require"
./scripts/run-migration.sh migrations/001_initial_schema.sql
./scripts/run-migration.sh migrations/002_analytics_cache.sql
```

For local Docker development:

```bash
export DATABASE_URI="postgresql://flowpost:flowpost_dev_password@localhost:5433/flowpost?sslmode=disable"
./scripts/run-migration.sh migrations/001_initial_schema.sql
```

## Security

The initial migration enables row-level security on app tables. The app uses server-side Postgres access through `DATABASE_URI`; do not expose database credentials to browser code.
