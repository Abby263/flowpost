# PostgreSQL Integration Guide

## Overview

This document describes the Azure Database for PostgreSQL Flexible Server integration for LangGraph API state management.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        GitHub CI/CD Pipeline                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  Version → Code Quality → Package → Deploy → Integration                     │
│                                                                              │
│  • Semantic version bumping on release branches                              │
│  • Pre-commit checks (black, ruff, mypy, terraform)                         │
│  • Docker image builds and push to ACR                                       │
│  • Azure Developer CLI deployment                                            │
│  • Integration tests                                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Azure Infrastructure                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │  Resource Group │  │  Key Vault      │  │  PostgreSQL     │             │
│  │  (per env)      │  │  (secrets)      │  │  Flexible Server│             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
│           │                    │                    │                        │
│           ▼                    ▼                    ▼                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Container Apps Environment                        │   │
│  │  ┌─────────────────────┐      ┌─────────────────────┐               │   │
│  │  │  Backend Container  │      │  Frontend Container │               │   │
│  │  │  (LangGraph API)    │◄────►│  (Next.js)          │               │   │
│  │  │                     │      │                     │               │   │
│  │  │  DATABASE_URI ─────────────────────────────────► PostgreSQL      │   │
│  │  └─────────────────────┘      └─────────────────────┘               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## PostgreSQL Configuration

### Database Name Restrictions

PostgreSQL database names must follow these rules:

- Start with a letter or underscore
- Contain only letters, digits, and underscores
- Maximum 63 characters

The Terraform configuration automatically sanitizes names:

```hcl
locals {
  postgres_raw_name = "${var.project_name}_${var.environment}_db"
  postgres_sanitized_name = replace(lower(local.postgres_raw_name), "/[^a-z0-9_]/", "_")
  postgres_valid_start = regex("^[a-z_]", local.postgres_sanitized_name) == "" ? "_${local.postgres_sanitized_name}" : local.postgres_sanitized_name
  postgres_db_name = substr(local.postgres_valid_start, 0, min(63, length(local.postgres_valid_start)))
}
```

### Secret Management

PostgreSQL credentials are stored in Azure Key Vault:

| Secret Name                  | Description            |
| ---------------------------- | ---------------------- |
| `{prefix}-postgres-host`     | PostgreSQL server FQDN |
| `{prefix}-postgres-admin`    | Administrator username |
| `{prefix}-postgres-password` | Administrator password |
| `{prefix}-postgres-uri`      | Full connection URI    |

### Environment Variables

The `DATABASE_URI` environment variable is injected into the backend container:

```
postgresql://user:password@host:5432/database?sslmode=require
```

## Shared Resources

### Shared PostgreSQL Server

PostgreSQL is a **shared resource** across environments:

- Each environment deployment creates its own **database** on the shared server
- Dev and UAT environments share the dev PostgreSQL server
- Production has its own dedicated PostgreSQL server

### Shared Environment Selection

```hcl
variable "shared_environment" {
  description = "Shared environment name for shared resources (dev, qa, etc.)"
  type        = string
  default     = "dev"
}
```

## Environment Deployment Strategy

| Trigger                     | Environment            | Deployment      |
| --------------------------- | ---------------------- | --------------- |
| Push to `develop` or `main` | Dev                    | Automatic       |
| Pull Request                | Review (Dev resources) | Automatic       |
| Tag `v*`                    | UAT                    | Manual approval |
| Manual dispatch             | UAT/Prod               | Manual approval |

### Release Flow

```
Feature Branch → Review Environment → Dev (auto) → UAT (manual) → Prod (manual)
                      │
                      └── Uses Dev shared resources
```

## Pre-commit Checks

### Python Checks

| Hook    | Description          |
| ------- | -------------------- |
| `black` | Code formatting      |
| `ruff`  | Fast Python linter   |
| `mypy`  | Static type checking |

### General Checks

| Hook                  | Description            |
| --------------------- | ---------------------- |
| `check-yaml`          | Validate YAML syntax   |
| `end-of-file-fixer`   | Ensure newline at EOF  |
| `trailing-whitespace` | Remove trailing spaces |

### Terraform Checks

| Hook                       | Description            |
| -------------------------- | ---------------------- |
| `terraform_fmt`            | Format Terraform code  |
| `terraform_tflint`         | Lint Terraform code    |
| `terraform_providers_lock` | Lock provider versions |
| `terraform_validate`       | Validate configuration |

## LangGraph API Integration

**Important:** This application does not directly use PostgreSQL in its own code.

PostgreSQL is used by **LangGraph Platform API** for internal state management:

- Storing graph execution state
- Managing checkpoints and interrupts
- Persisting agent memory across sessions

The connection is injected via the `DATABASE_URI` environment variable.

## Production Configuration

Production environment has enhanced features:

| Feature              | Value                                |
| -------------------- | ------------------------------------ |
| SKU                  | GP_Standard_D2s_v3 (General Purpose) |
| Storage              | 64GB                                 |
| Backup Retention     | 35 days                              |
| Geo-Redundant Backup | Enabled                              |
| High Availability    | Zone Redundant                       |
| TLS Production       | Enabled                              |

## Required Secrets

### GitHub Secrets

| Secret                    | Description                       | Required |
| ------------------------- | --------------------------------- | -------- |
| `ARM_CLIENT_ID`           | Azure Service Principal Client ID | Yes      |
| `ARM_CLIENT_SECRET`       | Azure Service Principal Secret    | Yes      |
| `ARM_SUBSCRIPTION_ID`     | Azure Subscription ID             | Yes      |
| `ARM_TENANT_ID`           | Azure Tenant ID                   | Yes      |
| `POSTGRES_ADMIN_PASSWORD` | PostgreSQL admin password         | Yes      |
| `CLERK_PUBLISHABLE_KEY`   | Clerk public key                  | Yes      |
| `CLERK_SECRET_KEY`        | Clerk secret key                  | Yes      |
| `GEMINI_API_KEY`          | Gemini API key                    | One of   |
| `OPENAI_API_KEY`          | OpenAI API key                    | One of   |

## Files Modified/Created

### Terraform

- `terraform/main.tf` - Main configuration with PostgreSQL locals
- `terraform/variables.tf` - Shared environment variables
- `terraform/outputs.tf` - PostgreSQL and Key Vault outputs
- `terraform/environments/dev.tfvars` - Dev configuration
- `terraform/environments/uat.tfvars` - UAT configuration
- `terraform/environments/prod.tfvars` - Production configuration
- `terraform/modules/postgresql/` - PostgreSQL Flexible Server module
- `terraform/modules/key-vault/` - Key Vault module

### CI/CD

- `.github/workflows/deploy.yml` - Build and deploy pipeline
- `.github/workflows/terraform.yml` - Infrastructure pipeline
- `.github/workflows/ci.yml` - Code quality checks

### Configuration

- `.pre-commit-config.yaml` - Pre-commit hooks
- `.tflint.hcl` - TFLint configuration
- `pyproject.toml` - Python tooling configuration
- `backend/Dockerfile` - LangGraph API with PostgreSQL

## Deployment Steps

1. **Configure Secrets**

   - Add `POSTGRES_ADMIN_PASSWORD` to GitHub Secrets
   - Ensure all required Azure secrets are configured

2. **Apply Terraform**

   - Run Terraform to create PostgreSQL server and Key Vault
   - Verify database is created

3. **Deploy Application**

   - Push to `develop` or `main` branch
   - Verify `DATABASE_URI` is injected to backend

4. **Verify Deployment**
   - Check LangGraph API health endpoint
   - Verify state persistence works correctly
