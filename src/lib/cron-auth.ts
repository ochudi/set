/**
 * Shared auth for scheduled job endpoints. Vercel Cron sends
 * `Authorization: Bearer $CRON_SECRET` automatically when CRON_SECRET is set, so
 * every cron route checks the bearer here before doing any work.
 *
 * NOTE (CLAUDE.md rule 5): Vercel Cron can only invoke endpoints over GET, so
 * the cron routes are mutating GET handlers — the one place that rule is relaxed.
 * It stays safe because nothing runs unless this constant-time bearer check
 * passes: a browser, prefetch, or scanner can never trigger a mutation.
 */
export function isAuthorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed if unconfigured
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (header.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < header.length; i++) {
    mismatch |= header.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}
