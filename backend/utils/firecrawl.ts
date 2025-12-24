import { FireCrawlLoader } from "@langchain/community/document_loaders/web/firecrawl";

/**
 * Extracts image URLs from FireCrawl metadata by combining both regular image and OpenGraph image fields.
 * @param {any} metadata - The metadata object from FireCrawl containing potential image information
 * @param {string[]} [metadata.image] - Optional array of regular image URLs
 * @param {string} [metadata.ogImage] - Optional OpenGraph image URL
 * @returns {string[] | undefined} An array of image URLs if any images are found, undefined otherwise
 */
export function getImagesFromFireCrawlMetadata(
  metadata: any,
): string[] | undefined {
  const image = metadata.image || [];
  const ogImage = metadata.ogImage ? [metadata.ogImage] : [];
  if (image?.length || ogImage?.length) {
    return [...ogImage, ...image];
  }
  return undefined;
}

/**
 * Gets the FireCrawl API key from environment variables.
 * Checks multiple possible environment variable names for flexibility.
 */
export function getFireCrawlApiKey(): string | undefined {
  return process.env.FIRECRAWL_API_KEY || process.env.FIRE_CRAWL_API_KEY;
}

/**
 * Checks if FireCrawl is configured (API key is available)
 */
export function isFireCrawlConfigured(): boolean {
  const apiKey = getFireCrawlApiKey();
  return !!apiKey && apiKey.length > 0;
}

/**
 * Creates a FireCrawlLoader with explicit API key configuration.
 * This ensures the API key is properly passed even in environments where
 * environment variables might not be automatically picked up.
 */
export function createFireCrawlLoader(
  url: string,
  options: {
    mode?: "scrape" | "crawl";
    formats?: ("markdown" | "html" | "rawHtml" | "links" | "screenshot")[];
  } = {},
): FireCrawlLoader {
  const apiKey = getFireCrawlApiKey();

  if (!apiKey) {
    throw new Error(
      "Firecrawl API key not set. You can set it as FIRECRAWL_API_KEY in your .env file.",
    );
  }

  return new FireCrawlLoader({
    url,
    apiKey,
    mode: options.mode || "scrape",
    params: {
      formats: options.formats || ["markdown"],
    },
  });
}
