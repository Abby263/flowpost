# FlowPost Terraform Infrastructure

Infrastructure as Code (IaC) for deploying FlowPost to Azure Container Apps.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Azure Subscription                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  Resource Group: flowpost-{env}-rg                                     │ │
│  │                                                                         │ │
│  │  ┌──────────────────────┐  ┌──────────────────────────────────────┐   │ │
│  │  │ Container Registry   │  │ Container Apps Environment           │   │ │
│  │  │ flowpost{env}acr     │  │ flowpost-{env}-env                   │   │ │
│  │  │                      │  │                                       │   │ │
│  │  │ - Backend Image      │  │  ┌────────────────┐ ┌────────────────┐│   │ │
│  │  │ - Frontend Image     │  │  │ Backend App    │ │ Frontend App   ││   │ │
│  │  │                      │  │  │ Port 54367     │ │ Port 3000      ││   │ │
│  │  └──────────────────────┘  │  └────────────────┘ └────────────────┘│   │ │
│  │                            │                                       │   │ │
│  │                            │  ┌──────────────────────────────────┐ │   │ │
│  │                            │  │ Log Analytics Workspace          │ │   │ │
│  │                            │  └──────────────────────────────────┘ │   │ │
│  │                            └──────────────────────────────────────────┘│ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Environments

| Environment | Branch    | Purpose                 | Scaling       |
| ----------- | --------- | ----------------------- | ------------- |
| `dev`       | `develop` | Development/testing     | Scale to zero |
| `uat`       | `uat`     | User acceptance testing | 1-3 replicas  |
| `prod`      | `main`    | Production              | 2-20 replicas |

## Directory Structure

```
terraform/
├── main.tf                 # Main configuration
├── variables.tf            # Variable definitions
├── outputs.tf              # Output definitions
├── versions.tf             # Provider versions & backend
├── modules/
│   ├── container-app/      # Container App module
│   ├── container-registry/ # ACR module
│   └── container-environment/ # Environment module
└── environments/
    ├── dev.tfvars          # Dev environment variables
    ├── dev.backend.tfvars  # Dev state backend config
    ├── uat.tfvars          # UAT environment variables
    ├── uat.backend.tfvars  # UAT state backend config
    ├── prod.tfvars         # Prod environment variables
    └── prod.backend.tfvars # Prod state backend config
```

## Prerequisites

### 1. Azure CLI & Terraform

```bash
# Install Azure CLI
brew install azure-cli  # macOS
# or
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash  # Linux

# Install Terraform
brew install terraform  # macOS
# or download from https://terraform.io/downloads

# Verify
az --version
terraform --version
```

### 2. Azure Authentication

```bash
# Login to Azure
az login

# Set subscription
az account set --subscription "<subscription-id>"
```

### 3. Create Terraform State Storage

Run this once to create storage for Terraform state:

```bash
# Variables
RESOURCE_GROUP="flowpost-terraform-state"
LOCATION="eastus"

# Create resource group for state
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create storage accounts for each environment
for ENV in dev uat prod; do
  STORAGE_ACCOUNT="flowposttfstate${ENV}"

  az storage account create \
    --name $STORAGE_ACCOUNT \
    --resource-group $RESOURCE_GROUP \
    --location $LOCATION \
    --sku Standard_LRS \
    --encryption-services blob

  az storage container create \
    --name tfstate \
    --account-name $STORAGE_ACCOUNT
done
```

### 4. Service Principal for CI/CD

```bash
SUBSCRIPTION_ID=$(az account show --query id -o tsv)

az ad sp create-for-rbac \
  --name "flowpost-terraform" \
  --role Contributor \
  --scopes /subscriptions/$SUBSCRIPTION_ID \
  --sdk-auth
```

Save the output JSON for GitHub secrets.

## Usage

### Local Development

```bash
cd terraform

# Initialize (first time or when changing backends)
terraform init -backend-config="environments/dev.backend.tfvars"

# Plan changes
terraform plan \
  -var-file="environments/dev.tfvars" \
  -var="openai_api_key=sk-..." \
  -var="supabase_url=https://..." \
  -var="supabase_service_role_key=..." \
  -var="clerk_publishable_key=pk_..." \
  -var="clerk_secret_key=sk_..."

# Apply changes
terraform apply \
  -var-file="environments/dev.tfvars" \
  -var="openai_api_key=sk-..." \
  # ... other vars

# Destroy (careful!)
terraform destroy \
  -var-file="environments/dev.tfvars" \
  -var="openai_api_key=sk-..." \
  # ... other vars
```

