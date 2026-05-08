/**
 * Learning loop helpers.
 *
 * Builds a short summary of past wins/losses for a given user+workflow that we
 * can inject into the LLM prompt. Sourced from:
 *   - post_learnings (manual reject reasons, auto engagement deltas, user notes)
 *   - posts joined with the latest post_engagement row (top vs. low performers)
 *
 * Kept deliberately small (a few hundred chars) so we don't blow the context.
 */

import { queryMany } from "./postgres.js";

export interface LearningContext {
  rules: string[];
  topPerformers: string[];
  lowPerformers: string[];
}

interface LearningRow {
  signal: "positive" | "negative" | "neutral";
  lesson: string;
}

interface PerformerRow {
  content: string | null;
  likes: number | null;
  comments: number | null;
}

const MAX_RULES = 8;
const MAX_PERFORMERS = 3;

export async function loadLearningContext(
  userId: string,
  workflowId: string | null,
): Promise<LearningContext> {
  if (!process.env.DATABASE_URI && !process.env.DATABASE_URL) {
    return { rules: [], topPerformers: [], lowPerformers: [] };
  }

  try {
    const rules = await queryMany<LearningRow>(
      `SELECT signal, lesson
         FROM post_learnings
        WHERE user_id = $1
          AND ($2::uuid IS NULL OR workflow_id = $2)
        ORDER BY created_at DESC
        LIMIT $3`,
      [userId, workflowId, MAX_RULES],
    );

    // Use the most recent engagement row per post.
    const top = await queryMany<PerformerRow>(
      `SELECT p.content, e.likes, e.comments
         FROM posts p
         JOIN LATERAL (
           SELECT likes, comments
             FROM post_engagement
            WHERE post_id = p.id
            ORDER BY fetched_at DESC
            LIMIT 1
         ) e ON true
        WHERE p.user_id = $1
          AND ($2::uuid IS NULL OR p.workflow_id = $2)
          AND p.status = 'published'
        ORDER BY (COALESCE(e.likes, 0) + COALESCE(e.comments, 0) * 2) DESC
        LIMIT $3`,
      [userId, workflowId, MAX_PERFORMERS],
    );

    const low = await queryMany<PerformerRow>(
      `SELECT p.content, e.likes, e.comments
         FROM posts p
         JOIN LATERAL (
           SELECT likes, comments
             FROM post_engagement
            WHERE post_id = p.id
            ORDER BY fetched_at DESC
            LIMIT 1
         ) e ON true
        WHERE p.user_id = $1
          AND ($2::uuid IS NULL OR p.workflow_id = $2)
          AND p.status = 'published'
        ORDER BY (COALESCE(e.likes, 0) + COALESCE(e.comments, 0) * 2) ASC
        LIMIT $3`,
      [userId, workflowId, MAX_PERFORMERS],
    );

    return {
      rules: rules.map((r) =>
        r.signal === "negative"
          ? `AVOID: ${r.lesson}`
          : r.signal === "positive"
            ? `DO: ${r.lesson}`
            : r.lesson,
      ),
      topPerformers: top
        .map((p) => p.content)
        .filter((c): c is string => !!c)
        .map((c) => truncate(c, 160)),
      lowPerformers: low
        .map((p) => p.content)
        .filter((c): c is string => !!c)
        .map((c) => truncate(c, 160)),
    };
  } catch (err) {
    // Learning is best-effort — never block generation on it.
    console.warn("[learnings] Failed to load context:", err);
    return { rules: [], topPerformers: [], lowPerformers: [] };
  }
}

export function formatLearningPrompt(ctx: LearningContext): string {
  if (
    ctx.rules.length === 0 &&
    ctx.topPerformers.length === 0 &&
    ctx.lowPerformers.length === 0
  ) {
    return "";
  }

  const sections: string[] = [];
  sections.push("\n--- LEARNINGS FROM PAST POSTS ---");

  if (ctx.rules.length > 0) {
    sections.push("Rules:");
    ctx.rules.forEach((r) => sections.push(`- ${r}`));
  }

  if (ctx.topPerformers.length > 0) {
    sections.push("\nTop-performing past captions (mimic their style):");
    ctx.topPerformers.forEach((p) => sections.push(`- ${p}`));
  }

  if (ctx.lowPerformers.length > 0) {
    sections.push("\nLow-performing past captions (avoid this style):");
    ctx.lowPerformers.forEach((p) => sections.push(`- ${p}`));
  }

  sections.push("--- END LEARNINGS ---\n");
  return sections.join("\n");
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}
