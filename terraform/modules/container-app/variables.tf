# =============================================================================
# Container App Configuration
# =============================================================================

variable "name" {
  description = "Name of the container app"
  type        = string
}

variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
}

variable "location" {
  description = "Azure region"
  type        = string
}

variable "container_environment_id" {
  description = "ID of the container app environment"
  type        = string
}

variable "container_registry_server" {
  description = "Container registry login server"
  type        = string
}

variable "container_registry_username" {
  description = "Container registry username"
  type        = string
}

variable "container_registry_password" {
  description = "Container registry password"
  type        = string
  sensitive   = true
}

variable "image_name" {
  description = "Docker image name"
  type        = string
}

variable "image_tag" {
  description = "Docker image tag"
  type        = string
  default     = "latest"
}

variable "target_port" {
  description = "Port the container listens on"
  type        = number
}

variable "cpu" {
  description = "CPU cores"
  type        = number
  default     = 0.5
}

variable "memory" {
  description = "Memory in Gi"
  type        = string
  default     = "1Gi"
}

variable "min_replicas" {
  description = "Minimum number of replicas"
  type        = number
  default     = 1
}

variable "max_replicas" {
  description = "Maximum number of replicas"
  type        = number
  default     = 10
}

variable "revision_suffix" {
  description = "Suffix for the revision name (used for blue/green deployments)"
  type        = string
  default     = null
}

variable "scale_concurrent_requests" {
  description = "Concurrent requests threshold for scaling"
  type        = string
  default     = "50"
}

variable "enable_resource_limits" {
  description = "Enable explicit resource limits"
  type        = bool
  default     = false
}

# =============================================================================
# Key Vault Configuration
# =============================================================================

variable "key_vault_id" {
  description = "ID of the Azure Key Vault for secret references"
  type        = string
  default     = null
}

variable "key_vault_uri" {
  description = "URI of the Azure Key Vault (e.g., https://myvault.vault.azure.net/)"
  type        = string
  default     = null
}

# =============================================================================
# Environment Variables
# =============================================================================

variable "environment_variables" {
  description = "Environment variables"
  type        = map(string)
  default     = {}
}

variable "secrets" {
  description = "Secret values"
  type        = map(string)
  default     = {}
  sensitive   = true
}

variable "secret_environment_variables" {
  description = "Environment variables that reference secrets"
  type        = map(string)
  default     = {}
}

# =============================================================================
# Health Probe Configuration
# =============================================================================
# Health probes are automated checks that Kubernetes/Container Apps use
# to determine if an application is healthy and ready to serve traffic.

# -----------------------------------------------------------------------------
# Startup Probe
# -----------------------------------------------------------------------------
# Checks if the application has started successfully.
# - Runs only during container startup
# - Disables liveness/readiness until it succeeds
# - Use longer intervals for slow-starting apps

variable "startup_probe_path" {
  description = "HTTP path for startup probe (e.g., /health/startup)"
  type        = string
  default     = "/health/startup"
}

variable "startup_probe_initial_delay" {
  description = "Initial delay before first startup probe (seconds)"
  type        = number
  default     = 10
}

variable "startup_probe_interval" {
  description = "Interval between startup probes (seconds)"
  type        = number
  default     = 10
}

variable "startup_probe_timeout" {
  description = "Timeout for startup probe response (seconds)"
  type        = number
  default     = 5
}

variable "startup_probe_failure_threshold" {
  description = "Number of failures before marking startup as failed"
  type        = number
  default     = 30 # 30 * 10s = 5 minutes max startup time
}

# -----------------------------------------------------------------------------
# Liveness Probe
# -----------------------------------------------------------------------------
# Checks if the application is in a healthy state.
# - If fails: Container is RESTARTED
# - Should check core app health, NOT external dependencies

variable "liveness_probe_path" {
  description = "HTTP path for liveness probe (e.g., /health/live)"
  type        = string
  default     = "/health/live"
}

variable "liveness_probe_initial_delay" {
  description = "Initial delay after startup before first liveness probe (seconds)"
  type        = number
  default     = 0
}

variable "liveness_probe_interval" {
  description = "Interval between liveness probes (seconds)"
  type        = number
  default     = 30
}

variable "liveness_probe_timeout" {
  description = "Timeout for liveness probe response (seconds)"
  type        = number
  default     = 5
}

variable "liveness_probe_failure_threshold" {
  description = "Number of failures before restarting container"
  type        = number
  default     = 3
}

# -----------------------------------------------------------------------------
# Readiness Probe
# -----------------------------------------------------------------------------
# Checks if the application can accept traffic.
# - If fails: Container removed from load balancer (NO traffic)
# - Container is NOT restarted
# - Should check if app can serve requests (including dependencies)

variable "readiness_probe_path" {
  description = "HTTP path for readiness probe (e.g., /health/ready)"
  type        = string
  default     = "/health/ready"
}

variable "readiness_probe_interval" {
  description = "Interval between readiness probes (seconds)"
  type        = number
  default     = 10
}

variable "readiness_probe_timeout" {
  description = "Timeout for readiness probe response (seconds)"
  type        = number
  default     = 5
}

variable "readiness_probe_success_threshold" {
  description = "Number of consecutive successes required to be ready"
  type        = number
  default     = 1
}

variable "readiness_probe_failure_threshold" {
  description = "Number of failures before removing from load balancer"
  type        = number
  default     = 3
}

# =============================================================================
# Legacy Health Check (deprecated - use specific probes)
# =============================================================================

variable "health_check_path" {
  description = "DEPRECATED: Use startup_probe_path, liveness_probe_path, readiness_probe_path"
  type        = string
  default     = "/health"
}

# =============================================================================
# Tags
# =============================================================================

variable "tags" {
  description = "Tags to apply"
  type        = map(string)
  default     = {}
}
