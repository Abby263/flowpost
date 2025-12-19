import { ChatOpenAI } from "@langchain/openai";
import { SupervisorState } from "../supervisor-state.js";
import { z } from "zod";

const DETERMINE_POST_TYPE_PROMPT = `You're a highly skilled marketer, working to craft new social media content for your Twitter & LinkedIn pages.
You're given a report (or reports) on a technical AI topic. Based on the report(s), you should determine if this report should be used to generate a long form 'thread' like post, or a shorter, more concise and straightforward post.

To do this, you should consider the following points:
- If the report is on a new product, release, academic paper, or similar, it's likely that you should generate a long form 'thread' like post.
- If the report is on a new method of doing something, or a smaller feature, it is likely that you should generate a shorter, more concise and straightforward post.
- Writing long form threads should be reserved for only the most detailed, interesting, and technical reports. All other reports should likely be categorized as a shorter, more concise and straightforward post.

Use your best judgement to determine the type of post to generate based on the report provided by the user.`;

const postTypeSchema = z
  .object({
    reason: z.string().describe("The reasoning behind your decision."),
    type: z
      .enum(["thread", "post"])
      .describe(
        "The type of post to generate. Thread for long form posts, post for shorter, more concise and straightforward posts.",
      ),
  })
  .describe(
    "The type of post to generate and reasoning behind your decision based on the report(s) provided.",
  );

function formatReportUserPrompt(report: {
  reports: string[];
  keyDetails: string[];
}) {
  if (report.reports.length === 1) {
    return `Here are the key details for the report:
<key-details>
${report.keyDetails[0] || "no key details"}
</key-details>

And here is the full report:
<report>
${report.reports[0]}
</report>

Please take your time, and identify the best type of post to generate for this report, and why! Thank you!`;
  }

  return `Here are all of the key details & reports I've written for this post:
<key-details-and-reports>
  ${report.reports
      .map(
        (r, index) => `
  <report index="${index}">
    ${r}
  </report>
  
  <key-details index="${index}">
    ${report.keyDetails[index] || "no key details"}
  </key-details>
  `,
      )
      .join("\n")}
</key-details-and-reports>

Please take your time, and identify the best type of post to generate for these reports, and why! Thank you!`;
}

export async function determinePostType(
  state: SupervisorState,
): Promise<Partial<SupervisorState>> {
  const aiProvider = process.env.AI_PROVIDER || "openai";
  const useGemini = aiProvider === "gemini" || (process.env.LLM_MODEL || "").toLowerCase().includes("gemini");

  const reportAndPostType: {
    reports: string[];
    keyDetails: string[];
    reason: string;
    type: "thread" | "post";
  }[] = [];

  for await (const report of state.groupedReports) {
    let result: z.infer<typeof postTypeSchema>;

    if (useGemini && process.env.GEMINI_API_KEY) {
      const { generateTextWithGemini } = await import("../../../../utils/gemini.js");
      const userPrompt = formatReportUserPrompt(report);
      const prompt = `${DETERMINE_POST_TYPE_PROMPT}\n\n${userPrompt}\n\nReturn your response as valid JSON with "reason" and "type" fields. Example: {"reason": "...", "type": "post"}`;
      
      const response = await generateTextWithGemini(prompt, undefined, {
        temperature: 0,
      });
      
      // Parse JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        result = postTypeSchema.parse(parsed);
      } else {
        // Fallback parsing
        const parsed = JSON.parse(response);
        result = postTypeSchema.parse(parsed);
      }
    } else {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error("Missing credentials. Please set OPENAI_API_KEY or GEMINI_API_KEY");
      }
      const model = new ChatOpenAI({
        modelName: process.env.LLM_MODEL || "gpt-4o",
        temperature: 0, // Keep at 0 for deterministic post type routing
      }).withStructuredOutput(postTypeSchema, {
        name: "postType",
      });

      result = (await model.invoke([
        ["system", DETERMINE_POST_TYPE_PROMPT],
        ["user", formatReportUserPrompt(report)],
      ])) as z.infer<typeof postTypeSchema>;
    }

    reportAndPostType.push({
      ...result,
      ...report,
    });
  }

  return {
    reportAndPostType,
  };
}
