# Azure Infrastructure Guide

## Overview

This document describes the Azure infrastructure for the FlowPost application, including PostgreSQL integration, Blue/Green deployment strategy, and health probes.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      GitHub CI/CD Pipeline (Blue/Green)                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   ┌──────────┐   ┌──────────────┐   ┌─────────┐   ┌────────────────────────┐   │
│   │ Version  │ → │ Code Quality │ → │ Package │ → │ Blue/Green Deploy      │   │
│   └──────────┘   └──────────────┘   └─────────┘   │                        │   │
│                                                    │  1. Deploy Green (0%)  │   │
│   • Semantic      • Pre-commit       • Docker     │  2. Health Check       │   │
│     versioning      hooks              build      │  3. Shift Traffic 10%  │   │
│   • Tag-based     • Terraform        • Push to   │  4. Integration Tests  │   │
│     releases        validation         ACR       │  5. Promote to 100%    │   │
│                                                    │  6. Deactivate Blue    │   │
│                                                    └────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
                    ▼                   ▼                   ▼
            ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
            │      DEV      │   │      UAT      │   │     PROD      │
            │  (automatic)  │   │   (manual)    │   │   (manual)    │
            └───────────────┘   └───────────────┘   └───────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                            Azure Infrastructure                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────────┐ │
│  │   Azure Key     │  │   Container     │  │  PostgreSQL Flexible Server     │ │
│  │   Vault         │  │   Registry      │  │  (Shared Resource)              │ │
│  │                 │  │   (ACR)         │  │                                 │ │
│  │  • DB URI       │  │  • Backend      │  │  • Dev/UAT: Shared server       │ │
│  │  • DB Password  │  │  • Frontend     │  │  • Prod: Dedicated server       │ │
│  └────────┬────────┘  └────────┬────────┘  └─────────────┬───────────────────┘ │
│           │                    │                         │                      │
│           ▼                    ▼                         ▼                      │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │                    Container Apps Environment                               │ │
│  │                                                                             │ │
│  │  ┌─────────────────────────────┐    ┌─────────────────────────────┐       │ │
│  │  │    Backend (LangGraph)      │    │     Frontend (Next.js)      │       │ │
│  │  │                             │    │                             │       │ │
│  │  │  ┌───────────────────────┐  │    │  ┌───────────────────────┐  │       │ │
│  │  │  │  Blue Revision (old)  │  │    │  │  Blue Revision (old)  │  │       │ │
│  │  │  │  Traffic: 0-90%       │  │    │  │  Traffic: 0-90%       │  │       │ │
│  │  │  └───────────────────────┘  │    │  └───────────────────────┘  │       │ │
│  │  │  ┌───────────────────────┐  │    │  ┌───────────────────────┐  │       │ │
│  │  │  │ Green Revision (new)  │  │    │  │ Green Revision (new)  │  │       │ │
│  │  │  │  Traffic: 10-100%     │  │    │  │  Traffic: 10-100%     │  │       │ │
│  │  │  └───────────────────────┘  │    │  └───────────────────────┘  │       │ │
│  │  │                             │    │                             │       │ │
│  │  │  Health Probes:             │    │  Health Probes:             │       │ │
│  │  │  • /health/startup          │    │  • /api/health/startup      │       │ │
│  │  │  • /health/live             │    │  • /api/health/live         │       │ │
│  │  │  • /health/ready            │    │  • /api/health/ready        │       │ │
│  │  │                             │    │                             │       │ │
│  │  │  Port: 54367                │    │  Port: 3000                 │       │ │
│  │  └──────────────┬──────────────┘    └─────────────────────────────┘       │ │
│  │                 │                                                          │ │
│  │                 │ DATABASE_URI                                             │ │
│  │                 ▼                                                          │ │
│  │  ┌─────────────────────────────────────────────────────────────────────┐  │ │
│  │  │                     PostgreSQL (LangGraph State)                     │  │ │
│  │  │  • Graph execution checkpoints                                       │  │ │
│  │  │  • Agent state and memory                                            │  │ │
│  │  │  • Interrupt handling                                                │  │ │
│  │  └─────────────────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Blue/Green Deployment Strategy

