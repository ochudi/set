import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// Load .env.local the same way Next does, so DIRECT_URL is visible to the CLI.
loadEnvConfig(process.cwd());

// generate/push/migrate run on the DIRECT (session) connection, port 5432 —
// never the transaction pooler the app uses at runtime.
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DIRECT_URL!,
  },
  strict: true,
  verbose: true,
});
