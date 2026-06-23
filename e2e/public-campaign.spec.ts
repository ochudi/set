import { test, expect } from "@playwright/test";

// The seeded "bus" campaign is public at /p/bus (run `npx tsx scripts/seed-bus.ts`).
test("public campaign page renders without a session", async ({ page }) => {
  await page.goto("/p/bus");

  // No auth wall: the public page renders, it does not bounce to /login.
  await expect(page).not.toHaveURL(/\/login/);
  await expect(
    page.getByRole("heading", { name: /set bus appeal/i }),
  ).toBeVisible();
});
