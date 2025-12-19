import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { GeneratePostAnnotation } from "../../generate-post-state.js";
import { ChatOpenAI } from "@langchain/openai";
import { GENERATE_REPORT_PROMPT } from "./prompts.js";

/**
 * Parse the LLM generation to extract the report from inside the <report> tag.
 * If the report can not be parsed, returns the generation with thinking tags removed.
 * @param generation The text generation to parse
 * @returns The parsed generation, or the generation without thinking tags
 */
function parseGeneration(generation: string): string {
  const reportMatch = generation.match(/<report>([\s\S]*?)<\/report>/);
  if (!reportMatch) {
    console.warn("⚠️  Could not find <report> tags in generation, using raw output");
    // Remove <thinking> tags and their content
    const withoutThinking = generation.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
    return withoutThinking || generation;
  }
  return reportMatch[1].trim();
}

const formatReportPrompt = (pageContents: string[]): string => {
  return `The following text contains summaries, or entire pages from the content I submitted to you.Please review the content and generate a report on it.
  ${pageContents.map((content, index) => `<Content index={${index + 1}}>\n${content}\n</Content>`).join("\n\n")} `;
};

export async function generateContentReport(
  state: typeof GeneratePostAnnotation.State,
  _config: LangGraphRunnableConfig,
): Promise<Partial<typeof GeneratePostAnnotation.State>> {
  const validPageContents = state.pageContents?.filter((content) => content?.trim().length > 0);

  if (!validPageContents?.length) {
    console.warn("No valid page contents found to generate report. Using existing report or default.");
    return {
      report: state.report || "No detailed content available to generate report. Using initial summaries.",
    };
  }

  const aiProvider = process.env.AI_PROVIDER || "openai";
  const useGemini = aiProvider === "gemini" || (process.env.LLM_MODEL || "").toLowerCase().includes("gemini");

  if (useGemini && process.env.GEMINI_API_KEY) {
    const { generateTextWithGemini } = await import("../../../../utils/gemini.js");
    const systemPrompt = GENERATE_REPORT_PROMPT;
    const userPrompt = formatReportPrompt(validPageContents);
    
    const result = await generateTextWithGemini(userPrompt, systemPrompt, {
      temperature: 0,
    });
    
    return {
      report: parseGeneration(result),
    };
  } else {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("Missing credentials. Please set OPENAI_API_KEY or GEMINI_API_KEY");
    }
    
    const reportModel = new ChatOpenAI({
      modelName: process.env.LLM_MODEL || "gpt-4o",
      temperature: 0,
    });

    const result = await reportModel.invoke([
      {
        role: "system",
        content: GENERATE_REPORT_PROMPT,
      },
      {
        role: "user",
        content: formatReportPrompt(validPageContents),
      },
    ]);

    return {
      report: parseGeneration(result.content as string),
    };
  }
}
