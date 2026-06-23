/**
 * Sentry PII scrubber (CLAUDE.md: this platform holds member PII). Runs in every
 * runtime's `beforeSend`/`beforeSendTransaction`. It:
 *   - drops anything under a key named `metadata` (our audit metadata + any
 *     context bag we attach), wholesale,
 *   - redacts email addresses and phone numbers inside any string,
 *   - clears the Sentry `user` email/username/ip.
 * Pure and depth/cycle-guarded so it is unit-testable and cannot loop.
 */

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// 7+ digits, allowing spaces, dashes, dots, parens and a leading +. Conservative
// enough to catch phone numbers without nuking ordinary short numbers.
const PHONE_RE = /\+?\d[\d\s().-]{6,}\d/g;

export function scrubString(input: string): string {
  return input
    .replace(EMAIL_RE, "[redacted-email]")
    .replace(PHONE_RE, (m) =>
      // Only treat it as a phone if it has at least 7 actual digits.
      (m.match(/\d/g)?.length ?? 0) >= 7 ? "[redacted-phone]" : m,
    );
}

function scrubValue(value: unknown, seen: WeakSet<object>, depth: number): unknown {
  if (depth > 12) return value;
  if (typeof value === "string") return scrubString(value);
  if (value == null || typeof value !== "object") return value;

  if (seen.has(value as object)) return value;
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((v) => scrubValue(v, seen, depth + 1));
  }

  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    // Drop any "metadata" bag entirely.
    if (key.toLowerCase() === "metadata") continue;
    out[key] = scrubValue(v, seen, depth + 1);
  }
  return out;
}

/**
 * Scrub a Sentry event (or transaction) in place-ish: returns a new, scrubbed
 * object. Typed loosely so it works for the client/server/edge SDKs alike.
 */
export function scrubEvent<T extends Record<string, unknown>>(event: T): T {
  const scrubbed = scrubValue(event, new WeakSet(), 0) as T;
  // Belt and braces on the well-known user PII fields.
  if (scrubbed && typeof scrubbed === "object" && "user" in scrubbed) {
    const user = (scrubbed as Record<string, unknown>).user;
    if (user && typeof user === "object") {
      const u = user as Record<string, unknown>;
      delete u.email;
      delete u.username;
      delete u.ip_address;
    }
  }
  return scrubbed;
}
