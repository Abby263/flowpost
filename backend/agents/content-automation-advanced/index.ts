import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import { generatePostGraph } from "../generate-post/generate-post-graph.js";
import { InstagramGraphClient } from "../../clients/instagram/graph-client.js";
import { uploadImageToSupabase } from "../../utils/supabase-storage.js";
import {
  formatLearningPrompt,
  loadLearningContext,
  LearningContext,
} from "../../utils/learnings.js";

// Define the state for our graph
const ContentAutomationAdvancedState = Annotation.Root({
  // Inputs
  searchQuery: Annotation<string>,
  location: Annotation<string>,
  stylePrompt: Annotation<string>,
  platform: Annotation<"instagram" | "twitter" | "linkedin" | "slack">,
  credentials: Annotation<any>,
  requiresApproval: Annotation<boolean>,
  userId: Annotation<string>,
  workflowId: Annotation<string>,

  // Learning context loaded at the start of each run, injected into prompts.
  learningContext: Annotation<LearningContext | undefined>({
    reducer: (_x, y) => y,
    default: () => undefined,
  }),

  // Cost tracking
  apiCosts: Annotation<{
    serper?: number;
    openai_curate?: number;
    openai_quality?: number;
    dalle?: number;
    total?: number;
  }>({
    reducer: (x, y) => ({ ...x, ...y }),
    default: () => ({}),
  }),

  // Internal
  events: Annotation<any[]>,
  selectedContent: Annotation<any[]>,
  imageUrl: Annotation<string>,
  isContentSufficient: Annotation<boolean>,
  feedback: Annotation<string>,
  retryCount: Annotation<number>({
    reducer: (_x, y) => y,
    default: () => 0,
  }),

  // Output passed to generate-post-graph
  links: Annotation<string[]>,
  report: Annotation<string>,
  image: Annotation<{ imageUrl: string; mimeType: string } | undefined>,

  // Fields required by GeneratePostGraph (to prevent AggregateError)
  post: Annotation<string>({
    reducer: (_x, y) => y,
    default: () => "",
  }),
  complexPost: Annotation<any>({
    reducer: (_x, y) => y,
    default: () => undefined,
  }),
  scheduleDate: Annotation<any>({
    reducer: (_x, y) => y,
  }),
  userResponse: Annotation<string | undefined>({
    reducer: (_x, y) => y,
    default: () => undefined,
  }),
  next: Annotation<any>({
    reducer: (_x, y) => y,
    default: () => undefined,
  }),
  condenseCount: Annotation<number>({
    reducer: (_x, y) => y,
    default: () => 0,
  }),
  pageContents: Annotation<string[] | undefined>({
    reducer: (x, y) => (x || []).concat(y || []),
    default: () => [],
  }),
  relevantLinks: Annotation<string[] | undefined>({
    reducer: (_x, y) => y, // Simplified reducer for now
    default: () => [],
  }),
  imageOptions: Annotation<string[] | undefined>({
    reducer: (_x, y) => y,
    default: () => [],
  }),
  publishStatus: Annotation<"pending" | "success" | "failed" | "skipped">({
    reducer: (_x, y) => y,
    default: () => "pending",
  }),
  publishError: Annotation<string | undefined>({
    reducer: (_x, y) => y,
    default: () => undefined,
  }),
  publishedUrl: Annotation<string | undefined>({
    reducer: (_x, y) => y,
    default: () => undefined,
  }),
});

// Node: load past learnings and engagement context for this user/workflow.
// Best-effort — failures don't block generation.
async function loadLearnings(
  state: typeof ContentAutomationAdvancedState.State,
) {
  console.log(`\n📚 [LOAD LEARNINGS] Pulling past learnings...`);
  const ctx = await loadLearningContext(state.userId, state.workflowId || null);
  console.log(
    `   Found: ${ctx.rules.length} rules, ${ctx.topPerformers.length} top performers, ${ctx.lowPerformers.length} low performers`,
  );
  return { learningContext: ctx };
}

