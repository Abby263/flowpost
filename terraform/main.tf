locals {
  resource_prefix = "${var.project_name}-${var.environment}"
  common_tags = merge(var.tags, {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  })
}

# Resource Group
resource "azurerm_resource_group" "main" {
  name     = "${local.resource_prefix}-rg"
  location = var.location
  tags     = local.common_tags
}

# Container Registry
module "container_registry" {
  source = "./modules/container-registry"

  name                = replace("${local.resource_prefix}acr", "-", "")
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = var.environment == "prod" ? "Standard" : "Basic"
  tags                = local.common_tags
}

# Container Apps Environment
module "container_environment" {
  source = "./modules/container-environment"

  name                = "${local.resource_prefix}-env"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  tags                = local.common_tags
}

# Backend Container App
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

  environment_variables = {
    NODE_ENV    = var.environment == "prod" ? "production" : "development"
    HOST        = "0.0.0.0"
    PORT        = "54367"
    AI_PROVIDER = var.ai_provider
    LLM_MODEL   = var.llm_model
    IMAGE_MODEL = var.image_model
  }

  secrets = merge(
    {
      supabase-url = var.supabase_url
      supabase-key = var.supabase_service_role_key
    },
    var.openai_api_key != "" ? { openai-api-key = var.openai_api_key } : {},
    var.gemini_api_key != "" ? { gemini-api-key = var.gemini_api_key } : {},
    var.langchain_api_key != "" ? { langchain-key = var.langchain_api_key } : {},
    var.serper_api_key != "" ? { serper-key = var.serper_api_key } : {}
  )

  secret_environment_variables = merge(
    {
      SUPABASE_URL              = "supabase-url"
      SUPABASE_SERVICE_ROLE_KEY = "supabase-key"
    },
    var.openai_api_key != "" ? { OPENAI_API_KEY = "openai-api-key" } : {},
    var.gemini_api_key != "" ? { GEMINI_API_KEY = "gemini-api-key" } : {},
    var.langchain_api_key != "" ? { LANGCHAIN_API_KEY = "langchain-key" } : {},
    var.serper_api_key != "" ? { SERPER_API_KEY = "serper-key" } : {}
  )

  health_check_path = "/ok"
  tags              = local.common_tags
}

# Frontend Container App
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

  secrets = merge(
    {
      clerk-pub-key = var.clerk_publishable_key
      clerk-secret  = var.clerk_secret_key
      supabase-url  = var.supabase_url
      supabase-key  = var.supabase_service_role_key
    },
    var.stripe_secret_key != "" ? { stripe-secret = var.stripe_secret_key } : {}
  )

  secret_environment_variables = merge(
    {
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "clerk-pub-key"
      CLERK_SECRET_KEY                  = "clerk-secret"
      SUPABASE_URL                      = "supabase-url"
      SUPABASE_SERVICE_ROLE_KEY         = "supabase-key"
    },
    var.stripe_secret_key != "" ? { STRIPE_SECRET_KEY = "stripe-secret" } : {}
  )

  health_check_path = "/api/health"
  tags              = local.common_tags

  depends_on = [module.backend]
}
