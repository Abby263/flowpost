# Import existing Azure resources into Terraform state
# These resources were created but the state was lost/reset
# 
# IMPORTANT: Only uncomment these import blocks if you get errors about
# resources already existing. Comment them back out after successful import.
#
# To use: uncomment the relevant import block, run terraform plan/apply,
# then comment it back out after the resource is imported.

# # Import existing Resource Group (uncomment if resource already exists)
# import {
#   to = azurerm_resource_group.main
#   id = "/subscriptions/${var.subscription_id}/resourceGroups/${local.resource_prefix}-rg"
# }

# # Import existing Container Registry (uncomment if resource already exists)
# import {
#   to = module.container_registry.azurerm_container_registry.this
#   id = "/subscriptions/${var.subscription_id}/resourceGroups/${local.resource_prefix}-rg/providers/Microsoft.ContainerRegistry/registries/${replace("${local.resource_prefix}acr", "-", "")}"
# }

# # Import existing Log Analytics Workspace (uncomment if resource already exists)
# import {
#   to = module.container_environment.azurerm_log_analytics_workspace.this
#   id = "/subscriptions/${var.subscription_id}/resourceGroups/${local.resource_prefix}-rg/providers/Microsoft.OperationalInsights/workspaces/${local.resource_prefix}-env-logs"
# }

# # Import existing Container App Environment (uncomment if resource already exists)
# import {
#   to = module.container_environment.azurerm_container_app_environment.this
#   id = "/subscriptions/${var.subscription_id}/resourceGroups/${local.resource_prefix}-rg/providers/Microsoft.App/managedEnvironments/${local.resource_prefix}-env"
# }

