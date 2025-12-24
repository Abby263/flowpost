resource "azurerm_log_analytics_workspace" "this" {
  name                = "${var.name}-logs"
  resource_group_name = var.resource_group_name
  location            = var.location
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = var.tags
}

# Wait for Log Analytics Workspace to be fully provisioned
# Azure has eventual consistency - the workspace may report as created but not be immediately available
resource "time_sleep" "wait_for_log_analytics" {
  depends_on      = [azurerm_log_analytics_workspace.this]
  create_duration = "30s"
}

resource "azurerm_container_app_environment" "this" {
  name                       = var.name
  resource_group_name        = var.resource_group_name
  location                   = var.location
  log_analytics_workspace_id = azurerm_log_analytics_workspace.this.id
  tags                       = var.tags

  depends_on = [time_sleep.wait_for_log_analytics]
}
