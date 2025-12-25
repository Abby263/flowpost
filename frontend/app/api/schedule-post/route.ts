import { NextResponse } from "next/server";
import { Client } from "@langchain/langgraph-sdk";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Initialize LangGraph Client for direct posting
const langGraphClient = new Client({
  apiUrl: process.env.LANGGRAPH_API_URL || "http://localhost:54367",
});

async function generateImage(prompt: string): Promise<string> {
  if (!OPENAI_API_KEY) {
    throw new Error("OpenAI API key not configured");
  }

  const imageModel = process.env.IMAGE_MODEL || "dall-e-3";
  const imagePrompt = `Create a professional, visually appealing social media post image: ${prompt}. Style: modern, clean, high quality, suitable for Instagram/LinkedIn. SQUARE FORMAT.`;

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: imageModel,
      prompt: imagePrompt,
      n: 1,
      size: "1024x1024", // Force square for Instagram compatibility
      quality: "standard", // Standard quality is faster and cheaper
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      `OpenAI API error: ${errorData.error?.message || response.statusText}`,
    );
  }

  const data = await response.json();
  const url = data.data?.[0]?.url;

  if (!url) {
    throw new Error("No image URL in response");
  }

  return url;
}

async function schedulePost(
  content: string,
  platform: string,
  connectionId: string,
  scheduledAt: string,
  userId: string,
  imageUrl?: string,
  source?: string,
) {
  // Get connection details to find the workflow or create a new scheduled entry
  const { data: connection, error: connError } = await supabaseAdmin
    .from("connections")
    .select("*")
    .eq("id", connectionId)
    .eq("user_id", userId)
    .single();

  if (connError || !connection) {
    throw new Error("Connection not found");
  }

  // Insert scheduled post into posts table
  const { data: post, error: postError } = await supabaseAdmin
    .from("posts")
    .insert({
      user_id: userId,
      content: content,
      platform: platform,
      status: "scheduled",
      scheduled_at: scheduledAt,
      image_url: imageUrl || null,
      connection_id: connectionId,
      posted_at: null, // Will be set when actually posted
      source: source || "manual",
    })
    .select()
    .single();

  if (postError) {
    console.error("Error inserting scheduled post:", postError);
    throw new Error(`Failed to schedule post: ${postError.message}`);
  }

  return post;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;
    const { userId } = auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (action === "generate-image") {
      const { prompt } = body;

      if (!prompt) {
        return NextResponse.json(
          { error: "Prompt is required" },
          { status: 400 },
        );
      }

      try {
        const imageUrl = await generateImage(prompt);
        return NextResponse.json({ success: true, imageUrl });
      } catch (error: any) {
        console.error("Image generation error:", error);
        return NextResponse.json(
          {
            success: false,
            error: error.message || "Failed to generate image",
          },
          { status: 500 },
        );
      }
    }

    if (action === "schedule") {
      const { content, platform, connectionId, scheduledAt, imageUrl, source } =
        body;

      if (!content || !platform || !connectionId || !scheduledAt) {
        return NextResponse.json(
          {
            error:
              "Missing required fields: content, platform, connectionId, scheduledAt",
          },
          { status: 400 },
        );
      }

      try {
        const post = await schedulePost(
          content,
          platform,
          connectionId,
          scheduledAt,
          userId,
          imageUrl,
          source,
        );
        return NextResponse.json({ success: true, post });
      } catch (error: any) {
        console.error("Schedule post error:", error);
        return NextResponse.json(
          {
            success: false,
            error: error.message || "Failed to schedule post",
          },
          { status: 500 },
        );
      }
    }

    if (action === "post-now") {
      const { content, platform, connectionId, imageUrl, source } = body;

      if (!content || !platform || !connectionId) {
        return NextResponse.json(
          {
            error: "Missing required fields: content, platform, connectionId",
          },
          { status: 400 },
        );
      }

      try {
        // Get connection details with credentials
        const { data: connection, error: connError } = await supabaseAdmin
          .from("connections")
          .select("*")
          .eq("id", connectionId)
          .eq("user_id", userId)
          .single();

        if (connError || !connection) {
          throw new Error("Connection not found");
        }

        // For Instagram, image is required
        if (platform === "instagram" && !imageUrl) {
          return NextResponse.json(
            {
              error:
                "Instagram posts require an image. Please add an image before posting.",
            },
            { status: 400 },
          );
        }

        // Create a record in posts table with "posting" status
        const { data: post, error: postError } = await supabaseAdmin
          .from("posts")
          .insert({
            user_id: userId,
            content: content,
            platform: platform,
            status: "posting", // In progress
            image_url: imageUrl || null,
            connection_id: connectionId,
            posted_at: new Date().toISOString(),
            source: source || "manual",
          })
          .select()
          .single();

        if (postError) {
          throw new Error(`Failed to create post record: ${postError.message}`);
        }

        // Call the upload_post graph via LangGraph SDK to directly publish
        try {
          console.log("Calling upload_post graph for direct publishing...");

          // Create a thread for the upload
          const thread = await langGraphClient.threads.create();

          // Prepare input for upload_post graph
          const uploadInput = {
            post: content,
            platform: platform,
            credentials: connection.credentials,
            ...(imageUrl && {
              image: {
                imageUrl: imageUrl,
                mimeType: "image/jpeg", // Default, could be detected
              },
            }),
          };

          console.log("Upload input:", {
            platform,
            hasCredentials: !!connection.credentials,
            hasImage: !!imageUrl,
          });

          // Run the upload_post graph and wait for completion
          const run = await langGraphClient.runs.create(
            thread.thread_id,
            "upload_post",
            {
              input: uploadInput,
              multitaskStrategy: "rollback", // Allow new runs to interrupt stuck/previous runs
            },
          );

          // Wait for the run to complete (with timeout)
          let runStatus = run;
          const maxAttempts = 30; // 30 seconds timeout
          let attempts = 0;

          while (
            runStatus.status !== "success" &&
            runStatus.status !== "error" &&
            attempts < maxAttempts
          ) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            runStatus = await langGraphClient.runs.get(
              thread.thread_id,
              run.run_id,
            );
            attempts++;
          }

          if (runStatus.status === "success") {
            // Update post status to published
            console.log(
              `[Schedule Post API] Updating post ${post.id} status to published`,
            );
            const { error: updateError } = await supabaseAdmin
              .from("posts")
              .update({
                status: "published",
                posted_at: new Date().toISOString(),
              })
              .eq("id", post.id);

            if (updateError) {
              console.error(
                `[Schedule Post API] Failed to update post status:`,
                updateError,
              );
            } else {
              console.log(
                `[Schedule Post API] Successfully updated post ${post.id} to published`,
              );
            }

            return NextResponse.json({
              success: true,
              post: { ...post, status: "published" },
              message: "Post published successfully!",
            });
          } else if (runStatus.status === "error") {
            // Update post status to failed
            await supabaseAdmin
              .from("posts")
              .update({ status: "failed" })
              .eq("id", post.id);

            // Try to extract a meaningful error message
            let errorMsg = "Failed to publish post.";

            if ((runStatus as any).error) {
              const errorStr = String((runStatus as any).error);
              if (errorStr.includes("aspect ratio")) {
                errorMsg =
                  "Image has incorrect aspect ratio for Instagram. Try regenerating with AI or use a square image (1:1 ratio).";
              } else if (
                errorStr.includes("login") ||
                errorStr.includes("authentication")
              ) {
                errorMsg =
                  "Authentication failed. Please check your Instagram credentials.";
              } else if (errorStr.includes("rate limit")) {
                errorMsg =
                  "Instagram rate limit exceeded. Please wait 10-15 minutes and try again.";
              } else {
                errorMsg = `Failed to publish: ${errorStr.substring(0, 150)}`;
              }
            }

            throw new Error(errorMsg);
          } else {
            // Timeout - mark as pending
            await supabaseAdmin
              .from("posts")
              .update({ status: "pending" })
              .eq("id", post.id);

            return NextResponse.json({
              success: true,
              post: { ...post, status: "pending" },
              message:
                "Post is being processed. Check back shortly for status.",
            });
          }
        } catch (uploadError: any) {
          console.error("Upload error:", uploadError);

          // Update post status to failed
          await supabaseAdmin
            .from("posts")
            .update({ status: "failed" })
            .eq("id", post.id);

          // Avoid duplicating "Failed to publish:" in error message
          const errorMsg = uploadError.message?.startsWith("Failed to publish")
            ? uploadError.message
            : `Failed to publish: ${uploadError.message}`;
          throw new Error(errorMsg);
        }
      } catch (error: any) {
        console.error("Post now error:", error);
        return NextResponse.json(
          {
            success: false,
            error: error.message || "Failed to publish post",
          },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("Schedule Post API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET endpoint to fetch scheduled posts
export async function GET(request: Request) {
  try {
    const { userId } = auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: posts, error } = await supabaseAdmin
      .from("posts")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "scheduled")
      .order("scheduled_at", { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, posts });
  } catch (error: any) {
    console.error("Get scheduled posts error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
