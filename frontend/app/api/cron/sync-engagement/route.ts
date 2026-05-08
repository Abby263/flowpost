import { NextResponse } from "next/server";
import { insert, query, queryMany } from "@/lib/postgres";
import { InstagramGraphClient } from "@/lib/instagram-graph";
import { decryptToken } from "@/lib/encryption";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ConnectionWithToken {
  id: string;
  user_id: string;
  access_token_encrypted: string;
  ig_business_account_id: string;
}

interface PostRow {
  id: string;
  user_id: string;
  content: string | null;
  published_url: string | null;
  posted_at: string | null;
}

function isCronAuthorized(request: Request): boolean {
  const auth = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (expected && auth === `Bearer ${expected}`) return true;
  if (request.headers.get("x-vercel-cron")) return true;
  if (process.env.NODE_ENV !== "production") return true;
  return false;
}

function permalinkMatchesPost(
  permalink: string | undefined,
  post: PostRow,
): boolean {
  if (!permalink) return false;
  if (post.published_url && permalink.startsWith(post.published_url))
    return true;
  // /p/{code}/ shortcode match
  const code = permalink.match(/\/p\/([^/?]+)/)?.[1];
  if (code && post.published_url?.includes(`/p/${code}`)) return true;
  return false;
}

function captionMatchesPost(
  caption: string | undefined,
  post: PostRow,
): boolean {
  if (!caption || !post.content) return false;
  const a = caption.replace(/\s+/g, " ").trim().slice(0, 80).toLowerCase();
  const b = post.content.replace(/\s+/g, " ").trim().slice(0, 80).toLowerCase();
  return a.length > 20 && a === b;
}

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connections = await queryMany<ConnectionWithToken>(
    `SELECT id, user_id, access_token_encrypted, ig_business_account_id
       FROM connections
      WHERE platform = 'instagram'
        AND access_token_encrypted IS NOT NULL
        AND ig_business_account_id IS NOT NULL
        AND connection_status = 'active'`,
  );

  let totalSynced = 0;
  const errors: { connection_id: string; error: string }[] = [];

  for (const conn of connections) {
    try {
      const accessToken = decryptToken(conn.access_token_encrypted);
      const client = new InstagramGraphClient(
        accessToken,
        conn.ig_business_account_id,
      );
      const media = await client.listRecentMedia(25);
      if (media.length === 0) continue;

      // Pull this user's recently published posts to match against.
      const recentPosts = await queryMany<PostRow>(
        `SELECT id, user_id, content, published_url, posted_at
           FROM posts
          WHERE user_id = $1
            AND status = 'published'
            AND posted_at > NOW() - INTERVAL '60 days'
          ORDER BY posted_at DESC
          LIMIT 200`,
        [conn.user_id],
      );

      for (const m of media) {
        let post = recentPosts.find((p) =>
          permalinkMatchesPost(m.permalink, p),
        );
        if (!post) {
          post = recentPosts.find((p) => captionMatchesPost(m.caption, p));
        }
        if (!post) continue;

        // Fill in the permalink on first match so future syncs are direct.
        if (!post.published_url && m.permalink) {
          await query(`UPDATE posts SET published_url = $1 WHERE id = $2`, [
            m.permalink,
            post.id,
          ]);
          post.published_url = m.permalink;
        }

        const insights = await client.getMediaInsights(m);
        await insert("post_engagement", {
          post_id: post.id,
          user_id: conn.user_id,
          platform: "instagram",
          likes: insights.likes ?? 0,
          comments: insights.comments ?? 0,
          saves: insights.saves ?? 0,
          shares: insights.shares ?? 0,
          reach: insights.reach ?? 0,
          impressions: insights.impressions ?? 0,
          raw: JSON.stringify(insights.raw || {}),
        });
        totalSynced += 1;
      }

      // After syncing, derive auto-engagement learnings from the latest
      // engagement row of each post (top 10% vs bottom 10%).
      await deriveAutoLearnings(conn.user_id);
    } catch (err) {
      errors.push({
        connection_id: conn.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    connections_processed: connections.length,
    rows_inserted: totalSynced,
    errors,
  });
}

async function deriveAutoLearnings(userId: string) {
  // Take the most recent engagement row per published post (last 60 days).
  const scored = await queryMany<{
    post_id: string;
    workflow_id: string | null;
    content: string | null;
    score: number;
  }>(
    `SELECT p.id AS post_id,
            p.workflow_id,
            p.content,
            (e.likes + e.comments * 2) AS score
       FROM posts p
       JOIN LATERAL (
         SELECT likes, comments
           FROM post_engagement
          WHERE post_id = p.id
          ORDER BY fetched_at DESC
          LIMIT 1
       ) e ON true
      WHERE p.user_id = $1
        AND p.status = 'published'
        AND p.posted_at > NOW() - INTERVAL '60 days'
      ORDER BY score DESC`,
    [userId],
  );

  if (scored.length < 4) return;

  const topCount = Math.max(1, Math.floor(scored.length * 0.2));
  const bottomCount = topCount;
  const top = scored.slice(0, topCount);
  const bottom = scored.slice(-bottomCount);

  // Replace any existing auto_engagement learnings with fresh ones — we don't
  // want to accumulate stale signals as posts roll off.
  await query(
    `DELETE FROM post_learnings
       WHERE user_id = $1 AND source = 'auto_engagement'`,
    [userId],
  );

  for (const p of top) {
    if (!p.content) continue;
    await insert("post_learnings", {
      user_id: userId,
      workflow_id: p.workflow_id,
      post_id: p.post_id,
      source: "auto_engagement",
      signal: "positive",
      lesson: `Top performer (score ${Math.round(p.score)}) — keep this style: "${p.content.slice(0, 140)}"`,
    });
  }
  for (const p of bottom) {
    if (!p.content) continue;
    if (top.find((t) => t.post_id === p.post_id)) continue;
    await insert("post_learnings", {
      user_id: userId,
      workflow_id: p.workflow_id,
      post_id: p.post_id,
      source: "auto_engagement",
      signal: "negative",
      lesson: `Low performer (score ${Math.round(p.score)}) — avoid this style: "${p.content.slice(0, 140)}"`,
    });
  }
}
