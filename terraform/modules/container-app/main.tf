resource "azurerm_container_app" "this" {
  name                         = var.name
  resource_group_name          = var.resource_group_name
  container_app_environment_id = var.container_environment_id
  revision_mode                = "Single"
  tags                         = var.tags

  registry {
    server               = var.container_registry_server
    username             = var.container_registry_username
    password_secret_name = "registry-password"
  }

  dynamic "secret" {
    for_each = var.secrets
    content {
      name  = secret.key
      value = secret.value
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

    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }

  template {
    min_replicas = var.min_replicas
    max_replicas = var.max_replicas

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

      liveness_probe {
        transport        = "HTTP"
        path             = var.health_check_path
        port             = var.target_port
        initial_delay    = 60
        interval_seconds = 30
        failure_count_threshold = 3
      }

      readiness_probe {
        transport        = "HTTP"
        path             = var.health_check_path
        port             = var.target_port
        initial_delay    = 30
        interval_seconds = 10
        failure_count_threshold = 3
      }

      startup_probe {
        transport        = "HTTP"
        path             = var.health_check_path
        port             = var.target_port
        initial_delay    = 10
        interval_seconds = 10
        failure_count_threshold = 30
      }
    }

    http_scale_rule {
      name                = "http-scaling"
      concurrent_requests = var.scale_concurrent_requests
    }
  }
}
