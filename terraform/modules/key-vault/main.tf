# =============================================================================
# Azure Key Vault for Centralized Secrets Management
# =============================================================================
# All application secrets are stored in Key Vault:
# - PostgreSQL credentials (DATABASE_URI)
# - API keys (OpenAI, Gemini, LangChain, etc.)
# - Authentication secrets (Clerk)
# - Payment secrets (Stripe)
# - Admin configuration

data "azurerm_client_config" "current" {}

# Look up additional service principal by client ID (for CI/CD)
data "azuread_service_principal" "additional" {
  count     = var.additional_service_principal_client_id != "" ? 1 : 0
  client_id = var.additional_service_principal_client_id
}

# =============================================================================
# Local Variables
# =============================================================================
locals {
  # Use feature flags for count conditions (known at plan time)
  # These avoid the "count depends on resource attributes" error
  additional_sp_object_id = try(data.azuread_service_principal.additional[0].object_id, "")
  create_additional_sp = (
    !var.enable_rbac_authorization &&
    local.additional_sp_object_id != "" &&
    local.additional_sp_object_id != data.azurerm_client_config.current.object_id
  )

  preserve_optional_secrets = var.preserve_optional_secrets

  optional_secret_names = local.preserve_optional_secrets ? toset(try(nonsensitive(data.azurerm_key_vault_secrets.optional[0].names), [])) : toset([])

  openai_api_key_exists        = contains(local.optional_secret_names, "openai-api-key")
  gemini_api_key_exists        = contains(local.optional_secret_names, "gemini-api-key")
  langchain_api_key_exists     = contains(local.optional_secret_names, "langchain-api-key")
  serper_api_key_exists        = contains(local.optional_secret_names, "serper-api-key")
  perplexity_api_key_exists    = contains(local.optional_secret_names, "perplexity-api-key")
  firecrawl_api_key_exists     = contains(local.optional_secret_names, "firecrawl-api-key")
  stripe_secret_key_exists     = contains(local.optional_secret_names, "stripe-secret-key")
  stripe_webhook_secret_exists = contains(local.optional_secret_names, "stripe-webhook-secret")
  admin_user_ids_exists        = contains(local.optional_secret_names, "admin-user-ids")

  openai_api_key_provided        = trimspace(nonsensitive(var.openai_api_key)) != ""
  gemini_api_key_provided        = trimspace(nonsensitive(var.gemini_api_key)) != ""
  langchain_api_key_provided     = trimspace(nonsensitive(var.langchain_api_key)) != ""
  serper_api_key_provided        = trimspace(nonsensitive(var.serper_api_key)) != ""
  perplexity_api_key_provided    = trimspace(nonsensitive(var.perplexity_api_key)) != ""
  firecrawl_api_key_provided     = trimspace(nonsensitive(var.firecrawl_api_key)) != ""
  stripe_secret_key_provided     = trimspace(nonsensitive(var.stripe_secret_key)) != ""
  stripe_webhook_secret_provided = trimspace(nonsensitive(var.stripe_webhook_secret)) != ""
  admin_user_ids_provided        = trimspace(nonsensitive(var.admin_user_ids)) != ""
  clerk_publishable_key_present  = trimspace(nonsensitive(var.clerk_publishable_key)) != ""
  clerk_secret_key_present       = trimspace(nonsensitive(var.clerk_secret_key)) != ""
  acr_password_present           = trimspace(nonsensitive(var.acr_password)) != ""

  openai_api_key_value = local.openai_api_key_provided ? var.openai_api_key : (
    local.preserve_optional_secrets ? try(nonsensitive(data.azurerm_key_vault_secret.openai_api_key[0].value), "") : ""
  )
  gemini_api_key_value = local.gemini_api_key_provided ? var.gemini_api_key : (
    local.preserve_optional_secrets ? try(nonsensitive(data.azurerm_key_vault_secret.gemini_api_key[0].value), "") : ""
  )
  langchain_api_key_value = local.langchain_api_key_provided ? var.langchain_api_key : (
    local.preserve_optional_secrets ? try(nonsensitive(data.azurerm_key_vault_secret.langchain_api_key[0].value), "") : ""
  )
  serper_api_key_value = local.serper_api_key_provided ? var.serper_api_key : (
    local.preserve_optional_secrets ? try(nonsensitive(data.azurerm_key_vault_secret.serper_api_key[0].value), "") : ""
  )
  perplexity_api_key_value = local.perplexity_api_key_provided ? var.perplexity_api_key : (
    local.preserve_optional_secrets ? try(nonsensitive(data.azurerm_key_vault_secret.perplexity_api_key[0].value), "") : ""
  )
  firecrawl_api_key_value = local.firecrawl_api_key_provided ? var.firecrawl_api_key : (
    local.preserve_optional_secrets ? try(nonsensitive(data.azurerm_key_vault_secret.firecrawl_api_key[0].value), "") : ""
  )
  stripe_secret_key_value = local.stripe_secret_key_provided ? var.stripe_secret_key : (
    local.preserve_optional_secrets ? try(nonsensitive(data.azurerm_key_vault_secret.stripe_secret_key[0].value), "") : ""
  )
  stripe_webhook_secret_value = local.stripe_webhook_secret_provided ? var.stripe_webhook_secret : (
    local.preserve_optional_secrets ? try(nonsensitive(data.azurerm_key_vault_secret.stripe_webhook_secret[0].value), "") : ""
  )
  admin_user_ids_value = local.admin_user_ids_provided ? var.admin_user_ids : (
    local.preserve_optional_secrets ? try(nonsensitive(data.azurerm_key_vault_secret.admin_user_ids[0].value), "") : ""
  )

  openai_api_key_value_present        = trimspace(nonsensitive(local.openai_api_key_value)) != ""
  gemini_api_key_value_present        = trimspace(nonsensitive(local.gemini_api_key_value)) != ""
  langchain_api_key_value_present     = trimspace(nonsensitive(local.langchain_api_key_value)) != ""
  serper_api_key_value_present        = trimspace(nonsensitive(local.serper_api_key_value)) != ""
  perplexity_api_key_value_present    = trimspace(nonsensitive(local.perplexity_api_key_value)) != ""
  firecrawl_api_key_value_present     = trimspace(nonsensitive(local.firecrawl_api_key_value)) != ""
  stripe_secret_key_value_present     = trimspace(nonsensitive(local.stripe_secret_key_value)) != ""
  stripe_webhook_secret_value_present = trimspace(nonsensitive(local.stripe_webhook_secret_value)) != ""
  admin_user_ids_value_present        = trimspace(nonsensitive(local.admin_user_ids_value)) != ""
}

