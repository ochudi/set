"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  requireSuperAdmin,
  setDailyBulkCap,
  setEmailSettings,
  setOrgSettings,
  transferSuperAdmin,
} from "@/lib/dal";

const emailOrEmpty = z.union([z.string().email(), z.literal("")]);

const orgSchema = z.object({
  name: z.string().trim().max(120),
  contactEmail: emailOrEmpty,
  foundingYear: z.union([z.string().regex(/^\d{4}$/), z.literal("")]),
});

const emailSchema = z.object({
  fromName: z.string().trim().max(80),
  replyTo: emailOrEmpty,
});

const transferSchema = z.object({
  targetUserId: z.string().uuid(),
  confirmEmail: z.string().trim().min(1),
});

export async function saveOrgAction(input: z.infer<typeof orgSchema>) {
  await requireSuperAdmin();
  const parsed = orgSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the organization fields." };
  const res = await setOrgSettings({
    name: parsed.data.name,
    contactEmail: parsed.data.contactEmail,
    foundingYear: parsed.data.foundingYear,
  });
  if (res.ok) {
    revalidatePath("/admin/settings");
    revalidatePath("/");
    revalidatePath("/privacy");
    revalidatePath("/terms");
  }
  return res;
}

export async function saveEmailAction(input: z.infer<typeof emailSchema>) {
  await requireSuperAdmin();
  const parsed = emailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Check the email fields." };
  const res = await setEmailSettings({
    fromName: parsed.data.fromName,
    replyTo: parsed.data.replyTo,
  });
  if (res.ok) revalidatePath("/admin/settings");
  return res;
}

export async function saveDailyCapAction(cap: number) {
  await requireSuperAdmin();
  const res = await setDailyBulkCap(cap);
  if (res.ok) revalidatePath("/admin/settings");
  return res;
}

export async function transferSuperAdminAction(
  input: z.infer<typeof transferSchema>,
) {
  await requireSuperAdmin();
  const parsed = transferSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Pick a member and confirm." };
  const res = await transferSuperAdmin(
    parsed.data.targetUserId,
    parsed.data.confirmEmail,
  );
  if (res.ok) revalidatePath("/admin/settings");
  return res;
}
