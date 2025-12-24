import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  isGeminiConfigured,
  generateTextWithGrounding,
  generateImageWithGrounding,
  isGeminiModel,
} from "../../../lib/gemini";

const SERPER_API_KEY = process.env.SERPER_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const AI_PROVIDER = process.env.AI_PROVIDER || "openai";
const USE_GOOGLE_SEARCH_GROUNDING =
  process.env.USE_GOOGLE_SEARCH_GROUNDING === "true";

// Configuration
const MAX_SEARCH_QUERIES = 2; // Limit number of parallel searches
const RESULTS_PER_QUERY = 5; // Results per search query

// Credits required for generating content ideas
const CREDITS_PER_GENERATION = 1;

interface ContentItem {
  title: string;
  snippet: string;
  link: string;
  source?: string;
  date?: string;
  imageUrl?: string;
}

interface GeneratedIdea {
  title: string;
  caption: string;
  hashtags: string[];
  style: string;
  imageUrl?: string;
}

async function searchWithSerper(query: string): Promise<ContentItem[]> {
  if (!SERPER_API_KEY) throw new Error("SERPER_API_KEY not configured");

  // Get date range for last 7 days
  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 7);
  const dateRange = `${sevenDaysAgo.toISOString().split("T")[0]}..${today.toISOString().split("T")[0]}`;

  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": SERPER_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: `${query} after:${sevenDaysAgo.toISOString().split("T")[0]}`,
      num: RESULTS_PER_QUERY,
      type: "news",
      tbs: "qdr:w", // Last week filter
    }),
  });

  if (!response.ok) throw new Error(`Serper API returned ${response.status}`);

  const data = await response.json();
  const results = data.news || data.organic || [];

  console.log(
    `[Serper] Found ${results.length} recent results for query: ${query}`,
  );

  return results.map((item: any) => ({
    title: item.title,
    snippet: item.snippet || item.description || "",
    link: item.link,
    source: item.source || new URL(item.link).hostname.replace("www.", ""),
    date: item.date,
    imageUrl: item.imageUrl || item.thumbnail,
  }));
}

async function searchWithTavily(query: string): Promise<ContentItem[]> {
  if (!TAVILY_API_KEY) throw new Error("TAVILY_API_KEY not configured");

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      api_key: TAVILY_API_KEY,
      query: query,
      search_depth: "basic",
      include_answer: false,
      include_images: true,
      include_raw_content: false,
      max_results: RESULTS_PER_QUERY,
      days: 7, // Only last 7 days
    }),
  });

  if (!response.ok) throw new Error(`Tavily API returned ${response.status}`);

  const data = await response.json();

  console.log(
    `[Tavily] Found ${data.results?.length || 0} recent results for query: ${query}`,
  );

  // Filter results to only include items from the last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const recentResults = data.results.filter((item: any) => {
    if (!item.published_date) return true; // Include if no date
    const publishDate = new Date(item.published_date);
    return publishDate >= sevenDaysAgo;
  });

  console.log(
    `[Tavily] Filtered to ${recentResults.length} results from last 7 days`,
  );

  return recentResults.map((item: any) => ({
    title: item.title,
    snippet: item.content,
    link: item.url,
    source: new URL(item.url).hostname.replace("www.", ""),
    date: item.published_date,
    imageUrl: item.image || item.thumbnail,
  }));
}

