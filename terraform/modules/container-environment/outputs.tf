output "id" {
  description = "Container environment ID"
  value       = azurerm_container_app_environment.this.id
}

output "name" {
  description = "Container environment name"
  value       = azurerm_container_app_environment.this.name
}

output "default_domain" {
  description = "Default domain of the container environment"
  value       = azurerm_container_app_environment.this.default_domain
}

output "log_analytics_workspace_id" {
  description = "Log Analytics workspace ID"
  value       = azurerm_log_analytics_workspace.this.id
}
