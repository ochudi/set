"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { signOut } from "@/auth";
import { encryptPhone } from "@/lib/crypto";
import {
  requireSession,
  revokeMySession,
  saveMyMember,
  signOutOtherSessions,
  softDeleteMyAccount,
} from "@/lib/dal";
import { isPauFaculty } from "@/lib/pau";

// Every action opens with a DAL guard and validates with Zod (rule 3).

export type ActionResult = { ok: boolean; error?: string };

const optionalText = (max: number) => z.string().trim().max(max);

const profileSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().min(1, "Last name is required").max(80),
  preferredName: optionalText(80),
  avatarUrl: optionalText(1000),
  bio: optionalText(500),
  graduationYear: z.coerce.number().int().min(1990).max(2100),
  faculty: z.string().refine(isPauFaculty, "Choose a faculty"),
  programme: optionalText(120),
  phone: optionalText(40),
  city: optionalText(120),
  country: optionalText(120),
  jobTitle: optionalText(160),
  company: optionalText(160),
  linkedinUrl: optionalText(300),
});

export async function saveMyProfile(
  values: z.input<typeof profileSchema>,
): Promise<ActionResult> {
  await requireSession();
  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: "Please check the highlighted fields." };
  }
  const d = parsed.data;
  await saveMyMember({
    firstName: d.firstName,
    lastName: d.lastName,
    preferredName: d.preferredName || null,
    avatarUrl: d.avatarUrl || null,
    bio: d.bio || null,
    graduationYear: d.graduationYear,
    faculty: d.faculty,
    programme: d.programme || null,
    // Phone is encrypted at rest (rule 7); clearing the field removes it.
    phoneEncrypted: d.phone ? encryptPhone(d.phone) : null,
    city: d.city || null,
    country: d.country || null,
    jobTitle: d.jobTitle || null,
    company: d.company || null,
    linkedinUrl: d.linkedinUrl || null,
  });
  revalidatePath("/me");
  return { ok: true };
}

const visibility = z.enum(["public", "members", "private"]);

const privacySchema = z.object({
  profileVisibility: visibility,
  emailVisibility: visibility,
  phoneVisibility: visibility,
});

export async function savePrivacy(
  values: z.infer<typeof privacySchema>,
): Promise<ActionResult> {
  await requireSession();
  const parsed = privacySchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Invalid privacy settings." };
  await saveMyMember(parsed.data);
  return { ok: true };
}

const notificationsSchema = z.object({
  notifyAnnouncements: z.boolean(),
  notifyEvents: z.boolean(),
  notifyFundraisers: z.boolean(),
});

export async function saveNotifications(
  values: z.infer<typeof notificationsSchema>,
): Promise<ActionResult> {
  await requireSession();
  const parsed = notificationsSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Invalid settings." };
  await saveMyMember(parsed.data);
  return { ok: true };
}

export async function revokeSession(id: string): Promise<ActionResult> {
  await requireSession();
  const parsed = z.string().min(1).max(128).safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid session." };
  await revokeMySession(parsed.data);
  revalidatePath("/me");
  return { ok: true };
}

export async function signOutOthers(): Promise<ActionResult> {
  await requireSession();
  await signOutOtherSessions();
  revalidatePath("/me");
  return { ok: true };
}

export async function deleteAccount(formData: FormData): Promise<void> {
  await requireSession();
  const confirm = String(formData.get("confirm") ?? "");
  // The UI also gates the button, but never trust the client (rule 3).
  if (confirm !== "DELETE") return;
  await softDeleteMyAccount();
  await signOut({ redirectTo: "/login?deleted=1" });
}
