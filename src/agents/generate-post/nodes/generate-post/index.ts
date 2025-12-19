import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { GeneratePostAnnotation } from "../../generate-post-state.js";
import { ChatOpenAI } from "@langchain/openai";
import {
  GENERATE_INSTAGRAM_POST_PROMPT,
  GENERATE_POST_PROMPT,
} from "./prompts.js";
import { formatPrompt, parseGeneration } from "./utils.js";
import { ALLOWED_TIMES } from "../../constants.js";
import {
  getReflectionsPrompt,
  REFLECTIONS_PROMPT,
} from "../../../../utils/reflections.js";
import { getNextSaturdayDate } from "../../../../utils/date.js";

export async function generatePost(
  state: typeof GeneratePostAnnotation.State,
  config: LangGraphRunnableConfig,
): Promise<Partial<typeof GeneratePostAnnotation.State>> {
  if (!state.report) {
    throw new Error("No report found");
  }
  if (!state.relevantLinks?.length) {
    throw new Error("No relevant links found");
  }
  
  const prompt = formatPrompt(state.report, state.relevantLinks);
  const reflections = await getReflectionsPrompt(config);
  const reflectionsPrompt = REFLECTIONS_PROMPT.replace(
    "{reflections}",
    reflections,
  );

  const basePrompt = state.platform === "instagram" ? GENERATE_INSTAGRAM_POST_PROMPT : GENERATE_POST_PROMPT;
  const generatePostPrompt = basePrompt.replace(
    "{reflectionsPrompt}",
    reflectionsPrompt,
  );

  const aiProvider = process.env.AI_PROVIDER || "openai";
  const useGemini = aiProvider === "gemini" || (process.env.LLM_MODEL || "").toLowerCase().includes("gemini");

  let postContent: string;

  if (useGemini && process.env.GEMINI_API_KEY) {
    const { generateTextWithGemini } = await import("../../../../utils/gemini.js");
    postContent = await generateTextWithGemini(prompt, generatePostPrompt, {
      temperature: parseFloat(process.env.LLM_TEMPERATURE || "0.5"),
    });
  } else {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("Missing credentials. Please set OPENAI_API_KEY or GEMINI_API_KEY");
    }
    const postModel = new ChatOpenAI({
      modelName: process.env.LLM_MODEL || "gpt-4o",
      temperature: parseFloat(process.env.LLM_TEMPERATURE || "0.5"),
    });

    const postResponse = await postModel.invoke([
      {
        role: "system",
        content: generatePostPrompt,
      },
      {
        role: "user",
        content: prompt,
      },
    ]);

    postContent = postResponse.content as string;
  }

  // Randomly select a time from the allowed times
  const [postHour, postMinute] = ALLOWED_TIMES[
    Math.floor(Math.random() * ALLOWED_TIMES.length)
  ]
    .split(" ")[0]
    .split(":");
  const postDate = getNextSaturdayDate(Number(postHour), Number(postMinute));

  return {
    post: parseGeneration(postContent),
    scheduleDate: postDate,
  };
}
