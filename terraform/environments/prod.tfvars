# Production Environment Configuration

environment  = "prod"
location     = "eastus"
project_name = "flowpost"

# Backend Configuration (production-grade)
backend_cpu          = 1.0
backend_memory       = "2Gi"
backend_min_replicas = 2 # Always running for HA
backend_max_replicas = 10

# Frontend Configuration (production-grade)
frontend_cpu          = 0.5
frontend_memory       = "1Gi"
frontend_min_replicas = 2 # Always running for HA
frontend_max_replicas = 20

tags = {
  CostCenter  = "production"
  Criticality = "high"
}