async function searchWithPerplexity(query: string): Promise<ContentItem[]> {
  if (!PERPLEXITY_API_KEY) throw new Error("PERPLEXITY_API_KEY not configured");

  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.1-sonar-small-128k-online",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful news assistant. Search for the latest and most recent news (from the last 7 days only) about the user's query. Return a list of 5-10 specific recent news items with titles, brief snippets, publication dates, and source URLs. Format the output as a JSON array of objects with keys: title, snippet, link, source, date.",
        },
        {
          role: "user",
          content: `Find the most recent trending news from the last week about: ${query}`,
        },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok)
    throw new Error(`Perplexity API returned ${response.status}`);

  const data = await response.json();
  const content = data.choices[0]?.message?.content || "[]";

  // Attempt to parse JSON from the response
  try {
    // Extract JSON if it's wrapped in code blocks
    const jsonMatch =
      content.match(/```json\n?([\s\S]*?)\n?```/) ||
      content.match(/\[[\s\S]*\]/);
    const jsonStr = jsonMatch
      ? jsonMatch[0].replace(/```json|```/g, "")
      : content;
    const items = JSON.parse(jsonStr);

    if (Array.isArray(items)) {
      return items.map((item: any) => ({
        title: item.title || "No Title",
        snippet: item.snippet || item.description || "",
        link: item.link || item.url || "#",
        source: item.source || "Perplexity",
        date: item.date,
      }));
    }
  } catch (e) {
    console.warn(
      "Failed to parse Perplexity JSON response, returning raw text as one item",
      e,
    );
  }

  return [
    {
      title: "Perplexity Search Result",
      snippet: content.substring(0, 200) + "...",
      link: "#",
      source: "Perplexity",
    },
  ];
}

async function fetchTrendingContent(
  query: string,
  provider: string = "auto",
): Promise<ContentItem[]> {
  let results: ContentItem[] = [];
  let errors: string[] = [];

  // Try specific provider if requested
  if (provider === "serper" && SERPER_API_KEY) {
    try {
      return await searchWithSerper(query);
    } catch (e: any) {
      errors.push(`Serper: ${e.message}`);
    }
  }
  if (provider === "tavily" && TAVILY_API_KEY) {
    try {
      return await searchWithTavily(query);
    } catch (e: any) {
      errors.push(`Tavily: ${e.message}`);
    }
  }
  if (provider === "perplexity" && PERPLEXITY_API_KEY) {
    try {
      return await searchWithPerplexity(query);
    } catch (e: any) {
      errors.push(`Perplexity: ${e.message}`);
    }
  }

  // Auto mode or fallback: try available providers in order
  if (SERPER_API_KEY) {
    try {
      return await searchWithSerper(query);
    } catch (e: any) {
      errors.push(`Serper: ${e.message}`);
    }
  }
  if (TAVILY_API_KEY) {
    try {
      return await searchWithTavily(query);
    } catch (e: any) {
      errors.push(`Tavily: ${e.message}`);
    }
  }
  if (PERPLEXITY_API_KEY) {
    try {
      return await searchWithPerplexity(query);
    } catch (e: any) {
      errors.push(`Perplexity: ${e.message}`);
    }
  }

  // If all failed or no keys, return mock data
  console.warn("All search providers failed or unconfigured:", errors);
  return [
    {
      title: "Mock Data: AI Revolution",
      snippet:
        "Real search failed. Please configure SERPER_API_KEY, TAVILY_API_KEY, or PERPLEXITY_API_KEY.",
      link: "https://example.com/ai-news-1",
      source: "System",
    },
    {
      title: "Mock Data: Future of Work",
      snippet:
        "This is placeholder content because no search provider API keys are valid.",
      link: "https://example.com/remote-work",
      source: "System",
    },
  ];
}

/**
 * Generate post ideas using Gemini with Google Search grounding
 * This provides real-time, up-to-date information for trending content
 */
