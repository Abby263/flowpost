# Database Migrations

This folder contains SQL migration scripts for the FlowPost Azure PostgreSQL database.

## Prerequisites

- Azure PostgreSQL Flexible Server provisioned via Terraform
- PostgreSQL client (`psql`) installed locally
- Database connection URI from Azure Key Vault

## Getting Connection Details

After Terraform provisions the infrastructure:

```bash
# Get the DATABASE_URI from Azure Key Vault
az keyvault secret show \
  --vault-name "your-keyvault-name" \
  --name "database-uri" \
  --query "value" -o tsv
```

Or construct it manually:

```
postgresql://<admin_username>:<admin_password>@<server_fqdn>:5432/<database_name>?sslmode=require
```

## Running Migrations

### Option 1: Using psql directly

```bash
# Set your connection string
export DATABASE_URI="postgresql://admin:password@server.postgres.database.azure.com:5432/flowpost?sslmode=require"

# Run the initial schema migration
psql "$DATABASE_URI" -f migrations/001_initial_schema.sql
```

### Option 2: Using the migration script

```bash
# Make the script executable
chmod +x scripts/run-migration.sh

# Run with environment variable
./scripts/run-migration.sh
```

## Migration Files

| File                      | Description                                |
| ------------------------- | ------------------------------------------ |
| `001_initial_schema.sql`  | Creates all tables, indexes, and functions |
| `002_analytics_cache.sql` | Adds user analytics cache table            |

## Schema Overview

### Core Tables

- **connections** - Social media platform credentials
- **workflows** - Automated workflow configurations
- **posts** - All posts and their history

### Billing Tables

- **plans** - Subscription tier definitions
- **user_subscriptions** - User subscription status
- **user_credits** - Credit balance tracking
- **credit_transactions** - Credit audit trail
- **credit_packages** - One-time purchase options

### Cost Tracking Tables

- **cost_tracking** - Detailed external service costs
- **monthly_cost_summary** - Aggregated monthly costs

### Cache Tables

- **user_analytics_cache** - Cached analytics data per user

## Notes

- All tables use UUIDs as primary keys
- `user_id` is TEXT to match Clerk user IDs
- JSONB is used for flexible nested data (credentials, features, etc.)
- No Row Level Security (RLS) - authentication is handled at the application layer
- SSL is required for all connections (`sslmode=require`)

## Rollback

To drop all tables (⚠️ **DESTRUCTIVE**):

```sql
DROP TABLE IF EXISTS user_analytics_cache CASCADE;
DROP TABLE IF EXISTS cost_tracking CASCADE;
DROP TABLE IF EXISTS monthly_cost_summary CASCADE;
DROP TABLE IF EXISTS credit_transactions CASCADE;
DROP TABLE IF EXISTS credit_packages CASCADE;
DROP TABLE IF EXISTS user_credits CASCADE;
DROP TABLE IF EXISTS user_subscriptions CASCADE;
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS workflows CASCADE;
DROP TABLE IF EXISTS connections CASCADE;
DROP TABLE IF EXISTS plans CASCADE;

DROP FUNCTION IF EXISTS reset_stale_workflows();
DROP FUNCTION IF EXISTS update_monthly_cost_summary();
```
