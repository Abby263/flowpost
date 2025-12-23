import { z } from "zod";

/**
 * Environment variable validation schema for backend
 * Validates all required environment variables at startup
 */
const envSchema = z.object({
  // Required API Keys
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),

  // Database
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),

  // Optional API Keys
  LANGCHAIN_API_KEY: z.string().optional(),
  SERPER_API_KEY: z.string().optional(),
  FIRECRAWL_API_KEY: z.string().optional(),

  // Social Media (optional - used for specific features)
  TWITTER_API_KEY: z.string().optional(),
  TWITTER_API_SECRET: z.string().optional(),
  TWITTER_ACCESS_TOKEN: z.string().optional(),
  TWITTER_ACCESS_TOKEN_SECRET: z.string().optional(),

  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),

  INSTAGRAM_USERNAME: z.string().optional(),
  INSTAGRAM_PASSWORD: z.string().optional(),

  // Slack (optional)
  SLACK_BOT_TOKEN: z.string().optional(),
  SLACK_SIGNING_SECRET: z.string().optional(),

  // Server configuration
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.string().default("54367"),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates environment variables and returns typed env object
 * Throws detailed error if validation fails
 */
export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues
      .map((err) => `  - ${String(err.path.join("."))}: ${err.message}`)
      .join("\n");

    throw new Error(
      `Environment validation failed:\n${errors}\n\nPlease check your .env file.`,
    );
  }

  return result.data;
}

/**
 * Validates environment variables without throwing
 * Returns validation result with success flag
 */
export function validateEnvSafe(): {
  success: boolean;
  data?: Env;
  errors?: string[];
} {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    return {
      success: false,
      errors: result.error.issues.map(
        (err) => `${String(err.path.join("."))}: ${err.message}`,
      ),
    };
  }

  return {
    success: true,
    data: result.data,
  };
}

/**
 * Check if running in production environment
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Check if running in development environment
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development";
}

/**
 * Check if running in test environment
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === "test";
}

/**
 * Get required environment variable or throw
 */
export function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Get optional environment variable with default
 */
export function getOptionalEnv(key: string, defaultValue = ""): string {
  return process.env[key] || defaultValue;
}