// Node to find content
async function fetchContent(
  state: typeof ContentAutomationAdvancedState.State,
) {
  console.log(`\n🔍 [FETCH CONTENT] Starting content search...`);
  console.log(`   Query: "${state.searchQuery}"`);
  console.log(`   Location: "${state.location || "Not specified"}"`);

  const SERPER_API_KEY = process.env.SERPER_API_KEY;
  if (!SERPER_API_KEY) {
    console.warn(
      "⚠️  [FETCH CONTENT] SERPER_API_KEY not set. Using mock data.",
    );
    return {
      events: [
        {
          title: "Mock Event 1",
          date: "Tomorrow",
          link: "https://example.com/1",
          snippet:
            "This is mock data because Serper API key is not configured.",
        },
        {
          title: "Mock Event 2",
          date: "Weekend",
          link: "https://example.com/2",
          snippet: "Please add SERPER_API_KEY to your .env file.",
        },
      ],
      retryCount: (state.retryCount || 0) + 1,
    };
  }

  try {
    const searchQuery = `${state.searchQuery} ${state.location || ""}`.trim();
    console.log(`   📡 Calling Serper API with query: "${searchQuery}"`);

    const startTime = Date.now();
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": SERPER_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: searchQuery,
        num: 10,
      }),
    });

    const duration = Date.now() - startTime;
    console.log(`   ⏱️  Serper API response time: ${duration}ms`);

    if (!response.ok) {
      throw new Error(
        `Serper API returned status ${response.status}: ${response.statusText}`,
      );
    }

    const data = await response.json();
    const events = data.organic || [];
    console.log(
      `✅ [FETCH CONTENT] Successfully fetched ${events.length} results`,
    );

    return {
      events,
      retryCount: (state.retryCount || 0) + 1,
      apiCosts: { serper: 0.0025 },
    };
  } catch (error: any) {
    console.error(`❌ [FETCH CONTENT] Error fetching content:`, error.message);
    return {
      events: [],
      retryCount: (state.retryCount || 0) + 1,
      feedback: `Failed to fetch content: ${error.message}`,
    };
  }
}

// Node to curate content
async function curateContent(
  state: typeof ContentAutomationAdvancedState.State,
) {
  console.log(`\n🎯 [CURATE CONTENT] Starting content curation...`);
  console.log(
    `   Style: "${state.stylePrompt || "Professional and engaging"}"`,
  );
  console.log(`   Input events: ${state.events.length} items`);

  if (!state.events || state.events.length === 0) {
    console.warn(
      "⚠️  [CURATE CONTENT] No events to curate. Using empty selection.",
    );
    return {
      selectedContent: [],
      links: [],
      relevantLinks: [],
      pageContents: [],
      report: "No content available to curate.",
    };
  }

  const learningBlock = state.learningContext
    ? formatLearningPrompt(state.learningContext)
    : "";

  const prompt = `
    You are a content curator for social media posts.
    Style/Tone: ${state.stylePrompt || "Professional and engaging"}
    Platform: ${state.platform || "instagram"}
    ${learningBlock}
    Review the following search results:
    ${JSON.stringify(state.events)}

    Select the top 3-5 most relevant and engaging items that would make great social media content.
    If the LEARNINGS section is present, prefer items that align with the top-performer style and avoid topics/styles called out as low-performing or to-avoid.
    Return ONLY a JSON array of objects with 'title', 'snippet', and 'link' fields.
    Do not include any markdown formatting, just the raw JSON array.
  `;

  const aiProvider = process.env.AI_PROVIDER || "openai";
  const useGemini =
    aiProvider === "gemini" ||
    (process.env.LLM_MODEL || "").toLowerCase().includes("gemini");

  try {
    const startTime = Date.now();
    let content: string;
    let curateCost = 0;

    if (useGemini && process.env.GEMINI_API_KEY) {
      console.log(
        `   🤖 Calling Gemini (${process.env.LLM_MODEL || "gemini-2.0-flash-exp"}) for curation...`,
      );
      const { generateTextWithGemini } = await import("../../utils/gemini.js");
      content = await generateTextWithGemini(prompt, undefined, {
        temperature: 0,
      });
      const duration = Date.now() - startTime;
      console.log(`   ⏱️  Gemini response time: ${duration}ms`);
      // Gemini pricing is very low, estimate ~$0.0001 per request
      curateCost = 0.0001;
    } else {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error(
          "Missing credentials. Please set OPENAI_API_KEY or GEMINI_API_KEY",
        );
      }
      const llm = new ChatOpenAI({
        modelName: process.env.LLM_MODEL || "gpt-4o-mini",
        temperature: 0,
        apiKey: process.env.OPENAI_API_KEY,
      });
      console.log(
        `   🤖 Calling OpenAI (${process.env.LLM_MODEL || "gpt-4o-mini"}) for curation...`,
      );
      const response = await llm.invoke([new HumanMessage(prompt)]);
      const duration = Date.now() - startTime;
      console.log(`   ⏱️  OpenAI response time: ${duration}ms`);

      // Calculate cost if token usage available
      const tokenUsage = (response.response_metadata as any)?.tokenUsage;
      if (tokenUsage) {
        curateCost = (tokenUsage.totalTokens / 1000) * 0.00015; // gpt-4o-mini pricing
      }

      content = response.content as string;
    }

    // Strip markdown code blocks if present
    content = content.replace(/```json\n?|```/g, "").trim();
    const selected = JSON.parse(content);

    if (!Array.isArray(selected)) {
      throw new Error("LLM did not return an array");
    }

    console.log(
      `✅ [CURATE CONTENT] Successfully curated ${selected.length} items`,
    );
    selected.forEach((item, i) => {
      console.log(`   ${i + 1}. ${item.title}`);
    });

    return {
      selectedContent: selected,
      links: selected.map((item: any) => item.link),
      relevantLinks: selected.map((item: any) => item.link),
      pageContents: selected.map((item: any) => item.snippet || ""),
      report: `Curated Content for ${state.searchQuery}:\n\n${selected.map((s: any) => `- ${s.title}: ${s.snippet || ""}`).join("\n")}`,
      apiCosts: { openai_curate: curateCost },
    };
  } catch (e: any) {
    console.error(`❌ [CURATE CONTENT] Error:`, e.message);
    console.log(`   📝 Falling back to first 3 events`);

    const fallback = state.events.slice(0, 3);
    return {
      selectedContent: fallback,
      links: fallback.map((item: any) => item.link || ""),
      relevantLinks: fallback.map((item: any) => item.link || ""),
      pageContents: fallback.map((item: any) => item.snippet || ""),
      report: `Content for ${state.searchQuery} (fallback):\n\n${fallback.map((s: any) => `- ${s.title}`).join("\n")}`,
    };
  }
}

