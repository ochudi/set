"use server";

import { revalidatePath } from "next/cache";
import { fromZonedTime } from "date-fns-tz";
import { z } from "zod";

import {
  cancelEvent,
  createEvent,
  deleteEvent,
  exportEventRsvpsCsv,
  publishEvent,
  requireRole,
  sendEventInvites,
  updateEvent,
  type EventInput,
} from "@/lib/dal";

const WAT = "Africa/Lagos";

export type ActionResult = { ok: boolean; error?: string };

const optionalNumber = z.preprocess(
  (v) => (v === "" || v == null ? undefined : Number(v)),
  z.number().int().min(1).max(100000).optional(),
);

const baseSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(20000),
  isVirtual: z.boolean(),
  location: z.string().trim().max(300),
  meetingUrl: z.string().trim().max(500),
  startsAt: z.string().min(1, "Start time is required"),
  endsAt: z.string(),
  capacity: optionalNumber,
  coverImage: z.string().trim().max(1000),
});

type BaseInput = z.input<typeof baseSchema>;

function toEventInput(d: z.output<typeof baseSchema>): EventInput {
  // datetime-local strings are entered in WAT; convert to a UTC instant.
  return {
    title: d.title,
    description: d.description || null,
    isVirtual: d.isVirtual,
    location: d.location || null,
    meetingUrl: d.meetingUrl || null,
    startsAt: fromZonedTime(d.startsAt, WAT),
    endsAt: d.endsAt ? fromZonedTime(d.endsAt, WAT) : null,
    capacity: d.capacity ?? null,
    coverImage: d.coverImage || null,
  };
}

export async function createEventAction(
  values: BaseInput,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  await requireRole("exco", "super_admin");
  const parsed = baseSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const res = await createEvent(toEventInput(parsed.data));
  if (res.ok) revalidatePath("/admin/events");
  return res;
}

export async function updateEventAction(
  id: string,
  values: BaseInput,
): Promise<ActionResult> {
  await requireRole("exco", "super_admin");
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: "Invalid event." };
  }
  const parsed = baseSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const res = await updateEvent(id, toEventInput(parsed.data));
  if (res.ok) {
    revalidatePath("/admin/events");
    revalidatePath(`/admin/events/${id}`);
    revalidatePath(`/events/${id}`);
  }
  return res;
}

export async function publishEventAction(
  id: string,
  emailMembers: boolean,
): Promise<{ ok: boolean; error?: string; emailed?: number }> {
  await requireRole("exco", "super_admin");
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: "Invalid event." };
  }
  const res = await publishEvent(id, Boolean(emailMembers));
  if (res.ok) {
    revalidatePath("/admin/events");
    revalidatePath(`/admin/events/${id}`);
  }
  return res;
}

export async function sendInvitesAction(
  id: string,
): Promise<{ ok: boolean; recipients?: number }> {
  await requireRole("exco", "super_admin");
  if (!z.string().uuid().safeParse(id).success) return { ok: false };
  const res = await sendEventInvites(id);
  return { ok: true, recipients: res.recipients };
}

export async function cancelEventAction(
  id: string,
): Promise<{ ok: boolean; error?: string; notified?: number }> {
  await requireRole("exco", "super_admin");
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: "Invalid event." };
  }
  const res = await cancelEvent(id);
  if (res.ok) {
    revalidatePath("/admin/events");
    revalidatePath(`/admin/events/${id}`);
    revalidatePath(`/events/${id}`);
  }
  return res;
}

export async function deleteEventAction(id: string): Promise<ActionResult> {
  await requireRole("exco", "super_admin");
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: "Invalid event." };
  }
  const res = await deleteEvent(id);
  if (res.ok) revalidatePath("/admin/events");
  return res;
}

export async function exportRsvpsAction(
  id: string,
): Promise<{ csv: string; count: number }> {
  await requireRole("exco", "super_admin");
  if (!z.string().uuid().safeParse(id).success) return { csv: "", count: 0 };
  return exportEventRsvpsCsv(id);
}
