# Azure Container Apps Deployment Guide

Complete guide for deploying FlowPost to Azure Container Apps using Terraform.

## Overview

FlowPost uses **Terraform** for Infrastructure as Code (IaC) with three environments:

| Environment | Branch    | Purpose                 |
| ----------- | --------- | ----------------------- |
| **dev**     | `develop` | Development and testing |
| **uat**     | `uat`     | User acceptance testing |
| **prod**    | `main`    | Production              |

## Prerequisites

Before starting deployment, ensure you have:

1. **Azure CLI** (v2.50+)

   ```bash
   brew install azure-cli
   az --version
   ```

2. **Terraform** (v1.5+)

   ```bash
   brew install terraform
   terraform --version
   ```

3. **Docker Desktop** (running)

   ```bash
   docker --version
   ```

4. **GitHub CLI** (optional, for auto-configuring secrets)

   ```bash
   brew install gh
   gh auth login
   ```

5. **Azure Subscription** with Contributor access

6. **Environment Variables** - Create a `.env` file in the project root with:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - `OPENAI_API_KEY` or `GEMINI_API_KEY`
   - `SERPER_API_KEY` (optional)

## Quick Start (Automated Setup)

The easiest way to deploy is using our setup script:

```bash
# 1. Login to Azure
az login

# 2. Run the setup script
./scripts/azure-setup.sh
```

This script will:

- ✅ Register required Azure resource providers
- ✅ Create Terraform state storage
- ✅ Create Service Principal for CI/CD
- ✅ Configure GitHub secrets (if `gh` CLI is installed)
- ✅ Deploy infrastructure with Terraform
- ✅ Build and push Docker images (for AMD64)
- ✅ Deploy to Azure Container Apps

## Manual Deployment Steps

If you prefer manual control, follow these steps:

### Step 1: Register Azure Resource Providers

```bash
az provider register --namespace Microsoft.Storage --wait
az provider register --namespace Microsoft.ContainerRegistry --wait
az provider register --namespace Microsoft.App --wait
az provider register --namespace Microsoft.OperationalInsights --wait
```

### Step 2: Create Terraform State Storage

```bash
# Create resource group for state
az group create --name flowpost-terraform-state --location eastus

# Create storage accounts for each environment
for ENV in dev uat prod; do
  STORAGE_ACCOUNT="flowposttfstate${ENV}"

  az storage account create \
    --name "$STORAGE_ACCOUNT" \
    --resource-group "flowpost-terraform-state" \
    --location "eastus" \
    --sku Standard_LRS \
    --encryption-services blob

  az storage container create \
    --name tfstate \
    --account-name "$STORAGE_ACCOUNT"
done
```

### Step 3: Create Service Principal

```bash
# Get your subscription ID
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
echo "Subscription ID: $SUBSCRIPTION_ID"

# Create the service principal
az ad sp create-for-rbac \
  --name "flowpost-github-actions" \
  --role Contributor \
  --scopes /subscriptions/$SUBSCRIPTION_ID \
  --query "{clientId:appId, clientSecret:password, tenantId:tenant}" \
  -o json
```

This outputs:

```json
{
  "clientId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "clientSecret": "your-secret-here",
  "tenantId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

**Save these values** - you'll need them for GitHub secrets (see below).

### Step 4: Deploy Infrastructure with Terraform

```bash
cd terraform

# Initialize Terraform
terraform init \
  -backend-config="resource_group_name=flowpost-terraform-state" \
  -backend-config="storage_account_name=flowposttfstatedev" \
  -backend-config="container_name=tfstate" \
  -backend-config="key=dev.terraform.tfstate"

# Plan deployment
terraform plan \
  -var-file="environments/dev.tfvars" \
  -var="openai_api_key=YOUR_KEY" \
  -var="supabase_url=YOUR_URL" \
  -var="supabase_service_role_key=YOUR_KEY" \
  -var="clerk_publishable_key=YOUR_KEY" \
  -var="clerk_secret_key=YOUR_KEY" \
  -out=tfplan

# Apply
terraform apply tfplan
```

### Step 5: Build and Push Docker Images

**Important**: Build for `linux/amd64` platform (Azure runs on AMD64):

```bash
ACR_SERVER="flowpostdevacr.azurecr.io"

# Login to ACR
az acr login --name flowpostdevacr

# Build and push backend
docker buildx build \
  --platform linux/amd64 \
  -t ${ACR_SERVER}/flowpost-backend:latest \
  -f backend/Dockerfile \
  --push \
  .

# Build and push frontend (with Clerk key)
CLERK_PUB_KEY=$(grep "^NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=" .env | cut -d'=' -f2-)

docker buildx build \
  --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="$CLERK_PUB_KEY" \
  -t ${ACR_SERVER}/flowpost-frontend:latest \
  -f frontend/Dockerfile \
  --push \
  frontend/
