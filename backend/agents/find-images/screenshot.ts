import { fileTypeFromBuffer } from "file-type";
import type { BrowserContextOptions, PageScreenshotOptions } from "playwright";
import {
  getRepoContents,
  getFileContents,
} from "../../utils/github-repo-contents.js";
import { takeScreenshot } from "../../utils/screenshot.js";
import {
  GITHUB_SCREENSHOT_OPTIONS,
  GITHUB_BROWSER_CONTEXT_OPTIONS,
} from "../generate-post/constants.js";
import { getUrlType } from "../utils.js";

/**
 * Take a screenshot of a URL and return it as a base64 data URL.
 * @param url The URL to take a screenshot of
 * @returns {Promise<string | undefined>} A base64 data URL of the screenshot or undefined if the screenshot could not be taken
 */
export async function takeScreenshotAndUpload(
  url: string,
): Promise<string | undefined> {
  const screenshotUrl = await getUrlForScreenshot(url);
  const urlType = getUrlType(url);
  if (!screenshotUrl) {
    console.warn("No screenshot URL found for", url);
    return undefined;
  }

  let screenshotOptions: PageScreenshotOptions = {};
  let browserContextOptions: BrowserContextOptions = {};
  if (urlType === "github") {
    // We want to clip GitHub screenshots to only include the README contents.
    screenshotOptions = GITHUB_SCREENSHOT_OPTIONS;
    browserContextOptions = GITHUB_BROWSER_CONTEXT_OPTIONS;
  }

  try {
    const screenshotBuffer = await takeScreenshot(screenshotUrl, {
      screenshotOptions,
      browserContextOptions,
    });

    // Detect the file type from the buffer
    const type = await fileTypeFromBuffer(screenshotBuffer);
    if (!type || !type.mime.startsWith("image/")) {
      throw new Error("Invalid image file");
    }

    // Return as base64 data URL
    const base64Data = screenshotBuffer.toString("base64");
    return `data:${type.mime};base64,${base64Data}`;
  } catch (error) {
    console.error("Error taking screenshot:", error);
    // Return undefined instead of throwing to prevent workflow crash
    return undefined;
  }
}

/**
 * Gets the URL for a screenshot given the base URL. Mainly used to either avoid
 * taking a screenshot of a YouTube video, or getting the proper URL for GitHub repos.
 * @param url The URL to take a screenshot of
 * @returns {Promise<string | undefined>} A public URL to use to take the screenshot or undefined if the URL is not supported
 */
async function getUrlForScreenshot(url: string): Promise<string | undefined> {
  const urlType = getUrlType(url);
  // Do not attempt to take a screenshot of YouTube URLs (should get thumbnail instead)
  // or undefined types as those are not supported
  if (!urlType || urlType === "youtube") return undefined;

  if (urlType === "github") {
    const repoContents = await getRepoContents(url);
    const readmePath = repoContents.find(
      (c) =>
        c.name.toLowerCase() === "readme.md" ||
        c.name.toLowerCase() === "readme",
    )?.path;
    // Fallback to root of repo if no README is found.
    if (!readmePath) {
      return url;
    }
    const readmeContents = await getFileContents(url, readmePath);
    // HTML URLs are the public human-readable URL.
    return readmeContents.html_url || url;
  }
  return url;
}
