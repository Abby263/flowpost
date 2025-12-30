variable "server_name" {
  description = "Name of the PostgreSQL Flexible Server"
  type        = string
}

variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
}

variable "location" {
  description = "Azure region for the PostgreSQL server"
  type        = string
}

variable "postgresql_version" {
  description = "PostgreSQL version"
  type        = string
  default     = "16"
}

variable "delegated_subnet_id" {
  description = "Subnet ID for private access (optional)"
  type        = string
  default     = null
}

variable "private_dns_zone_id" {
  description = "Private DNS zone ID for private access (optional)"
  type        = string
  default     = null
}

variable "administrator_login" {
  description = "Administrator login for the PostgreSQL server"
  type        = string
}

variable "administrator_password" {
  description = "Administrator password for the PostgreSQL server"
  type        = string
  sensitive   = true
}

variable "availability_zone" {
  description = "Availability zone for the primary server"
  type        = string
  default     = "1"
}

variable "storage_mb" {
  description = "Storage size in MB"
  type        = number
  default     = 32768 # 32GB
}

variable "storage_tier" {
  description = "Storage tier (P4, P6, P10, P15, P20, P30, P40, P50, P60, P70, P80)"
  type        = string
  default     = "P10"
}

variable "sku_name" {
  description = "SKU name for the PostgreSQL server"
  type        = string
  default     = "B_Standard_B1ms" # Burstable for dev/test
}

variable "backup_retention_days" {
  description = "Backup retention days"
  type        = number
  default     = 7
}

variable "geo_redundant_backup_enabled" {
  description = "Enable geo-redundant backups"
  type        = bool
  default     = false
}

variable "auto_grow_enabled" {
  description = "Enable auto-grow for storage"
  type        = bool
  default     = true
}

variable "public_network_access_enabled" {
  description = "Enable public network access"
  type        = bool
  default     = true
}

variable "active_directory_auth_enabled" {
  description = "Enable Azure Active Directory authentication"
  type        = bool
  default     = false
}

variable "high_availability_enabled" {
  description = "Enable high availability (zone redundant)"
  type        = bool
  default     = false
}

variable "standby_availability_zone" {
  description = "Availability zone for standby server"
  type        = string
  default     = "2"
}

variable "database_name" {
  description = "Name of the database to create"
  type        = string
}

variable "collation" {
  description = "Database collation"
  type        = string
  default     = "en_US.utf8"
}

variable "charset" {
  description = "Database character set"
  type        = string
  default     = "UTF8"
}

variable "allow_azure_services" {
  description = "Allow access from Azure services"
  type        = bool
  default     = true
}

variable "allowed_ip_ranges" {
  description = "Map of allowed IP ranges for firewall rules"
  type = map(object({
    start_ip = string
    end_ip   = string
  }))
  default = {}
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}

