import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import { generatePostGraph } from "../generate-post/generate-post-graph.js";
import { InstagramClient } from "../../clients/instagram/client.js";

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

  const prompt = `
    You are a content curator for social media posts.
    Style/Tone: ${state.stylePrompt || "Professional and engaging"}
    Platform: ${state.platform || "instagram"}
    
    Review the following search results:
    ${JSON.stringify(state.events)}

    Select the top 3-5 most relevant and engaging items that would make great social media content.
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
    const client = new InstagramClient();

    // Download the generated image
    const imageUrl = state.imageUrl || state.image?.imageUrl;
    if (!imageUrl) {
      throw new Error("No image URL available for Instagram post");
    }

    // Only log URL preview, not full base64 data
    if (imageUrl && imageUrl.startsWith("data:")) {
      console.log("📥 Downloading image from: [Base64 data URL]");
    } else {
      console.log("📥 Downloading image from:", imageUrl);
    }
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.statusText}`);
    }

    const arrayBuffer = await imageResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log("📤 Uploading to Instagram...");
    const result = await client.uploadPhoto({
      photo: buffer,
      caption: state.post,
      credentials: state.credentials,
    });

    console.log("✅ Successfully uploaded to Instagram!");
    console.log(`   Media ID: ${result.media?.id || "N/A"}`);
    console.log(
      `   Published URL: https://www.instagram.com/p/${result.media?.code || "N/A"}/`,
    );
    return {
      publishStatus: "success",
      publishedUrl: `https://www.instagram.com/p/${result.media?.code}/`,
    };
  } catch (error: any) {
    console.error("❌ Failed to upload to Instagram:", error);
    console.error("   Error details:", error.message || String(error));

    let userFriendlyError = error.message || String(error);

    // Add helpful context based on error type
    if (
      error.message?.includes("login_required") ||
      error.message?.includes("IgLoginRequiredError")
    ) {
      userFriendlyError =
        `Instagram login failed. This could be due to:\n` +
        `1. Incorrect username or password\n` +
        `2. Instagram security measures detected automated behavior\n` +
        `3. Account requires verification\n\n` +
        `Please:\n` +
        `- Verify your Instagram credentials in Connections\n` +
        `- Try logging in manually through Instagram app first\n` +
        `- Wait 10-15 minutes before trying again`;
    } else if (
      error.message?.includes("verification") ||
      error.message?.includes("challenge")
    ) {
      userFriendlyError =
        `Instagram requires account verification. ` +
        `Please log in through the Instagram app or website to complete the security challenge, then try again.`;
    }

    return {
      publishStatus: "failed",
      publishError: userFriendlyError,
    };
  }
}

