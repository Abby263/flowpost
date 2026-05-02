/**
 * Gemini AI Integration Utilities
 * Provides support for:
 * - Text generation with Gemini models
 * - Native image generation with Gemini 2.5 Flash Image and Gemini 3 Pro Image
 * - Google Search grounding for real-time information
 *
 * Compatible with both:
 * - gemini-2.5-flash-image (fast, up to 1024px)
 * - gemini-3-pro-image-preview (professional, up to 4K, with thinking process)
 */

import { GoogleGenAI } from "@google/genai";

/**
 * Retry configuration for API calls
 */
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

/**
 * Check if an error is retryable (network errors, rate limits, server errors)
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Network errors
    if (
      message.includes("fetch failed") ||
      message.includes("network") ||
      message.includes("timeout") ||
      message.includes("econnreset") ||
      message.includes("econnrefused") ||
      message.includes("socket hang up")
    ) {
      return true;
    }
    // Rate limiting
    if (message.includes("429") || message.includes("rate limit")) {
      return true;
    }
    // Server errors (5xx)
    if (
      message.includes("500") ||
      message.includes("502") ||
      message.includes("503") ||
      message.includes("504")
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Execute a function with retry logic and exponential backoff
 */
async function withRetry<T>(fn: () => Promise<T>, context: string): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (!isRetryableError(error) || attempt === RETRY_CONFIG.maxRetries) {
        // Not retryable or exhausted retries
        console.error(
          `❌ [Gemini ${context}] Failed after ${attempt} attempt(s):`,
          lastError.message,
        );
        throw lastError;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        RETRY_CONFIG.initialDelayMs *
          Math.pow(RETRY_CONFIG.backoffMultiplier, attempt - 1),
        RETRY_CONFIG.maxDelayMs,
      );

      console.warn(
        `⚠️  [Gemini ${context}] Attempt ${attempt}/${RETRY_CONFIG.maxRetries} failed: ${lastError.message}. Retrying in ${delay}ms...`,
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError || new Error("Unknown error in retry logic");
}

// Check if Gemini is configured
export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

// Check if the current LLM model is a Gemini model
export function isGeminiModel(model?: string): boolean {
  const modelName = model || process.env.LLM_MODEL || "";
  return modelName.toLowerCase().includes("gemini");
}

// Check if the current image model is a Gemini model
export function isGeminiImageModel(model?: string): boolean {
  const modelName = model || process.env.IMAGE_MODEL || "";
  return modelName.toLowerCase().includes("gemini");
}