### Overview

Blue/Green deployment minimizes downtime and risk by running two identical production environments:

| Revision  | Description                | Traffic           |
| --------- | -------------------------- | ----------------- |
| **Blue**  | Current stable version     | 90-100% initially |
| **Green** | New version being deployed | 0-10% initially   |

### Deployment Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Deploy    │ --> │   Health    │ --> │   Traffic   │ --> │  Promote/   │
│   Green     │     │   Check     │     │   Shift     │     │  Rollback   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
      │                   │                   │                   │
      ▼                   ▼                   ▼                   ▼
  New revision       Wait for           Route 10%           If healthy:
  deployed with      startup,           traffic to          → 100% Green
  0% traffic         liveness,          green               → Deactivate Blue
                     readiness                              If unhealthy:
                     probes                                 → 100% Blue
                                                            → Deactivate Green
```

### Traffic Shifting Pattern

1. **Initial Deploy**: Green revision deployed with 0% traffic
2. **Canary (10%)**: Small traffic sample to validate
3. **Partial (50%)**: Increased confidence
4. **Full (100%)**: Complete migration
5. **Cleanup**: Deactivate old blue revision

### Rollback

Instant rollback by shifting 100% traffic back to blue revision:

```bash
az containerapp ingress traffic set \
  --name flowpost-{env}-backend \
  --resource-group flowpost-{env}-rg \
  --revision-weight {blue-revision}=100
