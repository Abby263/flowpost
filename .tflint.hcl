# =============================================================================
# TFLint Configuration
# =============================================================================
# Terraform linter configuration for pre-commit checks
# Documentation: https://github.com/terraform-linters/tflint

config {
  # Enable all available plugins
  call_module_type = "local"
  force            = false
  disabled_by_default = false
}

# =============================================================================
# Azure Provider Plugin
# =============================================================================
plugin "azurerm" {
  enabled = true
  version = "0.27.0"
  source  = "github.com/terraform-linters/tflint-ruleset-azurerm"
}

# =============================================================================
# Terraform Rules
# =============================================================================
plugin "terraform" {
  enabled = true
  preset  = "recommended"
}

# Enforce naming conventions
rule "terraform_naming_convention" {
  enabled = true
  format  = "snake_case"
}

# Require standard module structure
rule "terraform_standard_module_structure" {
  enabled = true
}

# Require documented variables
rule "terraform_documented_variables" {
  enabled = true
}

# Require documented outputs
rule "terraform_documented_outputs" {
  enabled = true
}

# Prevent deprecated syntax
rule "terraform_deprecated_interpolation" {
  enabled = true
}

# Require module version
rule "terraform_module_version" {
  enabled = true
}

# =============================================================================
# Custom Rules
# =============================================================================

# Warn about unused declarations
rule "terraform_unused_declarations" {
  enabled = true
}

# Require type constraints on variables
rule "terraform_typed_variables" {
  enabled = true
}

