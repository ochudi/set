"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { recordExternalPledge } from "@/lib/dal";
import { nairaToKobo } from "@/lib/money";
import { publicPledgeAllowed } from "@/lib/ratelimit";
import { verifyTurnstile } from "@/lib/turnstile";

export type ExternalPledgeState = { ok: boolean; message: string };

const schema = z.object({
  slug: z.string().trim().min(1),
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email(),
  amount: z.string().trim().min(1),
  channel: z.string().trim().max(20).optional(),
});

export async function externalPledgeAction(
  _prev: ExternalPledgeState | undefined,
  formData: FormData,
): Promise<ExternalPledgeState> {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  // 1) Turnstile — a missing token is rejected here, server-side.
  const token = formData.get("cf-turnstile-response");
  const verified = await verifyTurnstile(
    typeof token === "string" ? token : null,
    ip,
  );
  if (!verified) {
    return { ok: false, message: "Please complete the verification and try again." };
  }

  // 2) Rate limit: 5 per hour per IP.
  if (!(await publicPledgeAllowed(ip))) {
    return { ok: false, message: "Too many attempts. Please try again later." };
  }

  // 3) Server-side Zod.
  const parsed = schema.safeParse({
    slug: formData.get("slug"),
    name: formData.get("name"),
    email: formData.get("email"),
    amount: formData.get("amount"),
    channel: formData.get("channel"),
  });
  if (!parsed.success) {
    return { ok: false, message: "Check your details and try again." };
  }
  const kobo = nairaToKobo(parsed.data.amount);
  if (kobo === null || kobo <= 0) {
    return { ok: false, message: "Enter a valid amount in naira." };
  }

  const res = await recordExternalPledge(parsed.data.slug, {
    name: parsed.data.name,
    email: parsed.data.email,
    amountKobo: kobo,
    channel: parsed.data.channel ?? null,
  });
  if (!res.ok) {
    return { ok: false, message: res.error ?? "Could not record your pledge." };
  }
  return {
    ok: true,
    message: "Thank you. Your pledge is logged and the team will reach out.",
  };
}
