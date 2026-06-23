import { test, expect } from "@playwright/test";

import { cleanupUser, ensureUser, mintSession } from "./helpers/db";

const EMAIL = "e2e-member@example.test";

test.afterAll(async () => {
  await cleanupUser(EMAIL);
});

test("a member session cannot load /admin/members", async ({ page, context }) => {
  const { userId } = await ensureUser(EMAIL, "member");
  const token = await mintSession(userId);

  await context.addCookies([
    {
      name: "authjs.session-token",
      value: token,
      url: "http://localhost:3000",
    },
  ]);

  await page.goto("/admin/members");

  // requireRole redirects a non-admin to /dashboard; the admin roster must not show.
  await expect(page).not.toHaveURL(/\/admin\/members/);
  await expect(page).toHaveURL(/\/dashboard/);
});
