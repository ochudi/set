import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM encryption for member phone numbers (CLAUDE.md security rule 7).
 *
 * The key comes from PHONE_ENC_KEY, which must decode (base64) to exactly 32
 * bytes. Each value is encrypted with a fresh random 96-bit IV. The stored
 * format is three base64 segments joined by colons: `iv:tag:cipher`.
 */

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32; // AES-256
const IV_BYTES = 12; // 96-bit nonce, the recommended size for GCM

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;

  const raw = process.env.PHONE_ENC_KEY;
  if (!raw) {
    throw new Error("PHONE_ENC_KEY is not set");
  }

  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `PHONE_ENC_KEY must decode to ${KEY_BYTES} bytes, got ${key.length}. ` +
        "Generate one with: openssl rand -base64 32",
    );
  }

  cachedKey = key;
  return key;
}

/** Encrypt a phone number. Returns `iv:tag:cipher`, each segment base64. */
export function encryptPhone(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

/** Decrypt a value produced by {@link encryptPhone}. Throws if tampered. */
export function decryptPhone(payload: string): string {
  const key = getKey();

  const segments = payload.split(":");
  if (segments.length !== 3) {
    throw new Error("Malformed ciphertext: expected iv:tag:cipher");
  }

  const [ivB64, tagB64, dataB64] = segments;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
  return plaintext.toString("utf8");
}
