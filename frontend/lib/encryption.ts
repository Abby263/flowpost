import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";

/**
 * AES-256-GCM helpers for at-rest encryption of OAuth access tokens.
 *
 * The wire format is:  v1:<iv-hex>:<authTag-hex>:<ciphertext-hex>
 *
 * The version prefix lets us rotate the algorithm later without ambiguity.
 * The key is derived from TOKEN_ENCRYPTION_KEY (any length) by SHA-256, so
 * operators can use a passphrase or a 64-char hex string interchangeably.
 *
 * SECURITY NOTES:
 *   - Never log plaintext tokens. Treat the decrypted string as you would
 *     a password — keep it in memory only as long as needed.
 *   - Rotating the key invalidates all previously-encrypted tokens. Plan a
 *     re-OAuth on rotation; we do not store both old + new keys today.
 */

const ALGO = "aes-256-gcm";
const IV_LEN = 12; // GCM standard
const VERSION = "v1";

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw || raw.length < 16) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY env var is missing or too short (need >= 16 chars).",
    );
  }
  cachedKey = createHash("sha256").update(raw, "utf8").digest();
  return cachedKey;
}

export function encryptToken(plaintext: string): string {
  if (!plaintext) throw new Error("encryptToken: empty input");
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("hex"),
    authTag.toString("hex"),
    ciphertext.toString("hex"),
  ].join(":");
}

export function decryptToken(payload: string): string {
  if (!payload) throw new Error("decryptToken: empty input");
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("decryptToken: unrecognized payload format");
  }
  const [, ivHex, tagHex, ctHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ct = Buffer.from(ctHex, "hex");
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString(
    "utf8",
  );
}