// Get Gemini client instance
export function getGeminiClient(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

/**
 * Generate text content using Gemini models
 */
export async function generateTextWithGemini(
  prompt: string,
  systemPrompt?: string,
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  },
): Promise<string> {
  return withRetry(async () => {
    const client = getGeminiClient();
    const model =
      options?.model || process.env.LLM_MODEL || "gemini-2.0-flash-exp";

    const messages = [];
    if (systemPrompt) {
      messages.push({ role: "system" as const, content: systemPrompt });
    }
    messages.push({ role: "user" as const, content: prompt });

    const response = await client.models.generateContent({
      model,
      contents: messages.map((msg) => ({
        role: msg.role === "system" ? "user" : msg.role,
        parts: [{ text: msg.content }],
      })),
      config: {
        temperature:
          options?.temperature ??
          parseFloat(process.env.LLM_TEMPERATURE || "0.5"),
        maxOutputTokens: options?.maxTokens,
      },
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return text;
  }, "generateText");
}

/**
 * Generate text content with Google Search grounding
 * Perfect for real-time information like news, trends, weather, etc.
 *
 * This uses Google Search tool to get real-time information.
 * Example: "What are the latest trends in AI?" or "Current weather in San Francisco"
 *
 * @param prompt - The question or request requiring real-time information
 * @param systemPrompt - Optional system instructions
 * @param options - Configuration options
 * @returns Object with generated text and grounding metadata
 */
export async function generateTextWithGrounding(
  prompt: string,
  systemPrompt?: string,
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    dynamicThreshold?: number;
  },
): Promise<{ text: string; groundingMetadata?: any }> {
  return withRetry(async () => {
    const client = getGeminiClient();
    const model =
      options?.model || process.env.LLM_MODEL || "gemini-2.0-flash-exp";

    const messages = [];
    if (systemPrompt) {
      messages.push({ role: "system" as const, content: systemPrompt });
    }
    messages.push({ role: "user" as const, content: prompt });

    // Build config with Google Search tool
    const config: any = {
      temperature:
        options?.temperature ??
        parseFloat(process.env.LLM_TEMPERATURE || "0.7"),
      maxOutputTokens: options?.maxTokens,
      tools: [{ googleSearch: {} }],
    };

    const response = await client.models.generateContent({
      model,
      contents: messages.map((msg) => ({
        role: msg.role === "system" ? "user" : msg.role,
        parts: [{ text: msg.content }],
      })),
      config,
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const groundingMetadata = (response as any).groundingMetadata;

    // Log grounding information if available
    if (groundingMetadata) {
      console.log(
        "✅ [Gemini Grounding] Real-time data used:",
        JSON.stringify(groundingMetadata, null, 2),
      );
    }

    return { text, groundingMetadata };
  }, "generateTextWithGrounding");
}

/**
 * Generate images using Gemini native image generation
 * Supports both gemini-2.5-flash-image and gemini-3-pro-image-preview
 *
 * @param prompt - Text description of the image to generate
 * @param options - Configuration options
 * @returns Array of generated images with URLs and base64 data
 */
export async function generateImageWithGemini(
  prompt: string,
  options?: {
    model?: string;
    aspectRatio?: string;
    imageSize?: string; // '1K', '2K', '4K' for gemini-3-pro-image-preview
    numberOfImages?: number;
    safetySettings?: any;
  },
): Promise<{ imageUrl: string; imageData: string }[]> {
  return withRetry(async () => {
    const client = getGeminiClient();
    const model =
      options?.model || process.env.IMAGE_MODEL || "gemini-2.5-flash-image";

    // Build config object with proper typing
    const config: any = {
      responseModalities: ["IMAGE"],
    };

    // Add imageConfig if aspect ratio or size is specified
    if (options?.aspectRatio || options?.imageSize) {
      config.imageConfig = {
        ...(options.aspectRatio && { aspectRatio: options.aspectRatio }),
        ...(options.imageSize && { imageSize: options.imageSize }),
      };
    }

    const response = await client.models.generateContent({
      model,
      contents: prompt,
      config,
    });

    const images: { imageUrl: string; imageData: string }[] = [];

    // Extract images from response parts
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const imageData = part.inlineData.data;
        // Convert base64 to data URL
        const mimeType = part.inlineData.mimeType || "image/png";
        const imageUrl = `data:${mimeType};base64,${imageData}`;
        images.push({ imageUrl, imageData: imageData as string });
      }
    }

    return images;
  }, "generateImage");
}

/**
 * Generate images with Google Search grounding for real-time visual information
 * Perfect for weather, stock charts, recent events, etc.
 *
 * This uses the Gemini 3 Pro Image Preview model with Google Search tool for real-time data.
 * Example: "Visualize the current weather forecast for the next 5 days in San Francisco"
 *
 * @param prompt - Text description including request for real-time information
 * @param options - Configuration options
 * @returns Array of generated images with URLs, base64 data, and grounding metadata
 */
export async function generateImageWithGrounding(
  prompt: string,
  options?: {
    model?: string;
    aspectRatio?: string;
    imageSize?: string; // '1K', '2K', '4K' for gemini-3-pro-image-preview
    numberOfImages?: number;
  },
): Promise<
  {
    imageUrl: string;
    imageData: string;
    groundingMetadata?: any;
  }[]
> {
  return withRetry(async () => {
    const client = getGeminiClient();

    // Use Gemini 3 Pro Image Preview for grounding (supports up to 4K)
    const model =
      options?.model || process.env.IMAGE_MODEL || "gemini-3-pro-image-preview";

    // Build config with Google Search tool for grounding
    const config: any = {
      responseModalities: ["Text", "Image"], // Include both text and image
    };

    // Add imageConfig if specified
    if (options?.aspectRatio || options?.imageSize) {
      config.imageConfig = {
        ...(options.aspectRatio && { aspectRatio: options.aspectRatio }),
        ...(options.imageSize && { imageSize: options.imageSize }),
      };
    }

    // Add Google Search tool for real-time grounding
    config.tools = [{ googleSearch: {} }];

    const response = await client.models.generateContent({
      model,
      contents: prompt,
      config,
    });

    const images: {
      imageUrl: string;
      imageData: string;
      groundingMetadata?: any;
    }[] = [];

    // Extract grounding metadata if available
    const groundingMetadata = (response as any).groundingMetadata;
    let textResponse = "";

    // Process response parts
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.text) {
        textResponse += part.text;
      } else if (part.inlineData) {
        const imageData = part.inlineData.data;
        const mimeType = part.inlineData.mimeType || "image/png";
        const imageUrl = `data:${mimeType};base64,${imageData}`;
        images.push({
          imageUrl,
          imageData: imageData as string,
          groundingMetadata,
        });
      }
    }

    // Log grounding information if available
    if (groundingMetadata) {
      console.log(
        "✅ [Gemini Grounding] Real-time data used:",
        JSON.stringify(groundingMetadata, null, 2),
      );
    }
    if (textResponse) {
      console.log("📝 [Gemini Response] Text:", textResponse);
    }

    return images;
  }, "generateImageWithGrounding");
}