```

### Step 6: Update Container Apps

```bash
# Update backend
az containerapp update \
  --name flowpost-dev-backend \
  --resource-group flowpost-dev-rg \
  --image ${ACR_SERVER}/flowpost-backend:latest

# Update frontend
az containerapp update \
  --name flowpost-dev-frontend \
  --resource-group flowpost-dev-rg \
  --image ${ACR_SERVER}/flowpost-frontend:latest
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              GitHub Repository                               │
│                                                                              │
│  Push to branch ────────────────────────────────────────────────────────────┐│
│  (develop/uat/main)                                                         ││
└─────────────────────────────────────────────────────────────────────────────┘│
                                                                               │
                                    ┌──────────────────────────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GitHub Actions                                     │
│                                                                              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │ terraform.yml   │    │ deploy.yml      │    │ ci.yml          │         │
│  │                 │    │                 │    │                 │         │
│  │ Infrastructure  │    │ Build & Deploy  │    │ Tests & Lint    │         │
│  │ changes         │    │ containers      │    │                 │         │
│  └────────┬────────┘    └────────┬────────┘    └─────────────────┘         │
│           │                      │                                          │
└───────────┼──────────────────────┼──────────────────────────────────────────┘
            │                      │
            ▼                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Azure Cloud                                     │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  flowpost-{env}-rg                                                      │ │
│  │                                                                         │ │
│  │  ┌─────────────────┐  ┌─────────────────────────────────────────────┐  │ │
│  │  │ Container       │  │ Container Apps Environment                  │  │ │
│  │  │ Registry (ACR)  │  │                                             │  │ │
│  │  │                 │  │  ┌─────────────┐    ┌─────────────┐         │  │ │
│  │  │ flowpost-backend│──│─▶│   Backend   │    │  Frontend   │◀── Web  │  │ │
│  │  │ flowpost-frontend│ │  │   :54367    │◀───│   :3000     │         │  │ │
│  │  │                 │  │  └─────────────┘    └─────────────┘         │  │ │
│  │  └─────────────────┘  │                                             │  │ │
│  │                       └─────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## GitHub Secrets Configuration

Go to your repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

### Azure Authentication (Required for Terraform & Deploy workflows)

Using the values from Step 3 above:

