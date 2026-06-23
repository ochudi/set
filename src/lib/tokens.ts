import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/** Generate a random URL-safe token (the raw value handed out in links). */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** sha256 hex digest. Tokens (invite, rsvp, unsubscribe) are stored hashed (rule 6). */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Constant-time compare of two hex digests. */
export function hashesEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ab.length === 0 || ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function signingSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return secret;
}

/** Stateless HMAC-signed token: base64url(payload).base64url(sig). */
export function signPayload(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", signingSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyPayload<T = Record<string, unknown>>(
  token: string,
): T | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", signingSecret())
    .update(body)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

/** Bulk email categories an unsubscribe link can target. */
export type UnsubCategory = "announcements" | "events" | "fundraisers" | "all";

const UNSUB_CATEGORIES: UnsubCategory[] = [
  "announcements",
  "events",
  "fundraisers",
  "all",
];

/**
 * Per-recipient one-click unsubscribe token (no DB row needed). Carries the
 * category so the link flips only the matching notify_* flag. Tokens minted
 * before categories existed decode as "all" for backward compatibility.
 */
export function unsubscribeToken(
  email: string,
  category: UnsubCategory = "all",
): string {
  return signPayload({ e: email.toLowerCase(), p: "unsub", c: category });
}

export function readUnsubscribeToken(
  token: string,
): { email: string; category: UnsubCategory } | null {
  const data = verifyPayload<{ e: string; p: string; c?: string }>(token);
  if (!data || data.p !== "unsub" || typeof data.e !== "string") return null;
  const category = UNSUB_CATEGORIES.includes(data.c as UnsubCategory)
    ? (data.c as UnsubCategory)
    : "all";
  return { email: data.e, category };
}