/**
 * Upload base64 image data to a temporary storage and return a URL
 * This is useful because Gemini returns base64 data URLs which might be too large
 */
export async function uploadBase64ImageToStorage(
  base64Data: string,
  _options?: {
    filename?: string;
  },
): Promise<string> {
  // For now, return the data URL directly
  // In production, you might want to upload to Supabase Storage, S3, etc.
  if (base64Data.startsWith("data:")) {
    return base64Data;
  }
  return `data:image/png;base64,${base64Data}`;
}

/**
 * Get the appropriate Gemini model based on environment configuration
 */
export function getGeminiLLMModel(): string {
  return process.env.LLM_MODEL || "gemini-2.0-flash-exp";
}

export function getGeminiImageModel(): string {
  return process.env.IMAGE_MODEL || "gemini-2.5-flash-image";
}

/**
 * Aspect ratio mappings for Gemini image generation
 */
export const GEMINI_ASPECT_RATIOS = {
  "1024x1024": "1:1",
  "1024x1792": "9:16",
  "1792x1024": "16:9",
  "832x1248": "2:3",
  "1248x832": "3:2",
  "864x1184": "3:4",
  "1184x864": "4:3",
  "896x1152": "4:5",
  "1152x896": "5:4",
  "768x1344": "9:16",
  "1344x768": "16:9",
  "1536x672": "21:9",
};

/**
 * Get aspect ratio string for Gemini based on size configuration
 */
export function getGeminiAspectRatio(size?: string): string {
  const imageSize = size || process.env.IMAGE_SIZE || "1024x1024";
  return (
    GEMINI_ASPECT_RATIOS[imageSize as keyof typeof GEMINI_ASPECT_RATIOS] ||
    "1:1"
  );
}

/**
 * Unified LLM text generation that supports both OpenAI and Gemini
 * Automatically routes to the correct provider based on AI_PROVIDER or model name
 */
export async function generateText(
  prompt: string,
  options?: {
    systemPrompt?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    useGrounding?: boolean;
  },
): Promise<string> {
  const aiProvider = process.env.AI_PROVIDER || "openai";
  const model = options?.model || process.env.LLM_MODEL || "gpt-4o";
  const useGemini = aiProvider === "gemini" || isGeminiModel(model);

  if (useGemini && isGeminiConfigured()) {
    // Use Gemini
    if (
      options?.useGrounding &&
      process.env.USE_GOOGLE_SEARCH_GROUNDING === "true"
    ) {
      const result = await generateTextWithGrounding(
        prompt,
        options.systemPrompt,
        {
          model,
          temperature: options.temperature,
          maxTokens: options.maxTokens,
        },
      );
      return result.text;
    } else {
      return await generateTextWithGemini(prompt, options?.systemPrompt, {
        model,
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
      });
    }
  } else {
    // Use OpenAI - import dynamically to avoid circular dependencies
    const { ChatOpenAI } = await import("@langchain/openai");
    const { HumanMessage, SystemMessage } = await import(
      "@langchain/core/messages"
    );

    const llm = new ChatOpenAI({
      modelName: model,
      temperature:
        options?.temperature ??
        parseFloat(process.env.LLM_TEMPERATURE || "0.5"),
      maxTokens: options?.maxTokens,
      apiKey: process.env.OPENAI_API_KEY,
    });

    const messages = [];
    if (options?.systemPrompt) {
      messages.push(new SystemMessage(options.systemPrompt));
    }
    messages.push(new HumanMessage(prompt));

    const response = await llm.invoke(messages);
    return response.content.toString();
  }
}