| Secret                | Value                                  | Source                              |
| --------------------- | -------------------------------------- | ----------------------------------- |
| `ARM_CLIENT_ID`       | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` | `clientId` from Step 3              |
| `ARM_CLIENT_SECRET`   | `your-secret-here`                     | `clientSecret` from Step 3          |
| `ARM_SUBSCRIPTION_ID` | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` | Run: `az account show -q id -o tsv` |
| `ARM_TENANT_ID`       | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` | `tenantId` from Step 3              |
| `AZURE_CREDENTIALS`   | JSON object (see below)                | Combine all values                  |

**`AZURE_CREDENTIALS` JSON format** (required for Build & Deploy workflow):

```json
{
  "clientId": "<ARM_CLIENT_ID>",
  "clientSecret": "<ARM_CLIENT_SECRET>",
  "subscriptionId": "<ARM_SUBSCRIPTION_ID>",
  "tenantId": "<ARM_TENANT_ID>"
}
```

Example:

```json
{
  "clientId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "clientSecret": "your-service-principal-secret-here",
  "subscriptionId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "tenantId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

### Application Secrets (Required for Terraform deployment)

| Secret                      | Value                        | How to Get                                                  |
| --------------------------- | ---------------------------- | ----------------------------------------------------------- |
| `OPENAI_API_KEY`            | OpenAI API key               | [platform.openai.com](https://platform.openai.com/api-keys) |
| `GEMINI_API_KEY`            | Google Gemini API key        | [Google AI Studio](https://aistudio.google.com/apikey)      |
| `SUPABASE_URL`              | Supabase project URL         | Supabase Dashboard → Settings → API                         |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key    | Supabase Dashboard → Settings → API                         |
| `CLERK_PUBLISHABLE_KEY`     | Clerk publishable key        | [Clerk Dashboard](https://dashboard.clerk.com) → API Keys   |
| `CLERK_SECRET_KEY`          | Clerk secret key             | [Clerk Dashboard](https://dashboard.clerk.com) → API Keys   |
| `LANGCHAIN_API_KEY`         | LangChain API key (optional) | [smith.langchain.com](https://smith.langchain.com)          |
| `SERPER_API_KEY`            | Serper API key (optional)    | [serper.dev](https://serper.dev)                            |

### Stripe Payment Secrets (Required for Subscriptions & Credits)

| Secret                  | Value                         | How to Get                                                                                  |
| ----------------------- | ----------------------------- | ------------------------------------------------------------------------------------------- |
| `STRIPE_SECRET_KEY`     | Stripe secret key             | [Stripe Dashboard](https://dashboard.stripe.com/apikeys) → Secret key                       |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | See [Stripe Webhook Setup](#stripe-webhook-setup) below                                     |
| `NEXT_PUBLIC_APP_URL`   | Your frontend application URL | Your Azure Container App URL (e.g., `https://flowpost-prod-frontend.azurecontainerapps.io`) |

> **Note**: Use `sk_test_...` keys for dev/uat environments and `sk_live_...` for production.

### E2E Test Secrets (Required for Integration Tests workflow)

| Secret                  | Value                 | Notes                               |
| ----------------------- | --------------------- | ----------------------------------- |
| `CLERK_PUBLISHABLE_KEY` | Clerk publishable key | Use test key (`pk_test_...`) for CI |
| `CLERK_SECRET_KEY`      | Clerk secret key      | Use test key (`sk_test_...`) for CI |

> **Note**: The E2E tests require valid Clerk credentials. If not configured, the Integration Tests workflow will be skipped.

## Stripe Webhook Setup

Stripe webhooks are required for the subscription and credits system to work properly. They notify your app when payments succeed, subscriptions change, etc.

### Step 1: Get Your Frontend URL

After deploying to Azure, get your frontend URL:

```bash
# Get the frontend URL
az containerapp show \
  --name flowpost-prod-frontend \
  --resource-group flowpost-prod-rg \
  --query "properties.configuration.ingress.fqdn" \
  -o tsv
```

This will output something like: `flowpost-prod-frontend.azurecontainerapps.io`

Your `NEXT_PUBLIC_APP_URL` will be: `https://flowpost-prod-frontend.azurecontainerapps.io`

### Step 2: Create Stripe Webhook Endpoint

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click **"Add endpoint"**
3. Enter your webhook URL:
   ```
   https://flowpost-prod-frontend.azurecontainerapps.io/api/stripe/webhooks
   ```
4. Select these events to listen to:
   - `checkout.session.completed` - When a checkout is successful
   - `customer.subscription.created` - When a new subscription starts
   - `customer.subscription.updated` - When a subscription changes
   - `customer.subscription.deleted` - When a subscription is canceled
   - `invoice.payment_succeeded` - When a payment succeeds (for credit reset)
   - `invoice.payment_failed` - When a payment fails
5. Click **"Add endpoint"**

### Step 3: Get the Webhook Signing Secret

1. After creating the endpoint, click on it in the webhooks list
2. Under **"Signing secret"**, click **"Reveal"**
3. Copy the `whsec_...` value
4. This is your `STRIPE_WEBHOOK_SECRET`

### Step 4: Add Secrets to Azure Container App

```bash
# Add Stripe secrets to the frontend container app
az containerapp secret set \
  --name flowpost-prod-frontend \
  --resource-group flowpost-prod-rg \
  --secrets \
    stripe-secret-key="sk_live_xxx" \
    stripe-webhook-secret="whsec_xxx"

# Update environment variables
az containerapp update \
  --name flowpost-prod-frontend \
  --resource-group flowpost-prod-rg \
  --set-env-vars \
    STRIPE_SECRET_KEY=secretref:stripe-secret-key \
    STRIPE_WEBHOOK_SECRET=secretref:stripe-webhook-secret \
    NEXT_PUBLIC_APP_URL=https://flowpost-prod-frontend.azurecontainerapps.io
```

### Local Development with Stripe Webhooks

For local testing, use the Stripe CLI to forward webhooks:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Forward webhooks to your local server
stripe listen --forward-to localhost:3000/api/stripe/webhooks

# Output:
# > Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx
# Use this whsec_... value as STRIPE_WEBHOOK_SECRET in your local .env
```

### Webhook Events Summary

| Event                           | Purpose                                                       |
| ------------------------------- | ------------------------------------------------------------- |
| `checkout.session.completed`    | Process successful checkout (subscription or credit purchase) |
| `customer.subscription.created` | Set up new subscription                                       |
| `customer.subscription.updated` | Handle plan changes                                           |
| `customer.subscription.deleted` | Downgrade to free plan                                        |
| `invoice.payment_succeeded`     | Reset monthly credits                                         |
| `invoice.payment_failed`        | Mark subscription as past_due                                 |

## CI/CD Pipeline

### Workflow Triggers

| Workflow        | Trigger                   | Action                          |
| --------------- | ------------------------- | ------------------------------- |
| `ci.yml`        | All PRs                   | Lint, test, type check          |
| `terraform.yml` | Changes to `terraform/**` | Plan on PR, Apply on merge      |
| `deploy.yml`    | Merge to branch           | Build images, deploy containers |

### Automatic Deployment Flow

1. **PR Created** → CI runs tests → Terraform plan posted to PR
2. **PR Approved & Merged** → Terraform apply → Docker build → Deploy

### Branch to Environment Mapping

```
develop → Dev Environment
uat     → UAT Environment
main    → Production Environment
```

## Environment Configuration

### Dev Environment

```hcl
# terraform/environments/dev.tfvars
environment          = "dev"
backend_min_replicas = 0   # Scale to zero
frontend_min_replicas = 0  # Scale to zero
backend_cpu          = 0.5
frontend_cpu         = 0.25
```

### UAT Environment

```hcl
# terraform/environments/uat.tfvars
environment          = "uat"
backend_min_replicas = 1
frontend_min_replicas = 1
backend_cpu          = 0.5
frontend_cpu         = 0.5
```

### Prod Environment

```hcl
# terraform/environments/prod.tfvars
environment          = "prod"
backend_min_replicas = 2   # HA - always running
frontend_min_replicas = 2  # HA - always running
backend_cpu          = 1.0
frontend_cpu         = 0.5
backend_max_replicas = 10
frontend_max_replicas = 20
```

## Monitoring & Health Checks

### Health Endpoints

| Service  | Endpoint                            |
| -------- | ----------------------------------- |
| Backend  | `https://<backend-url>/ok`          |
| Frontend | `https://<frontend-url>/api/health` |

### View Logs

```bash
# Backend logs
az containerapp logs show \
  --name flowpost-dev-backend \
  --resource-group flowpost-dev-rg \
  --tail 50

# System logs (for startup issues)
az containerapp logs show \
  --name flowpost-dev-backend \
  --resource-group flowpost-dev-rg \
  --type system \
  --tail 30
```

### Check Revision Status

```bash
az containerapp revision list \
  --name flowpost-dev-backend \
  --resource-group flowpost-dev-rg \
  --output table
```

## Troubleshooting

### Common Issues

#### 1. "exec format error"

**Problem**: Image built for ARM (Mac M1/M2) but Azure runs AMD64.

**Solution**: Build with `--platform linux/amd64`:

```bash
docker buildx build --platform linux/amd64 ...
```

#### 2. "Publishable key not valid" (Clerk)

**Problem**: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` needs to be set at build time.

**Solution**: Pass as build argument:

```bash
docker buildx build \
  --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..." \
  ...
```

#### 3. "Error: ENOENT: no such file or directory, open '/app/.env'"

**Problem**: LangGraph CLI expects a `.env` file.

**Solution**: The backend Dockerfile includes `RUN touch .env` to create an empty file.

#### 4. Container Health Check Failing

**Problem**: Container shows "Unhealthy" status.

**Solution**:

```bash
# Check system logs for errors
az containerapp logs show --name <app> --resource-group <rg> --type system

# Check container logs
az containerapp logs show --name <app> --resource-group <rg> --type console
```

#### 5. "SubscriptionNotFound" Error

**Problem**: Azure resource providers not registered.

**Solution**:

```bash
az provider register --namespace Microsoft.Storage --wait
az provider register --namespace Microsoft.ContainerRegistry --wait
az provider register --namespace Microsoft.App --wait
az provider register --namespace Microsoft.OperationalInsights --wait
```

### Rollback

```bash
# List revisions
az containerapp revision list \
  --name flowpost-dev-backend \
  --resource-group flowpost-dev-rg \
  --output table

# Activate previous revision
az containerapp revision activate \
  --name flowpost-dev-backend \
  --resource-group flowpost-dev-rg \
  --revision <revision-name>
```

### Restart Container

```bash
az containerapp revision restart \
  --name flowpost-dev-backend \
  --resource-group flowpost-dev-rg \
  --revision <revision-name>
```

## Teardown

To destroy all resources for an environment:

```bash
./scripts/azure-destroy.sh dev
```

Or manually:

```bash
cd terraform
terraform destroy -var-file="environments/dev.tfvars" -var="..."
```

## Cost Estimates

| Environment | Configuration                    | Est. Monthly Cost |
| ----------- | -------------------------------- | ----------------- |
| Dev         | Scale to zero, Basic ACR         | ~$20              |
| UAT         | Always on (1 replica), Basic ACR | ~$60              |
| Prod        | HA (2+ replicas), Standard ACR   | ~$150+            |

## Security Checklist

- [ ] Service principal has minimum required permissions
- [ ] Secrets stored in GitHub Secrets, not in code
- [ ] Production uses `pk_live_` and `sk_live_` Clerk keys
- [ ] Production uses `sk_live_` Stripe keys (not test keys)
- [ ] Stripe webhook endpoint uses HTTPS
- [ ] Stripe webhook signature verification enabled
- [ ] HTTPS enforced on all ingress
- [ ] Log Analytics enabled for audit trail
- [ ] Regular secret rotation schedule

## Additional Resources

- [Azure Container Apps Documentation](https://learn.microsoft.com/en-us/azure/container-apps/)
- [Terraform AzureRM Provider](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs)
- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
