/**
 * =============================================================================
 * BACKEND CONFIGURATION
 * =============================================================================
 * Centralized configuration for the LangGraph backend agents and services.
 * All magic numbers and settings should be defined here.
 */

// =============================================================================
// AI MODEL CONFIGURATION
// =============================================================================

export const AI_CONFIG = {
  // Temperature settings for different use cases
  temperature: {
    deterministic: 0, // Routing, validation, structured outputs
    low: 0.2, // Search, factual queries
    balanced: 0.5, // Default for general use
    creative: 0.7, // Content generation
    high: 0.8, // Highly creative outputs
  },

  // Token limits for different operations
  maxTokens: {
    short: 500, // Quick responses
    medium: 1024, // Standard responses
    long: 2048, // Complex JSON, multi-item responses
    extended: 4096, // Long-form content
    report: 8192, // Full reports
  },

  // Default models (overridden by env vars)
  defaults: {
    llmModel: "gpt-4o",
    reportModel: "gpt-4o-mini",
    provider: "openai",
  },

  // Model-specific settings
  gemini: {
    defaultModel: "gemini-2.5-flash",
    imageModel: "gemini-2.5-flash-image",
  },

  openai: {
    defaultModel: "gpt-4o",
    miniModel: "gpt-4o-mini",
  },
} as const;

// =============================================================================
// AGENT CONFIGURATION
// =============================================================================

export const AGENT_CONFIG = {
  // Supervisor agent settings
  supervisor: {
    maxReportsPerGroup: 5,
    maxParallelAgents: 3,
  },

  // Content generation settings
  contentGeneration: {
    maxRetries: 3,
    retryDelayMs: 1000,
  },

  // Post generation
  post: {
    maxLength: {
      twitter: 280,
      linkedin: 3000,
      instagram: 2200,
    },
    hashtagLimits: {
      min: 3,
      max: 10,
      recommended: 5,
    },
  },

  // Thread generation
  thread: {
    minPosts: 3,
    maxPosts: 10,
    targetPostLength: 250,
  },

  // Image finding/validation
  images: {
    minRatio: 0.8, // 4:5 portrait (Instagram)
    maxRatio: 1.91, // 1.91:1 landscape
    optimalWidth: 1080,
    maxImages: 10,
  },

  // Data curation
  curation: {
    maxTweetsPerBatch: 50,
    maxRedditPostsPerBatch: 20,
  },
} as const;

// =============================================================================
// API & SERVICE CONFIGURATION
// =============================================================================

export const API_CONFIG = {
  // Timeouts (in milliseconds)
  timeouts: {
    default: 30000,
    llm: 60000,
    imageGeneration: 120000,
    webScrape: 45000,
    screenshot: 30000,
  },

  // Retry configuration
  retries: {
    maxAttempts: 3,
    initialBackoffMs: 1000,
    maxBackoffMs: 10000,
    backoffMultiplier: 2,
  },

  // Rate limiting
  rateLimits: {
    twitter: {
      requestsPerMinute: 15,
      requestsPerDay: 500,
    },
    reddit: {
      requestsPerMinute: 30,
    },
    linkedin: {
      requestsPerMinute: 10,
    },
  },
} as const;

// =============================================================================
// FIRECRAWL / WEB SCRAPING CONFIGURATION
// =============================================================================

export const SCRAPING_CONFIG = {
  // Firecrawl settings
  firecrawl: {
    maxRetries: 3,
    waitForSelector: 5000,
    maxContentLength: 50000,
  },

  // Content extraction
  extraction: {
    minContentLength: 100,
    maxContentLength: 100000,
    summaryLength: 500,
  },
} as const;

// =============================================================================
// IMAGE GENERATION CONFIGURATION
// =============================================================================

export const IMAGE_CONFIG = {
  // DALL-E settings
  dalle: {
    model: "dall-e-3",
    sizes: {
      square: "1024x1024",
      portrait: "1024x1792",
      landscape: "1792x1024",
    },
    quality: "standard", // "standard" or "hd"
    style: "natural", // "vivid" or "natural"
  },

  // Gemini image settings
  gemini: {
    aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    defaultAspectRatio: "1:1",
  },
} as const;

// =============================================================================
// SCHEDULING CONFIGURATION
// =============================================================================

export const SCHEDULE_CONFIG = {
  // Optimal posting times (in UTC hours)
  optimalTimes: {
    weekday: [9, 12, 17, 20], // 9am, 12pm, 5pm, 8pm
    weekend: [10, 14, 18], // 10am, 2pm, 6pm
  },

  // Scheduling constraints
  constraints: {
    minPostIntervalHours: 2,
    maxPostsPerDay: 5,
    advanceScheduleDays: 7,
  },
} as const;

// =============================================================================
// FEATURE FLAGS
// =============================================================================

export const FEATURE_FLAGS = {
  useGoogleSearchGrounding: process.env.USE_GOOGLE_SEARCH_GROUNDING === "true",
  useArcadeAuth: process.env.USE_ARCADE_AUTH === "true",
  skipUsedUrlsCheck: process.env.SKIP_USED_URLS_CHECK === "true",
  enableLangSmithTracing: process.env.LANGSMITH_TRACING_V2 === "true",
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
 * Get timeout for a specific operation
 */
export function getTimeout(
  operation: keyof typeof API_CONFIG.timeouts,
): number {
  return API_CONFIG.timeouts[operation];
}

/**
 * Get the LLM model name from env or default
 */
export function getLLMModel(): string {
  return process.env.LLM_MODEL || AI_CONFIG.defaults.llmModel;
}

/**
 * Get the default temperature from env or config
 */
export function getDefaultTemperature(): number {
  return parseFloat(
    process.env.LLM_TEMPERATURE || String(AI_CONFIG.temperature.balanced),
  );
}

/**
 * Check if using Gemini provider
 */
export function isGeminiProvider(): boolean {
  return process.env.AI_PROVIDER === "gemini";
}
