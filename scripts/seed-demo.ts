import { loadEnvConfig } from "@next/env";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { hashPassword } from "../src/lib/password";
import { PAU_FACULTIES } from "../src/lib/pau";
import * as schema from "../src/db/schema";

loadEnvConfig(process.cwd());

/**
 * Seed a SHARED, SANDBOX-ONLY demo account for showing the platform to the team.
 *
 *   npm run seed-demo
 *
 * Creates (or refreshes) a fully onboarded super_admin with a password so anyone
 * can sign in at /login with email + password. Idempotent — re-running just
 * resets the profile and password.
 *
 * ⚠️ This is a known, shared credential committed to the repo. NEVER run it
 * against production. It is for local/sandbox demos only.
 */
const EMAIL = process.argv[2] ?? "chudi.sandbox@gmail.com";
const PASSWORD = process.argv[3] ?? "secret_password_1#";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (process.env.EMAIL_MODE === "live") {
    throw new Error(
      "Refusing to seed a shared demo account while EMAIL_MODE=live (looks like production).",
    );
  }

  const email = EMAIL.toLowerCase();
  const client = postgres(url, { prepare: false, max: 1 });
  const db = drizzle(client, { schema });

  try {
    await db.transaction(async (tx) => {
      // Transaction-local: lets the members RLS write policy permit the write.
      await tx.execute(sql`select set_config('app.role', 'super_admin', true)`);

      const [user] = await tx
        .insert(schema.users)
        .values({
          email,
          name: "Chudi (Demo)",
          role: "super_admin",
          status: "active",
          passwordHash: hashPassword(PASSWORD),
        })
        .onConflictDoUpdate({
          target: schema.users.email,
          set: {
            role: "super_admin",
            status: "active",
            passwordHash: hashPassword(PASSWORD),
          },
        })
        .returning();

      await tx.execute(sql`select set_config('app.user_id', ${user.id}, true)`);

      const now = new Date();
      await tx
        .insert(schema.members)
        .values({
          userId: user.id,
          firstName: "Chudi",
          lastName: "Demo",
          faculty: PAU_FACULTIES[0],
          graduationYear: 2015,
          city: "Lagos",
          country: "Nigeria",
          bio: "Sandbox account for the team demo.",
          onboardedAt: now,
          consentedAt: now,
        })
        .onConflictDoUpdate({
          target: schema.members.userId,
          set: { onboardedAt: now, consentedAt: now },
        });
    });

    console.log(`✓ Demo account ready: ${email}`);
    console.log(`  password: ${PASSWORD}`);
    console.log(`  role:     super_admin (full access for the demo)`);
    console.log(`  sign in:  ${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/login`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
