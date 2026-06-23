import { createHash, randomBytes, randomUUID } from "node:crypto";
import postgres from "postgres";

// Direct DB access for tests (owner connection, bypasses RLS). Each call opens
// and closes its own short-lived connection so specs never share a client that
// one spec's teardown could close out from under another.
async function withSql<T>(fn: (sql: postgres.Sql) => Promise<T>): Promise<T> {
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
  try {
    return await fn(sql);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

/** Ensure an active, onboarded user + member exists with the given role/email. */
export async function ensureUser(
  email: string,
  role: "member" | "exco" | "super_admin" = "member",
): Promise<{ userId: string; memberId: string }> {
  const lower = email.toLowerCase();
  return withSql(async (sql) => {
    const [u] = await sql`
      insert into users (email, name, role, status)
      values (${lower}, ${"E2E " + role}, ${role}, 'active')
      on conflict (email) do update set role = excluded.role, status = 'active', deleted_at = null
      returning id`;
    const userId = u.id as string;
    const [m] = await sql`
      insert into members (user_id, first_name, last_name, onboarded_at, consented_at)
      values (${userId}, 'E2E', ${role}, now(), now())
      on conflict (user_id) do update set onboarded_at = now(), deleted_at = null
      returning id`;
    return { userId, memberId: m.id as string };
  });
}

/** Insert a database session row and return its token (the cookie value). */
export async function mintSession(userId: string): Promise<string> {
  const token = `e2e-${randomUUID()}`;
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return withSql(async (sql) => {
    await sql`
      insert into sessions (session_token, user_id, expires)
      values (${token}, ${userId}, ${expires})`;
    return token;
  });
}

/**
 * Seed an Auth.js magic-link verification token the way the Email/Resend provider
 * does: the DB stores sha256(rawToken + AUTH_SECRET); the callback URL carries the
 * raw token. Returns the raw token to put in the callback URL.
 */
export async function seedVerificationToken(email: string): Promise<string> {
  const secret = process.env.AUTH_SECRET!;
  const raw = randomBytes(32).toString("hex");
  const hashed = createHash("sha256").update(`${raw}${secret}`).digest("hex");
  const expires = new Date(Date.now() + 10 * 60 * 1000);
  await withSql(
    (sql) => sql`
      insert into verification_tokens (identifier, token, expires)
      values (${email.toLowerCase()}, ${hashed}, ${expires})`,
  );
  return raw;
}

export async function cleanupUser(email: string) {
  await withSql((sql) => sql`delete from users where email = ${email.toLowerCase()}`);
}
