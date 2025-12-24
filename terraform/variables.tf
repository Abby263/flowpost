variable "environment" {
  description = "Environment name (dev, uat, prod)"
  type        = string

  validation {
    condition     = contains(["dev", "uat", "prod"], var.environment)
    error_message = "Environment must be one of: dev, uat, prod"
  }
}

variable "subscription_id" {
  description = "Azure subscription ID (used for resource imports)"
  type        = string
  default     = ""
}

variable "location" {
  description = "Azure region for resources"
  type        = string
  default     = "eastus"
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "flowpost"
}

# Container App Configuration
variable "backend_cpu" {
  description = "CPU cores for backend container"
  type        = number
  default     = 1.0
}

variable "backend_memory" {
  description = "Memory in Gi for backend container"
  type        = string
  default     = "2Gi"
}

variable "backend_min_replicas" {
  description = "Minimum replicas for backend"
  type        = number
  default     = 1
}

variable "backend_max_replicas" {
  description = "Maximum replicas for backend"
  type        = number
  default     = 5
}

variable "frontend_cpu" {
  description = "CPU cores for frontend container"
  type        = number
  default     = 0.5
}

variable "frontend_memory" {
  description = "Memory in Gi for frontend container"
  type        = string
  default     = "1Gi"
}

variable "frontend_min_replicas" {
  description = "Minimum replicas for frontend"
  type        = number
  default     = 1
}

variable "frontend_max_replicas" {
  description = "Maximum replicas for frontend"
  type        = number
  default     = 10
}

# Secrets - passed via environment variables or tfvars
variable "openai_api_key" {
  description = "OpenAI API key (optional if using Gemini)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "gemini_api_key" {
  description = "Gemini API key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "ai_provider" {
  description = "AI provider to use: openai or gemini"
  type        = string
  default     = "gemini"

  validation {
    condition     = contains(["openai", "gemini"], var.ai_provider)
    error_message = "AI provider must be one of: openai, gemini"
  }
}

variable "llm_model" {
  description = "LLM model to use (e.g., gpt-4o, gemini-2.5-flash)"
  type        = string
  default     = "gemini-2.5-flash"
}

variable "image_model" {
  description = "Image generation model (e.g., dall-e-3, gemini-2.5-flash-image)"
  type        = string
  default     = "gemini-2.5-flash-image"
}

variable "supabase_url" {
  description = "Supabase project URL"
  type        = string
  sensitive   = true
}

variable "supabase_service_role_key" {
  description = "Supabase service role key"
  type        = string
  sensitive   = true
}

variable "clerk_publishable_key" {
  description = "Clerk publishable key"
  type        = string
  sensitive   = true
}

variable "clerk_secret_key" {
  description = "Clerk secret key"
  type        = string
  sensitive   = true
}

variable "langchain_api_key" {
  description = "LangChain API key (optional)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "serper_api_key" {
  description = "Serper API key (optional)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "firecrawl_api_key" {
  description = "FireCrawl API key for web scraping (optional)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "stripe_secret_key" {
  description = "Stripe secret key for payment processing (optional)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "stripe_webhook_secret" {
  description = "Stripe webhook signing secret for verifying webhook events (optional)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "admin_user_ids" {
  description = "Comma-separated list of Clerk user IDs with admin access"
  type        = string
  sensitive   = true
  default     = ""
}

# Tags
variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
