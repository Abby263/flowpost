# =============================================================================
# UAT (User Acceptance Testing) Environment Configuration
# =============================================================================

environment        = "uat"
shared_environment = "dev" # UAT uses dev's shared PostgreSQL server
location           = "centralus"
project_name       = "flowpost"

# =============================================================================
# PostgreSQL Configuration (Shared Resource)
# =============================================================================
# Shared PostgreSQL server for LangGraph API state management
# UAT creates its own database on the shared dev PostgreSQL server

enable_postgresql              = true
enable_key_vault               = true
postgres_sku_name              = "B_Standard_B1ms" # Burstable for UAT
postgres_storage_mb            = 32768             # 32GB
postgres_backup_retention_days = 14
postgres_geo_redundant_backup  = false
postgres_high_availability     = false

# =============================================================================
# Backend Configuration (moderate for testing)
# =============================================================================

backend_cpu          = 0.5
backend_memory       = "1Gi"
backend_min_replicas = 1
backend_max_replicas = 3

# =============================================================================
# Frontend Configuration (moderate for testing)
# =============================================================================

frontend_cpu          = 0.5
frontend_memory       = "1Gi"
frontend_min_replicas = 1
frontend_max_replicas = 3

# =============================================================================
# Tags for Governance and CI/CD
# =============================================================================

tags = {
  CostCenter   = "testing"
  Lifecycle    = "testing"
  Criticality  = "medium"
  AutoDeploy   = "false" # UAT requires manual deployment
  ManualDeploy = "true"
}
