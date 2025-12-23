# Terraform Backend Configuration for Dev Environment
# Usage: terraform init -backend-config="environments/dev.backend.tfvars"

resource_group_name  = "flowpost-terraform-state"
storage_account_name = "flowposttfstatedev"
container_name       = "tfstate"
key                  = "dev.terraform.tfstate"
