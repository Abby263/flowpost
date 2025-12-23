output "id" {
  description = "Container registry ID"
  value       = azurerm_container_registry.this.id
}

output "name" {
  description = "Container registry name"
  value       = azurerm_container_registry.this.name
}

output "login_server" {
  description = "Container registry login server"
  value       = azurerm_container_registry.this.login_server
}

output "admin_username" {
  description = "Container registry admin username"
  value       = azurerm_container_registry.this.admin_username
}

output "admin_password" {
  description = "Container registry admin password"
  value       = azurerm_container_registry.this.admin_password
  sensitive   = true
}
