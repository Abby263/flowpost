# =============================================================================
# Development Environment Configuration
# =============================================================================

environment        = "dev"
shared_environment = "dev"
location           = "eastus"  # Match existing infrastructure location
project_name       = "flowpost"

# =============================================================================
# PostgreSQL Configuration (Shared Resource)
# =============================================================================
# Shared PostgreSQL server for LangGraph API state management
# Each environment creates its own database on the shared server

enable_postgresql              = true
enable_key_vault               = true
postgres_sku_name              = "B_Standard_B1ms" # Burstable for dev (cost-effective)
postgres_storage_mb            = 32768             # 32GB
postgres_backup_retention_days = 7
postgres_geo_redundant_backup  = false
postgres_high_availability     = false

# =============================================================================
# Backend Configuration (smaller for dev)
# =============================================================================

backend_cpu          = 0.5
backend_memory       = "1Gi"
backend_min_replicas = 0 # Scale to zero when not in use
backend_max_replicas = 2

# =============================================================================
# Frontend Configuration (smaller for dev)
# =============================================================================

frontend_cpu          = 0.25
frontend_memory       = "0.5Gi"
frontend_min_replicas = 0 # Scale to zero when not in use
frontend_max_replicas = 2

# =============================================================================
# Tags for Governance and CI/CD
# =============================================================================

tags = {
  CostCenter  = "development"
  Lifecycle   = "development"
  Criticality = "low"
  AutoDeploy  = "true"
}
