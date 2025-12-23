/**
 * Unified LLM Utilities
 * Clean separation between OpenAI and Gemini with automatic provider selection
 */

import { ChatOpenAI } from "@langchain/openai";
import {
  BaseMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import {
  isGeminiConfigured,
  isGeminiModel,
  generateTextWithGemini,
  generateTextWithGrounding,
} from "./gemini.js";

/**
 * Determine which AI provider to use
 */
export function getAIProvider(): "openai" | "gemini" {
  const aiProvider = process.env.AI_PROVIDER || "openai";
  const llmModel = process.env.LLM_MODEL || "";

  // Use Gemini if explicitly set or if model name contains "gemini"
  if (aiProvider === "gemini" || isGeminiModel(llmModel)) {
    if (!isGeminiConfigured()) {
      console.warn(
        "⚠️  Gemini selected but GEMINI_API_KEY not configured. Falling back to OpenAI.",
      );
      return "openai";
    }
    return "gemini";
  }

  return "openai";
}

/**
 * Configuration for LLM generation
 */
export interface LLMConfig {
  modelName?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  streaming?: boolean;
  useGrounding?: boolean;
}

/**
 * Get a ChatOpenAI instance (for direct LangChain usage)
 */
function getOpenAIModel(config: LLMConfig = {}): ChatOpenAI {
  return new ChatOpenAI({
    modelName:
      config.modelName || config.model || process.env.LLM_MODEL || "gpt-4o",
    temperature:
      config.temperature ?? parseFloat(process.env.LLM_TEMPERATURE || "0.5"),
    maxTokens: config.maxTokens,
    streaming: config.streaming ?? process.env.LLM_STREAMING === "true",
    apiKey: process.env.OPENAI_API_KEY,
  });
}

/**
 * Generate text using Gemini
 */
async function generateWithGemini(
  messages: BaseMessage[] | any[],
  config: LLMConfig = {},
): Promise<{ content: string; usage?: any }> {
  // Extract system and user messages
  let systemPrompt: string | undefined;
  let userPrompt = "";

  for (const message of messages) {
    const content =
      typeof message.content === "string"
        ? message.content
        : JSON.stringify(message.content);

    // Handle both BaseMessage objects and plain objects
    const messageType =
      typeof message._getType === "function"
        ? message._getType()
        : message.role;

    if (messageType === "system") {
      systemPrompt = content;
    } else if (messageType === "human" || messageType === "user") {
      userPrompt += content + "\n";
    } else if (messageType === "ai" || messageType === "assistant") {
      userPrompt += `Assistant: ${content}\n`;
    }
  }

  const model =
    config.modelName ||
    config.model ||
    process.env.LLM_MODEL ||
    "gemini-2.0-flash-exp";

  // Use Google Search grounding if enabled and requested
  if (
    config.useGrounding &&
    process.env.USE_GOOGLE_SEARCH_GROUNDING === "true"
  ) {
    const result = await generateTextWithGrounding(userPrompt, systemPrompt, {
      model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    });
    return { content: result.text };
  } else {
    const text = await generateTextWithGemini(userPrompt, systemPrompt, {
      model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    });
    return { content: text };
  }
}

/**
 * Gemini wrapper that implements LangChain-like interface
 */
class GeminiChatModel {
  private config: LLMConfig;

  constructor(config: LLMConfig = {}) {
    this.config = config;
  }

  /**
   * Invoke the model with messages (LangChain compatible)
   */
  async invoke(messages: BaseMessage[]): Promise<any> {
    const result = await generateWithGemini(messages, this.config);
    return {
      content: result.content,
      _getType: () => "ai",
    };
  }

  /**
   * Support for structured output with Zod schemas
   */
  withStructuredOutput(schema: any, _options?: { name?: string }): any {
    const config = this.config;

    return {
      async invoke(messages: BaseMessage[]): Promise<any> {
        // Extract schema shape if it's a Zod schema
        let schemaDescription = "";
        if (schema && schema._def) {
          try {
            // Get the shape from Zod schema
            const shape = schema._def.shape?.();
            if (shape) {
              const fields: string[] = [];
              for (const [key, value] of Object.entries(shape)) {
                const field = value as any;
                const typeName = field._def?.typeName || "unknown";
                const description = field._def?.description || "";

                let fieldType = "string";
                if (typeName === "ZodBoolean") fieldType = "boolean";
                else if (typeName === "ZodNumber") fieldType = "number";
                else if (typeName === "ZodArray") fieldType = "array";
                else if (typeName === "ZodObject") fieldType = "object";

                fields.push(
                  `"${key}": ${fieldType}${description ? ` (${description})` : ""}`,
                );
              }
              schemaDescription = `\n\nRequired JSON schema:\n{\n  ${fields.join(",\n  ")}\n}`;
            }
          } catch (e) {
            // Fallback if we can't extract schema
            schemaDescription =
              "\n\nProvide all required fields in the JSON response.";
          }
        }

        // Enhance the last message to request JSON output
        const enhancedMessages = [...messages];
        const lastMessage = enhancedMessages[enhancedMessages.length - 1];

        if (lastMessage) {
          const originalContent =
            typeof lastMessage.content === "string"
              ? lastMessage.content
              : JSON.stringify(lastMessage.content);

          enhancedMessages[enhancedMessages.length - 1] = new HumanMessage(
            originalContent +
              schemaDescription +
              "\n\nIMPORTANT: Respond with ONLY valid JSON matching the EXACT schema above. " +
              "Include ALL required fields. " +
              "Do not include markdown formatting, code blocks, or explanatory text. " +
              "Start your response with { and end with }.",
          );
        }

        const result = await generateWithGemini(enhancedMessages, config);
        const text = result.content;

        // Extract and parse JSON from response
        try {
          // Try to find JSON in various formats
          let jsonStr = text.trim();

          // Remove markdown code blocks if present
          const codeBlockMatch = jsonStr.match(
            /```(?:json)?\s*([\s\S]*?)\s*```/,
          );
          if (codeBlockMatch) {
            jsonStr = codeBlockMatch[1].trim();
          }

          // Try to parse as-is first
          let parsed: any;
          try {
            parsed = JSON.parse(jsonStr);
          } catch {
            // If direct parse fails, try to extract JSON object
            const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              jsonStr = jsonMatch[0];
              parsed = JSON.parse(jsonStr);
            } else {
              // Last resort: try to parse key-value pairs from plain text
              // More flexible patterns to handle various Gemini output formats
              const reasoningMatch = jsonStr.match(
                /(?:reasoning|Reasoning):\s*["']?([\s\S]+?)(?=\n(?:relevant|is_relevant|Is the content relevant)|$)/i,
              );
              const relevantMatch = jsonStr.match(
                /(?:relevant|is_relevant|Is the content relevant[^:]*?):\s*(true|false)/i,
              );

              if (reasoningMatch && relevantMatch) {
                const reasoning = reasoningMatch[1]
                  .trim()
                  .replace(/^["']|["']$/g, "")
                  .replace(/\n+$/, "")
                  .trim();

                parsed = {
                  reasoning: reasoning,
                  relevant: relevantMatch[1].toLowerCase() === "true",
                };
              } else {
                throw new Error(
                  "Could not extract structured data from response",
                );
              }
            }
          }

          // Handle Gemini's tendency to use 'is_relevant' instead of 'relevant'
          if (
            parsed.is_relevant !== undefined &&
            parsed.relevant === undefined
          ) {
            parsed.relevant = parsed.is_relevant;
          }

          // Validate with Zod schema if provided
          if (schema && schema.parse) {
            return schema.parse(parsed);
          }

          return parsed;
        } catch (error: any) {
          console.error("❌ Failed to parse structured output");

          // Provide more helpful error message
          if (error.issues) {
            console.error("   Schema validation failed:");
            for (const issue of error.issues) {
              console.error(
                `      - ${issue.path.join(".")}: ${issue.message}`,
              );
            }
          }

          throw new Error(
            `Failed to parse structured output: ${error.message}`,
          );
        }
      },
    };
  }

  /**
   * Support for function calling / tool binding
   */
  bindTools(tools: any[], options?: any): any {
    const config = this.config;
    const toolChoice = options?.tool_choice;

    return {
      async invoke(messages: BaseMessage[]): Promise<any> {
        // Describe tools in the prompt
        const toolDescriptions = tools
          .map((tool, idx) => {
            const schemaStr = JSON.stringify(tool.schema, null, 2);
            return `Tool ${idx + 1}: "${tool.name}"\nDescription: ${tool.description}\nSchema:\n${schemaStr}`;
          })
          .join("\n\n");

        // Enhance messages with tool information
        const enhancedMessages = [...messages];
        const lastMessage = enhancedMessages[enhancedMessages.length - 1];

        if (lastMessage) {
          const originalContent =
            typeof lastMessage.content === "string"
              ? lastMessage.content
              : JSON.stringify(lastMessage.content);

          enhancedMessages[enhancedMessages.length - 1] = new HumanMessage(
            originalContent +
              `\n\n--- AVAILABLE TOOLS ---\n${toolDescriptions}\n\n` +
              `IMPORTANT: Respond with ONLY valid JSON matching one of the tool schemas. ` +
              `Do not include markdown, code blocks, or explanatory text.`,
          );
        }

        const result = await generateWithGemini(enhancedMessages, config);
        const text = result.content;

        // Parse tool call from response
        try {
          let jsonStr = text.trim();

          // Remove markdown if present
          const codeBlockMatch = jsonStr.match(
            /```(?:json)?\s*([\s\S]*?)\s*```/,
          );
          if (codeBlockMatch) {
            jsonStr = codeBlockMatch[1].trim();
          }

          // Find JSON
          const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            jsonStr = jsonMatch[0];
          }

          const parsed = JSON.parse(jsonStr);

          // Determine which tool was called
          const toolName = toolChoice || tools[0]?.name || "unknown";

          return {
            content: text,
            tool_calls: [
              {
                name: toolName,
                args: parsed,
              },
            ],
          };
        } catch (error: any) {
          console.warn(
            "⚠️  Could not parse tool call from Gemini:",
            error.message,
          );
          return {
            content: text,
            tool_calls: [],
          };
        }
      },
    };
  }
}

/**
 * Get a model instance that works with LangChain patterns
 * Automatically selects between OpenAI and Gemini
 */
export function getChatModel(config: LLMConfig = {}): any {
  const provider = getAIProvider();

  if (provider === "gemini") {
    return new GeminiChatModel(config);
  } else {
    return getOpenAIModel(config);
  }
}

/**
 * Simple text generation (high-level helper)
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
  const provider = getAIProvider();

  if (provider === "gemini") {
    // Use Gemini directly
    const model =
      options?.model || process.env.LLM_MODEL || "gemini-2.0-flash-exp";

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
    // Use OpenAI
    const model = getOpenAIModel({
      modelName: options?.model,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
    });

    const messages: BaseMessage[] = [];
    if (options?.systemPrompt) {
      messages.push(new SystemMessage(options.systemPrompt));
    }
    messages.push(new HumanMessage(prompt));

    const response = await model.invoke(messages);
    return response.content.toString();
  }
}

/**
 * Generate with structured output (high-level helper)
 */
export async function generateStructuredOutput<T = any>(
  prompt: string,
  schema: any,
  options?: {
    systemPrompt?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
  },
): Promise<T> {
  const model = getChatModel({
    modelName: options?.model,
    temperature: options?.temperature,
    maxTokens: options?.maxTokens,
  });

  const modelWithSchema = model.withStructuredOutput(schema);

  const messages: BaseMessage[] = [];
  if (options?.systemPrompt) {
    messages.push(new SystemMessage(options.systemPrompt));
  }
  messages.push(new HumanMessage(prompt));

  return await modelWithSchema.invoke(messages);
}

/**
 * Check if we're using Gemini
 */
export function isUsingGemini(): boolean {
  return getAIProvider() === "gemini";
}

/**
 * Check if we're using OpenAI
 */
export function isUsingOpenAI(): boolean {
  return getAIProvider() === "openai";
}
