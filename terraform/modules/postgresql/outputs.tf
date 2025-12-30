output "server_id" {
  description = "ID of the PostgreSQL Flexible Server"
  value       = azurerm_postgresql_flexible_server.this.id
}

output "server_name" {
  description = "Name of the PostgreSQL Flexible Server"
  value       = azurerm_postgresql_flexible_server.this.name
}

output "server_fqdn" {
  description = "FQDN of the PostgreSQL Flexible Server"
  value       = azurerm_postgresql_flexible_server.this.fqdn
}

output "database_name" {
  description = "Name of the database"
  value       = azurerm_postgresql_flexible_server_database.this.name
}

output "administrator_login" {
  description = "Administrator login"
  value       = azurerm_postgresql_flexible_server.this.administrator_login
  sensitive   = true
}

output "connection_string" {
  description = "PostgreSQL connection string (without password)"
  value       = "postgresql://${azurerm_postgresql_flexible_server.this.administrator_login}@${azurerm_postgresql_flexible_server.this.fqdn}:5432/${azurerm_postgresql_flexible_server_database.this.name}?sslmode=require"
  sensitive   = true
}

output "database_uri" {
  description = "Full database URI for LangGraph API"
  value       = "postgresql://${azurerm_postgresql_flexible_server.this.administrator_login}:${var.administrator_password}@${azurerm_postgresql_flexible_server.this.fqdn}:5432/${azurerm_postgresql_flexible_server_database.this.name}?sslmode=require"
  sensitive   = true
}

output "host" {
  description = "PostgreSQL server hostname"
  value       = azurerm_postgresql_flexible_server.this.fqdn
}

output "port" {
  description = "PostgreSQL server port"
  value       = 5432
}