// Node to generate visuals
async function generateVisuals(
  state: typeof ContentAutomationAdvancedState.State,
) {
  console.log(`\n🎨 [GENERATE VISUALS] Creating image for post...`);
  console.log(`   Style: "${state.stylePrompt || "default"}"`);
  console.log(`   Topic: "${state.searchQuery}"`);

  try {
    const { generateImage } = await import("../../utils/image-generation.js");

    const imagePrompt = `A professional social media post image for ${state.platform || "Instagram"}. Style: ${state.stylePrompt || "modern and engaging"}. Topic: ${state.searchQuery}${state.location ? ` in ${state.location}` : ""}. High quality, visually appealing, suitable for social media.`;

    console.log(`   Prompt: "${imagePrompt.substring(0, 100)}..."`);

    const result = await generateImage({
      prompt: imagePrompt,
    });

    console.log(`✅ [GENERATE VISUALS] Image generated successfully`);
    // Only log URL preview, not full base64 data
    if (result.imageUrl && result.imageUrl.startsWith("data:")) {
      console.log(
        `   URL: [Base64 data URL - ${result.imageUrl.length} chars]`,
      );
    } else if (result.imageUrl) {
      console.log(`   URL: ${result.imageUrl.substring(0, 50)}...`);
    }

    return {
      imageUrl: result.imageUrl,
      image: { imageUrl: result.imageUrl, mimeType: result.mimeType },
      apiCosts: { imageGeneration: result.cost || 0.04 },
    };
  } catch (error: any) {
    console.error(`❌ [GENERATE VISUALS] Error:`, error.message);
    console.log(`   📝 Failing workflow due to image generation error`);

    // Don't use placeholder images as they will fail Instagram upload
    // Instead, mark the workflow as failed
    return {
      imageUrl: undefined,
      image: undefined,
      publishStatus: "failed",
      publishError: `Image generation failed: ${error.message}`,
    };
  }
}