async function generatePostIdeasWithGemini(
  content: ContentItem[],
  category: string,
): Promise<GeneratedIdea[]> {
  try {
    const contentSummary = content
      .slice(0, 5)
      .map((item) => `- ${item.title}: ${item.snippet}`)
      .join("\n");

    const systemPrompt =
      "You are a creative social media content strategist. You MUST respond with ONLY a valid JSON array, no other text before or after.";

    const prompt = `Based on the following trending content about "${category}", generate 3 unique post ideas for social media (Instagram/LinkedIn/Twitter).

${USE_GOOGLE_SEARCH_GROUNDING ? "Use Google Search to find the latest real-time information, trends, and data to make these post ideas as current and relevant as possible." : ""}

Trending Content:
${contentSummary}

For each post idea, provide:
1. A short catchy title (3-5 words)
2. An engaging caption (100-200 characters) that includes emojis and a call-to-action
3. 5 relevant hashtags (without the # symbol)
4. The post style (Inspirational, Educational, Casual, or Professional)

CRITICAL: Return ONLY a valid JSON array with no markdown, no explanations, no text before or after. Example format:
[{"title":"Example Title","caption":"Example caption 💡","hashtags":["example","social"],"style":"Professional"}]`;

    let responseText: string;
    let groundingMetadata: any = null;

    // Use Google Search grounding if enabled
    if (USE_GOOGLE_SEARCH_GROUNDING) {
      console.log(
        "🔍 [Gemini] Using Google Search grounding for real-time content ideas",
      );
      const result = await generateTextWithGrounding(prompt, systemPrompt, {
        temperature: 0.8,
        maxTokens: 1000,
      });
      responseText = result.text;
      groundingMetadata = result.groundingMetadata;

      if (groundingMetadata) {
        console.log(
          "✅ [Gemini] Grounding metadata received:",
          JSON.stringify(groundingMetadata, null, 2),
        );
      }
    } else {
      const { generateTextWithGemini } = await import("../../../lib/gemini");
      responseText = await generateTextWithGemini(prompt, systemPrompt, {
        temperature: 0.8,
        maxTokens: 1000,
      });
    }

    // Strip any markdown code blocks and validate response
    let cleanedResponse = responseText.replace(/```json\n?|```/g, "").trim();

    // Log the raw response for debugging
    console.log("🔍 [Gemini Response]:", cleanedResponse.substring(0, 200));

    // Handle empty or incomplete responses
    if (!cleanedResponse || cleanedResponse.length < 10) {
      console.error("❌ [Gemini] Empty or incomplete response");
      throw new Error("Gemini returned an empty response");
    }

    // Try to extract JSON if it's embedded in text
    const jsonMatch = cleanedResponse.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      cleanedResponse = jsonMatch[0];
    }

    let ideas;
    try {
      ideas = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error("❌ [Gemini] Failed to parse JSON:", cleanedResponse);
      throw new Error(
        "Gemini response is not valid JSON. Response: " +
          cleanedResponse.substring(0, 500),
      );
    }

    // Validate ideas array
    if (!Array.isArray(ideas) || ideas.length === 0) {
      console.error("❌ [Gemini] Invalid ideas format:", ideas);
      throw new Error("Gemini did not return a valid array of ideas");
    }

    // Generate images for each idea using Gemini image generation with grounding
    const ideasWithImages = await Promise.all(
      ideas.map(async (idea: GeneratedIdea) => {
        try {
          // Generate image prompt based on the post idea
          const imagePrompt = `A professional social media post image for ${idea.title}. Style: ${idea.style}. Topic: ${category}. High quality, visually appealing, suitable for social media platforms.`;

          let imageUrl = `https://picsum.photos/seed/${encodeURIComponent(idea.title)}/400/300`;

          // Use Gemini image generation with grounding if enabled
          if (USE_GOOGLE_SEARCH_GROUNDING) {
            try {
              console.log(
                `🖼️  [Gemini] Generating image with Google Search grounding: "${idea.title}"`,
              );
              const images = await generateImageWithGrounding(imagePrompt, {
                aspectRatio: "1:1",
              });

              if (images.length > 0) {
                imageUrl = images[0].imageUrl;
                console.log(
                  `✅ [Gemini] Image generated successfully with grounding`,
                );
              }
            } catch (imgError) {
              console.warn(
                `⚠️  [Gemini] Image generation failed, using placeholder:`,
                imgError,
              );
            }
          }

          return {
            ...idea,
            imageUrl,
          };
        } catch (error) {
          console.warn(
            "Failed to generate image for idea, using placeholder:",
            error,
          );
          return {
            ...idea,
            imageUrl: `https://picsum.photos/seed/${encodeURIComponent(idea.title)}/400/300`,
          };
        }
      }),
    );

    return ideasWithImages;
  } catch (error) {
    console.error("Error generating ideas with Gemini:", error);
    throw error;
  }
}