### Switch Environments

```bash
# Re-initialize for different environment
terraform init -backend-config="environments/uat.backend.tfvars" -reconfigure

# Plan for UAT
terraform plan -var-file="environments/uat.tfvars" -var="..."
```

## GitHub Actions Integration

Infrastructure changes are managed via GitHub Actions:

### Automatic Triggers

| Branch    | Environment | Action                     |
| --------- | ----------- | -------------------------- |
| `develop` | dev         | Plan on PR, Apply on merge |
| `uat`     | uat         | Plan on PR, Apply on merge |
| `main`    | prod        | Plan on PR, Apply on merge |

### Manual Deployment

Go to Actions → Terraform → Run workflow:

- Select environment (dev/uat/prod)
- Select action (plan/apply/destroy)

### Required GitHub Secrets

| Secret                      | Description                     |
| --------------------------- | ------------------------------- |
| `ARM_CLIENT_ID`             | Service principal client ID     |
| `ARM_CLIENT_SECRET`         | Service principal client secret |
| `ARM_SUBSCRIPTION_ID`       | Azure subscription ID           |
| `ARM_TENANT_ID`             | Azure tenant ID                 |
| `OPENAI_API_KEY`            | OpenAI API key                  |
| `SUPABASE_URL`              | Supabase project URL            |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key       |
| `CLERK_PUBLISHABLE_KEY`     | Clerk publishable key           |
| `CLERK_SECRET_KEY`          | Clerk secret key                |
| `LANGCHAIN_API_KEY`         | LangChain API key (optional)    |
| `SERPER_API_KEY`            | Serper API key (optional)       |
| `AZURE_CREDENTIALS`         | Full Azure credentials JSON     |

## Modules

### container-registry

Creates Azure Container Registry for storing Docker images.

```hcl
module "container_registry" {
  source = "./modules/container-registry"

  name                = "flowpostdevacr"
  resource_group_name = azurerm_resource_group.main.name
  location            = "eastus"
  sku                 = "Basic"  # or "Standard" for prod
}
```

### container-environment

Creates Container Apps Environment with Log Analytics.

```hcl
module "container_environment" {
  source = "./modules/container-environment"

  name                = "flowpost-dev-env"
  resource_group_name = azurerm_resource_group.main.name
  location            = "eastus"
}
```

### container-app

Creates a Container App with health checks and auto-scaling.

```hcl
module "backend" {
  source = "./modules/container-app"

  name                     = "flowpost-dev-backend"
  container_environment_id = module.container_environment.id
  image_name               = "flowpost-backend"
  target_port              = 54367
  cpu                      = 1.0
  memory                   = "2Gi"
  min_replicas             = 1
  max_replicas             = 5
  health_check_path        = "/ok"

  environment_variables = {
    NODE_ENV = "production"
  }

  secrets = {
    openai-api-key = var.openai_api_key
  }

  secret_environment_variables = {
    OPENAI_API_KEY = "openai-api-key"
  }
}
```

## Outputs

After applying, Terraform outputs:

```bash
terraform output

# Example output:
backend_url  = "https://flowpost-dev-backend.azurecontainerapps.io"
frontend_url = "https://flowpost-dev-frontend.azurecontainerapps.io"
container_registry_login_server = "flowpostdevacr.azurecr.io"
```

## Troubleshooting

### State Lock Error

```bash
# Force unlock (use with caution)
terraform force-unlock <lock-id>
```

### Resource Already Exists

```bash
# Import existing resource
terraform import azurerm_resource_group.main /subscriptions/.../resourceGroups/flowpost-dev-rg
```

### Plan Shows Changes After Apply

Check for:

- External changes made outside Terraform
- Sensitive values not matching
- Provider version differences

## Cost Optimization

| Environment         | Est. Monthly Cost |
| ------------------- | ----------------- |
| Dev (scale to zero) | ~$20              |
| UAT (always on)     | ~$60              |
| Prod (HA)           | ~$150+            |

Tips:

- Use `min_replicas = 0` for dev to scale to zero
- Use smaller CPU/memory for non-prod
- Use Basic ACR SKU for non-prod