resource "azurerm_key_vault" "this" {
  name                        = var.name
  location                    = var.location
  resource_group_name         = var.resource_group_name
  enabled_for_disk_encryption = false
  tenant_id                   = data.azurerm_client_config.current.tenant_id
  soft_delete_retention_days  = var.soft_delete_retention_days
  purge_protection_enabled    = var.purge_protection_enabled
  sku_name                    = var.sku_name

  # Enable RBAC authorization for Container Apps managed identity
  enable_rbac_authorization = var.enable_rbac_authorization

  # Network access configuration
  public_network_access_enabled = var.public_network_access_enabled

  dynamic "network_acls" {
    for_each = var.network_acls_enabled ? [1] : []
    content {
      bypass                     = var.network_acls_bypass
      default_action             = var.network_acls_default_action
      ip_rules                   = var.network_acls_ip_rules
      virtual_network_subnet_ids = var.network_acls_subnet_ids
    }
  }

  tags = var.tags
}

# =============================================================================
# Optional Secret Preservation (Key Vault lookups)
# =============================================================================

data "azurerm_key_vault_secrets" "optional" {
  count        = var.preserve_optional_secrets ? 1 : 0
  key_vault_id = azurerm_key_vault.this.id
}

data "azurerm_key_vault_secret" "openai_api_key" {
  count        = var.preserve_optional_secrets && !local.openai_api_key_provided && local.openai_api_key_exists ? 1 : 0
  name         = "openai-api-key"
  key_vault_id = azurerm_key_vault.this.id
}

data "azurerm_key_vault_secret" "gemini_api_key" {
  count        = var.preserve_optional_secrets && !local.gemini_api_key_provided && local.gemini_api_key_exists ? 1 : 0
  name         = "gemini-api-key"
  key_vault_id = azurerm_key_vault.this.id
}

data "azurerm_key_vault_secret" "langchain_api_key" {
  count        = var.preserve_optional_secrets && !local.langchain_api_key_provided && local.langchain_api_key_exists ? 1 : 0
  name         = "langchain-api-key"
  key_vault_id = azurerm_key_vault.this.id
}

data "azurerm_key_vault_secret" "serper_api_key" {
  count        = var.preserve_optional_secrets && !local.serper_api_key_provided && local.serper_api_key_exists ? 1 : 0
  name         = "serper-api-key"
  key_vault_id = azurerm_key_vault.this.id
}

