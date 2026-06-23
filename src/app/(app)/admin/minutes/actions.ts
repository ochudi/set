"use server";

import { revalidatePath } from "next/cache";

import {
  createMinutes,
  deleteMinutes,
  generateMinutes,
  requireRole,
  updateMinutes,
} from "@/lib/dal";
import type { MinutesDraft } from "@/lib/minutes";

export async function generateMinutesAction(transcript: string, notes: string) {
  await requireRole("exco", "super_admin");
  if (!transcript.trim()) {
    return { ok: false as const, error: "Paste a transcript first." };
  }
  const { draft, usedAi } = await generateMinutes(transcript, notes);
  return { ok: true as const, draft, usedAi };
}

export async function createMinutesAction(
  draft: MinutesDraft,
  rawTranscript: string,
  status: "draft" | "final",
) {
  await requireRole("exco", "super_admin");
  const { id } = await createMinutes({ ...draft, rawTranscript, status });
  revalidatePath("/admin/minutes");
  return { ok: true as const, id };
}

export async function updateMinutesAction(
  id: string,
  draft: MinutesDraft,
  status: "draft" | "final",
) {
  await requireRole("exco", "super_admin");
  const res = await updateMinutes(id, { ...draft, status });
  if (res.ok) {
    revalidatePath("/admin/minutes");
    revalidatePath(`/admin/minutes/${id}`);
  }
  return res;
}

export async function deleteMinutesAction(id: string) {
  await requireRole("exco", "super_admin");
  const res = await deleteMinutes(id);
  if (res.ok) revalidatePath("/admin/minutes");
  return res;
}