// Node to save post to DB and update workflow status
async function savePostToDb(
  state: typeof ContentAutomationAdvancedState.State,
) {
  console.log("--- SAVING POST TO DB ---");

  // Check if Supabase is configured (support both NEXT_PUBLIC and regular env vars)
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn("⚠️  Supabase not configured. Skipping DB save.");
    console.warn(
      "   Set either NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
    console.warn("   OR SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");
    return {};
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Save post to DB if we have content
  if (state.post) {
    try {
      console.log(`   📊 Connecting to Supabase...`);

      // Prepare post data - only include fields if they have values
      const postData: any = {
        workflow_id: state.workflowId,
        user_id: state.userId,
        content: state.post,
        platform: state.platform,
        status: state.publishStatus === "success" ? "published" : "failed",
        posted_at: new Date().toISOString(),
      };

      let connectionId: string | null = null;
      if (state.workflowId) {
        const { data: workflow, error: workflowError } = await supabase
          .from("workflows")
          .select("connection_id")
          .eq("id", state.workflowId)
          .single();

        if (workflowError) {
          console.warn(
            "WARN: Failed to load workflow connection:",
            workflowError.message,
          );
        } else if (workflow?.connection_id) {
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

      const { error } = await supabase.from("posts").insert(postData);

      if (error) {
        console.error("❌ Supabase insert error:", error);
      } else {
        console.log("✅ Post saved to DB successfully.");
      }
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

      const { error: updateError } = await supabase
        .from("workflows")
        .update({
          run_status: finalStatus,
          run_completed_at: new Date().toISOString(),
          last_error: errorMessage,
        })
        .eq("id", state.workflowId);

      if (updateError) {
        console.error("❌ Failed to update workflow status:", updateError);
      } else {
        console.log(`✅ Workflow status updated to: ${finalStatus}`);
      }
    } catch (e) {
      console.error("❌ Failed to update workflow status:", e);
    }
  }

  // Print cost summary
  console.log(`\n
╔═══════════════════════════════════════════════════════════╗
║                    WORKFLOW SUMMARY                       ║
╠═══════════════════════════════════════════════════════════╣`);
  console.log(`║ Workflow: ${state.workflowId?.substring(0, 36) || "N/A"}`);
  console.log(`║ Platform: ${state.platform || "N/A"}`);
  console.log(`║ Status: ${state.publishStatus || "N/A"}`);
  console.log(`╠═══════════════════════════════════════════════════════════╣`);
  console.log(`║               WORKFLOW COMPLETED SUCCESSFULLY             ║`);
  console.log(
    `╚═══════════════════════════════════════════════════════════╝\n`,
  );

  return {};
}

// Node to prepare caption from generated post
async function prepareCaption(
  state: typeof ContentAutomationAdvancedState.State,
) {
  console.log(`\n📝 [PREPARE CAPTION] Preparing post caption...`);

  // If we already have a post from generatePostSubgraph, use it
  if (state.post && state.post.length > 10) {
    console.log(
      `✅ [PREPARE CAPTION] Using existing post (${state.post.length} chars)`,
    );
    console.log(`   Preview: "${state.post.substring(0, 100)}..."`);
    return {};
  }

  console.log(`   📄 Creating caption from report...`);

  // Otherwise, create a simple caption from the report
  let caption = `${state.searchQuery}${state.location ? ` in ${state.location}` : ""}!\n\n`;

  if (state.report) {
    // Extract key points from report
    const lines = state.report
      .split("\n")
      .filter((l) => l.trim().length > 0)
      .slice(0, 5);
    caption += lines.join("\n");
  } else {
    caption += "Check out these amazing updates!";
  }

  // Add hashtags
  const hashtags = [
    state.location ? `#${state.location.replace(/\s/g, "")}` : null,
    `#${state.searchQuery.replace(/\s/g, "").replace(/[^a-zA-Z0-9]/g, "")}`,
    `#${state.platform || "social"}media`,
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
): "publishToInstagram" | "savePostToDb" {
  // If requiresApproval is true, skip publishing and go straight to DB save
  // (In a full implementation, this would go to a human approval node)
  if (state.requiresApproval) {
    console.log("Requires approval - skipping auto-publish");
    return "savePostToDb";
  }

  console.log("Auto-approving post as requiresApproval is false");
  return "publishToInstagram";
}

export const contentAutomationAdvancedGraph = new StateGraph(
  ContentAutomationAdvancedState,
)
  .addNode("fetchContent", fetchContent)
  .addNode("curateContent", curateContent)
  .addNode("checkContentQuality", checkContentQuality)
  .addNode("generateVisuals", generateVisuals)
  .addNode("generatePostSubgraph", generatePostGraph)
  .addNode("prepareCaption", prepareCaption)
  .addNode("publishToInstagram", publishToInstagram)
  .addNode("savePostToDb", savePostToDb)

  .addEdge(START, "fetchContent")
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
    savePostToDb: "savePostToDb",
  })
  .addEdge("publishToInstagram", "savePostToDb")
  .addEdge("savePostToDb", END)
  .compile();

contentAutomationAdvancedGraph.name = "Content Automation Advanced Graph";
