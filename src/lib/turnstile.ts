/**
 * Cloudflare Turnstile verification for public forms (CLAUDE.md stack).
 *
 * A missing token is ALWAYS rejected server-side, even in dev — that guarantee
 * does not depend on configuration. When TURNSTILE_SECRET_KEY is unset (local
 * dev), a present token is accepted without calling Cloudflare so the form stays
 * usable; in production the secret is set and the token is verified for real.
 */
export async function verifyTurnstile(
  token: string | null | undefined,
  ip?: string | null,
): Promise<boolean> {
  if (!token) return false; // missing token: reject (server-side)

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // dev: no secret configured

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body },
    );
    const data = (await res.json()) as { success?: boolean };
    return Boolean(data.success);
  } catch {
    return false;
  }
}
