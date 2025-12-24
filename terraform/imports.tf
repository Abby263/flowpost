# Import existing Azure resources into Terraform state
# These resources exist in Azure but are not in Terraform state
# After successful import, comment these blocks back out

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

# Import existing Container App Environment (comment out if it doesn't exist yet)
# import {
#   to = module.container_environment.azurerm_container_app_environment.this
#   id = "/subscriptions/${var.subscription_id}/resourceGroups/${local.resource_prefix}-rg/providers/Microsoft.App/managedEnvironments/${local.resource_prefix}-env"
# }

