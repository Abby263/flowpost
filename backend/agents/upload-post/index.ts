import {
  Annotation,
  END,
  LangGraphRunnableConfig,
  START,
  StateGraph,
} from "@langchain/langgraph";
import { TwitterClient } from "../../clients/twitter/client.js";
import { TwitterApi } from "twitter-api-v2";
import { InstagramClient } from "../../clients/instagram/client.js";
import {
  imageUrlToBuffer,
  isTextOnly,
  shouldPostToLinkedInOrg,
  useArcadeAuth,
  useTwitterApiOnly,
} from "../utils.js";
import { CreateMediaRequest } from "../../clients/twitter/types.js";
import { LinkedInClient } from "../../clients/linkedin.js";
import {
  LINKEDIN_ACCESS_TOKEN,
  LINKEDIN_ORGANIZATION_ID,
  LINKEDIN_PERSON_URN,
  POST_TO_LINKEDIN_ORGANIZATION,
  TEXT_ONLY_MODE,
} from "../generate-post/constants.js";
import { SlackClient } from "../../clients/slack/client.js";
import { ComplexPost } from "../shared/nodes/generate-post/types.js";

async function getMediaFromImage(image?: {
  imageUrl: string;
  mimeType: string;
}): Promise<CreateMediaRequest | undefined> {
  if (!image) return undefined;
  const { buffer, contentType } = await imageUrlToBuffer(image.imageUrl);
  return {
    media: buffer,
    mimeType: contentType,
  };
}

function ensureSignature(text: string): string {
  const signature = "Made by the LangChain Community";
  if (text.toLowerCase().includes(signature.toLowerCase())) {
    return text;
  }
  return `${text}\n${signature}`;
}

const UploadPostAnnotation = Annotation.Root({
  post: Annotation<string>,
  /**
   * The complex post, if the user decides to split the URL from the main body.
   *
   * TODO: Refactor the post/complexPost state interfaces to use a single shared interface
   * which includes images too.
   * Tracking issue: https://github.com/langchain-ai/social-media-agent/issues/144
   */
  complexPost: Annotation<ComplexPost | undefined>,
  image: Annotation<
    | {
        imageUrl: string;
        mimeType: string;
      }
    | undefined
  >,
  platform: Annotation<"instagram" | "twitter" | "linkedin" | "slack">,
  credentials: Annotation<any>,
});

const UploadPostGraphConfiguration = Annotation.Root({
  [POST_TO_LINKEDIN_ORGANIZATION]: Annotation<boolean | undefined>,
  /**
   * Whether or not to use text only mode throughout the graph.
   * If true, it will not try to extract, validate, or upload images.
   * Additionally, it will not be able to handle validating YouTube videos.
   * @default false
   */
  [TEXT_ONLY_MODE]: Annotation<boolean | undefined>({
    reducer: (_state, update) => update,
    default: () => false,
  }),
});

interface PostUploadFailureToSlackArgs {
  uploadDestination: "twitter" | "linkedin";
  error: any;
  threadId: string;
  postContent: string | ComplexPost;
  image?: {
    imageUrl: string;
    mimeType: string;
  };
}

async function postUploadFailureToSlack({
  uploadDestination,
  error,
  threadId,
  postContent,
  image,
}: PostUploadFailureToSlackArgs) {
  if (!process.env.SLACK_CHANNEL_ID) {
    console.warn(
      "No SLACK_CHANNEL_ID found in environment variables. Can not send error message to Slack.",
    );
    return;
  }
  const slackClient = new SlackClient();

  const postStr =
    typeof postContent === "string"
      ? `Post:
\`\`\`
${postContent}
\`\`\``
      : `Main post:
\`\`\`
${postContent.main_post}
\`\`\`
Reply post:
\`\`\`
${postContent.reply_post}
\`\`\``;

  const slackMessageContent = `❌ FAILED TO UPLOAD POST TO ${uploadDestination.toUpperCase()} ❌

Error message:
\`\`\`
${error}
\`\`\`

Thread ID: *${threadId}*

${postStr}

${image ? `Image:\nURL: ${image.imageUrl}\nMIME type: ${image.mimeType}` : ""}
`;
  await slackClient.sendMessage(
    process.env.SLACK_CHANNEL_ID,
    slackMessageContent,
  );
}

