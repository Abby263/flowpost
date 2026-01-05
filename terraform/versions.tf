terraform {
  required_version = ">= 1.5.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.85"
    }
    azuread = {
      source  = "hashicorp/azuread"
      version = "~> 2.47"
    }
    time = {
      source  = "hashicorp/time"
      version = "~> 0.10"
    }
  }

  backend "azurerm" {
    # Configure via backend config file or CLI args:
    # terraform init -backend-config="environments/dev.backend.tfvars"
  }
}

provider "azurerm" {
  features {
    resource_group {
      prevent_deletion_if_contains_resources = false
    }
  }
}

provider "azuread" {
  # Uses the same credentials as azurerm provider
}
