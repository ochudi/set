import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

// Load .env.local into the test runner's process.env (Next loads it for the app,
// but the Playwright process and its DB helper need DATABASE_URL/AUTH_SECRET too).
loadEnvConfig(process.cwd());

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

// Smoke tests aimed at what must never break: the admin guard, a real magic-link
// login round-trip (token read from the DB), and the public campaign page with no
// session. They need a running app + a seeded database (see .github/workflows/ci.yml
// and DEPLOY.md). Browsers install with `npx playwright install --with-deps chromium`.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    // Reuse a dev server if one is already up locally; CI builds then starts.
    command: process.env.CI
      ? "npm run build && npm run start"
      : "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
