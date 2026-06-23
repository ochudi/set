"use server";

import { z } from "zod";

import { recordRsvpByToken } from "@/lib/dal";

// Pre-auth, token-authorized action (no session). The GET page never mutates
// (rule 5); this POST records the reply, so a scanner prefetch of the link
// changes nothing.
export type RsvpResult = { ok: boolean; message: string };

const statusSchema = z.enum(["going", "maybe", "declined"]);

export async function submitRsvp(
  _prev: RsvpResult | undefined,
  formData: FormData,
): Promise<RsvpResult> {
  const token = String(formData.get("token") ?? "");
  const status = statusSchema.safeParse(String(formData.get("status") ?? ""));
  if (!token || !status.success) {
    return { ok: false, message: "That RSVP link is not valid." };
  }
  const res = await recordRsvpByToken(token, status.data);
  if (!res.ok) {
    return { ok: false, message: res.error ?? "Could not record your RSVP." };
  }
  const message =
    status.data === "going"
      ? "You're going. See you there."
      : status.data === "maybe"
        ? "Noted as maybe."
        : "Noted that you can't make it.";
  return { ok: true, message };
}
