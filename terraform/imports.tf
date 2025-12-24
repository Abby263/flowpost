# Import existing Azure resources into Terraform state
# These resources were created but the state was lost/reset
# After successful import, these blocks can be removed or commented out

# Import existing Resource Group
import {
  to = azurerm_resource_group.main
  id = "/subscriptions/${var.subscription_id}/resourceGroups/${local.resource_prefix}-rg"
}

# Import existing Container Registry
import {
  to = module.container_registry.azurerm_container_registry.this
  id = "/subscriptions/${var.subscription_id}/resourceGroups/${local.resource_prefix}-rg/providers/Microsoft.ContainerRegistry/registries/${replace("${local.resource_prefix}acr", "-", "")}"
}

# Import existing Log Analytics Workspace
import {
  to = module.container_environment.azurerm_log_analytics_workspace.this
  id = "/subscriptions/${var.subscription_id}/resourceGroups/${local.resource_prefix}-rg/providers/Microsoft.OperationalInsights/workspaces/${local.resource_prefix}-env-logs"
}

# Import existing Container App Environment (if it exists)
# Remove this block if it causes "resource not found" errors
import {
  to = module.container_environment.azurerm_container_app_environment.this
  id = "/subscriptions/${var.subscription_id}/resourceGroups/${local.resource_prefix}-rg/providers/Microsoft.App/managedEnvironments/${local.resource_prefix}-env"
}

