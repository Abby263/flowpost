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
  }
): Promise<string> {
  const client = getGeminiClient();
  const model = options?.model || process.env.LLM_MODEL || "gemini-2.0-flash-exp";

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
      temperature: options?.temperature ?? parseFloat(process.env.LLM_TEMPERATURE || "0.5"),
      maxOutputTokens: options?.maxTokens,
    },
  });

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return text;
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
  }
): Promise<{ text: string; groundingMetadata?: any }> {
  const client = getGeminiClient();
  const model = options?.model || process.env.LLM_MODEL || "gemini-2.0-flash-exp";

  const messages = [];
  if (systemPrompt) {
    messages.push({ role: "system" as const, content: systemPrompt });
  }
  messages.push({ role: "user" as const, content: prompt });

  // Build config with Google Search tool
  const config: any = {
    temperature: options?.temperature ?? parseFloat(process.env.LLM_TEMPERATURE || "0.7"),
    maxOutputTokens: options?.maxTokens,
    tools: [{googleSearch: {}}],
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
    console.log("✅ [Gemini Grounding] Real-time data used:", JSON.stringify(groundingMetadata, null, 2));
  }

  return { text, groundingMetadata };
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
  }
): Promise<{ imageUrl: string; imageData: string }[]> {
  const client = getGeminiClient();
  
  // Get model name and validate it
  let model = options?.model || process.env.IMAGE_MODEL || "gemini-2.5-flash-image";
  
  // Validate model name - ensure it's a valid Gemini image model
  const validModels = [
    "gemini-2.5-flash-image",
    "gemini-2.5-flash-image-preview", 
    "gemini-3-pro-image-preview"
  ];
  
  if (!validModels.includes(model) && !model.includes("gemini") && !model.includes("image")) {
    console.warn(`⚠️  [Gemini] Invalid model name "${model}", defaulting to gemini-2.5-flash-image`);
    model = "gemini-2.5-flash-image";
  }

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
  }
): Promise<{
  imageUrl: string;
  imageData: string;
  groundingMetadata?: any;
}[]> {
  const client = getGeminiClient();
  
  // Use Gemini 3 Pro Image Preview for grounding (supports up to 4K)
  // Note: Only gemini-3-pro-image-preview supports Google Search grounding
  // If user has gemini-2.5-flash-image set, we must override it for grounding
  let model = options?.model || process.env.IMAGE_MODEL || "gemini-3-pro-image-preview";
  
  // Force gemini-3-pro-image-preview for grounding (required)
  if (!options?.model && model !== "gemini-3-pro-image-preview" && !model.includes("gemini-3-pro-image")) {
    console.log(`⚠️  [Gemini] Overriding IMAGE_MODEL (${model}) to gemini-3-pro-image-preview for Google Search grounding`);
    model = "gemini-3-pro-image-preview";
  }

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
  config.tools = [{googleSearch: {}}];

  // Log the model being used for debugging
  console.log(`🖼️  [Gemini Image Grounding] Using model: ${model}`);

  try {
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
          groundingMetadata 
        });
      }
    }

    // Log grounding information if available
    if (groundingMetadata) {
      console.log("✅ [Gemini Grounding] Real-time data used:", JSON.stringify(groundingMetadata, null, 2));
    }
    if (textResponse) {
      console.log("📝 [Gemini Response] Text:", textResponse);
    }

    return images;
  } catch (error: any) {
    console.error(`❌ [Gemini Image Grounding] Error with model "${model}":`, error.message);
    if (error.error?.message) {
      console.error("API Error:", error.error.message);
    }
    // Re-throw with more context
    throw new Error(`Gemini image generation with grounding failed (model: ${model}): ${error.message}`);
  }
}

/**
 * Upload base64 image data to a temporary storage and return a URL
 * This is useful because Gemini returns base64 data URLs which might be too large
 */
export async function uploadBase64ImageToStorage(
  base64Data: string,
  _options?: {
    filename?: string;
  }
): Promise<string> {
  // For now, return the data URL directly
  // In production, you might want to upload to S3, Supabase Storage, etc.
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
  return GEMINI_ASPECT_RATIOS[imageSize as keyof typeof GEMINI_ASPECT_RATIOS] || "1:1";
}

