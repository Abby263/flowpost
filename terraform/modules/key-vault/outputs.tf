# =============================================================================
# Key Vault Outputs
# =============================================================================

output "key_vault_id" {
  description = "ID of the Key Vault"
  value       = azurerm_key_vault.this.id
}

output "key_vault_name" {
  description = "Name of the Key Vault"
  value       = azurerm_key_vault.this.name
}

output "key_vault_uri" {
  description = "URI of the Key Vault"
  value       = azurerm_key_vault.this.vault_uri
}

output "tenant_id" {
  description = "Tenant ID of the Key Vault"
  value       = azurerm_key_vault.this.tenant_id
}

# =============================================================================
# Secret URIs (for Container Apps Key Vault references)
# =============================================================================
# Format: https://{vault-name}.vault.azure.net/secrets/{secret-name}

output "database_uri_secret_uri" {
  description = "URI for DATABASE_URI secret"
  value       = local.has_postgres_config ? "${azurerm_key_vault.this.vault_uri}secrets/database-uri" : null
}

output "openai_api_key_secret_uri" {
  description = "URI for OpenAI API key secret"
  value       = var.openai_api_key != "" ? "${azurerm_key_vault.this.vault_uri}secrets/openai-api-key" : null
}

output "gemini_api_key_secret_uri" {
  description = "URI for Gemini API key secret"
  value       = var.gemini_api_key != "" ? "${azurerm_key_vault.this.vault_uri}secrets/gemini-api-key" : null
}

output "langchain_api_key_secret_uri" {
  description = "URI for LangChain API key secret"
  value       = var.langchain_api_key != "" ? "${azurerm_key_vault.this.vault_uri}secrets/langchain-api-key" : null
}

output "serper_api_key_secret_uri" {
  description = "URI for Serper API key secret"
  value       = var.serper_api_key != "" ? "${azurerm_key_vault.this.vault_uri}secrets/serper-api-key" : null
}

output "perplexity_api_key_secret_uri" {
  description = "URI for Perplexity API key secret"
  value       = var.perplexity_api_key != "" ? "${azurerm_key_vault.this.vault_uri}secrets/perplexity-api-key" : null
}

output "firecrawl_api_key_secret_uri" {
  description = "URI for FireCrawl API key secret"
  value       = var.firecrawl_api_key != "" ? "${azurerm_key_vault.this.vault_uri}secrets/firecrawl-api-key" : null
}

output "clerk_publishable_key_secret_uri" {
  description = "URI for Clerk publishable key secret"
  value       = var.clerk_publishable_key != "" ? "${azurerm_key_vault.this.vault_uri}secrets/clerk-publishable-key" : null
}

output "clerk_secret_key_secret_uri" {
  description = "URI for Clerk secret key secret"
  value       = var.clerk_secret_key != "" ? "${azurerm_key_vault.this.vault_uri}secrets/clerk-secret-key" : null
}

output "stripe_secret_key_secret_uri" {
  description = "URI for Stripe secret key secret"
  value       = var.stripe_secret_key != "" ? "${azurerm_key_vault.this.vault_uri}secrets/stripe-secret-key" : null
}

output "stripe_webhook_secret_secret_uri" {
  description = "URI for Stripe webhook secret"
  value       = var.stripe_webhook_secret != "" ? "${azurerm_key_vault.this.vault_uri}secrets/stripe-webhook-secret" : null
}

output "admin_user_ids_secret_uri" {
  description = "URI for admin user IDs secret"
  value       = var.admin_user_ids != "" ? "${azurerm_key_vault.this.vault_uri}secrets/admin-user-ids" : null
}

output "acr_password_secret_uri" {
  description = "URI for ACR password secret"
  value       = var.acr_password != "" ? "${azurerm_key_vault.this.vault_uri}secrets/acr-password" : null
}

# =============================================================================
# Secret Names (for reference)
# =============================================================================

output "secret_names" {
  description = "Map of all secret names stored in Key Vault"
  value = {
    database_uri       = "database-uri"
    postgres_host      = "postgres-host"
    postgres_admin     = "postgres-admin"
    postgres_password  = "postgres-password"
    openai_api_key     = "openai-api-key"
    gemini_api_key     = "gemini-api-key"
    langchain_api_key  = "langchain-api-key"
    serper_api_key     = "serper-api-key"
    perplexity_api_key = "perplexity-api-key"
    firecrawl_api_key  = "firecrawl-api-key"
    clerk_publishable  = "clerk-publishable-key"
    clerk_secret       = "clerk-secret-key"
    stripe_secret      = "stripe-secret-key"
    stripe_webhook     = "stripe-webhook-secret"
    admin_user_ids     = "admin-user-ids"
    acr_password       = "acr-password"
  }
}
