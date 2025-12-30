# =============================================================================
# Production Environment Configuration
# =============================================================================

environment        = "prod"
shared_environment = "prod" # Production uses its own dedicated PostgreSQL server
location           = "eastus2"
project_name       = "flowpost"

# =============================================================================
# PostgreSQL Configuration (Dedicated Production Resource)
# =============================================================================
# Production has its own dedicated PostgreSQL server with HA and geo-redundancy
# This enables production-specific features for reliability

enable_postgresql              = true
enable_key_vault               = true
postgres_sku_name              = "GP_Standard_D2s_v3" # General Purpose for production
postgres_storage_mb            = 65536                # 64GB for production workloads
postgres_backup_retention_days = 35                   # Extended retention for compliance
postgres_geo_redundant_backup  = true                 # Geo-redundant backups for DR
postgres_high_availability     = true                 # Zone-redundant HA for uptime

# =============================================================================
# Backend Configuration (production-grade)
# =============================================================================

backend_cpu          = 1.0
backend_memory       = "2Gi"
backend_min_replicas = 2 # Always running for HA
backend_max_replicas = 10

# =============================================================================
# Frontend Configuration (production-grade)
# =============================================================================

frontend_cpu          = 0.5
frontend_memory       = "1Gi"
frontend_min_replicas = 2 # Always running for HA
frontend_max_replicas = 20

# =============================================================================
# Tags for Governance and CI/CD
# =============================================================================
# Production uses TLS deployment with production-specific features

tags = {
  CostCenter       = "production"
  Lifecycle        = "production"
  Criticality      = "high"
  AutoDeploy       = "false" # Production requires manual deployment
  ManualDeploy     = "true"
  TLSProduction    = "true" # Enables production-specific TLS features
  DisasterRecovery = "enabled"
}
