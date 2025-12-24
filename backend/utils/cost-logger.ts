import { createClient } from "@supabase/supabase-js";

// Cost logging utility for tracking external service costs
// This helps track AI API costs, infrastructure costs, etc.

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!supabase && supabaseUrl && supabaseServiceRoleKey) {
    supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabase;
}

export type ServiceType =
  | "ai_model"
  | "image_generation"
  | "web_scraping"
  | "infrastructure"
  | "storage"
  | "other";

export interface CostLogEntry {
  service: string; // e.g., 'openai', 'anthropic', 'gemini', 'firecrawl'
  serviceType: ServiceType;
  amount: number; // Cost in USD
  userId?: string;
  workflowId?: string;
  tokensInput?: number;
  tokensOutput?: number;
  description?: string;
  metadata?: Record<string, any>;
}

// Cost rates for common services (per 1M tokens or per request)
export const COST_RATES = {
  // OpenAI GPT-4o
  "gpt-4o": {
    input: 2.5 / 1_000_000, // $2.50 per 1M input tokens
    output: 10 / 1_000_000, // $10 per 1M output tokens
  },
  // OpenAI GPT-4o-mini
  "gpt-4o-mini": {
    input: 0.15 / 1_000_000, // $0.15 per 1M input tokens
    output: 0.6 / 1_000_000, // $0.60 per 1M output tokens
  },
  // Anthropic Claude 3.5 Sonnet
  "claude-3-5-sonnet": {
    input: 3 / 1_000_000, // $3 per 1M input tokens
    output: 15 / 1_000_000, // $15 per 1M output tokens
  },
  // Google Gemini Pro
  "gemini-1.5-pro": {
    input: 1.25 / 1_000_000, // $1.25 per 1M input tokens
    output: 5 / 1_000_000, // $5 per 1M output tokens
  },
  // Google Gemini Flash
  "gemini-1.5-flash": {
    input: 0.075 / 1_000_000, // $0.075 per 1M input tokens
    output: 0.3 / 1_000_000, // $0.30 per 1M output tokens
  },
  // DALL-E 3
  "dall-e-3": {
    standard_1024: 0.04, // $0.04 per image (1024x1024)
    standard_1792: 0.08, // $0.08 per image (1792x1024)
    hd_1024: 0.08, // $0.08 per HD image
    hd_1792: 0.12, // $0.12 per HD image (1792x1024)
  },
  // Flux image generation
  flux: {
    per_image: 0.03, // Approximate cost per image
  },
  // Firecrawl
  firecrawl: {
    per_page: 0.002, // $0.002 per page scraped
  },
};

/**
 * Calculate cost for an LLM API call
 */
export function calculateLLMCost(
  model: string,
  tokensInput: number,
  tokensOutput: number,
): number {
  const modelKey = model.toLowerCase();

  // Find matching rate
  for (const [key, rates] of Object.entries(COST_RATES)) {
    if (modelKey.includes(key) && "input" in rates) {
      return (
        tokensInput * (rates as { input: number; output: number }).input +
        tokensOutput * (rates as { input: number; output: number }).output
      );
    }
  }

  // Default fallback for unknown models (assume GPT-4o-mini rates)
  return (
    tokensInput * COST_RATES["gpt-4o-mini"].input +
    tokensOutput * COST_RATES["gpt-4o-mini"].output
  );
}

/**
 * Log a cost entry to the database
 */
export async function logCost(entry: CostLogEntry): Promise<void> {
  const client = getSupabaseClient();
  if (!client) {
    console.warn("Supabase client not available, skipping cost logging");
    return;
  }

  try {
    const { error } = await client.from("cost_tracking").insert({
      service: entry.service,
      service_type: entry.serviceType,
      amount: entry.amount,
      user_id: entry.userId,
      workflow_id: entry.workflowId,
      tokens_input: entry.tokensInput,
      tokens_output: entry.tokensOutput,
      description: entry.description,
      metadata: entry.metadata || {},
    });

    if (error) {
      console.error("Failed to log cost:", error);
    }
  } catch (err) {
    console.error("Error logging cost:", err);
  }
}

/**
 * Log LLM API call cost
 */
export async function logLLMCost(params: {
  model: string;
  tokensInput: number;
  tokensOutput: number;
  userId?: string;
  workflowId?: string;
  description?: string;
}): Promise<void> {
  const cost = calculateLLMCost(
    params.model,
    params.tokensInput,
    params.tokensOutput,
  );

  // Determine the service name from model
  let service = "openai";
  if (params.model.includes("claude")) service = "anthropic";
  if (params.model.includes("gemini")) service = "google";

  await logCost({
    service,
    serviceType: "ai_model",
    amount: cost,
    userId: params.userId,
    workflowId: params.workflowId,
    tokensInput: params.tokensInput,
    tokensOutput: params.tokensOutput,
    description: params.description || `${params.model} API call`,
    metadata: { model: params.model },
  });
}

/**
 * Log image generation cost
 */
export async function logImageGenerationCost(params: {
  service: string; // 'dall-e-3', 'flux', etc.
  size?: string;
  quality?: string;
  userId?: string;
  workflowId?: string;
  description?: string;
}): Promise<void> {
  let cost = 0.04; // Default cost

  if (params.service === "dall-e-3") {
    const rates = COST_RATES["dall-e-3"];
    const key =
      `${params.quality || "standard"}_${params.size === "1792x1024" ? "1792" : "1024"}` as keyof typeof rates;
    cost = rates[key] || 0.04;
  } else if (params.service === "flux") {
    cost = COST_RATES.flux.per_image;
  }

  await logCost({
    service: params.service,
    serviceType: "image_generation",
    amount: cost,
    userId: params.userId,
    workflowId: params.workflowId,
    description: params.description || `Image generation (${params.service})`,
    metadata: { size: params.size, quality: params.quality },
  });
}

/**
 * Log web scraping cost
 */
export async function logScrapingCost(params: {
  service: string; // 'firecrawl', etc.
  pagesScraped: number;
  userId?: string;
  workflowId?: string;
  description?: string;
}): Promise<void> {
  const cost = params.pagesScraped * COST_RATES.firecrawl.per_page;

  await logCost({
    service: params.service,
    serviceType: "web_scraping",
    amount: cost,
    userId: params.userId,
    workflowId: params.workflowId,
    description:
      params.description || `Web scraping (${params.pagesScraped} pages)`,
    metadata: { pages_scraped: params.pagesScraped },
  });
}

/**
 * Batch log multiple costs at once
 */
export async function logCostsBatch(entries: CostLogEntry[]): Promise<void> {
  const client = getSupabaseClient();
  if (!client) {
    console.warn("Supabase client not available, skipping cost logging");
    return;
  }

  try {
    const records = entries.map((entry) => ({
      service: entry.service,
      service_type: entry.serviceType,
      amount: entry.amount,
      user_id: entry.userId,
      workflow_id: entry.workflowId,
      tokens_input: entry.tokensInput,
      tokens_output: entry.tokensOutput,
      description: entry.description,
      metadata: entry.metadata || {},
    }));

    const { error } = await client.from("cost_tracking").insert(records);

    if (error) {
      console.error("Failed to batch log costs:", error);
    }
  } catch (err) {
    console.error("Error batch logging costs:", err);
  }
}
