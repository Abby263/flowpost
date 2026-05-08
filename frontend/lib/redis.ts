import "server-only";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

/**
 * Upstash Redis helpers used by the worker.
 *
 *   1. Per-`connection_id` lease:
 *        Prevents two workflow runs from publishing to the same IG account
 *        simultaneously (which would trip Meta's rate limits and create
 *        out-of-order content). Lease is acquired with SET NX EX TTL and
 *        explicitly released on completion.
 *
 *   2. Per-account publish rate limit:
 *        Token bucket that bounds how often any one IG account is published
 *        to. Defaults to 1 per 30 minutes; configurable via
 *        WORKFLOW_PUBLISH_RATE_PER_HOUR (per IG account).
 *
 * Env:
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 *   WORKFLOW_PUBLISH_RATE_PER_HOUR  (default 2)
 *
 * The whole module is a no-op when the env is missing — the worker still
 * runs, just without lease/rate-limit guarantees. Worth flagging in logs
 * but not fatal for a side-project setup.
 */

let cachedRedis: Redis | null = null;
let cachedRateLimit: Ratelimit | null = null;

export function isRedisConfigured(): boolean {
  return (
    !!process.env.UPSTASH_REDIS_REST_URL &&
    !!process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

function getRedis(): Redis {
  if (cachedRedis) return cachedRedis;
  if (!isRedisConfigured()) {
    throw new Error(
      "UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not set",
    );
  }
  cachedRedis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
  return cachedRedis;
}

const LEASE_TTL_SECONDS = 10 * 60;

/**
 * Try to acquire a lease for `connectionId`. Returns the lease token on
 * success, null on contention. Pass the same token to releaseConnectionLease
 * to release; another holder's release will be ignored (compare-and-delete).
 */
export async function acquireConnectionLease(
  connectionId: string,
  ttlSeconds: number = LEASE_TTL_SECONDS,
): Promise<string | null> {
  if (!isRedisConfigured()) return "noop";
  const redis = getRedis();
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const result = await redis.set(`lease:conn:${connectionId}`, token, {
    nx: true,
    ex: ttlSeconds,
  });
  return result === "OK" ? token : null;
}

const RELEASE_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
else
  return 0
end
`;

export async function releaseConnectionLease(
  connectionId: string,
  token: string,
): Promise<void> {
  if (!isRedisConfigured() || token === "noop") return;
  const redis = getRedis();
  await redis.eval(RELEASE_SCRIPT, [`lease:conn:${connectionId}`], [token]);
}

/**
 * Per-IG-account publish rate limiter. Sliding window: N publishes per hour.
 * Pass connectionId as the bucket key. Returns whether the action is allowed
 * and how many ms to wait if not.
 */
export async function checkPublishRateLimit(connectionId: string): Promise<{
  allowed: boolean;
  retryAfterMs: number;
}> {
  if (!isRedisConfigured()) {
    return { allowed: true, retryAfterMs: 0 };
  }
  const perHour = Number(process.env.WORKFLOW_PUBLISH_RATE_PER_HOUR || "2");
  if (!cachedRateLimit) {
    cachedRateLimit = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(perHour, "1 h"),
      prefix: "rl:publish:conn",
    });
  }
  const result = await cachedRateLimit.limit(connectionId);
  const retryAfterMs = result.success
    ? 0
    : Math.max(0, result.reset - Date.now());
  return { allowed: result.success, retryAfterMs };
}