// Node to check content quality
async function checkContentQuality(
  state: typeof ContentAutomationAdvancedState.State,
) {
  console.log(`\n✅ [CHECK QUALITY] Evaluating content quality...`);

  if (!state.report || state.report.length < 50) {
    console.warn(
      "⚠️  [CHECK QUALITY] Report is too short or empty. Marking as insufficient.",
    );
    return {
      isContentSufficient: false,
      feedback: "Content report is too short or empty",
    };
  }

  const prompt = `
    Review the following curated content report:
    ${state.report}

    Is this content sufficient and relevant for a ${state.platform || "social media"} post about "${state.searchQuery}"${state.location ? ` in "${state.location}"` : ""}?
    
    Be lenient in your evaluation. Content is sufficient if it:
    - Has at least 2-3 relevant items
    - Provides useful information related to the topic
    - Can be used to create an engaging post
    
    Return ONLY valid JSON with these fields:
    - 'sufficient' (boolean): true if content meets the above criteria, false only if completely irrelevant or empty
    - 'feedback' (string): brief explanation of your decision
    
    Example: {"sufficient": true, "feedback": "Content is relevant and engaging"}
    `;

  const aiProvider = process.env.AI_PROVIDER || "openai";
  const useGemini =
    aiProvider === "gemini" ||
    (process.env.LLM_MODEL || "").toLowerCase().includes("gemini");

  try {
    const startTime = Date.now();
    let content: string;

    if (useGemini && process.env.GEMINI_API_KEY) {
      console.log(
        `   🤖 Asking Gemini (${process.env.LLM_MODEL || "gemini-2.0-flash-exp"}) to evaluate quality...`,
      );
      const { generateTextWithGemini } = await import("../../utils/gemini.js");
      content = await generateTextWithGemini(prompt, undefined, {
        temperature: 0,
      });
      const duration = Date.now() - startTime;
      console.log(`   ⏱️  Gemini response time: ${duration}ms`);
    } else {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error(
          "Missing credentials. Please set OPENAI_API_KEY or GEMINI_API_KEY",
        );
      }
      const llm = new ChatOpenAI({
        modelName: process.env.LLM_MODEL || "gpt-4o-mini",
        temperature: 0,
        apiKey: process.env.OPENAI_API_KEY,
      });
      console.log(
        `   🤖 Asking OpenAI (${process.env.LLM_MODEL || "gpt-4o-mini"}) to evaluate quality...`,
      );
      const response = await llm.invoke([new HumanMessage(prompt)]);
      const duration = Date.now() - startTime;
      console.log(`   ⏱️  OpenAI response time: ${duration}ms`);
      content = response.content as string;
    }

    // Log token usage (only for OpenAI)
    let qualityCost = 0;
    if (!useGemini) {
      // Token usage logging would go here if we had access to response metadata
      qualityCost = 0.0001; // Estimate
    }

    // Parse content
    const jsonMatch = content.match(/\{.*\}/s);

    if (!jsonMatch) {
      console.warn(
        "⚠️  [CHECK QUALITY] No JSON found in response. Assuming sufficient.",
      );
      return {
        isContentSufficient: true,
        feedback: "Could not parse quality check",
      };
    }

    const result = JSON.parse(jsonMatch[0]);
    console.log(
      `   ${result.sufficient ? "✅" : "❌"} Quality check result: ${result.sufficient ? "SUFFICIENT" : "INSUFFICIENT"}`,
    );

    return {
      isContentSufficient: result.sufficient,
      feedback: result.feedback,
      apiCosts: { openai_quality: qualityCost },
    };
  } catch (e: any) {
    console.error(`❌ [CHECK QUALITY] Error:`, e.message);
    console.log(`   📝 Defaulting to sufficient=true`);
    return {
      isContentSufficient: true,
      feedback: "Error in quality check, proceeding anyway",
    };
  }
}

function routeContentQuality(
  state: typeof ContentAutomationAdvancedState.State,
) {
  if (state.isContentSufficient) {
    return "generateVisuals";
  }
  // Simple retry logic: if bad, try fetching again (maybe with a refined query in a real agent)
  // For now, we just proceed to avoid infinite loops in this demo,
  // but in a real advanced agent, we would modify the query.
  // Let's just log and proceed for safety, or loop back if we had a query refiner.
  // To demonstrate the graph complexity, let's loop back to fetchContent but limit retries.

  if ((state.retryCount || 0) < 1) {
    return "fetchContent";
  }
  return "generateVisuals";
}

