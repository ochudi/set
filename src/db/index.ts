import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

/**
 * Drizzle client. All data access runs in the Node runtime (CLAUDE.md).
 *
 * Import this ONLY from src/db itself and src/lib/dal.ts — enforced by eslint
 * no-restricted-imports once the DAL lands (rule 2).
 *
 * Production DATABASE_URL points at the Supavisor TRANSACTION pooler (port
 * 6543) and connects as the restricted `app_user` role, never the owner or the
 * service key. The transaction pooler cannot use prepared statements, hence
 * `prepare: false`. Migrations use DIRECT_URL instead (see drizzle.config.ts).
 */

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
export { schema };
export type Database = typeof db;
