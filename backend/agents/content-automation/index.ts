import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import { InstagramClient } from "../../clients/instagram/client.js";

// Define the state for our graph
const ContentAutomationState = Annotation.Root({
  // Inputs
  searchQuery: Annotation<string>,
  location: Annotation<string>,
  stylePrompt: Annotation<string>,
  platform: Annotation<"instagram" | "twitter" | "slack">,
  credentials: Annotation<any>, // JSON object with username/password/tokens

  // Internal/Outputs
  events: Annotation<any[]>,
  selectedContent: Annotation<any[]>,
  imageUrl: Annotation<string>,
  caption: Annotation<string>,
});

// Node to find content
async function fetchContent(state: typeof ContentAutomationState.State) {
  console.log(
    `Fetching content for query: ${state.searchQuery} in ${state.location}`,
  );

  const SERPER_API_KEY = process.env.SERPER_API_KEY;
  if (!SERPER_API_KEY) {
    console.warn("SERPER_API_KEY not found. Using mock data.");
    return {
      events: [
        {
          title: "Mock Event 1",
          date: "Tomorrow",
          link: "https://example.com/1",
        },
        {
          title: "Mock Event 2",
          date: "Weekend",
          link: "https://example.com/2",
        },
      ],
    };
  }

  try {
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": SERPER_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: `${state.searchQuery} ${state.location}`,
        num: 10,
      }),
    });

    const data = await response.json();
    return { events: data.organic || [] };
  } catch (error) {
    console.error("Error fetching content:", error);
    return { events: [] };
  }
}

// Node to curate content
async function curateContent(state: typeof ContentAutomationState.State) {
  console.log("Curating content...");
  const llm = new ChatOpenAI({
    modelName: process.env.LLM_MODEL || "gpt-4o-mini",
    temperature: 0,
    apiKey: process.env.OPENAI_API_KEY,
  });

  const prompt = `
    You are a content curator.
    Style/Tone: ${state.stylePrompt || "Professional and engaging"}
    
    Review the following search results:
    ${JSON.stringify(state.events)}

    Select the top 3-5 most relevant items.
    Return a JSON array of objects with 'title', 'date', and 'link'.
  `;

  try {
    const response = await llm.invoke([new HumanMessage(prompt)]);
    const content = response.content.toString();
    const jsonMatch = content.match(/\[.*\]/s);
    const selectedContent = jsonMatch
      ? JSON.parse(jsonMatch[0])
      : state.events.slice(0, 3);
    return { selectedContent };
  } catch (e) {
    console.error("Error parsing curated content", e);
    return { selectedContent: state.events.slice(0, 3) };
  }
}

// Node to generate visuals
async function generateVisuals(state: typeof ContentAutomationState.State) {
  console.log("Generating visuals...");

  try {
    const { generateImage } = await import("../../utils/image-generation.js");

    const prompt = `A social media post image. Style: ${state.stylePrompt}. Context: ${state.searchQuery}${state.location ? ` in ${state.location}` : ""}. High quality, aesthetic.`;

    const result = await generateImage({
      prompt,
    });

    return { imageUrl: result.imageUrl };
  } catch (error: any) {
    console.error("❌ Error generating image:", error.message);
    console.warn("Using placeholder image");
    const { getPlaceholderImageUrl } = await import(
      "../../utils/image-generation.js"
    );
    return { imageUrl: getPlaceholderImageUrl("Content+Automation") };
  }
}

// Node to prepare caption
async function prepareCaption(state: typeof ContentAutomationState.State) {
  console.log("Preparing caption...");
  let caption = `${state.searchQuery} Update!\n\n`;

  state.selectedContent.forEach((item: any) => {
    caption += `🔹 ${item.title}\n🔗 ${item.link}\n\n`;
  });

  caption += `#${state.location.replace(/\s/g, "")} #${state.platform}`;
  return { caption };
}

// Node to publish content
async function publishContent(state: typeof ContentAutomationState.State) {
  console.log(`Publishing to ${state.platform}...`);

  if (state.platform === "instagram") {
    const client = new InstagramClient();
    try {
      const imageResponse = await fetch(state.imageUrl);
      const arrayBuffer = await imageResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      await client.uploadPhoto({
        photo: buffer,
        caption: state.caption,
        credentials: state.credentials,
      });
      console.log("Successfully uploaded to Instagram!");
    } catch (error) {
      console.error("Failed to upload to Instagram:", error);
    }
  } else {
    console.log(`Platform ${state.platform} not yet implemented.`);
  }
  return {};
}

// Create the graph
export const contentAutomationGraph = new StateGraph(ContentAutomationState)
  .addNode("fetchContent", fetchContent)
  .addNode("curateContent", curateContent)
  .addNode("generateVisuals", generateVisuals)
  .addNode("prepareCaption", prepareCaption)
  .addNode("publishContent", publishContent)
  .addEdge(START, "fetchContent")
  .addEdge("fetchContent", "curateContent")
  .addEdge("curateContent", "generateVisuals")
  .addEdge("generateVisuals", "prepareCaption")
  .addEdge("prepareCaption", "publishContent")
  .addEdge("publishContent", END)
  .compile();

contentAutomationGraph.name = "Content Automation Graph";