// Node to publish content to Instagram
async function publishToInstagram(
  state: typeof ContentAutomationAdvancedState.State,
) {
  console.log(`--- PUBLISHING TO ${state.platform?.toUpperCase()} ---`);

  // Check if there was a previous failure
  if (state.publishStatus === "failed") {
    console.error(
      `❌ Skipping publish - previous error: ${state.publishError}`,
    );
    return { publishStatus: "failed", publishError: state.publishError };
  }

  if (!state.post) {
    console.error("❌ No post content to publish.");
    return { publishStatus: "failed", publishError: "No post content" };
  }

  if (state.platform !== "instagram") {
    console.log(
      `⚠️  Platform ${state.platform} not yet implemented in this workflow.`,
    );
    return {
      publishStatus: "skipped",
      publishError: `Platform ${state.platform} not supported`,
    };
  }

  try {
    const accessToken = state.credentials?.accessToken;
    const igUserId = state.credentials?.igUserId;
    if (!accessToken || !igUserId) {
      throw new Error(
        "Instagram credentials missing accessToken or igUserId. The connection may need to be reconnected via Facebook OAuth.",
      );
    }

    const sourceImageUrl = state.imageUrl || state.image?.imageUrl;
    if (!sourceImageUrl) {
      throw new Error("No image URL available for Instagram post");
    }

    console.log("📤 Uploading image to Supabase Storage for Graph API...");
    const publicImageUrl = await uploadImageToSupabase(sourceImageUrl, {
      userId: state.userId,
    });
    console.log(`   Public URL: ${publicImageUrl}`);

    console.log("📤 Publishing via Meta Graph API...");
    const client = new InstagramGraphClient(accessToken, igUserId);
    const result = await client.publishImage({
      imageUrl: publicImageUrl,
      caption: state.post,
    });

    console.log("✅ Successfully published to Instagram!");
    console.log(`   Media ID: ${result.mediaId}`);
    if (result.permalink) console.log(`   Permalink: ${result.permalink}`);

    return {
      publishStatus: "success",
      publishedUrl: result.permalink || undefined,
      imageUrl: publicImageUrl,
    };
  } catch (error: any) {
    console.error("❌ Failed to publish to Instagram:", error);
    return {
      publishStatus: "failed",
      publishError: error?.message || String(error),
    };
  }
}

