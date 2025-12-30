# =============================================================================
# Azure Container App with Blue/Green Deployment Strategy
# =============================================================================
# Deployment Strategy: Blue/Green
# - Multiple revisions maintained simultaneously
# - Traffic gradually shifted from old (blue) to new (green) revision
# - Instant rollback capability by shifting traffic back
#
# Health Probes:
# - Startup Probe: Checks if application has started successfully
# - Liveness Probe: Checks if application is running (restart if fails)
# - Readiness Probe: Checks if application can accept traffic

resource "azurerm_container_app" "this" {
  name                         = var.name
  resource_group_name          = var.resource_group_name
  container_app_environment_id = var.container_environment_id

  # Blue/Green Deployment: Multiple revision mode allows traffic splitting
  revision_mode = "Multiple"

  tags = var.tags

  registry {
    server               = var.container_registry_server
    username             = var.container_registry_username
    password_secret_name = "registry-password"
  }

  dynamic "secret" {
    for_each = nonsensitive(var.secrets)
    content {
      name  = secret.key
      value = var.secrets[secret.key]
    }
  }

  secret {
    name  = "registry-password"
    value = var.container_registry_password
  }

  ingress {
    external_enabled = true
    target_port      = var.target_port
    transport        = "http"

    # Blue/Green: Route 100% traffic to latest revision initially
    # During deployment, traffic is gradually shifted
    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }

  template {
    min_replicas    = var.min_replicas
    max_replicas    = var.max_replicas
    revision_suffix = var.revision_suffix

    container {
      name   = var.name
      image  = "${var.container_registry_server}/${var.image_name}:${var.image_tag}"
      cpu    = var.cpu
      memory = var.memory

      dynamic "env" {
        for_each = var.environment_variables
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = var.secret_environment_variables
        content {
          name        = env.key
          secret_name = env.value
        }
      }

      # =========================================================================
      # Startup Probe
      # =========================================================================
      # Purpose: Determine when the application has started successfully
      # - Runs only during container startup
      # - Disables liveness/readiness probes until startup succeeds
      # - Allows slow-starting applications time to initialize
      # - Prevents premature termination during initialization
      startup_probe {
        transport = "HTTP"
        path      = var.startup_probe_path
        port      = var.target_port

        # Time between probes (seconds)
        interval_seconds = var.startup_probe_interval

        # Max time to wait for response (seconds)
        timeout = var.startup_probe_timeout

        # Number of failures before marking unhealthy
        failure_count_threshold = var.startup_probe_failure_threshold
      }

      # =========================================================================
      # Liveness Probe
      # =========================================================================
      # Purpose: Detect if the application is in a broken state
      # - Runs continuously after startup succeeds
      # - If fails: Container is restarted
      # - Should check core application health
      # - Should NOT check external dependencies (use readiness for that)
      liveness_probe {
        transport = "HTTP"
        path      = var.liveness_probe_path
        port      = var.target_port

        # Time between probes (seconds)
        interval_seconds = var.liveness_probe_interval

        # Max time to wait for response (seconds)
        timeout = var.liveness_probe_timeout

        # Number of failures before restarting container
        failure_count_threshold = var.liveness_probe_failure_threshold
      }

      # =========================================================================
      # Readiness Probe
      # =========================================================================
      # Purpose: Determine if the application can accept traffic
      # - Runs continuously after startup succeeds
      # - If fails: Container removed from load balancer (no traffic)
      # - Container is NOT restarted
      # - Should check if app can serve requests (including dependencies)
      readiness_probe {
        transport = "HTTP"
        path      = var.readiness_probe_path
        port      = var.target_port

        # Time between probes (seconds)
        interval_seconds = var.readiness_probe_interval

        # Max time to wait for response (seconds)
        timeout = var.readiness_probe_timeout

        # Number of consecutive successes required
        success_count_threshold = var.readiness_probe_success_threshold

        # Number of failures before removing from load balancer
        failure_count_threshold = var.readiness_probe_failure_threshold
      }

    }

    # HTTP scaling rule
    http_scale_rule {
      name                = "http-scaling"
      concurrent_requests = var.scale_concurrent_requests
    }
  }

  lifecycle {
    # Ignore changes to traffic weights (managed by CI/CD)
    ignore_changes = [
      ingress[0].traffic_weight
    ]
  }
}