```

## Health Probes

Health probes are automated checks that Kubernetes/Container Apps use to determine application health.

### Probe Types

| Probe         | Purpose                         | On Failure                |
| ------------- | ------------------------------- | ------------------------- |
| **Startup**   | Check if app has started        | Block other probes        |
| **Liveness**  | Check if app is running         | Restart container         |
| **Readiness** | Check if app can accept traffic | Remove from load balancer |

### Startup Probe

**Purpose**: Determine when the application has started successfully

```
Endpoint: /health/startup (backend) or /api/health/startup (frontend)
```

**Configuration**:

```hcl
startup_probe {
  path                    = "/health/startup"
  initial_delay           = 10    # Wait 10s before first check
  interval_seconds        = 10    # Check every 10s
  timeout                 = 5     # 5s timeout per check
  failure_count_threshold = 30    # 30 failures = 5 min max startup
}
```

**What it checks**:

- Application bootstrap complete
- Essential configuration loaded
- Critical initialization done

**What it does NOT check**:

- External service connectivity (use readiness)
- Database connections (use readiness)

### Liveness Probe

**Purpose**: Detect if the application is in a broken state

```
Endpoint: /health/live (backend) or /api/health/live (frontend)
```

**Configuration**:

```hcl
liveness_probe {
  path                    = "/health/live"
  initial_delay           = 0     # Start immediately after startup
  interval_seconds        = 30    # Check every 30s
  timeout                 = 5     # 5s timeout per check
  failure_count_threshold = 3     # 3 failures = restart
}
```

**What it checks**:

- Event loop is responsive
- Memory usage is acceptable (<95%)
- No deadlocks or infinite loops

**What it does NOT check**:

- External dependencies
- Database connectivity

### Readiness Probe

**Purpose**: Determine if the application can accept traffic

```
Endpoint: /health/ready (backend) or /api/health/ready (frontend)
```

**Configuration**:

```hcl
readiness_probe {
  path                    = "/health/ready"
  interval_seconds        = 10    # Check every 10s
  timeout                 = 5     # 5s timeout per check
  success_count_threshold = 1     # 1 success = ready
  failure_count_threshold = 3     # 3 failures = remove from LB
}
```

**What it checks**:

- LangGraph API is reachable
- Required credentials are configured
- Database connection is working

### Health Probe Endpoints

#### Backend (LangGraph)

| Endpoint          | Probe Type | Response       |
| ----------------- | ---------- | -------------- |
| `/health/startup` | Startup    | 200 if started |
| `/health/live`    | Liveness   | 200 if alive   |
| `/health/ready`   | Readiness  | 200 if ready   |
| `/ok`             | Legacy     | 200 if running |

#### Frontend (Next.js)

| Endpoint              | Probe Type | Response        |
| --------------------- | ---------- | --------------- |
| `/api/health/startup` | Startup    | 200 if started  |
| `/api/health/live`    | Liveness   | 200 if alive    |
| `/api/health/ready`   | Readiness  | 200 if ready    |
| `/api/health`         | General    | Detailed status |

## PostgreSQL Configuration

### Database Name Sanitization

PostgreSQL database names must follow these rules:

- Start with a letter or underscore
- Contain only letters, digits, and underscores
- Maximum 63 characters

```hcl
locals {
  postgres_raw_name       = "${var.project_name}_${var.environment}_db"
  postgres_sanitized_name = replace(lower(local.postgres_raw_name), "/[^a-z0-9_]/", "_")
  postgres_db_name        = substr(local.postgres_sanitized_name, 0, 63)
}
```

### Shared vs Dedicated Servers

| Environment | PostgreSQL Server | HA  | Geo-Backup |
| ----------- | ----------------- | --- | ---------- |
| Dev         | Shared (dev)      | No  | No         |
| UAT         | Shared (dev)      | No  | No         |
| Prod        | Dedicated (prod)  | Yes | Yes        |

### Secret Management

PostgreSQL credentials stored in Azure Key Vault:

| Secret                       | Description         |
| ---------------------------- | ------------------- |
| `{prefix}-postgres-host`     | Server FQDN         |
| `{prefix}-postgres-admin`    | Admin username      |
| `{prefix}-postgres-password` | Admin password      |
| `{prefix}-postgres-uri`      | Full connection URI |

## Environment Deployment Strategy

| Trigger              | Environment | Deployment | Traffic    |
| -------------------- | ----------- | ---------- | ---------- |
| Push to develop/main | Dev         | Automatic  | 100%       |
| Pull Request         | Review      | Automatic  | 100%       |
| Tag v\*              | UAT         | Manual     | 10% → 100% |
| Manual dispatch      | Prod        | Manual     | 10% → 100% |

## Required GitHub Secrets

| Secret                    | Description         | Required |
| ------------------------- | ------------------- | -------- |
| `ARM_CLIENT_ID`           | Azure SP Client ID  | Yes      |
| `ARM_CLIENT_SECRET`       | Azure SP Secret     | Yes      |
| `ARM_SUBSCRIPTION_ID`     | Azure Subscription  | Yes      |
| `ARM_TENANT_ID`           | Azure Tenant        | Yes      |
| `POSTGRES_ADMIN_PASSWORD` | PostgreSQL password | Yes      |
| `CLERK_PUBLISHABLE_KEY`   | Clerk public key    | Yes      |
| `CLERK_SECRET_KEY`        | Clerk secret key    | Yes      |
| `GEMINI_API_KEY`          | Gemini API key      | One of   |
| `OPENAI_API_KEY`          | OpenAI API key      | One of   |

## Files Reference

### Terraform

- `terraform/main.tf` - Main infrastructure
- `terraform/variables.tf` - Variable definitions
- `terraform/modules/container-app/` - Container App with health probes
- `terraform/modules/postgresql/` - PostgreSQL Flexible Server
- `terraform/modules/key-vault/` - Key Vault for secrets

### CI/CD

- `.github/workflows/deploy.yml` - Blue/Green deployment
- `.github/workflows/terraform.yml` - Infrastructure pipeline

### Health Endpoints

- `frontend/app/api/health/startup/route.ts`
- `frontend/app/api/health/live/route.ts`
- `frontend/app/api/health/ready/route.ts`
