output "resource_group_name" {
  description = "Name of the resource group"
  value       = azurerm_resource_group.main.name
}

output "container_registry_name" {
  description = "Name of the container registry"
  value       = module.container_registry.name
}

output "container_registry_login_server" {
  description = "Login server for the container registry"
  value       = module.container_registry.login_server
}

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

output "environment" {
  description = "Current environment"
  value       = var.environment
}
