# UAT Environment Configuration

environment  = "uat"
location     = "eastus"
project_name = "flowpost"

# Backend Configuration (moderate for testing)
backend_cpu          = 0.5
backend_memory       = "1Gi"
backend_min_replicas = 1
backend_max_replicas = 3

# Frontend Configuration (moderate for testing)
frontend_cpu          = 0.5
frontend_memory       = "1Gi"
frontend_min_replicas = 1
frontend_max_replicas = 3

tags = {
  CostCenter = "testing"
}