// Node to save post to DB and update workflow status
async function savePostToDb(
  state: typeof ContentAutomationAdvancedState.State,
) {
  console.log("--- SAVING POST TO DB ---");
  console.log(`   📋 State Summary:`);
  console.log(`      - workflowId: ${state.workflowId || "N/A"}`);
  console.log(`      - userId: ${state.userId || "N/A"}`);
  console.log(`      - platform: ${state.platform || "N/A"}`);
  console.log(`      - post length: ${state.post?.length || 0} chars`);
  console.log(
    `      - post preview: "${(state.post || "").substring(0, 50)}..."`,
  );
  console.log(`      - imageUrl: ${state.imageUrl ? "present" : "missing"}`);
  console.log(`      - publishStatus: ${state.publishStatus || "N/A"}`);
  console.log(`      - publishError: ${state.publishError || "none"}`);

  // Check if PostgreSQL is configured
  if (!process.env.DATABASE_URI) {
    console.warn("⚠️  DATABASE_URI not configured. Skipping DB save.");
    return {};
  }

  const { queryOne, insert, query } = await import("../../utils/postgres.js");

  // Save post to DB if we have content
  if (state.post && state.post.length > 0) {
    try {
      console.log(`   📊 Connecting to PostgreSQL...`);

      // Prepare post data - only include fields if they have values
      const postData: Record<string, unknown> = {
        workflow_id: state.workflowId,
        user_id: state.userId,
        content: state.post,
        platform: state.platform,
        status: state.publishStatus === "success" ? "published" : "failed",
        source: "workflow", // Explicitly set source
        posted_at: new Date().toISOString(),
      };

      let connectionId: string | null = null;
      if (state.workflowId) {
        const workflow = await queryOne<{ connection_id: string }>(
          `SELECT connection_id FROM workflows WHERE id = $1`,
          [state.workflowId],
        );

        if (workflow?.connection_id) {
          connectionId = workflow.connection_id;
        }
      }

      // Add optional fields if they exist
      if (state.imageUrl) {
        postData.image_url = state.imageUrl;
      }
      if (state.publishedUrl) {
        postData.published_url = state.publishedUrl;
      }
      if (connectionId) {
        postData.connection_id = connectionId;
      }

      console.log(`   💾 Inserting post data:`, {
        workflow_id: postData.workflow_id,
        status: postData.status,
        has_image: !!postData.image_url,
        has_url: !!postData.published_url,
      });

      await insert("posts", postData);
      console.log("✅ Post saved to DB successfully.");
    } catch (e) {
      console.error("❌ Failed to save post:", e);
    }
  } else {
    console.log("No post content to save.");
  }

  // Update workflow run status to completed/failed
  if (state.workflowId) {
    try {
      const finalStatus =
        state.publishStatus === "success" ? "completed" : "failed";
      const errorMessage =
        state.publishStatus !== "success" ? state.publishError : null;

      console.log(
        `   📊 Updating workflow ${state.workflowId} status to: ${finalStatus}`,
      );

      // First, get the workflow to retrieve user_id for credit deduction
      const workflow = await queryOne<{ user_id: string; name: string }>(
        `SELECT user_id, name FROM workflows WHERE id = $1`,
        [state.workflowId],
      );

      // Update workflow status
      await query(
        `UPDATE workflows SET run_status = $1, run_completed_at = $2, last_error = $3 WHERE id = $4`,
        [finalStatus, new Date().toISOString(), errorMessage, state.workflowId],
      );
      console.log(`✅ Workflow status updated to: ${finalStatus}`);

      // Deduct credits ONLY on successful completion
      if (finalStatus === "completed" && workflow?.user_id) {
        try {
          const CREDITS_PER_WORKFLOW = 1;

          // Get current credits
          const currentCredits = await queryOne<{
            credits_balance: number;
            bonus_credits: number;
          }>(
            `SELECT credits_balance, bonus_credits FROM user_credits WHERE user_id = $1 FOR UPDATE`,
            [workflow.user_id],
          );

          if (currentCredits) {
            let newCreditsBalance = currentCredits.credits_balance;
            let newBonusCredits = currentCredits.bonus_credits;

            if (newBonusCredits >= CREDITS_PER_WORKFLOW) {
              newBonusCredits -= CREDITS_PER_WORKFLOW;
            } else {
              const remainingAmount = CREDITS_PER_WORKFLOW - newBonusCredits;
              newBonusCredits = 0;
              newCreditsBalance -= remainingAmount;
            }

            await query(
              `UPDATE user_credits SET credits_balance = $1, bonus_credits = $2, credits_used_this_month = credits_used_this_month + $3 WHERE user_id = $4`,
              [
                newCreditsBalance,
                newBonusCredits,
                CREDITS_PER_WORKFLOW,
                workflow.user_id,
              ],
            );

            // Log transaction
            await insert("credit_transactions", {
              user_id: workflow.user_id,
              amount: -CREDITS_PER_WORKFLOW,
              balance_after: newCreditsBalance + newBonusCredits,
              transaction_type: "deduction",
              description: `Workflow completed: ${workflow.name || state.workflowId}`,
            });

            console.log(
              `💰 Deducted ${CREDITS_PER_WORKFLOW} credit(s) from user ${workflow.user_id}`,
            );
          }
        } catch (creditErr) {
          console.error("❌ Error deducting credits:", creditErr);
        }
      } else if (finalStatus === "failed") {
        console.log(`ℹ️ No credits deducted - workflow failed`);
      }
    } catch (e) {
      console.error("❌ Failed to update workflow status:", e);
    }
  }

  // Print workflow summary
  const statusEmoji = state.publishStatus === "success" ? "✅" : "❌";
  const creditsDeducted = state.publishStatus === "success" ? 1 : 0;
  console.log(`\n
╔═══════════════════════════════════════════════════════════╗
║                    WORKFLOW SUMMARY                       ║
╠═══════════════════════════════════════════════════════════╣
║ Workflow ID: ${(state.workflowId || "N/A").padEnd(42)}║
║ User ID:     ${(state.userId || "N/A").substring(0, 42).padEnd(42)}║
║ Platform:    ${(state.platform || "N/A").padEnd(42)}║
║ Status:      ${statusEmoji} ${(state.publishStatus || "N/A").padEnd(39)}║
║ Credits:     ${creditsDeducted > 0 ? `-${creditsDeducted} (deducted)` : "0 (not charged - failed)".padEnd(39)}║
╠═══════════════════════════════════════════════════════════╣
║          ${state.publishStatus === "success" ? "WORKFLOW COMPLETED SUCCESSFULLY" : "WORKFLOW FAILED - NO CREDITS CHARGED"}             ║
╚═══════════════════════════════════════════════════════════╝
`);

  return {};
}

