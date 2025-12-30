# =============================================================================
# Locals
# =============================================================================
locals {
  resource_prefix = "${var.project_name}-${var.environment}"
  common_tags = merge(var.tags, {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  })

  # PostgreSQL Database Name Configuration
  # --------------------------------------
  # Ensure PostgreSQL DB name follows restrictions:
  # - Must start with a letter or underscore
  # - Can contain letters, digits, underscores
  # - Truncate to 63 characters maximum
  postgres_raw_name = "${var.project_name}_${var.environment}_db"

  # Replace invalid characters with underscores
  postgres_sanitized_name = replace(
    lower(local.postgres_raw_name),
    "/[^a-z0-9_]/",
    "_"
  )

  # Ensure it starts with a letter or underscore
  postgres_valid_start = regex("^[a-z_]", local.postgres_sanitized_name) == "" ? "_${local.postgres_sanitized_name}" : local.postgres_sanitized_name

  # Truncate to 63 characters
  postgres_db_name = substr(local.postgres_valid_start, 0, min(63, length(local.postgres_valid_start)))

  # Shared PostgreSQL server name
  postgres_server_name = "${var.project_name}-${var.shared_environment}-postgres"

  # Key Vault name (must be globally unique, 3-24 characters)
  key_vault_name = replace(substr("${local.resource_prefix}-kv", 0, 24), "-", "")

  # Database configuration
  database = {
    name     = local.postgres_db_name
    port     = 5432
    ssl_mode = "require"
  }

  # Build Database URI for LangGraph API
  # Note: Only reference module output when postgresql is enabled
  postgres_host = var.enable_postgresql ? module.postgresql[0].server_fqdn : ""
}

# =============================================================================
# Resource Group
# =============================================================================
resource "azurerm_resource_group" "main" {
  name     = "${local.resource_prefix}-rg"
  location = var.location
  tags     = local.common_tags
}

# =============================================================================
# Key Vault - Centralized Secrets Management
# =============================================================================
# All secrets are stored in Azure Key Vault for:
# - Centralized secret management
# - Audit logging
# - Secret rotation
# - Access control via RBAC/policies

module "key_vault" {
  count  = var.enable_key_vault ? 1 : 0
  source = "./modules/key-vault"

  name                = local.key_vault_name
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location

  # Feature flags (known at plan time - avoid count dependency issues)
  enable_postgresql_secrets = var.enable_postgresql
  enable_acr_secrets        = true # ACR is always created

  # PostgreSQL secrets - pass components for URI construction in module
  postgres_host     = var.enable_postgresql ? module.postgresql[0].server_fqdn : ""
  postgres_admin    = var.postgres_admin_username
  postgres_password = var.postgres_admin_password
  postgres_database = local.postgres_db_name
  postgres_port     = "5432"

  # AI Provider secrets
  openai_api_key    = var.openai_api_key
  gemini_api_key    = var.gemini_api_key
  langchain_api_key = var.langchain_api_key

  # Search & Scraping secrets
  serper_api_key     = var.serper_api_key
  perplexity_api_key = var.perplexity_api_key
  firecrawl_api_key  = var.firecrawl_api_key

  # Authentication secrets (Clerk)
  clerk_publishable_key = var.clerk_publishable_key
  clerk_secret_key      = var.clerk_secret_key

  # Payment secrets (Stripe)
  stripe_secret_key     = var.stripe_secret_key
  stripe_webhook_secret = var.stripe_webhook_secret

  # Admin secrets
  admin_user_ids = var.admin_user_ids

  # Container Registry secrets
  acr_password = module.container_registry.admin_password

  tags = local.common_tags

  depends_on = [module.postgresql, module.container_registry]
}

# =============================================================================
# PostgreSQL Flexible Server - Shared resource for LangGraph API state
# =============================================================================
module "postgresql" {
  count  = var.enable_postgresql ? 1 : 0
  source = "./modules/postgresql"

  server_name         = local.postgres_server_name
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location

  # Authentication
  administrator_login    = var.postgres_admin_username
  administrator_password = var.postgres_admin_password

  # Database configuration
  database_name = local.postgres_db_name

  # Server configuration (varies by environment)
  sku_name                     = var.postgres_sku_name
  storage_mb                   = var.postgres_storage_mb
  backup_retention_days        = var.postgres_backup_retention_days
  geo_redundant_backup_enabled = var.postgres_geo_redundant_backup
  high_availability_enabled    = var.postgres_high_availability

  # Network configuration
  public_network_access_enabled = true
  allow_azure_services          = true

  tags = local.common_tags
}

# =============================================================================
# Container Registry
# =============================================================================
module "container_registry" {
  source = "./modules/container-registry"

  name                = replace("${local.resource_prefix}acr", "-", "")
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = var.environment == "prod" ? "Standard" : "Basic"
  tags                = local.common_tags
}

# =============================================================================
# Container Apps Environment
# =============================================================================
module "container_environment" {
  source = "./modules/container-environment"

  name                = "${local.resource_prefix}-env"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  tags                = local.common_tags
}

# =============================================================================
# Backend Container App
# =============================================================================
module "backend" {
  source = "./modules/container-app"

  name                        = "${local.resource_prefix}-backend"
  resource_group_name         = azurerm_resource_group.main.name
  location                    = azurerm_resource_group.main.location
  container_environment_id    = module.container_environment.id
  container_registry_server   = module.container_registry.login_server
  container_registry_username = module.container_registry.admin_username
  container_registry_password = module.container_registry.admin_password

