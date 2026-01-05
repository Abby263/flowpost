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
  count        = var.enable_rbac_authorization || var.additional_service_principal_client_id == "" ? 0 : 1
  key_vault_id = azurerm_key_vault.this.id
  tenant_id    = data.azurerm_client_config.current.tenant_id
  object_id    = data.azuread_service_principal.additional[0].object_id

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
  count        = var.openai_api_key != "" ? 1 : 0
  name         = "openai-api-key"
  value        = var.openai_api_key
  key_vault_id = azurerm_key_vault.this.id
  content_type = "OpenAI API Key"

  depends_on = [azurerm_key_vault_access_policy.terraform]
}

resource "azurerm_key_vault_secret" "gemini_api_key" {
  count        = var.gemini_api_key != "" ? 1 : 0
  name         = "gemini-api-key"
  value        = var.gemini_api_key
  key_vault_id = azurerm_key_vault.this.id
  content_type = "Google Gemini API Key"

  depends_on = [azurerm_key_vault_access_policy.terraform]
}

resource "azurerm_key_vault_secret" "langchain_api_key" {
  count        = var.langchain_api_key != "" ? 1 : 0
  name         = "langchain-api-key"
  value        = var.langchain_api_key
  key_vault_id = azurerm_key_vault.this.id
  content_type = "LangChain API Key"

  depends_on = [azurerm_key_vault_access_policy.terraform]
}

# =============================================================================
# Search & Scraping Secrets
# =============================================================================

resource "azurerm_key_vault_secret" "serper_api_key" {
  count        = var.serper_api_key != "" ? 1 : 0
  name         = "serper-api-key"
  value        = var.serper_api_key
  key_vault_id = azurerm_key_vault.this.id
  content_type = "Serper API Key"

  depends_on = [azurerm_key_vault_access_policy.terraform]
}

resource "azurerm_key_vault_secret" "perplexity_api_key" {
  count        = var.perplexity_api_key != "" ? 1 : 0
  name         = "perplexity-api-key"
  value        = var.perplexity_api_key
  key_vault_id = azurerm_key_vault.this.id
  content_type = "Perplexity API Key"

  depends_on = [azurerm_key_vault_access_policy.terraform]
}

resource "azurerm_key_vault_secret" "firecrawl_api_key" {
  count        = var.firecrawl_api_key != "" ? 1 : 0
  name         = "firecrawl-api-key"
  value        = var.firecrawl_api_key
  key_vault_id = azurerm_key_vault.this.id
  content_type = "FireCrawl API Key"

  depends_on = [azurerm_key_vault_access_policy.terraform]
}

# =============================================================================
# Authentication Secrets (Clerk)
# =============================================================================

resource "azurerm_key_vault_secret" "clerk_publishable_key" {
  count        = var.clerk_publishable_key != "" ? 1 : 0
  name         = "clerk-publishable-key"
  value        = var.clerk_publishable_key
  key_vault_id = azurerm_key_vault.this.id
  content_type = "Clerk Publishable Key"

  depends_on = [azurerm_key_vault_access_policy.terraform]
}

resource "azurerm_key_vault_secret" "clerk_secret_key" {
  count        = var.clerk_secret_key != "" ? 1 : 0
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
  count        = var.stripe_secret_key != "" ? 1 : 0
  name         = "stripe-secret-key"
  value        = var.stripe_secret_key
  key_vault_id = azurerm_key_vault.this.id
  content_type = "Stripe Secret Key"

  depends_on = [azurerm_key_vault_access_policy.terraform]
}

resource "azurerm_key_vault_secret" "stripe_webhook_secret" {
  count        = var.stripe_webhook_secret != "" ? 1 : 0
  name         = "stripe-webhook-secret"
  value        = var.stripe_webhook_secret
  key_vault_id = azurerm_key_vault.this.id
  content_type = "Stripe Webhook Secret"

  depends_on = [azurerm_key_vault_access_policy.terraform]
}

# =============================================================================
# Admin Secrets
# =============================================================================

resource "azurerm_key_vault_secret" "admin_user_ids" {
  count        = var.admin_user_ids != "" ? 1 : 0
  name         = "admin-user-ids"
  value        = var.admin_user_ids
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
