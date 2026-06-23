import { loadEnvConfig } from "@next/env";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { hashPassword } from "../src/lib/password";
import * as schema from "../src/db/schema";

loadEnvConfig(process.cwd());

/**
 * Set or reset a member's password (the "help me if I forget" path).
 *
 *   npm run set-password -- <email> <password>
 *
 * Connects directly like the seed script. Idempotent: re-running overwrites the
 * stored hash. Does nothing destructive beyond updating password_hash.
 */
async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error("Usage: npm run set-password -- <email> <password>");
    process.exit(1);
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const client = postgres(url, { prepare: false, max: 1 });
  const db = drizzle(client, { schema });
  try {
    const rows = await db
      .update(schema.users)
      .set({ passwordHash: hashPassword(password) })
      .where(eq(schema.users.email, email.toLowerCase()))
      .returning({ id: schema.users.id });
    if (rows.length === 0) {
      console.error(`✗ No user found with email ${email}`);
      process.exit(1);
    }
    console.log(`✓ Password set for ${email}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