// Node to prepare caption from generated post
async function prepareCaption(
  state: typeof ContentAutomationAdvancedState.State,
) {
  console.log(`\n📝 [PREPARE CAPTION] Preparing post caption...`);
  console.log(
    `   Current state.post: "${(state.post || "").substring(0, 50)}..." (${state.post?.length || 0} chars)`,
  );
  console.log(
    `   Current state.report: "${(state.report || "").substring(0, 50)}..." (${state.report?.length || 0} chars)`,
  );

  // If we already have a post from generatePostSubgraph, optionally rewrite it
  // through the learning lens before publishing.
  if (state.post && state.post.length > 10) {
    const learningBlock = state.learningContext
      ? formatLearningPrompt(state.learningContext)
      : "";

    if (
      learningBlock &&
      (process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY)
    ) {
      try {
        const rewritePrompt = `You are an Instagram caption editor. Apply the LEARNINGS to refine the draft caption while keeping its core meaning. Keep the result under 2200 chars. Return ONLY the final caption, no commentary.
${learningBlock}
DRAFT CAPTION:
${state.post}`;

        const aiProvider = process.env.AI_PROVIDER || "openai";
        const useGemini =
          aiProvider === "gemini" ||
          (process.env.LLM_MODEL || "").toLowerCase().includes("gemini");

        let rewritten: string;
        if (useGemini && process.env.GEMINI_API_KEY) {
          const { generateTextWithGemini } = await import(
            "../../utils/gemini.js"
          );
          rewritten = await generateTextWithGemini(rewritePrompt, undefined, {
            temperature: 0.4,
          });
        } else if (process.env.OPENAI_API_KEY) {
          const llm = new ChatOpenAI({
            modelName: process.env.LLM_MODEL || "gpt-4o-mini",
            temperature: 0.4,
            apiKey: process.env.OPENAI_API_KEY,
          });
          const response = await llm.invoke([new HumanMessage(rewritePrompt)]);
          rewritten = String(response.content || "").trim();
        } else {
          rewritten = state.post;
        }

        if (rewritten && rewritten.length > 20) {
          console.log(
            `   ✏️  Caption refined via learning loop (${rewritten.length} chars)`,
          );
          return { post: rewritten.slice(0, 2200) };
        }
      } catch (err) {
        console.warn(
          "[PREPARE CAPTION] Learning-based rewrite failed, using original:",
          err,
        );
      }
    }

    console.log(
      `✅ [PREPARE CAPTION] Using existing post (${state.post.length} chars)`,
    );
    console.log(`   Preview: "${state.post.substring(0, 100)}..."`);
    return {};
  }

  console.log(`   📄 Creating caption from report (no existing post found)...`);

  // Otherwise, create a simple caption from the report
  let caption = `${state.searchQuery || "Latest Updates"}${state.location ? ` in ${state.location}` : ""}!\n\n`;

  if (state.report && state.report.length > 10) {
    // Extract key points from report
    const lines = state.report
      .split("\n")
      .filter((l) => l.trim().length > 0)
      .slice(0, 5);
    caption += lines.join("\n");
  } else if (state.selectedContent && state.selectedContent.length > 0) {
    // Fallback to selectedContent if report is empty
    caption += state.selectedContent
      .slice(0, 3)
      .map((item: any) => `• ${item.title || item.snippet || ""}`)
      .join("\n");
  } else {
    caption += "Check out these amazing updates! Stay tuned for more content.";
  }

  // Add hashtags
  const hashtags = [
    state.location ? `#${state.location.replace(/\s/g, "")}` : null,
    state.searchQuery
      ? `#${state.searchQuery.replace(/\s/g, "").replace(/[^a-zA-Z0-9]/g, "")}`
      : null,
    `#${state.platform || "social"}media`,
    "#FlowPost",
  ]
    .filter(Boolean)
    .join(" ");

  caption += `\n\n${hashtags}`;

  // Truncate if too long (Instagram has a 2200 char limit)
  if (caption.length > 2000) {
    caption = caption.substring(0, 1997) + "...";
  }

  console.log(`✅ [PREPARE CAPTION] Caption created (${caption.length} chars)`);
  console.log(`   Preview: "${caption.substring(0, 150)}..."`);

  return { post: caption };
}

