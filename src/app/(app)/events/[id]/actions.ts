"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSession, rsvpToEvent } from "@/lib/dal";

export async function rsvpAction(
  eventId: string,
  status: "going" | "maybe" | "declined",
): Promise<{ ok: boolean; error?: string }> {
  await requireSession();
  const parsed = z
    .object({
      eventId: z.string().uuid(),
      status: z.enum(["going", "maybe", "declined"]),
    })
    .safeParse({ eventId, status });
  if (!parsed.success) return { ok: false, error: "Invalid RSVP." };

  const res = await rsvpToEvent(parsed.data.eventId, parsed.data.status);
  if (res.ok) revalidatePath(`/events/${eventId}`);
  return res;
}
