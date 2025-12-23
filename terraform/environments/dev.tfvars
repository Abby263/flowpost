# Development Environment Configuration

environment  = "dev"
location     = "eastus"
project_name = "flowpost"

# Backend Configuration (smaller for dev)
backend_cpu          = 0.5
backend_memory       = "1Gi"
backend_min_replicas = 0 # Scale to zero when not in use
backend_max_replicas = 2

# Frontend Configuration (smaller for dev)
frontend_cpu          = 0.25
frontend_memory       = "0.5Gi"
frontend_min_replicas = 0 # Scale to zero when not in use
frontend_max_replicas = 2

tags = {
  CostCenter = "development"
}