data "azurerm_key_vault_secret" "perplexity_api_key" {
  count        = var.preserve_optional_secrets && !local.perplexity_api_key_provided && local.perplexity_api_key_exists ? 1 : 0
  name         = "perplexity-api-key"
  key_vault_id = azurerm_key_vault.this.id
}

data "azurerm_key_vault_secret" "firecrawl_api_key" {
  count        = var.preserve_optional_secrets && !local.firecrawl_api_key_provided && local.firecrawl_api_key_exists ? 1 : 0
  name         = "firecrawl-api-key"
  key_vault_id = azurerm_key_vault.this.id
}

data "azurerm_key_vault_secret" "stripe_secret_key" {
  count        = var.preserve_optional_secrets && !local.stripe_secret_key_provided && local.stripe_secret_key_exists ? 1 : 0
  name         = "stripe-secret-key"
  key_vault_id = azurerm_key_vault.this.id
}

data "azurerm_key_vault_secret" "stripe_webhook_secret" {
  count        = var.preserve_optional_secrets && !local.stripe_webhook_secret_provided && local.stripe_webhook_secret_exists ? 1 : 0
  name         = "stripe-webhook-secret"
  key_vault_id = azurerm_key_vault.this.id
}

data "azurerm_key_vault_secret" "admin_user_ids" {
  count        = var.preserve_optional_secrets && !local.admin_user_ids_provided && local.admin_user_ids_exists ? 1 : 0
  name         = "admin-user-ids"
  key_vault_id = azurerm_key_vault.this.id
}

# Access policy for the current service principal (Terraform)
resource "azurerm_key_vault_access_policy" "terraform" {
  count        = var.enable_rbac_authorization ? 0 : 1
  key_vault_id = azurerm_key_vault.this.id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = data.azurerm_client_config.current.object_id

  secret_permissions = [
    "Backup",
    "Delete",
    "Get",
    "List",
    "Purge",
    "Recover",
    "Restore",
    "Set"
  ]

  key_permissions = [
    "Create",
    "Delete",
    "Get",
    "List",
    "Update"
  ]
}

# Access policy for additional service principal (e.g., GitHub Actions)
resource "azurerm_key_vault_access_policy" "additional_sp" {
  count        = local.create_additional_sp ? 1 : 0
  key_vault_id = azurerm_key_vault.this.id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = local.additional_sp_object_id

  secret_permissions = [
    "Backup",
    "Delete",
    "Get",
    "List",
    "Purge",
    "Recover",
    "Restore",
    "Set"
  ]

  key_permissions = [
    "Create",
    "Delete",
    "Get",
    "List",
    "Update"
  ]
}

# =============================================================================
# PostgreSQL Secrets
# =============================================================================

resource "azurerm_key_vault_secret" "database_uri" {
  count        = var.enable_postgresql_secrets ? 1 : 0
  name         = "database-uri"
  value        = "postgresql://${var.postgres_admin}:${var.postgres_password}@${var.postgres_host}:${var.postgres_port}/${var.postgres_database}?sslmode=require"
  key_vault_id = azurerm_key_vault.this.id
  content_type = "PostgreSQL Connection URI"

  depends_on = [azurerm_key_vault_access_policy.terraform]
}

resource "azurerm_key_vault_secret" "postgres_host" {
  count        = var.enable_postgresql_secrets ? 1 : 0
  name         = "postgres-host"
  value        = var.postgres_host
  key_vault_id = azurerm_key_vault.this.id
  content_type = "PostgreSQL Host"

  depends_on = [azurerm_key_vault_access_policy.terraform]
}

resource "azurerm_key_vault_secret" "postgres_admin" {
  count        = var.enable_postgresql_secrets ? 1 : 0
  name         = "postgres-admin"
  value        = var.postgres_admin
  key_vault_id = azurerm_key_vault.this.id
  content_type = "PostgreSQL Admin Username"

  depends_on = [azurerm_key_vault_access_policy.terraform]
}

resource "azurerm_key_vault_secret" "postgres_password" {
  count        = var.enable_postgresql_secrets ? 1 : 0
  name         = "postgres-password"
  value        = var.postgres_password
  key_vault_id = azurerm_key_vault.this.id
  content_type = "PostgreSQL Admin Password"

  depends_on = [azurerm_key_vault_access_policy.terraform]
}

# =============================================================================
# AI Provider Secrets
# =============================================================================

resource "azurerm_key_vault_secret" "openai_api_key" {
  count        = local.openai_api_key_value_present ? 1 : 0
  name         = "openai-api-key"
  value        = local.openai_api_key_value
  key_vault_id = azurerm_key_vault.this.id
  content_type = "OpenAI API Key"

  depends_on = [azurerm_key_vault_access_policy.terraform]
}