  image_name  = "flowpost-backend"
  image_tag   = "latest"
  target_port = 54367

  cpu          = var.backend_cpu
  memory       = var.backend_memory
  min_replicas = var.backend_min_replicas
  max_replicas = var.backend_max_replicas

  # Key Vault configuration for secret references
  key_vault_id  = var.enable_key_vault ? module.key_vault[0].key_vault_id : null
  key_vault_uri = var.enable_key_vault ? module.key_vault[0].key_vault_uri : null

  environment_variables = {
    NODE_ENV    = var.environment == "prod" ? "production" : "development"
    HOST        = "0.0.0.0"
    PORT        = "54367"
    AI_PROVIDER = var.ai_provider
    LLM_MODEL   = var.llm_model
    IMAGE_MODEL = var.image_model
  }

  # All secrets stored in Container App secrets (also backed up in Key Vault)
  # Note: Using postgresql module output to avoid sensitive values in conditionals
  secrets = merge(
    # PostgreSQL (DATABASE_URI for LangGraph) - use module output directly
    var.enable_postgresql ? {
      database-uri = module.postgresql[0].database_uri
    } : {},
    # AI Provider keys - always include, empty string is safe
    {
      openai-api-key    = var.openai_api_key
      gemini-api-key    = var.gemini_api_key
      langchain-api-key = var.langchain_api_key
      serper-api-key    = var.serper_api_key
      firecrawl-api-key = var.firecrawl_api_key
    }
  )

  # Map secret names to environment variables
  # Only DATABASE_URI is conditional on postgresql being enabled
  secret_environment_variables = merge(
    var.enable_postgresql ? { DATABASE_URI = "database-uri" } : {},
    {
      OPENAI_API_KEY    = "openai-api-key"
      GEMINI_API_KEY    = "gemini-api-key"
      LANGCHAIN_API_KEY = "langchain-api-key"
      SERPER_API_KEY    = "serper-api-key"
      FIRECRAWL_API_KEY = "firecrawl-api-key"
    }
  )

  # Health Probes
  startup_probe_path              = "/health/startup"
  startup_probe_initial_delay     = 10
  startup_probe_interval          = 10
  startup_probe_failure_threshold = 30

  liveness_probe_path              = "/health/live"
  liveness_probe_interval          = 30
  liveness_probe_failure_threshold = 3

  readiness_probe_path              = "/health/ready"
  readiness_probe_interval          = 10
  readiness_probe_failure_threshold = 3

  tags = local.common_tags

  depends_on = [module.postgresql, module.key_vault]
}

# =============================================================================
# Frontend Container App
# =============================================================================
module "frontend" {
  source = "./modules/container-app"

  name                        = "${local.resource_prefix}-frontend"
  resource_group_name         = azurerm_resource_group.main.name
  location                    = azurerm_resource_group.main.location
  container_environment_id    = module.container_environment.id
  container_registry_server   = module.container_registry.login_server
  container_registry_username = module.container_registry.admin_username
  container_registry_password = module.container_registry.admin_password

  image_name  = "flowpost-frontend"
  image_tag   = "latest"
  target_port = 3000

  cpu          = var.frontend_cpu
  memory       = var.frontend_memory
  min_replicas = var.frontend_min_replicas
  max_replicas = var.frontend_max_replicas

  # Key Vault configuration
  key_vault_id  = var.enable_key_vault ? module.key_vault[0].key_vault_id : null
  key_vault_uri = var.enable_key_vault ? module.key_vault[0].key_vault_uri : null

  environment_variables = {
    NODE_ENV                            = "production"
    HOSTNAME                            = "0.0.0.0"
    PORT                                = "3000"
    NEXT_PUBLIC_CLERK_SIGN_IN_URL       = "/sign-in"
    NEXT_PUBLIC_CLERK_SIGN_UP_URL       = "/sign-up"
    NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL = "/dashboard"
    NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL = "/dashboard"
    LANGGRAPH_API_URL                   = "https://${module.backend.fqdn}"
  }

  # All secrets stored in Key Vault - always include all secrets
  # Empty strings are handled by the container app module
  secrets = {
    clerk-publishable-key = var.clerk_publishable_key
    clerk-secret-key      = var.clerk_secret_key
    stripe-secret-key     = var.stripe_secret_key
    stripe-webhook-secret = var.stripe_webhook_secret
    admin-user-ids        = var.admin_user_ids
    serper-api-key        = var.serper_api_key
    perplexity-api-key    = var.perplexity_api_key
  }

  secret_environment_variables = {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "clerk-publishable-key"
    CLERK_SECRET_KEY                  = "clerk-secret-key"
    STRIPE_SECRET_KEY                 = "stripe-secret-key"
    STRIPE_WEBHOOK_SECRET             = "stripe-webhook-secret"
    ADMIN_USER_IDS                    = "admin-user-ids"
    SERPER_API_KEY                    = "serper-api-key"
    PERPLEXITY_API_KEY                = "perplexity-api-key"
  }

  # Health Probes
  startup_probe_path              = "/api/health/startup"
  startup_probe_initial_delay     = 5
  startup_probe_interval          = 5
  startup_probe_failure_threshold = 24

  liveness_probe_path              = "/api/health/live"
  liveness_probe_interval          = 30
  liveness_probe_failure_threshold = 3

  readiness_probe_path              = "/api/health/ready"
  readiness_probe_interval          = 10
  readiness_probe_failure_threshold = 3

  tags = local.common_tags

  depends_on = [module.backend, module.key_vault]
}
