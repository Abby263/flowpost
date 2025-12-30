# =============================================================================
# Resource Group Outputs
# =============================================================================

output "resource_group_name" {
  description = "Name of the resource group"
  value       = azurerm_resource_group.main.name
}

output "environment" {
  description = "Current environment"
  value       = var.environment
}

output "shared_environment" {
  description = "Shared environment for shared resources"
  value       = var.shared_environment
}

# =============================================================================
# Container Registry Outputs
# =============================================================================

output "container_registry_name" {
  description = "Name of the container registry"
  value       = module.container_registry.name
}

output "container_registry_login_server" {
  description = "Login server for the container registry"
  value       = module.container_registry.login_server
}

# =============================================================================
# Container App Outputs
# =============================================================================

output "backend_url" {
  description = "URL of the backend container app"
  value       = "https://${module.backend.fqdn}"
}

output "frontend_url" {
  description = "URL of the frontend container app"
  value       = "https://${module.frontend.fqdn}"
}

output "backend_name" {
  description = "Name of the backend container app"
  value       = module.backend.name
}

output "frontend_name" {
  description = "Name of the frontend container app"
  value       = module.frontend.name
}

# =============================================================================
# PostgreSQL Outputs
# =============================================================================

output "postgresql_server_name" {
  description = "Name of the PostgreSQL Flexible Server"
  value       = var.enable_postgresql ? module.postgresql[0].server_name : null
}

output "postgresql_server_fqdn" {
  description = "FQDN of the PostgreSQL Flexible Server"
  value       = var.enable_postgresql ? module.postgresql[0].server_fqdn : null
}

output "postgresql_database_name" {
  description = "Name of the PostgreSQL database"
  value       = var.enable_postgresql ? module.postgresql[0].database_name : null
}

output "postgresql_connection_info" {
  description = "PostgreSQL connection information (without password)"
  value = var.enable_postgresql ? {
    host     = module.postgresql[0].server_fqdn
    port     = 5432
    database = module.postgresql[0].database_name
    ssl_mode = "require"
  } : null
  sensitive = true
}

# =============================================================================
# Key Vault Outputs
# =============================================================================

output "key_vault_name" {
  description = "Name of the Key Vault"
  value       = var.enable_key_vault ? module.key_vault[0].key_vault_name : null
}

output "key_vault_uri" {
  description = "URI of the Key Vault"
  value       = var.enable_key_vault ? module.key_vault[0].key_vault_uri : null
}

output "key_vault_secret_names" {
  description = "Map of secret names stored in Key Vault"
  value       = var.enable_key_vault ? module.key_vault[0].secret_names : null
}
