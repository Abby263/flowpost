output "id" {
  description = "Container app ID"
  value       = azurerm_container_app.this.id
}

output "name" {
  description = "Container app name"
  value       = azurerm_container_app.this.name
}

output "fqdn" {
  description = "Fully qualified domain name"
  value       = azurerm_container_app.this.ingress[0].fqdn
}

output "latest_revision_name" {
  description = "Latest revision name"
  value       = azurerm_container_app.this.latest_revision_name
}
