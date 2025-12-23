#!/bin/bash

# =============================================================================
# FlowPost - One-Time Azure Setup Script
# =============================================================================
# This script sets up everything needed for Azure Container Apps deployment:
# 1. Creates Terraform state storage
# 2. Creates Service Principal for GitHub Actions
# 3. Deploys infrastructure with Terraform
# 4. Builds and pushes Docker images
# 5. Configures GitHub repository secrets (optional)
#
# After running this script, any push to main/develop/uat will auto-deploy.
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default values
DEFAULT_LOCATION="eastus"
DEFAULT_PROJECT_NAME="flowpost"
DEFAULT_ENVIRONMENT="dev"

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# =============================================================================
# Helper Functions
# =============================================================================

print_header() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

print_step() {
    echo -e "${BLUE}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

check_command() {
    if ! command -v "$1" &> /dev/null; then
        print_error "$1 is not installed. Please install it first."
        exit 1
    fi
}

prompt_with_default() {
    local prompt="$1"
    local default="$2"
    local var_name="$3"
    
    read -p "$(echo -e ${YELLOW}$prompt [$default]: ${NC})" input
    eval "$var_name=\"${input:-$default}\""
}

prompt_secret() {
    local prompt="$1"
    local var_name="$2"
    
    read -sp "$(echo -e ${YELLOW}$prompt: ${NC})" input
    echo ""
    eval "$var_name=\"$input\""
}

# =============================================================================
# Pre-flight Checks
# =============================================================================

preflight_checks() {
    print_header "Pre-flight Checks"
    
    print_step "Checking required tools..."
    
    check_command "az"
    print_success "Azure CLI installed"
    
    check_command "terraform"
    print_success "Terraform installed"
    
    check_command "docker"
    print_success "Docker installed"
    
    check_command "git"
    print_success "Git installed"
    
    # Check if gh CLI is installed (optional, for GitHub secrets)
    if command -v "gh" &> /dev/null; then
        GH_CLI_AVAILABLE=true
        print_success "GitHub CLI installed (will auto-configure secrets)"
    else
        GH_CLI_AVAILABLE=false
        print_warning "GitHub CLI not installed (secrets must be configured manually)"
    fi
    
    # Check Azure login
    print_step "Checking Azure login status..."
    if ! az account show &> /dev/null; then
        print_warning "Not logged in to Azure. Opening browser for login..."
        az login
    fi
    print_success "Logged in to Azure"

    # Show current subscription
    CURRENT_SUB=$(az account show --query name -o tsv)
    CURRENT_SUB_ID=$(az account show --query id -o tsv)
    echo -e "   Current subscription: ${CYAN}$CURRENT_SUB${NC}"
    
    print_step "Registering Azure resource providers..."
    az provider register --namespace Microsoft.Storage --wait &> /dev/null &
    az provider register --namespace Microsoft.ContainerRegistry --wait &> /dev/null &
    az provider register --namespace Microsoft.App --wait &> /dev/null &
    az provider register --namespace Microsoft.OperationalInsights --wait &> /dev/null &
    wait
    print_success "Azure resource providers registered"
}

# =============================================================================
# Gather Configuration
# =============================================================================

gather_config() {
    print_header "Configuration"
    
    echo -e "${YELLOW}Please provide the following configuration:${NC}"
    echo ""
    
    # Azure settings
    prompt_with_default "Azure region" "$DEFAULT_LOCATION" "LOCATION"
    prompt_with_default "Project name" "$DEFAULT_PROJECT_NAME" "PROJECT_NAME"
    prompt_with_default "Environment (dev/uat/prod)" "$DEFAULT_ENVIRONMENT" "ENVIRONMENT"
    
    echo ""
    echo -e "${YELLOW}Application secrets (required for deployment):${NC}"
    echo ""
    
    # Check if .env file exists and offer to use it
    if [ -f "$PROJECT_ROOT/.env" ]; then
        read -p "$(echo -e ${YELLOW}Found .env file. Use values from it? [Y/n]: ${NC})" use_env
        if [[ ! "$use_env" =~ ^[Nn]$ ]]; then
            source "$PROJECT_ROOT/.env"
            print_success "Loaded values from .env file"
        fi
    fi
    
    # Prompt for secrets if not already set
    if [ -z "$OPENAI_API_KEY" ]; then
        prompt_secret "OpenAI API Key" "OPENAI_API_KEY"
    else
        print_success "OpenAI API Key loaded from .env"
    fi
    
    if [ -z "$SUPABASE_URL" ]; then
        read -p "$(echo -e ${YELLOW}Supabase URL: ${NC})" SUPABASE_URL
    else
        print_success "Supabase URL loaded from .env"
    fi
    
    if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
        prompt_secret "Supabase Service Role Key" "SUPABASE_SERVICE_ROLE_KEY"
    else
        print_success "Supabase Service Role Key loaded from .env"
    fi
    
    if [ -z "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" ]; then
        read -p "$(echo -e ${YELLOW}Clerk Publishable Key: ${NC})" CLERK_PUBLISHABLE_KEY
    else
        CLERK_PUBLISHABLE_KEY="$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
        print_success "Clerk Publishable Key loaded from .env"
    fi
    
    if [ -z "$CLERK_SECRET_KEY" ]; then
        prompt_secret "Clerk Secret Key" "CLERK_SECRET_KEY"
    else
        print_success "Clerk Secret Key loaded from .env"
    fi
    
    # Optional secrets
    echo ""
    echo -e "${YELLOW}Optional secrets (press Enter to skip):${NC}"
    
    if [ -z "$LANGCHAIN_API_KEY" ]; then
        echo -ne "${YELLOW}LangChain API Key (optional): ${NC}"
        read LANGCHAIN_API_KEY
    fi
    
    if [ -z "$SERPER_API_KEY" ]; then
        echo -ne "${YELLOW}Serper API Key (optional): ${NC}"
        read SERPER_API_KEY
    fi
    
    # GitHub settings
    echo ""
    echo -e "${YELLOW}GitHub settings:${NC}"
    
    # Try to detect GitHub repo
    DETECTED_REPO=$(git -C "$PROJECT_ROOT" remote get-url origin 2>/dev/null | sed 's/.*github.com[:/]\(.*\)\.git/\1/' || echo "")
    if [ -n "$DETECTED_REPO" ]; then
        prompt_with_default "GitHub repository (owner/repo)" "$DETECTED_REPO" "GITHUB_REPO"
    else
        read -p "$(echo -e ${YELLOW}GitHub repository (owner/repo): ${NC})" GITHUB_REPO
    fi
}

# =============================================================================
# Create Terraform State Storage
# =============================================================================

create_terraform_state_storage() {
    print_header "Creating Terraform State Storage"
    
    STATE_RG="${PROJECT_NAME}-terraform-state"
    
    print_step "Creating resource group: $STATE_RG"
    az group create --name "$STATE_RG" --location "$LOCATION" --output none
    print_success "Resource group created"
    
    for env in dev uat prod; do
        STORAGE_ACCOUNT="${PROJECT_NAME}tfstate${env}"
        # Remove hyphens and ensure lowercase (storage account name restrictions)
        STORAGE_ACCOUNT=$(echo "$STORAGE_ACCOUNT" | tr -d '-' | tr '[:upper:]' '[:lower:]')
        
        print_step "Creating storage account for $env: $STORAGE_ACCOUNT"
        
        # Check if storage account exists
        if az storage account show --name "$STORAGE_ACCOUNT" --resource-group "$STATE_RG" &> /dev/null; then
            print_warning "Storage account $STORAGE_ACCOUNT already exists, skipping..."
        else
            az storage account create \
                --name "$STORAGE_ACCOUNT" \
                --resource-group "$STATE_RG" \
                --location "$LOCATION" \
                --sku Standard_LRS \
                --encryption-services blob \
                --output none
            
            az storage container create \
                --name tfstate \
                --account-name "$STORAGE_ACCOUNT" \
                --output none
            
            print_success "Storage account $STORAGE_ACCOUNT created"
        fi
    done
}

# =============================================================================
# Create Service Principal
# =============================================================================

create_service_principal() {
    print_header "Creating Service Principal for GitHub Actions"
    
    SP_NAME="${PROJECT_NAME}-github-actions"
    SUBSCRIPTION_ID=$(az account show --query id -o tsv)
    
    print_step "Creating service principal: $SP_NAME"
    
    # Check if SP already exists
    EXISTING_SP=$(az ad sp list --display-name "$SP_NAME" --query "[0].appId" -o tsv 2>/dev/null || echo "")
    
    if [ -n "$EXISTING_SP" ]; then
        print_warning "Service principal already exists. Creating new credentials..."
        SP_CREDENTIALS=$(az ad sp credential reset --id "$EXISTING_SP" --query "{clientId:appId, clientSecret:password}" -o json)
        ARM_CLIENT_ID=$(echo "$SP_CREDENTIALS" | grep -o '"clientId": *"[^"]*"' | cut -d'"' -f4)
        ARM_CLIENT_SECRET=$(echo "$SP_CREDENTIALS" | grep -o '"clientSecret": *"[^"]*"' | cut -d'"' -f4)
    else
        # Create new service principal
        SP_OUTPUT=$(az ad sp create-for-rbac \
            --name "$SP_NAME" \
            --role Contributor \
            --scopes "/subscriptions/$SUBSCRIPTION_ID" \
            --sdk-auth)
        
        # Extract values
        ARM_CLIENT_ID=$(echo "$SP_OUTPUT" | grep -o '"clientId": *"[^"]*"' | cut -d'"' -f4)
        ARM_CLIENT_SECRET=$(echo "$SP_OUTPUT" | grep -o '"clientSecret": *"[^"]*"' | cut -d'"' -f4)
        
        # Store full credentials for GitHub
        AZURE_CREDENTIALS="$SP_OUTPUT"
    fi
    
    ARM_TENANT_ID=$(az account show --query tenantId -o tsv)
    ARM_SUBSCRIPTION_ID="$SUBSCRIPTION_ID"
    
    # Generate AZURE_CREDENTIALS JSON if not already set
    if [ -z "$AZURE_CREDENTIALS" ]; then
        AZURE_CREDENTIALS=$(cat <<EOF
{
  "clientId": "$ARM_CLIENT_ID",
  "clientSecret": "$ARM_CLIENT_SECRET",
  "subscriptionId": "$ARM_SUBSCRIPTION_ID",
  "tenantId": "$ARM_TENANT_ID"
}
EOF
)
    fi
    
    print_success "Service principal created/updated"
    echo -e "   Client ID: ${CYAN}$ARM_CLIENT_ID${NC}"
}

# =============================================================================
# Configure GitHub Secrets
# =============================================================================

configure_github_secrets() {
    print_header "Configuring GitHub Secrets"
    
    if [ "$GH_CLI_AVAILABLE" = true ]; then
        print_step "Checking GitHub CLI authentication..."
        
        if ! gh auth status &> /dev/null; then
            print_warning "Not logged in to GitHub CLI. Please authenticate:"
            gh auth login
        fi
        
        print_step "Setting GitHub secrets for $GITHUB_REPO..."
        
        # Azure secrets
        gh secret set AZURE_CREDENTIALS --repo "$GITHUB_REPO" --body "$AZURE_CREDENTIALS"
        print_success "Set AZURE_CREDENTIALS"
        
        gh secret set ARM_CLIENT_ID --repo "$GITHUB_REPO" --body "$ARM_CLIENT_ID"
        print_success "Set ARM_CLIENT_ID"
        
        gh secret set ARM_CLIENT_SECRET --repo "$GITHUB_REPO" --body "$ARM_CLIENT_SECRET"
        print_success "Set ARM_CLIENT_SECRET"
        
        gh secret set ARM_SUBSCRIPTION_ID --repo "$GITHUB_REPO" --body "$ARM_SUBSCRIPTION_ID"
        print_success "Set ARM_SUBSCRIPTION_ID"
        
        gh secret set ARM_TENANT_ID --repo "$GITHUB_REPO" --body "$ARM_TENANT_ID"
        print_success "Set ARM_TENANT_ID"
        
        # Application secrets
        gh secret set OPENAI_API_KEY --repo "$GITHUB_REPO" --body "$OPENAI_API_KEY"
        print_success "Set OPENAI_API_KEY"
        
        gh secret set SUPABASE_URL --repo "$GITHUB_REPO" --body "$SUPABASE_URL"
        print_success "Set SUPABASE_URL"
        
        gh secret set SUPABASE_SERVICE_ROLE_KEY --repo "$GITHUB_REPO" --body "$SUPABASE_SERVICE_ROLE_KEY"
        print_success "Set SUPABASE_SERVICE_ROLE_KEY"
        
        gh secret set CLERK_PUBLISHABLE_KEY --repo "$GITHUB_REPO" --body "$CLERK_PUBLISHABLE_KEY"
        print_success "Set CLERK_PUBLISHABLE_KEY"
        
        gh secret set CLERK_SECRET_KEY --repo "$GITHUB_REPO" --body "$CLERK_SECRET_KEY"
        print_success "Set CLERK_SECRET_KEY"
        
        if [ -n "$LANGCHAIN_API_KEY" ]; then
            gh secret set LANGCHAIN_API_KEY --repo "$GITHUB_REPO" --body "$LANGCHAIN_API_KEY"
            print_success "Set LANGCHAIN_API_KEY"
        fi
        
        if [ -n "$SERPER_API_KEY" ]; then
            gh secret set SERPER_API_KEY --repo "$GITHUB_REPO" --body "$SERPER_API_KEY"
            print_success "Set SERPER_API_KEY"
        fi
        
    else
        print_warning "GitHub CLI not available. Please manually add these secrets to your GitHub repository:"
        echo ""
        echo -e "${CYAN}Go to: https://github.com/$GITHUB_REPO/settings/secrets/actions${NC}"
        echo ""
        echo "Add the following secrets:"
        echo "─────────────────────────────────────────────────────────"
        echo "AZURE_CREDENTIALS     = (see output file)"
        echo "ARM_CLIENT_ID         = $ARM_CLIENT_ID"
        echo "ARM_CLIENT_SECRET     = ***hidden***"
        echo "ARM_SUBSCRIPTION_ID   = $ARM_SUBSCRIPTION_ID"
        echo "ARM_TENANT_ID         = $ARM_TENANT_ID"
        echo "OPENAI_API_KEY        = ***hidden***"
        echo "SUPABASE_URL          = $SUPABASE_URL"
        echo "SUPABASE_SERVICE_ROLE_KEY = ***hidden***"
        echo "CLERK_PUBLISHABLE_KEY = $CLERK_PUBLISHABLE_KEY"
        echo "CLERK_SECRET_KEY      = ***hidden***"
        echo "LANGCHAIN_API_KEY     = ***hidden*** (optional)"
        echo "SERPER_API_KEY        = ***hidden*** (optional)"
        echo "─────────────────────────────────────────────────────────"
        
        # Save credentials to a file
        CREDS_FILE="$PROJECT_ROOT/.azure-credentials.json"
        echo "$AZURE_CREDENTIALS" > "$CREDS_FILE"
        print_warning "Azure credentials saved to: $CREDS_FILE"
        print_warning "⚠️  DELETE THIS FILE after copying to GitHub secrets!"
    fi
}

# =============================================================================
# Deploy Infrastructure with Terraform
# =============================================================================

deploy_terraform() {
    print_header "Deploying Infrastructure with Terraform"
    
    cd "$PROJECT_ROOT/terraform"
    
    # Update backend config with actual storage account name
    STORAGE_ACCOUNT="${PROJECT_NAME}tfstate${ENVIRONMENT}"
    STORAGE_ACCOUNT=$(echo "$STORAGE_ACCOUNT" | tr -d '-' | tr '[:upper:]' '[:lower:]')
    
    print_step "Initializing Terraform..."
    terraform init \
        -backend-config="resource_group_name=${PROJECT_NAME}-terraform-state" \
        -backend-config="storage_account_name=$STORAGE_ACCOUNT" \
        -backend-config="container_name=tfstate" \
        -backend-config="key=${ENVIRONMENT}.terraform.tfstate"
    
    print_success "Terraform initialized"
    
    print_step "Planning infrastructure changes..."
    terraform plan \
        -var-file="environments/${ENVIRONMENT}.tfvars" \
        -var="openai_api_key=$OPENAI_API_KEY" \
        -var="supabase_url=$SUPABASE_URL" \
        -var="supabase_service_role_key=$SUPABASE_SERVICE_ROLE_KEY" \
        -var="clerk_publishable_key=$CLERK_PUBLISHABLE_KEY" \
        -var="clerk_secret_key=$CLERK_SECRET_KEY" \
        -var="langchain_api_key=${LANGCHAIN_API_KEY:-}" \
        -var="serper_api_key=${SERPER_API_KEY:-}" \
        -out=tfplan
    
    echo ""
    read -p "$(echo -e ${YELLOW}Apply these changes? [y/N]: ${NC})" confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        print_step "Applying Terraform configuration..."
        terraform apply tfplan
        print_success "Infrastructure deployed"
        
        # Get outputs
        ACR_NAME=$(terraform output -raw container_registry_name)
        ACR_SERVER=$(terraform output -raw container_registry_login_server)
        BACKEND_URL=$(terraform output -raw backend_url)
        FRONTEND_URL=$(terraform output -raw frontend_url)
    else
        print_warning "Terraform apply cancelled"
        exit 1
    fi
    
    cd "$PROJECT_ROOT"
}

# =============================================================================
# Build and Push Docker Images
# =============================================================================

build_and_push_images() {
    print_header "Building and Pushing Docker Images"
    
    print_step "Logging in to Azure Container Registry..."
    az acr login --name "$ACR_NAME"
    print_success "Logged in to ACR"
    
    print_step "Building backend image for linux/amd64..."
    docker buildx build \
        --platform linux/amd64 \
        -t "${ACR_SERVER}/flowpost-backend:latest" \
        -t "${ACR_SERVER}/flowpost-backend:${GITHUB_SHA:-initial}" \
        -f "$PROJECT_ROOT/backend/Dockerfile" \
        --push \
        "$PROJECT_ROOT"
    print_success "Backend image built and pushed"
    
    # Image already pushed with buildx --push
    
    print_step "Building frontend image for linux/amd64..."
    docker buildx build \
        --platform linux/amd64 \
        --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="${CLERK_PUBLISHABLE_KEY}" \
        -t "${ACR_SERVER}/flowpost-frontend:latest" \
        -t "${ACR_SERVER}/flowpost-frontend:${GITHUB_SHA:-initial}" \
        -f "$PROJECT_ROOT/frontend/Dockerfile" \
        --push \
        "$PROJECT_ROOT/frontend"
    print_success "Frontend image built and pushed"
    
    # Image already pushed with buildx --push
}

# =============================================================================
# Update Container Apps with New Images
# =============================================================================

update_container_apps() {
    print_header "Updating Container Apps"
    
    RESOURCE_GROUP="${PROJECT_NAME}-${ENVIRONMENT}-rg"
    
    print_step "Updating backend container app..."
    az containerapp update \
        --name "${PROJECT_NAME}-${ENVIRONMENT}-backend" \
        --resource-group "$RESOURCE_GROUP" \
        --image "${ACR_SERVER}/flowpost-backend:latest" \
        --output none
    print_success "Backend updated"
    
    print_step "Updating frontend container app..."
    az containerapp update \
        --name "${PROJECT_NAME}-${ENVIRONMENT}-frontend" \
        --resource-group "$RESOURCE_GROUP" \
        --image "${ACR_SERVER}/flowpost-frontend:latest" \
        --output none
    print_success "Frontend updated"
}

# =============================================================================
# Print Summary
# =============================================================================

print_summary() {
    print_header "Deployment Complete! 🎉"
    
    echo -e "${GREEN}Your FlowPost application has been deployed successfully!${NC}"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${CYAN}Application URLs:${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "  Frontend:  ${GREEN}$FRONTEND_URL${NC}"
    echo -e "  Backend:   ${GREEN}$BACKEND_URL${NC}"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${CYAN}Azure Resources:${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "  Resource Group:      ${PROJECT_NAME}-${ENVIRONMENT}-rg"
    echo -e "  Container Registry:  $ACR_NAME"
    echo -e "  Environment:         ${PROJECT_NAME}-${ENVIRONMENT}-env"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${CYAN}Auto-Deployment (GitHub Actions):${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Push to 'develop' branch  → Deploys to DEV"
    echo "  Push to 'uat' branch      → Deploys to UAT"
    echo "  Push to 'main' branch     → Deploys to PROD"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${CYAN}Useful Commands:${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  # View logs"
    echo "  az containerapp logs show --name ${PROJECT_NAME}-${ENVIRONMENT}-backend --resource-group ${PROJECT_NAME}-${ENVIRONMENT}-rg --follow"
    echo ""
    echo "  # Check status"
    echo "  az containerapp show --name ${PROJECT_NAME}-${ENVIRONMENT}-frontend --resource-group ${PROJECT_NAME}-${ENVIRONMENT}-rg --query properties.runningStatus"
    echo ""
    
    if [ "$GH_CLI_AVAILABLE" = false ]; then
        echo -e "${YELLOW}⚠️  IMPORTANT: Don't forget to configure GitHub secrets manually!${NC}"
        echo -e "   Go to: ${CYAN}https://github.com/$GITHUB_REPO/settings/secrets/actions${NC}"
        echo ""
    fi
}

# =============================================================================
# Main Execution
# =============================================================================

main() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════════╗"
    echo "║                                                               ║"
    echo "║   FlowPost - Azure Container Apps Setup                       ║"
    echo "║                                                               ║"
    echo "║   This script will set up everything needed for deployment:   ║"
    echo "║   • Terraform state storage                                   ║"
    echo "║   • Service Principal for CI/CD                               ║"
    echo "║   • Azure Container Apps infrastructure                       ║"
    echo "║   • Docker images                                             ║"
    echo "║   • GitHub Actions integration                                ║"
    echo "║                                                               ║"
    echo "╚═══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    # Run setup steps
    preflight_checks
    gather_config
    create_terraform_state_storage
    create_service_principal
    configure_github_secrets
    deploy_terraform
    build_and_push_images
    update_container_apps
    print_summary
}

# Run main function
main "$@"
