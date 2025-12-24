import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { z } from "zod";
import { getPrompts } from "../../generate-post/prompts/index.js";
import { VerifyContentAnnotation } from "../shared-state.js";
import { getPageText, skipContentRelevancyCheck } from "../../utils.js";
import {
  getImagesFromFireCrawlMetadata,
  createFireCrawlLoader,
  isFireCrawlConfigured,
} from "../../../utils/firecrawl.js";
import { CurateDataState } from "../../curate-data/state.js";
import { shouldExcludeGeneralContent } from "../../should-exclude.js";
import { traceable } from "langsmith/traceable";
import { verifyContentIsRelevant } from "./verify-content.js";

const RELEVANCY_SCHEMA = z
  .object({
    reasoning: z
      .string()
      .describe(
        "Reasoning for why the webpage is or isn't relevant to your company's products.",
      ),
    relevant: z
      .boolean()
      .describe(
        "Whether or not the webpage is relevant to your company's products.",
      ),
  })
  .describe("The relevancy of the content to your company's products.");

const VERIFY_COMPANY_RELEVANT_CONTENT_PROMPT = `You are a highly regarded marketing employee.
You're provided with a webpage containing content a third party submitted to you claiming it's relevant to your business context.
Your task is to carefully read over the entire page, and determine whether or not the content is actually relevant to your context.

${getPrompts().businessContext}

${getPrompts().contentValidationPrompt}

Given this context, examine the webpage content closely, and determine if the content is relevant to your context.
You should provide reasoning as to why or why not the content is relevant to your context, then a simple true or false for whether or not it is relevant.`;

type UrlContents = {
  content: string;
  imageUrls?: string[];
};

async function getUrlContentsFunc(url: string): Promise<UrlContents> {
  // Check if URL is from a platform that commonly blocks scrapers
  const isProtectedPlatform =
    /instagram\.com|facebook\.com|twitter\.com|x\.com/i.test(url);

  if (isProtectedPlatform) {
    console.log(`⚠️  Skipping FireCrawl for protected platform: ${url}`);
    console.log(`   Using basic scrape method instead...`);

    try {
      const text = await getPageText(url);
      if (text) {
        return { content: text };
      }
    } catch (e: any) {
      console.warn(`⚠️  Basic scrape also failed for ${url}: ${e.message}`);
      throw new Error(`Failed to fetch content from ${url}.`);
    }
  }

  // Try FireCrawl for other URLs if configured
  if (isFireCrawlConfigured()) {
    try {
      const loader = createFireCrawlLoader(url, {
        formats: ["markdown", "screenshot"],
      });
      const docs = await loader.load();

      const docsText = docs.map((d) => d.pageContent).join("\n");
      if (docsText.length) {
        return {
          content: docsText,
          imageUrls: docs.flatMap(
            (d) => getImagesFromFireCrawlMetadata(d.metadata) || [],
          ),
        };
      }
    } catch (e: any) {
      // Only log the error message, not the full stack trace for cleaner logs
      const errorMsg = e.message || String(e);
      console.log(`⚠️  FireCrawl failed for ${url}: ${errorMsg}`);
      console.log(`   Falling back to basic scrape...`);
    }
  } else {
    console.log(`⚠️  FireCrawl not configured, using basic scrape for ${url}`);
  }

  // Fallback to basic scraping
  try {
    const text = await getPageText(url);
    if (text) {
      return { content: text };
    }
  } catch (e: any) {
    console.warn(`❌ Basic scrape also failed for ${url}: ${e.message}`);
  }

  throw new Error(`Failed to fetch content from ${url}.`);
}

export const getUrlContents = traceable(getUrlContentsFunc, {
  name: "get-url-contents",
});

/**
 * Verifies if the general content from a provided URL is relevant to your company's products.
 *
 * @param state - The current state containing the link to verify.
 * @param config - Configuration for the LangGraph runtime.
 * @returns An object containing relevant links and page contents if the content is relevant;
 * otherwise, returns empty arrays.
 */
export async function verifyGeneralContent(
  state: typeof VerifyContentAnnotation.State,
  config: LangGraphRunnableConfig,
): Promise<Partial<CurateDataState>> {
  const shouldExclude = shouldExcludeGeneralContent(state.link);
  if (shouldExclude) {
    return {};
  }

  let urlContents;
  try {
    urlContents = await getUrlContents(state.link);
  } catch (e: any) {
    console.warn(`❌ Failed to fetch content for ${state.link}: ${e.message}`);
    console.log(`   Skipping this URL...`);
    return {
      relevantLinks: [],
      pageContents: [],
    };
  }

  const returnValue = {
    relevantLinks: [state.link],
    pageContents: [urlContents.content],
    ...(urlContents.imageUrls?.length
      ? { imageOptions: urlContents.imageUrls }
      : {}),
  };

  if (await skipContentRelevancyCheck(config.configurable)) {
    return returnValue;
  }

  if (
    await verifyContentIsRelevant(urlContents.content, {
      systemPrompt: VERIFY_COMPANY_RELEVANT_CONTENT_PROMPT,
      schema: RELEVANCY_SCHEMA,
    })
  ) {
    return returnValue;
  }

  // Not relevant, return empty arrays so this URL is not included.
  return {
    relevantLinks: [],
    pageContents: [],
  };
}
