"use server";

import { revalidatePath } from "next/cache";

import {
  createAnnouncement,
  deleteAnnouncement,
  publishAnnouncement,
  updateAnnouncement,
  type AnnouncementInput,
} from "@/lib/dal";

async function ensureSaved(
  id: string | null,
  input: AnnouncementInput,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!id) return createAnnouncement(input);
  const res = await updateAnnouncement(id, input);
  return res.ok ? { ok: true, id } : res;
}

export async function saveDraftAction(
  id: string | null,
  input: AnnouncementInput,
) {
  const res = await ensureSaved(id, input);
  if (res.ok) revalidatePath("/admin/announcements");
  return res;
}

export async function publishAction(
  id: string | null,
  input: AnnouncementInput,
  emailMembers: boolean,
): Promise<{
  ok: boolean;
  emailed: number;
  batches: number;
  capExceeded?: boolean;
  error?: string;
  id?: string;
}> {
  const saved = await ensureSaved(id, input);
  if (!saved.ok || !saved.id) {
    return { ok: false, emailed: 0, batches: 0, error: saved.error };
  }
  const res = await publishAnnouncement(saved.id, emailMembers);
  revalidatePath("/admin/announcements");
  revalidatePath("/announcements");
  return { ...res, id: saved.id };
}

export async function deleteAnnouncementAction(id: string) {
  const res = await deleteAnnouncement(id);
  if (res.ok) {
    revalidatePath("/admin/announcements");
    revalidatePath("/announcements");
  }
  return res;
}
