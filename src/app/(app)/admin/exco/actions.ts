"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  createExcoMember,
  deleteExcoMember,
  requireRole,
  updateExcoMember,
} from "@/lib/dal";

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  role: z.string().trim().min(1).max(120),
  email: z.union([z.string().email(), z.literal("")]),
  photoUrl: z.string().trim().max(500),
  bio: z.string().trim().max(600),
  setLabel: z.string().trim().max(60),
  group: z.enum(["exco", "alumni_office"]),
  sortOrder: z.number().int().min(0).max(999),
});

export type ExcoFormInput = z.infer<typeof schema>;

function toInput(d: ExcoFormInput) {
  return {
    name: d.name,
    role: d.role,
    email: d.email || null,
    photoUrl: d.photoUrl || null,
    bio: d.bio || null,
    setLabel: d.setLabel || null,
    group: d.group,
    sortOrder: d.sortOrder,
  };
}

function revalidate() {
  revalidatePath("/admin/exco");
  revalidatePath("/exco");
}

export async function createExcoAction(input: ExcoFormInput) {
  await requireRole("exco", "super_admin");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Check the fields." };
  await createExcoMember(toInput(parsed.data));
  revalidate();
  return { ok: true as const };
}

export async function updateExcoAction(id: string, input: ExcoFormInput) {
  await requireRole("exco", "super_admin");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Check the fields." };
  const res = await updateExcoMember(id, toInput(parsed.data));
  if (res.ok) revalidate();
  return res;
}

export async function deleteExcoAction(id: string) {
  await requireRole("exco", "super_admin");
  const res = await deleteExcoMember(id);
  if (res.ok) revalidate();
  return res;
}