// Router to decide whether to skip Instagram publishing
function routePublishing(
  state: typeof ContentAutomationAdvancedState.State,
): "publishToInstagram" | "saveDraftForApproval" {
  if (state.requiresApproval) {
    console.log(
      "[ROUTE] requiresApproval=true → saving draft for human review",
    );
    return "saveDraftForApproval";
  }
  console.log("[ROUTE] requiresApproval=false → auto-publishing");
  return "publishToInstagram";
}

// Node: persist the generated draft for human review.
// Posts row keeps status='pending_approval' with the caption + image URL,
// so the approval inbox UI can fetch and approve/reject without re-running
// the agent. Credits are NOT deducted here (they're charged on approve).
async function saveDraftForApproval(
  state: typeof ContentAutomationAdvancedState.State,
) {
  console.log("\n📥 [SAVE DRAFT] Saving pending-approval draft...");

  if (!process.env.DATABASE_URI && !process.env.DATABASE_URL) {
    console.warn("⚠️  DATABASE_URI not configured. Skipping draft save.");
    return { publishStatus: "skipped" };
  }
  if (!state.post || state.post.length === 0) {
    console.warn("⚠️  No post content to save.");
    return { publishStatus: "skipped", publishError: "No post content" };
  }

  const { queryOne, insert, query } = await import("../../utils/postgres.js");

  let connectionId: string | null = null;
  if (state.workflowId) {
    const workflow = await queryOne<{ connection_id: string }>(
      `SELECT connection_id FROM workflows WHERE id = $1`,
      [state.workflowId],
    );
    if (workflow?.connection_id) connectionId = workflow.connection_id;
  }

  const draftMetadata = {
    searchQuery: state.searchQuery,
    location: state.location,
    stylePrompt: state.stylePrompt,
    learningContext: state.learningContext || null,
    selectedContent: state.selectedContent || [],
  };

  await insert("posts", {
    workflow_id: state.workflowId || null,
    connection_id: connectionId,
    user_id: state.userId,
    content: state.post,
    platform: state.platform,
    status: "pending_approval",
    source: "workflow",
    image_url: state.imageUrl || state.image?.imageUrl || null,
    draft_metadata: JSON.stringify(draftMetadata),
  });

  // Mark workflow run as completed (not failed) — the run itself succeeded,
  // the post is just awaiting human review. No credits deducted yet.
  if (state.workflowId) {
    await query(
      `UPDATE workflows
          SET run_status = 'completed',
              run_completed_at = NOW(),
              last_error = NULL,
              last_run_at = NOW()
        WHERE id = $1`,
      [state.workflowId],
    );
  }

  console.log("✅ Draft saved as pending_approval. Awaiting human review.");
  return { publishStatus: "skipped" };
}

export const contentAutomationAdvancedGraph = new StateGraph(
  ContentAutomationAdvancedState,
)
  .addNode("loadLearnings", loadLearnings)
  .addNode("fetchContent", fetchContent)
  .addNode("curateContent", curateContent)
  .addNode("checkContentQuality", checkContentQuality)
  .addNode("generateVisuals", generateVisuals)
  .addNode("generatePostSubgraph", generatePostGraph)
  .addNode("prepareCaption", prepareCaption)
  .addNode("publishToInstagram", publishToInstagram)
  .addNode("savePostToDb", savePostToDb)
  .addNode("saveDraftForApproval", saveDraftForApproval)

  .addEdge(START, "loadLearnings")
  .addEdge("loadLearnings", "fetchContent")
  .addEdge("fetchContent", "curateContent")
  .addEdge("curateContent", "checkContentQuality")
  .addConditionalEdges("checkContentQuality", routeContentQuality, {
    fetchContent: "fetchContent",
    generateVisuals: "generateVisuals",
  })
  .addEdge("generateVisuals", "generatePostSubgraph")
  .addEdge("generatePostSubgraph", "prepareCaption")
  .addConditionalEdges("prepareCaption", routePublishing, {
    publishToInstagram: "publishToInstagram",
    saveDraftForApproval: "saveDraftForApproval",
  })
  .addEdge("publishToInstagram", "savePostToDb")
  .addEdge("savePostToDb", END)
  .addEdge("saveDraftForApproval", END)
  .compile();

contentAutomationAdvancedGraph.name = "Content Automation Advanced Graph";