/**
 * Generate post ideas using OpenAI
 */
async function generatePostIdeasWithOpenAI(
  content: ContentItem[],
  category: string,
): Promise<GeneratedIdea[]> {
  if (!OPENAI_API_KEY) {
    console.warn("OPENAI_API_KEY not configured, returning mock ideas");
    return [
      {
        title: "Mock Idea 1",
        caption: "This is a mock caption because OPENAI_API_KEY is missing.",
        hashtags: ["Mock", "Test"],
        style: "Casual",
      },
    ];
  }

  try {
    const contentSummary = content
      .slice(0, 5)
      .map((item) => `- ${item.title}: ${item.snippet}`)
      .join("\n");

    const prompt = `You are a social media content strategist. Based on the following trending content about "${category}", generate 3 unique post ideas for social media (Instagram/LinkedIn/Twitter).

Trending Content:
${contentSummary}

For each post idea, provide:
1. A short catchy title (3-5 words)
2. An engaging caption (100-200 characters) that includes emojis and a call-to-action
3. 5 relevant hashtags (without the # symbol)
4. The post style (Inspirational, Educational, Casual, or Professional)

Return the response as a JSON array with objects containing: title, caption, hashtags (array), and style fields.
Only return valid JSON, no markdown or additional text.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.LLM_MODEL || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a creative social media content strategist. Always respond with valid JSON only.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.8,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API returned ${response.status}`);
    }

    const data = await response.json();
    let content_response = data.choices[0]?.message?.content || "[]";

    // Strip any markdown code blocks
    content_response = content_response.replace(/```json\n?|```/g, "").trim();

    const ideas = JSON.parse(content_response);

    // Add placeholder images for each idea based on style
    return ideas.map((idea: GeneratedIdea, index: number) => ({
      ...idea,
      imageUrl: `https://picsum.photos/seed/${encodeURIComponent(idea.title)}/400/300`,
    }));
  } catch (error) {
    console.error("Error generating ideas with OpenAI:", error);
    throw error;
  }
}

/**
 * Main function to generate post ideas - routes to appropriate provider
 */
async function generatePostIdeas(
  content: ContentItem[],
  category: string,
): Promise<GeneratedIdea[]> {
  const useGemini = AI_PROVIDER === "gemini" || isGeminiModel();

  if (useGemini && isGeminiConfigured()) {
    console.log("🚀 [Content Ideas] Using Gemini for post idea generation");
    return generatePostIdeasWithGemini(content, category);
  } else {
    console.log("🚀 [Content Ideas] Using OpenAI for post idea generation");
    return generatePostIdeasWithOpenAI(content, category);
  }
}

