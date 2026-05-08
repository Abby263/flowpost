import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { insert, query, queryOne } from "@/lib/postgres";
import { decryptToken } from "@/lib/encryption";
import { uploadImageToSupabase } from "@/lib/supabase-storage";
import { InstagramGraphClient } from "@/lib/instagram-graph";
import { isAdmin } from "@/lib/admin";

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
  access_token_encrypted: string | null;
  ig_business_account_id: string | null;
  connection_status: string | null;
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
      `SELECT id, platform, credentials,
              access_token_encrypted, ig_business_account_id, connection_status
         FROM connections WHERE id = $1 AND user_id = $2`,
      [draft.connection_id, userId],
    );
  } else if (draft.workflow_id) {
    connection = await queryOne<ConnectionRow>(
      `SELECT c.id, c.platform, c.credentials,
              c.access_token_encrypted, c.ig_business_account_id, c.connection_status
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
  if (
    !connection.access_token_encrypted ||
    !connection.ig_business_account_id ||
    connection.connection_status !== "active"
  ) {
    return NextResponse.json(
      {
        error:
          "Instagram connection is not active. Reconnect via Facebook OAuth.",
      },
      { status: 400 },
    );
  }

  // Charge a credit before publishing (refunded on failure). Admins bypass.
  const adminUser = isAdmin(userId);
  const credits = await queryOne<UserCredits>(
    `SELECT credits_balance, bonus_credits FROM user_credits WHERE user_id = $1`,
    [userId],
  );
  const total = (credits?.credits_balance || 0) + (credits?.bonus_credits || 0);
  if (!adminUser && total < CREDITS_PER_PUBLISH) {
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

  let runOk = false;
  let runError: string | null = null;
  let permalink: string | null = null;
  let publicImageUrl = draft.image_url;
  try {
    // Always re-host the image so we hand Meta a stable public URL.
    publicImageUrl = await uploadImageToSupabase(draft.image_url, {
      userId,
      postId: draft.id,
    });

    const accessToken = decryptToken(connection.access_token_encrypted);
    const client = new InstagramGraphClient(
      accessToken,
      connection.ig_business_account_id,
    );
    const result = await client.publishImage({
      imageUrl: publicImageUrl,
      caption: draft.content,
    });
    permalink = result.permalink;
    runOk = true;
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

  // Deduct credits and finalize the post. Admins are not charged.
  if (credits && !adminUser) {
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
            posted_at = NOW(),
            published_url = $2,
            image_url = $3
      WHERE id = $1`,
    [draft.id, permalink, publicImageUrl],
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