export async function uploadPost(
  state: typeof UploadPostAnnotation.State,
  config: LangGraphRunnableConfig,
): Promise<Partial<typeof UploadPostAnnotation.State>> {
  if (!state.post) {
    throw new Error("No post text found");
  }
  const isTextOnlyMode = isTextOnly(config);
  const postToLinkedInOrg = shouldPostToLinkedInOrg(config);

  if (state.platform === "instagram") {
    console.log("Uploading to Instagram...");
    const client = new InstagramClient();
    try {
      if (!state.image) {
        throw new Error("Image is required for Instagram posts");
      }

      const imageResponse = await fetch(state.image.imageUrl);
      const arrayBuffer = await imageResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      await client.uploadPhoto({
        photo: buffer,
        caption: state.post,
        credentials: state.credentials,
      });
      console.log("✅ Successfully uploaded to Instagram ✅");
      return {};
    } catch (error: any) {
      console.error("Failed to upload to Instagram:", error);
      await postUploadFailureToSlack({
        uploadDestination: "instagram" as any,
        error: error.message || error,
        threadId: config.configurable?.thread_id || "unknown",
        postContent: state.post,
        image: state.image,
      });
      // Re-throw the error so the run fails properly
      throw error;
    }
  } else if (state.platform === "twitter") {
    try {
      console.log("Uploading to Twitter...");
      let twitterClient: TwitterClient;

      if (state.credentials) {
        const { apiKey, apiKeySecret, accessToken, accessTokenSecret } =
          state.credentials;
        const client = new TwitterApi({
          appKey: apiKey,
          appSecret: apiKeySecret,
          accessToken: accessToken,
          accessSecret: accessTokenSecret,
        });
        twitterClient = new TwitterClient({ twitterClient: client });
      } else if (useTwitterApiOnly() || !useArcadeAuth()) {
        twitterClient = TwitterClient.fromBasicTwitterAuth();
      } else {
        // Arcade fallback (existing logic)
        const twitterUserId = process.env.TWITTER_USER_ID;
        if (!twitterUserId) throw new Error("Twitter user ID not found");
        twitterClient = await TwitterClient.fromArcade(
          twitterUserId,
          {
            twitterToken: process.env.TWITTER_USER_TOKEN,
            twitterTokenSecret: process.env.TWITTER_USER_TOKEN_SECRET,
          },
          { textOnlyMode: isTextOnlyMode },
        );
      }

      let mediaBuffer: CreateMediaRequest | undefined = undefined;
      if (!isTextOnlyMode) {
        mediaBuffer = await getMediaFromImage(state.image);
      }

      if (state.complexPost) {
        await twitterClient.uploadThread([
          {
            text: ensureSignature(state.complexPost.main_post),
            ...(mediaBuffer && { media: mediaBuffer }),
          },
          {
            text: state.complexPost.reply_post,
          },
        ]);
      } else {
        await twitterClient.uploadTweet({
          text: ensureSignature(state.post),
          ...(mediaBuffer && { media: mediaBuffer }),
        });
      }
      console.log("✅ Successfully uploaded Tweet ✅");
    } catch (e: any) {
      console.error("Failed to upload to Twitter:", e);
      await postUploadFailureToSlack({
        uploadDestination: "twitter",
        error: e.message || e,
        threadId: config.configurable?.thread_id || "unknown",
        postContent: state.complexPost || state.post,
        image: state.image,
      });
      // Re-throw the error so the run fails properly
      throw e;
    }
  } else if (state.platform === "linkedin") {
    try {
      console.log("Uploading to LinkedIn...");
      let linkedInClient: LinkedInClient;

      if (state.credentials) {
        linkedInClient = new LinkedInClient({
          accessToken: state.credentials.accessToken,
          personUrn: state.credentials.personUrn,
          organizationId: state.credentials.organizationId,
        });
      } else if (useArcadeAuth()) {
        // Arcade fallback
        const linkedInUserId = process.env.LINKEDIN_USER_ID;
        if (!linkedInUserId) throw new Error("LinkedIn user ID not found");
        linkedInClient = await LinkedInClient.fromArcade(linkedInUserId, {
          postToOrganization: postToLinkedInOrg,
        });
      } else {
        // Env fallback
        const accessToken =
          process.env.LINKEDIN_ACCESS_TOKEN ||
          config.configurable?.[LINKEDIN_ACCESS_TOKEN];
        if (!accessToken) throw new Error("LinkedIn access token not found");
        linkedInClient = new LinkedInClient({
          accessToken,
          personUrn:
            process.env.LINKEDIN_PERSON_URN ||
            config.configurable?.[LINKEDIN_PERSON_URN],
          organizationId:
            process.env.LINKEDIN_ORGANIZATION_ID ||
            config.configurable?.[LINKEDIN_ORGANIZATION_ID],
        });
      }

      if (!isTextOnlyMode && state.image) {
        await linkedInClient.createImagePost(
          {
            text: ensureSignature(state.post),
            imageUrl: state.image.imageUrl,
          },
          { postToOrganization: postToLinkedInOrg },
        );
      } else {
        await linkedInClient.createTextPost(ensureSignature(state.post), {
          postToOrganization: postToLinkedInOrg,
        });
      }
      console.log("✅ Successfully uploaded post to LinkedIn ✅");
    } catch (e: any) {
      console.error("Failed to upload to LinkedIn:", e);
      await postUploadFailureToSlack({
        uploadDestination: "linkedin",
        error: e.message || e,
        threadId: config.configurable?.thread_id || "unknown",
        postContent: state.complexPost || state.post,
        image: state.image,
      });
      // Re-throw the error so the run fails properly
      throw e;
    }
  }

  return {};
}

const uploadPostWorkflow = new StateGraph(
  UploadPostAnnotation,
  UploadPostGraphConfiguration,
)
  .addNode("uploadPost", uploadPost)
  .addEdge(START, "uploadPost")
  .addEdge("uploadPost", END);

export const uploadPostGraph = uploadPostWorkflow.compile();
uploadPostGraph.name = "Upload Post Graph";
