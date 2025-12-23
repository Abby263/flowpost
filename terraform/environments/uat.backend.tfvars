# Terraform Backend Configuration for UAT Environment
# Usage: terraform init -backend-config="environments/uat.backend.tfvars"

resource_group_name  = "flowpost-terraform-state"
storage_account_name = "flowposttfstateuat"
container_name       = "tfstate"
key                  = "uat.terraform.tfstate"
