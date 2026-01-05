# =============================================================================
# Key Vault Configuration
# =============================================================================

variable "name" {
  description = "Name of the Key Vault"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
}

variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
}

variable "sku_name" {
  description = "SKU name for the Key Vault"
  type        = string
  default     = "standard"
}

variable "soft_delete_retention_days" {
  description = "Soft delete retention days"
  type        = number
  default     = 7
}

variable "purge_protection_enabled" {
  description = "Enable purge protection"
  type        = bool
  default     = false
}

variable "enable_rbac_authorization" {
  description = "Enable RBAC authorization instead of access policies"
  type        = bool
  default     = false
}

variable "public_network_access_enabled" {
  description = "Enable public network access"
  type        = bool
  default     = true
}

# =============================================================================
# Network ACLs
# =============================================================================

variable "network_acls_enabled" {
  description = "Enable network ACLs"
  type        = bool
  default     = false
}

variable "network_acls_bypass" {
  description = "Network ACLs bypass"
  type        = string
  default     = "AzureServices"
}

variable "network_acls_default_action" {
  description = "Network ACLs default action"
  type        = string
  default     = "Deny"
}

variable "network_acls_ip_rules" {
  description = "Network ACLs IP rules"
  type        = list(string)
  default     = []
}

variable "network_acls_subnet_ids" {
  description = "Network ACLs subnet IDs"
  type        = list(string)
  default     = []
}

# =============================================================================
# Feature Flags (control secret creation with known values)
# =============================================================================

variable "enable_postgresql_secrets" {
  description = "Whether to create PostgreSQL secrets (set to true when PostgreSQL is enabled)"
  type        = bool
  default     = false
}

variable "enable_acr_secrets" {
  description = "Whether to create ACR secrets (set to true when Container Registry is enabled)"
  type        = bool
  default     = false
}

# =============================================================================
# PostgreSQL Secrets
# =============================================================================

variable "postgres_host" {
  description = "PostgreSQL host"
  type        = string
  default     = ""
}

variable "postgres_admin" {
  description = "PostgreSQL admin username"
  type        = string
  default     = ""
}

variable "postgres_password" {
  description = "PostgreSQL admin password"
  type        = string
  default     = ""
  sensitive   = true
}

variable "postgres_database" {
  description = "PostgreSQL database name"
  type        = string
  default     = ""
}

variable "postgres_port" {
  description = "PostgreSQL port"
  type        = string
  default     = "5432"
}

# Legacy secret name variables (deprecated)
variable "postgres_host_secret_name" {
  description = "DEPRECATED: Secret name is now standardized"
  type        = string
  default     = "postgres-host"
}

variable "postgres_admin_secret_name" {
  description = "DEPRECATED: Secret name is now standardized"
  type        = string
  default     = "postgres-admin"
}

variable "postgres_password_secret_name" {
  description = "DEPRECATED: Secret name is now standardized"
  type        = string
  default     = "postgres-password"
}

variable "postgres_uri_secret_name" {
  description = "DEPRECATED: Secret name is now standardized"
  type        = string
  default     = "database-uri"
}

# =============================================================================
# AI Provider Secrets
# =============================================================================

variable "openai_api_key" {
  description = "OpenAI API key"
  type        = string
  default     = ""
  sensitive   = true
}

variable "gemini_api_key" {
  description = "Google Gemini API key"
  type        = string
  default     = ""
  sensitive   = true
}

variable "langchain_api_key" {
  description = "LangChain API key"
  type        = string
  default     = ""
  sensitive   = true
}

# =============================================================================
# Search & Scraping Secrets
# =============================================================================

variable "serper_api_key" {
  description = "Serper API key"
  type        = string
  default     = ""
  sensitive   = true
}

variable "perplexity_api_key" {
  description = "Perplexity API key"
  type        = string
  default     = ""
  sensitive   = true
}

variable "firecrawl_api_key" {
  description = "FireCrawl API key"
  type        = string
  default     = ""
  sensitive   = true
}

# =============================================================================
# Authentication Secrets (Clerk)
# =============================================================================

variable "clerk_publishable_key" {
  description = "Clerk publishable key"
  type        = string
  default     = ""
  sensitive   = true
}

variable "clerk_secret_key" {
  description = "Clerk secret key"
  type        = string
  default     = ""
  sensitive   = true
}

# =============================================================================
# Payment Secrets (Stripe)
# =============================================================================

variable "stripe_secret_key" {
  description = "Stripe secret key"
  type        = string
  default     = ""
  sensitive   = true
}

variable "stripe_webhook_secret" {
  description = "Stripe webhook secret"
  type        = string
  default     = ""
  sensitive   = true
}

# =============================================================================
# Admin Secrets
# =============================================================================

variable "admin_user_ids" {
  description = "Comma-separated list of admin user IDs"
  type        = string
  default     = ""
  sensitive   = true
}

# =============================================================================
# Container Registry Secrets
# =============================================================================

variable "acr_password" {
  description = "Azure Container Registry password"
  type        = string
  default     = ""
  sensitive   = true
}

# =============================================================================
# Tags
# =============================================================================

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}

# =============================================================================
# Additional Service Principal Access (for CI/CD)
# =============================================================================

variable "additional_service_principal_client_id" {
  description = "Optional: Client ID of additional service principal to grant Key Vault access (e.g., GitHub Actions service principal)"
  type        = string
  default     = ""
}
