import { loadEnvConfig } from "@next/env";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { PAU_FACULTIES } from "../lib/pau";
import * as schema from "./schema";

loadEnvConfig(process.cwd());

/**
 * Idempotent bootstrap: ensures the super admin (SUPER_ADMIN_EMAIL) exists with
 * a user + member row. Re-running makes no further changes.
 *
 * Runs through the runtime DATABASE_URL (app_user) and asserts the super_admin
 * role via set_config, so it goes through the real members RLS write policy
 * rather than bypassing it.
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const email = process.env.SUPER_ADMIN_EMAIL;
  if (!email) throw new Error("SUPER_ADMIN_EMAIL is not set");

  const client = postgres(url, { prepare: false, max: 1 });
  const db = drizzle(client, { schema });

  try {
    await db.transaction(async (tx) => {
      // Transaction-local: lets the members RLS policy permit the bootstrap.
      await tx.execute(sql`select set_config('app.role', 'super_admin', true)`);

      const [user] = await tx
        .insert(schema.users)
        .values({
          email,
          name: "Super Admin",
          role: "super_admin",
          status: "active",
        })
        .onConflictDoUpdate({
          target: schema.users.email,
          set: { role: "super_admin", status: "active" },
        })
        .returning();

      // Now that the user id is known, the "self" branch of the policy holds too.
      await tx.execute(sql`select set_config('app.user_id', ${user.id}, true)`);

      await tx
        .insert(schema.members)
        .values({
          userId: user.id,
          // Placeholders — edit to the real profile after first sign-in.
          firstName: "Super",
          lastName: "Admin",
          faculty: PAU_FACULTIES[0],
          graduationYear: 2010,
          onboardedAt: new Date(),
        })
        .onConflictDoNothing({ target: schema.members.userId });
    });

    console.log(`✓ Seeded super admin: ${email}`);
    console.log(
      `✓ PAU faculties for validators (${PAU_FACULTIES.length}): ${PAU_FACULTIES.join(", ")}`,
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
