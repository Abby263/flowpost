import {
  Annotation,
  END,
  LangGraphRunnableConfig,
  START,
  StateGraph,
} from "@langchain/langgraph";
import { TwitterOAuthClient } from "../../clients/twitter/oauth-client.js";
import { InstagramGraphClient } from "../../clients/instagram/graph-client.js";
import { LinkedInOAuthClient } from "../../clients/linkedin-oauth-client.js";
import { uploadImageToSupabase } from "../../utils/supabase-storage.js";
import { isTextOnly } from "../utils.js";
import {
  POST_TO_LINKEDIN_ORGANIZATION,
  TEXT_ONLY_MODE,
} from "../generate-post/constants.js";
import { SlackClient } from "../../clients/slack/client.js";
import { ComplexPost } from "../shared/nodes/generate-post/types.js";

/**
 * Upload-post graph.
 *
 * Receives a generated post + (optionally) an image URL and a `credentials`
 * object containing the OAuth tokens / IDs the API layer decrypted before
 * triggering this run. Routes to one of three platform clients:
 *
 *   - instagram → InstagramGraphClient.publishImage (Meta Graph API)
 *   - twitter   → TwitterOAuthClient.tweet          (X v2 OAuth 2.0)
 *   - linkedin  → LinkedInOAuthClient.post          (UGC Posts)
 *
 * In every case the image is re-hosted on Supabase Storage first so the
 * platform's servers can fetch it from a stable public URL.
 */

const UploadPostAnnotation = Annotation.Root({
  post: Annotation<string>,
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
  [TEXT_ONLY_MODE]: Annotation<boolean | undefined>({
    reducer: (_state, update) => update,
    default: () => false,
  }),
});

interface FailureArgs {
  uploadDestination: "instagram" | "twitter" | "linkedin";
  error: any;
  threadId: string;
  postContent: string | ComplexPost;
  imageUrl?: string;
}

async function notifySlackOnFailure({
  uploadDestination,
  error,
  threadId,
  postContent,
  imageUrl,
}: FailureArgs) {
  if (!process.env.SLACK_CHANNEL_ID) return;
  const slack = new SlackClient();
  const postStr =
    typeof postContent === "string"
      ? postContent
      : `Main: ${postContent.main_post}\nReply: ${postContent.reply_post}`;
  const message = `❌ ${uploadDestination.toUpperCase()} upload failed
Thread: *${threadId}*
Error: \`\`\`${error}\`\`\`
Post: \`\`\`${postStr.slice(0, 800)}\`\`\`
${imageUrl ? `Image: ${imageUrl}` : ""}`;
  await slack
    .sendMessage(process.env.SLACK_CHANNEL_ID, message)
    .catch(() => null);
}

export async function uploadPost(
  state: typeof UploadPostAnnotation.State,
  config: LangGraphRunnableConfig,
): Promise<Partial<typeof UploadPostAnnotation.State>> {
  if (!state.post) {
    throw new Error("No post text provided to upload-post graph");
  }
  const isTextOnlyMode = isTextOnly(config);
  const userId =
    state.credentials?.userId || config.configurable?.user_id || "unknown";
  const threadId = config.configurable?.thread_id || "unknown";

  // Re-host the image on Supabase Storage before calling the platforms — they
  // require a public URL (Meta + LinkedIn explicitly; X works fine with a
  // public URL too and we keep the path consistent across platforms).
  let publicImageUrl: string | undefined;
  if (!isTextOnlyMode && state.image) {
    publicImageUrl = await uploadImageToSupabase(state.image.imageUrl, {
      userId,
    });
  }

  if (state.platform === "instagram") {
    try {
      const accessToken = state.credentials?.accessToken;
      const igUserId = state.credentials?.igUserId;
      if (!accessToken || !igUserId) {
        throw new Error(
          "Instagram credentials missing accessToken/igUserId — reconnect via Facebook OAuth",
        );
      }
      if (!publicImageUrl) {
        throw new Error("Instagram requires an image");
      }
      const client = new InstagramGraphClient(accessToken, igUserId);
      const result = await client.publishImage({
        imageUrl: publicImageUrl,
        caption: state.post,
      });
      console.log(
        `✅ Instagram published. Media ${result.mediaId}${
          result.permalink ? ` · ${result.permalink}` : ""
        }`,
      );
      return {};
    } catch (e: any) {
      await notifySlackOnFailure({
        uploadDestination: "instagram",
        error: e?.message || e,
        threadId,
        postContent: state.complexPost || state.post,
        imageUrl: publicImageUrl,
      });
      throw e;
    }
  }

  if (state.platform === "twitter") {
    try {
      const accessToken = state.credentials?.accessToken;
      const username = state.credentials?.username || "i";
      if (!accessToken) {
        throw new Error(
          "Twitter credentials missing accessToken — reconnect via X OAuth",
        );
      }
      const client = new TwitterOAuthClient(accessToken, username);

      const main = state.complexPost?.main_post || state.post;
      const result = await client.tweet(main, publicImageUrl);
      console.log(`✅ X published. ${result.url}`);

      // Threads: the upstream client used to allow a follow-up reply. The X
      // v2 endpoint accepts `reply.in_reply_to_tweet_id` which we'd add when
      // we want threads. Skipping for now — the agent rarely produces them
      // for the FlowPost flow.
      return {};
    } catch (e: any) {
      await notifySlackOnFailure({
        uploadDestination: "twitter",
        error: e?.message || e,
        threadId,
        postContent: state.complexPost || state.post,
        imageUrl: publicImageUrl,
      });
      throw e;
    }
  }

  if (state.platform === "linkedin") {
    try {
      const accessToken = state.credentials?.accessToken;
      const memberSub =
        state.credentials?.memberSub || state.credentials?.oauthProviderUserId;
      if (!accessToken || !memberSub) {
        throw new Error(
          "LinkedIn credentials missing accessToken/memberSub — reconnect via LinkedIn OAuth",
        );
      }
      const client = new LinkedInOAuthClient(accessToken, memberSub);
      const result = await client.post(state.post, publicImageUrl);
      console.log(`✅ LinkedIn published. ${result.url}`);
      return {};
    } catch (e: any) {
      await notifySlackOnFailure({
        uploadDestination: "linkedin",
        error: e?.message || e,
        threadId,
        postContent: state.complexPost || state.post,
        imageUrl: publicImageUrl,
      });
      throw e;
    }
  }

  console.warn(`Platform "${state.platform}" not supported by upload-post`);
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
