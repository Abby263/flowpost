# Terraform Backend Configuration for Prod Environment
# Usage: terraform init -backend-config="environments/prod.backend.tfvars"

resource_group_name  = "flowpost-terraform-state"
storage_account_name = "flowposttfstateprod"
container_name       = "tfstate"
key                  = "prod.terraform.tfstate"
