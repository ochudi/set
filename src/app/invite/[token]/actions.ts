"use server";

import { headers } from "next/headers";

import { signIn } from "@/auth";
import { getInviteByToken } from "@/lib/dal";
import { magicLinkEmailLimiter, magicLinkIpLimiter } from "@/lib/ratelimit";

export type AcceptState = { ok: boolean; message: string };

// Pre-auth action (no session yet), like the login flow. Triggers the magic-link
// sign-in for the invited email; the invite is consumed (acceptedAt) by the
// createUser event on first sign-in (src/auth.ts).
export async function acceptInvite(
  _prev: AcceptState | undefined,
  formData: FormData,
): Promise<AcceptState> {
  const token = String(formData.get("token") ?? "");
  if (!token) return { ok: false, message: "This invitation link is not valid." };

  const invite = await getInviteByToken(token);
  if (!invite || !invite.valid) {
    return {
      ok: false,
      message:
        invite?.reason === "expired"
          ? "This invitation has expired. Ask an admin to resend it."
          : "This invitation is no longer valid.",
    };
  }

  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  try {
    const [byEmail, byIp] = await Promise.all([
      magicLinkEmailLimiter().limit(invite.email),
      magicLinkIpLimiter().limit(ip),
    ]);
    if (!byEmail.success || !byIp.success) {
      return { ok: false, message: "Too many attempts. Please try again later." };
    }
  } catch {
    // limiter down — proceed
  }

  try {
    await signIn("resend", {
      email: invite.email,
      redirectTo: "/welcome",
      redirect: false,
    });
  } catch {
    return { ok: false, message: "Could not send the sign-in link. Please try again." };
  }
  return { ok: true, message: "Check your inbox for a sign-in link." };
}
