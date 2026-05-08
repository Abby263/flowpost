import "server-only";
import { Client, Receiver } from "@upstash/qstash";

/**
 * QStash queue wrapper — Upstash QStash is an HTTP webhook queue. The cron
 * sweep enqueues a {workflowId} job; QStash POSTs it back to the worker
 * endpoint, with retries and dead-lettering handled by Upstash.
 *
 * Env:
 *   QSTASH_TOKEN              - publish token
 *   QSTASH_CURRENT_SIGNING_KEY  - to verify incoming worker requests
 *   QSTASH_NEXT_SIGNING_KEY     - rotation key
 *   NEXT_PUBLIC_APP_URL       - public base URL the worker is reachable at
 *
 * QStash reachability: the worker URL must be a public HTTPS endpoint
 * (Upstash retries from the open internet). On Vercel that's just the prod
 * URL; in dev you'd need a tunnel like ngrok, which is why dispatch is a
 * no-op when env is missing.
 */

interface PublishArgs {
  workflowId: string;
  /** Optional ISO timestamp. Job is delayed until this point. */
  notBefore?: string;
  /** Idempotency key. Prevents duplicate dispatch within QStash's window. */
  deduplicationId?: string;
}

let cachedClient: Client | null = null;
let cachedReceiver: Receiver | null = null;

export function isQueueConfigured(): boolean {
  return !!process.env.QSTASH_TOKEN;
}

function getClient(): Client {
  if (cachedClient) return cachedClient;
  const token = process.env.QSTASH_TOKEN;
  if (!token) throw new Error("QSTASH_TOKEN is not set");
  cachedClient = new Client({ token });
  return cachedClient;
}

function getReceiver(): Receiver {
  if (cachedReceiver) return cachedReceiver;
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!currentSigningKey || !nextSigningKey) {
    throw new Error(
      "QSTASH_CURRENT_SIGNING_KEY and QSTASH_NEXT_SIGNING_KEY must both be set",
    );
  }
  cachedReceiver = new Receiver({ currentSigningKey, nextSigningKey });
  return cachedReceiver;
}

function workerUrl(): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  if (!base.startsWith("https://")) {
    throw new Error(
      `NEXT_PUBLIC_APP_URL must be a public https URL for QStash to reach the worker. Got: ${base || "(unset)"}`,
    );
  }
  return `${base}/api/queue/run-workflow`;
}

export async function enqueueWorkflow(args: PublishArgs) {
  const client = getClient();
  const url = workerUrl();
  return client.publishJSON({
    url,
    body: { workflowId: args.workflowId },
    ...(args.notBefore
      ? { notBefore: Math.floor(new Date(args.notBefore).getTime() / 1000) }
      : {}),
    ...(args.deduplicationId ? { deduplicationId: args.deduplicationId } : {}),
    retries: 3,
  });
}

/**
 * Verify a request came from QStash by checking its signature header.
 * Returns the parsed body on success, throws on failure.
 */
export async function verifyAndParseQueueRequest(
  request: Request,
): Promise<{ workflowId: string }> {
  const receiver = getReceiver();
  const signature = request.headers.get("upstash-signature");
  if (!signature) {
    throw new Error("missing upstash-signature header");
  }
  const body = await request.text();
  const isValid = await receiver.verify({
    signature,
    body,
    url: workerUrl(),
  });
  if (!isValid) {
    throw new Error("invalid QStash signature");
  }
  return JSON.parse(body) as { workflowId: string };
}
