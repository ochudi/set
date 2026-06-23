import { test, expect } from "@playwright/test";

import { cleanupUser, ensureUser, seedVerificationToken } from "./helpers/db";

const EMAIL = "e2e-login@example.test";

test.afterAll(async () => {
  await cleanupUser(EMAIL);
});

test("magic-link login round-trip via the verification token", async ({ page }) => {
  await ensureUser(EMAIL, "member");
  const rawToken = await seedVerificationToken(EMAIL);

  // Visit the Auth.js Email/Resend callback the magic link would point to. The
  // server hashes the raw token, matches the seeded row, and creates a session.
  const callbackUrl =
    `/api/auth/callback/resend?` +
    new URLSearchParams({
      callbackUrl: "http://localhost:3000/dashboard",
      token: rawToken,
      email: EMAIL,
    }).toString();

  await page.goto(callbackUrl);

  // We should now be signed in: an authenticated-only page loads instead of
  // redirecting to /login.
  await page.goto("/me");
  await expect(page).not.toHaveURL(/\/login/);
  await expect(
    page.getByRole("heading", { name: /your account/i }),
  ).toBeVisible();
});
