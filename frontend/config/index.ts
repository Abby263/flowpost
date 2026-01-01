/**
 * =============================================================================
 * FRONTEND CONFIGURATION
 * =============================================================================
 * Centralized configuration for the Next.js frontend application.
 * All magic numbers and settings should be defined here.
 */

// =============================================================================
// AI MODEL CONFIGURATION
// =============================================================================

export const AI_CONFIG = {
  // Default temperature settings for different use cases
  temperature: {
    deterministic: 0, // For structured outputs, routing, validation
    balanced: 0.5, // Default for general use
    creative: 0.8, // For content generation, ideas
    search: 0.2, // For search query generation
    smart_queries: 0.7, // For generating smart search queries
  },

  // Token limits for different operations
  maxTokens: {
    short: 500, // Short responses, summaries
    medium: 1000, // Standard responses
    long: 2048, // Complex JSON, multiple items
    extended: 4096, // Long-form content
  },

  // Default model fallbacks (overridden by env vars)
  defaults: {
    model: "gpt-4o-mini",
    provider: "openai",
  },
} as const;

// =============================================================================
// CREDITS CONFIGURATION
// =============================================================================

export const CREDITS_CONFIG = {
  // Credits required per operation
  perOperation: {
    contentIdeas: 1, // Generate content ideas
    workflowRun: 1, // Run a workflow
    imageGeneration: 1, // Generate an image
  },

  // Free tier defaults
  freeTier: {
    monthlyCredits: 10,
    bonusCredits: 0,
  },
} as const;

// =============================================================================
// SEARCH & CONTENT CONFIGURATION
// =============================================================================

export const SEARCH_CONFIG = {
  // Content discovery limits
  maxSearchQueries: 2, // Maximum parallel search queries
  resultsPerQuery: 5, // Results returned per search query
  maxTrendingResults: 5, // Maximum trending items to show

  // Time filters
  recentDays: 7, // Only fetch content from last N days

  // Provider priority order
  providerPriority: ["serper", "tavily", "perplexity"] as const,
} as const;

// =============================================================================
// API CONFIGURATION
// =============================================================================

export const API_CONFIG = {
  // Timeouts (in milliseconds)
  timeouts: {
    default: 30000, // 30 seconds
    search: 15000, // 15 seconds for search APIs
    llm: 60000, // 60 seconds for LLM calls
    imageGeneration: 120000, // 2 minutes for image generation
  },

  // Retry configuration
  retries: {
    maxAttempts: 3,
    backoffMs: 1000, // Initial backoff
    maxBackoffMs: 10000, // Max backoff
  },

  // Rate limiting
  rateLimits: {
    requestsPerMinute: 60,
    burstLimit: 10,
  },
} as const;

// =============================================================================
// CONTENT GENERATION CONFIGURATION
// =============================================================================

export const CONTENT_CONFIG = {
  // Post generation
  post: {
    maxCaptionLength: 280, // Twitter limit
    maxHashtags: 5,
    minHashtags: 3,
    idealCaptionLength: { min: 100, max: 200 },
  },

  // Ideas generation
  ideas: {
    count: 3, // Number of ideas to generate
    styles: ["Inspirational", "Educational", "Casual", "Professional"] as const,
  },

  // Image settings
  image: {
    defaultWidth: 400,
    defaultHeight: 300,
    placeholderBaseUrl: "https://picsum.photos/seed",
  },
} as const;

// =============================================================================
// FEATURE FLAGS
// =============================================================================

export const FEATURE_FLAGS = {
  // Enabled by environment variable
  useGoogleSearchGrounding: process.env.USE_GOOGLE_SEARCH_GROUNDING === "true",

  // Development features
  enableDebugLogs: process.env.NODE_ENV === "development",
  logSlowQueries: process.env.NODE_ENV === "development",
  slowQueryThresholdMs: 3000,
} as const;

// =============================================================================
// DATABASE CONFIGURATION
// =============================================================================

export const DB_CONFIG = {
  pool: {
    maxConnections: 20,
    idleTimeoutMs: 30000,
    connectionTimeoutMs: 10000,
  },
} as const;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get AI temperature based on use case
 */
export function getTemperature(
  useCase: keyof typeof AI_CONFIG.temperature,
): number {
  return AI_CONFIG.temperature[useCase];
}

/**
 * Get max tokens based on response type
 */
export function getMaxTokens(
  responseType: keyof typeof AI_CONFIG.maxTokens,
): number {
  return AI_CONFIG.maxTokens[responseType];
}

/**
 * Get credits required for an operation
 */
export function getCreditsRequired(
  operation: keyof typeof CREDITS_CONFIG.perOperation,
): number {
  return CREDITS_CONFIG.perOperation[operation];
}