resource "azurerm_key_vault_secret" "gemini_api_key" {
  count        = local.gemini_api_key_value_present ? 1 : 0
  name         = "gemini-api-key"
  value        = local.gemini_api_key_value
  key_vault_id = azurerm_key_vault.this.id
  content_type = "Google Gemini API Key"

  depends_on = [azurerm_key_vault_access_policy.terraform]
}

resource "azurerm_key_vault_secret" "langchain_api_key" {
  count        = local.langchain_api_key_value_present ? 1 : 0
  name         = "langchain-api-key"
  value        = local.langchain_api_key_value
  key_vault_id = azurerm_key_vault.this.id
  content_type = "LangChain API Key"

  depends_on = [azurerm_key_vault_access_policy.terraform]
}

# =============================================================================
# Search & Scraping Secrets
# =============================================================================

resource "azurerm_key_vault_secret" "serper_api_key" {
  count        = local.serper_api_key_value_present ? 1 : 0
  name         = "serper-api-key"
  value        = local.serper_api_key_value
  key_vault_id = azurerm_key_vault.this.id
  content_type = "Serper API Key"

  depends_on = [azurerm_key_vault_access_policy.terraform]
}

resource "azurerm_key_vault_secret" "perplexity_api_key" {
  count        = local.perplexity_api_key_value_present ? 1 : 0
  name         = "perplexity-api-key"
  value        = local.perplexity_api_key_value
  key_vault_id = azurerm_key_vault.this.id
  content_type = "Perplexity API Key"

  depends_on = [azurerm_key_vault_access_policy.terraform]
}

resource "azurerm_key_vault_secret" "firecrawl_api_key" {
  count        = local.firecrawl_api_key_value_present ? 1 : 0
  name         = "firecrawl-api-key"
  value        = local.firecrawl_api_key_value
  key_vault_id = azurerm_key_vault.this.id
  content_type = "FireCrawl API Key"

  depends_on = [azurerm_key_vault_access_policy.terraform]
}

# =============================================================================
# Authentication Secrets (Clerk)
# =============================================================================

resource "azurerm_key_vault_secret" "clerk_publishable_key" {
  count        = local.clerk_publishable_key_present ? 1 : 0
  name         = "clerk-publishable-key"
  value        = var.clerk_publishable_key
  key_vault_id = azurerm_key_vault.this.id
  content_type = "Clerk Publishable Key"

  depends_on = [azurerm_key_vault_access_policy.terraform]
}

resource "azurerm_key_vault_secret" "clerk_secret_key" {
  count        = local.clerk_secret_key_present ? 1 : 0
  name         = "clerk-secret-key"
  value        = var.clerk_secret_key
  key_vault_id = azurerm_key_vault.this.id
  content_type = "Clerk Secret Key"

  depends_on = [azurerm_key_vault_access_policy.terraform]
}

# =============================================================================
# Payment Secrets (Stripe)
# =============================================================================

resource "azurerm_key_vault_secret" "stripe_secret_key" {
  count        = local.stripe_secret_key_value_present ? 1 : 0
  name         = "stripe-secret-key"
  value        = local.stripe_secret_key_value
  key_vault_id = azurerm_key_vault.this.id
  content_type = "Stripe Secret Key"

  depends_on = [azurerm_key_vault_access_policy.terraform]
}

resource "azurerm_key_vault_secret" "stripe_webhook_secret" {
  count        = local.stripe_webhook_secret_value_present ? 1 : 0
  name         = "stripe-webhook-secret"
  value        = local.stripe_webhook_secret_value
  key_vault_id = azurerm_key_vault.this.id
  content_type = "Stripe Webhook Secret"

  depends_on = [azurerm_key_vault_access_policy.terraform]
}

# =============================================================================
# Admin Secrets
# =============================================================================

resource "azurerm_key_vault_secret" "admin_user_ids" {
  count        = local.admin_user_ids_value_present ? 1 : 0
  name         = "admin-user-ids"
  value        = local.admin_user_ids_value
  key_vault_id = azurerm_key_vault.this.id
  content_type = "Admin User IDs (comma-separated)"

  depends_on = [azurerm_key_vault_access_policy.terraform]
}

# =============================================================================
# Container Registry Secrets
# =============================================================================

resource "azurerm_key_vault_secret" "acr_password" {
  count        = var.enable_acr_secrets ? 1 : 0
  name         = "acr-password"
  value        = var.acr_password
  key_vault_id = azurerm_key_vault.this.id
  content_type = "Azure Container Registry Password"

  depends_on = [azurerm_key_vault_access_policy.terraform]
}
