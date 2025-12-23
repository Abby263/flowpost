#!/bin/bash

# =============================================================================
# FlowPost - Azure Teardown Script
# =============================================================================
# This script destroys all Azure resources created by the setup script.
# Use with caution - this will delete everything!
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${RED}"
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║   ⚠️  WARNING: This will DESTROY all Azure resources!         ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

read -p "Enter environment to destroy (dev/uat/prod): " ENVIRONMENT
read -p "Enter project name [flowpost]: " PROJECT_NAME
PROJECT_NAME="${PROJECT_NAME:-flowpost}"

echo ""
echo -e "${RED}This will destroy:${NC}"
echo "  - Resource Group: ${PROJECT_NAME}-${ENVIRONMENT}-rg"
echo "  - All Container Apps, Container Registry, and related resources"
echo ""

read -p "$(echo -e ${RED}Are you ABSOLUTELY sure? Type 'destroy' to confirm: ${NC})" confirm

if [ "$confirm" != "destroy" ]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo -e "${YELLOW}Destroying Terraform resources...${NC}"

cd "$PROJECT_ROOT/terraform"

STORAGE_ACCOUNT="${PROJECT_NAME}tfstate${ENVIRONMENT}"
STORAGE_ACCOUNT=$(echo "$STORAGE_ACCOUNT" | tr -d '-' | tr '[:upper:]' '[:lower:]')

terraform init \
    -backend-config="resource_group_name=${PROJECT_NAME}-terraform-state" \
    -backend-config="storage_account_name=$STORAGE_ACCOUNT" \
    -backend-config="container_name=tfstate" \
    -backend-config="key=${ENVIRONMENT}.terraform.tfstate" \
    -reconfigure

terraform destroy \
    -var-file="environments/${ENVIRONMENT}.tfvars" \
    -var="openai_api_key=dummy" \
    -var="supabase_url=https://dummy.supabase.co" \
    -var="supabase_service_role_key=dummy" \
    -var="clerk_publishable_key=pk_dummy" \
    -var="clerk_secret_key=sk_dummy"

echo ""
echo -e "${GREEN}✓ Resources destroyed successfully${NC}"
echo ""
echo -e "${YELLOW}Note: Terraform state storage was NOT deleted.${NC}"
echo "To delete state storage, run:"
echo "  az group delete --name ${PROJECT_NAME}-terraform-state --yes"
