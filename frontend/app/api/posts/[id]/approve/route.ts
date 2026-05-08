import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { insert, query, queryOne } from "@/lib/postgres";

export const dynamic = "force-dynamic";

interface DraftRow {
  id: string;
  user_id: string;
  status: string;
  content: string | null;
  image_url: string | null;
  platform: string | null;
  workflow_id: string | null;
  connection_id: string | null;
}

interface ConnectionRow {
  id: string;
  platform: string;
  credentials: Record<string, unknown> | null;
}

interface UserCredits {
  credits_balance: number;
  bonus_credits: number;
}

const CREDITS_PER_PUBLISH = 1;

// POST /api/posts/:id/approve — approve a pending draft and trigger the
// upload-post LangGraph run. On success, status flips to 'publishing' (and
// will be set to 'published' after the run finishes).
export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const draft = await queryOne<DraftRow>(
    `SELECT id, user_id, status, content, image_url, platform, workflow_id, connection_id
       FROM posts
      WHERE id = $1 AND user_id = $2`,
    [params.id, userId],
  );

  if (!draft) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (draft.status !== "pending_approval") {
    return NextResponse.json(
      { error: `Cannot approve a post in status '${draft.status}'` },
      { status: 400 },
    );
  }
  if (!draft.content) {
    return NextResponse.json(
      { error: "Draft is missing caption" },
      { status: 400 },
    );
  }
  if (!draft.image_url) {
    return NextResponse.json(
      { error: "Draft is missing image" },
      { status: 400 },
    );
  }
  if (draft.platform !== "instagram") {
    return NextResponse.json(
      { error: "Approval flow only supports Instagram for now" },
      { status: 400 },
    );
  }

  // Look up the connection so we can pass credentials to the upload graph.
  let connection: ConnectionRow | null = null;
  if (draft.connection_id) {
    connection = await queryOne<ConnectionRow>(
      `SELECT id, platform, credentials FROM connections WHERE id = $1 AND user_id = $2`,
      [draft.connection_id, userId],
    );
  } else if (draft.workflow_id) {
    connection = await queryOne<ConnectionRow>(
      `SELECT c.id, c.platform, c.credentials
         FROM connections c
         JOIN workflows w ON w.connection_id = c.id
        WHERE w.id = $1 AND c.user_id = $2`,
      [draft.workflow_id, userId],
    );
  }

  if (!connection) {
    return NextResponse.json(
      { error: "No Instagram connection found for this draft" },
      { status: 400 },
    );
  }

  // Charge a credit before publishing (refunded on failure).
  const credits = await queryOne<UserCredits>(
    `SELECT credits_balance, bonus_credits FROM user_credits WHERE user_id = $1`,
    [userId],
  );
  const total = (credits?.credits_balance || 0) + (credits?.bonus_credits || 0);
  if (total < CREDITS_PER_PUBLISH) {
    return NextResponse.json(
      {
        error: "Insufficient credits to publish",
        credits_remaining: total,
      },
      { status: 402 },
    );
  }

  // Optimistically mark the post as publishing.
  await query(
    `UPDATE posts
        SET status = 'publishing',
            approved_at = NOW(),
            approved_by = $1
      WHERE id = $2`,
    [userId, draft.id],
  );

  const apiUrl = process.env.LANGGRAPH_API_URL || "http://localhost:54367";

  let runOk = false;
  let runError: string | null = null;
  try {
    const runResponse = await fetch(`${apiUrl}/runs/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assistant_id: "upload_post",
        input: {
          post: draft.content,
          image: { imageUrl: draft.image_url, mimeType: "image/jpeg" },
          platform: "instagram",
          credentials: connection.credentials,
        },
        stream_mode: "updates",
      }),
    });

    if (!runResponse.ok) {
      runError = `LangGraph upload returned ${runResponse.status}: ${await runResponse
        .text()
        .catch(() => "")}`;
    } else {
      // Drain the stream so the run completes.
      const reader = runResponse.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          if (/"event":\s*"error"/.test(buffer)) {
            runError = buffer;
            break;
          }
        }
      }
      runOk = !runError;
    }
  } catch (err) {
    runError = err instanceof Error ? err.message : String(err);
  }

  if (!runOk) {
    await query(
      `UPDATE posts
          SET status = 'failed',
              draft_metadata = jsonb_set(
                COALESCE(draft_metadata, '{}'::jsonb),
                '{publish_error}',
                to_jsonb($2::text)
              )
        WHERE id = $1`,
      [draft.id, runError || "Upload failed"],
    );
    return NextResponse.json(
      { error: runError || "Failed to publish" },
      { status: 502 },
    );
  }

  // Deduct credits and finalize the post.
  if (credits) {
    let bonus = credits.bonus_credits;
    let balance = credits.credits_balance;
    if (bonus >= CREDITS_PER_PUBLISH) {
      bonus -= CREDITS_PER_PUBLISH;
    } else {
      balance -= CREDITS_PER_PUBLISH - bonus;
      bonus = 0;
    }
    await query(
      `UPDATE user_credits
          SET credits_balance = $1,
              bonus_credits = $2,
              credits_used_this_month = credits_used_this_month + $3
        WHERE user_id = $4`,
      [balance, bonus, CREDITS_PER_PUBLISH, userId],
    );
    await insert("credit_transactions", {
      user_id: userId,
      amount: -CREDITS_PER_PUBLISH,
      balance_after: balance + bonus,
      transaction_type: "deduction",
      description: `Approved & published post ${draft.id}`,
    });
  }

  await query(
    `UPDATE posts
        SET status = 'published',
            posted_at = NOW()
      WHERE id = $1`,
    [draft.id],
  );

  // Optional positive learning: an approval without edits is a weak positive
  // signal. We capture it so the next generation can lean into the same style.
  await insert("post_learnings", {
    user_id: userId,
    workflow_id: draft.workflow_id,
    post_id: draft.id,
    source: "user_note",
    signal: "positive",
    lesson: "Approved without changes — keep this voice/structure.",
  }).catch(() => null);

  return NextResponse.json({ success: true, postId: draft.id });
}