// Helper to check and deduct credits
async function checkAndDeductCredits(
  userId: string,
  amount: number,
  description: string,
): Promise<{ success: boolean; error?: string; balance?: number }> {
  // Check current credits
  const { data: credits, error: creditsError } = await supabaseAdmin
    .from("user_credits")
    .select("credits_balance, bonus_credits")
    .eq("user_id", userId)
    .single();

  if (creditsError || !credits) {
    // Try to initialize credits for new user
    try {
      await supabaseAdmin.rpc("initialize_user_credits", {
        p_user_id: userId,
        p_plan_slug: "free",
      });
      // Fetch again after initialization
      const { data: newCredits } = await supabaseAdmin
        .from("user_credits")
        .select("credits_balance, bonus_credits")
        .eq("user_id", userId)
        .single();

      if (!newCredits) {
        return { success: false, error: "Failed to initialize credits" };
      }

      const totalCredits =
        (newCredits.credits_balance || 0) + (newCredits.bonus_credits || 0);
      if (totalCredits < amount) {
        return {
          success: false,
          error: `Insufficient credits. You have ${totalCredits} credits, need ${amount}.`,
          balance: totalCredits,
        };
      }
    } catch {
      return { success: false, error: "Failed to check credits" };
    }
  } else {
    const totalCredits =
      (credits.credits_balance || 0) + (credits.bonus_credits || 0);
    if (totalCredits < amount) {
      return {
        success: false,
        error: `Insufficient credits. You have ${totalCredits} credits, need ${amount}.`,
        balance: totalCredits,
      };
    }
  }

  // Deduct credits
  try {
    await supabaseAdmin.rpc("deduct_credits", {
      p_user_id: userId,
      p_amount: amount,
      p_description: description,
    });

    // Get updated balance
    const { data: updatedCredits } = await supabaseAdmin
      .from("user_credits")
      .select("credits_balance, bonus_credits")
      .eq("user_id", userId)
      .single();

    const newBalance =
      (updatedCredits?.credits_balance || 0) +
      (updatedCredits?.bonus_credits || 0);
    return { success: true, balance: newBalance };
  } catch (error) {
    console.error("Failed to deduct credits:", error);
    return { success: false, error: "Failed to deduct credits" };
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    const body = await request.json();
    const { action, query, content, category, provider, interests } = body;

    if (action === "fetch") {
      console.log(`[Content Ideas API] Fetch action initiated`);
      let searchQueries: string[] = [];

      // 1. Determine what to search for
      if (query) {
        console.log(`[Content Ideas API] Direct query: "${query}"`);
        searchQueries = [query];
      } else if (
        interests &&
        Array.isArray(interests) &&
        interests.length > 0
      ) {
        console.log(
          `[Content Ideas API] Using interests: ${interests.join(", ")}`,
        );
        // Agentic Step: Generate smart search queries based on interests
        const useGemini = AI_PROVIDER === "gemini" || isGeminiModel();

        if (useGemini && isGeminiConfigured()) {
          try {
            console.log(
              `[Content Ideas API] Generating smart search queries with Gemini...`,
            );
            const systemPrompt =
              "You are a helpful assistant. Return valid JSON array only.";
            const prompt = `You are a trend spotter. The user is interested in: ${interests.join(", ")}.
Generate 3 specific, trending search queries to find the latest news and content for them.
Return ONLY a JSON array of strings. Example: ["latest AI tools 2024", "SpaceX Starship update", "React 19 features"]`;

            let responseText: string;
            if (USE_GOOGLE_SEARCH_GROUNDING) {
              const result = await generateTextWithGrounding(
                prompt,
                systemPrompt,
                { temperature: 0.7 },
              );
              responseText = result.text;
            } else {
              const { generateTextWithGemini } = await import(
                "../../../lib/gemini"
              );
              responseText = await generateTextWithGemini(
                prompt,
                systemPrompt,
                { temperature: 0.7 },
              );
            }

            const jsonStr = responseText.replace(/```json\n?|```/g, "").trim();
            searchQueries = JSON.parse(jsonStr);
            console.log(
              `[Content Ideas API] Generated queries with Gemini: ${searchQueries.join(", ")}`,
            );
          } catch (e) {
            console.error(
              "Failed to generate smart queries with Gemini, falling back to raw interests",
              e,
            );
            searchQueries = interests;
          }
        } else if (OPENAI_API_KEY) {
          try {
            console.log(
              `[Content Ideas API] Generating smart search queries with OpenAI...`,
            );
            const prompt = `You are a trend spotter. The user is interested in: ${interests.join(", ")}.
Generate 3 specific, trending search queries to find the latest news and content for them.
Return ONLY a JSON array of strings. Example: ["latest AI tools 2024", "SpaceX Starship update", "React 19 features"]`;

            const response = await fetch(
              "https://api.openai.com/v1/chat/completions",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${OPENAI_API_KEY}`,
                },
                body: JSON.stringify({
                  model: process.env.LLM_MODEL || "gpt-4o-mini",
                  messages: [
                    {
                      role: "system",
                      content:
                        "You are a helpful assistant. Return valid JSON array only.",
                    },
                    { role: "user", content: prompt },
                  ],
                  temperature: 0.7,
                }),
              },
            );

            const data = await response.json();
            const content = data.choices[0]?.message?.content || "[]";
            const jsonStr = content.replace(/```json\n?|```/g, "").trim();
            searchQueries = JSON.parse(jsonStr);
            console.log(
              `[Content Ideas API] Generated queries with OpenAI: ${searchQueries.join(", ")}`,
            );
          } catch (e) {
            console.error(
              "Failed to generate smart queries with OpenAI, falling back to raw interests",
              e,
            );
            searchQueries = interests;
          }
        } else {
          console.log(
            `[Content Ideas API] No AI provider configured, using raw interests as queries`,
          );
          searchQueries = interests;
        }
      } else {
        return NextResponse.json(
          { error: "Query or interests are required" },
          { status: 400 },
        );
      }

      // 2. Execute searches (parallel)
      // Limit queries to avoid rate limits and reduce total results
      const queriesToRun = searchQueries.slice(0, MAX_SEARCH_QUERIES);
      console.log(
        `[Content Ideas API] Executing ${queriesToRun.length} searches (${RESULTS_PER_QUERY} results each): ${queriesToRun.join(", ")}`,
      );
      const resultsPromises = queriesToRun.map((q) =>
        fetchTrendingContent(q, provider),
      );
      const resultsArrays = await Promise.all(resultsPromises);

      // 3. Flatten and Deduplicate
      const allContent = resultsArrays.flat();
      console.log(`[Content Ideas API] Got ${allContent.length} total results`);
      const seenLinks = new Set();
      const uniqueContent = allContent.filter((item) => {
        if (seenLinks.has(item.link)) return false;
        seenLinks.add(item.link);
        return true;
      });
      console.log(
        `[Content Ideas API] Returning ${uniqueContent.length} unique results`,
      );

      return NextResponse.json({
        success: true,
        content: uniqueContent,
        queries: queriesToRun,
      });
    }

    if (action === "generate") {
      console.log(`[Content Ideas API] Generate action initiated`);

      // Require authentication for generating ideas (costs credits)
      if (!userId) {
        return NextResponse.json(
          { error: "Authentication required to generate content ideas" },
          { status: 401 },
        );
      }

      if (!content || !Array.isArray(content) || content.length === 0) {
        return NextResponse.json(
          { error: "Content array is required" },
          { status: 400 },
        );
      }

      // Check credits before generating
      const { data: credits } = await supabaseAdmin
        .from("user_credits")
        .select("credits_balance, bonus_credits")
        .eq("user_id", userId)
        .single();

      const currentBalance =
        (credits?.credits_balance || 0) + (credits?.bonus_credits || 0);

      if (currentBalance < CREDITS_PER_GENERATION) {
        return NextResponse.json(
          {
            error: "Insufficient credits",
            message: `You need at least ${CREDITS_PER_GENERATION} credit to generate content ideas. You have ${currentBalance} credits remaining.`,
            credits_remaining: currentBalance,
            credits_required: CREDITS_PER_GENERATION,
          },
          { status: 402 }, // Payment Required
        );
      }

      // Use interests context if available, otherwise category
      const context =
        interests && interests.length > 0
          ? interests.join(", ")
          : category || "trending topics";
      console.log(
        `[Content Ideas API] Generating post ideas for context: ${context} from ${content.length} articles`,
      );

      // Generate ideas first
      const ideas = await generatePostIdeas(content, context);
      console.log(`[Content Ideas API] Generated ${ideas.length} post ideas`);

      // Deduct credits ONLY after successful generation
      const creditResult = await checkAndDeductCredits(
        userId,
        CREDITS_PER_GENERATION,
        `Content Ideas: Generated ${ideas.length} ideas for "${context}"`,
      );

      if (!creditResult.success) {
        console.warn(
          "Failed to deduct credits after generation:",
          creditResult.error,
        );
        // Still return ideas since generation was successful
      }

      return NextResponse.json({
        success: true,
        ideas,
        credits_used: CREDITS_PER_GENERATION,
        credits_remaining: creditResult.balance,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Content Ideas API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
