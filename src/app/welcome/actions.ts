"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { completeOnboarding, saveMyMember } from "@/lib/dal";
import { isPauFaculty } from "@/lib/pau";

// Each step is its own action that validates (rule 3), persists, then advances.
// Because every step writes to the member row, a refresh reloads saved values.

const step1Schema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  preferredName: z.string().trim().max(80).optional(),
  avatarUrl: z.string().trim().max(1000).optional(),
});

export async function saveStep1(formData: FormData) {
  const parsed = step1Schema.safeParse({
    firstName: formData.get("firstName") ?? "",
    lastName: formData.get("lastName") ?? "",
    preferredName: formData.get("preferredName") ?? "",
    avatarUrl: formData.get("avatarUrl") ?? "",
  });
  if (!parsed.success) redirect("/welcome?step=1&error=1");
  await saveMyMember({
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    preferredName: parsed.data.preferredName || null,
    avatarUrl: parsed.data.avatarUrl || null,
  });
  redirect("/welcome?step=2");
}

const step2Schema = z.object({
  graduationYear: z.coerce.number().int().min(1990).max(2100),
  faculty: z.string().refine(isPauFaculty, "Choose a faculty"),
  programme: z.string().trim().max(120).optional(),
});

export async function saveStep2(formData: FormData) {
  const parsed = step2Schema.safeParse({
    graduationYear: formData.get("graduationYear") ?? "",
    faculty: formData.get("faculty") ?? "",
    programme: formData.get("programme") ?? "",
  });
  if (!parsed.success) redirect("/welcome?step=2&error=1");
  await saveMyMember({
    graduationYear: parsed.data.graduationYear,
    faculty: parsed.data.faculty,
    programme: parsed.data.programme || null,
  });
  redirect("/welcome?step=3");
}

const step3Schema = z.object({
  city: z.string().trim().max(120).optional(),
  country: z.string().trim().max(120).optional(),
  jobTitle: z.string().trim().max(160).optional(),
  company: z.string().trim().max(160).optional(),
  linkedinUrl: z.string().trim().max(300).optional(),
});

export async function saveStep3(formData: FormData) {
  const parsed = step3Schema.safeParse({
    city: formData.get("city") ?? "",
    country: formData.get("country") ?? "",
    jobTitle: formData.get("jobTitle") ?? "",
    company: formData.get("company") ?? "",
    linkedinUrl: formData.get("linkedinUrl") ?? "",
  });
  if (!parsed.success) redirect("/welcome?step=3&error=1");
  await saveMyMember({
    city: parsed.data.city || null,
    country: parsed.data.country || null,
    jobTitle: parsed.data.jobTitle || null,
    company: parsed.data.company || null,
    linkedinUrl: parsed.data.linkedinUrl || null,
  });
  redirect("/welcome?step=4");
}

const visibility = z.enum(["public", "members", "private"]);
const checkbox = z
  .string()
  .optional()
  .transform((value) => value === "on");

const step4Schema = z.object({
  profileVisibility: visibility,
  emailVisibility: visibility,
  phoneVisibility: visibility,
  notifyAnnouncements: checkbox,
  notifyEvents: checkbox,
  notifyFundraisers: checkbox,
});

export async function saveStep4(formData: FormData) {
  const parsed = step4Schema.safeParse({
    profileVisibility: formData.get("profileVisibility") ?? "members",
    emailVisibility: formData.get("emailVisibility") ?? "members",
    phoneVisibility: formData.get("phoneVisibility") ?? "private",
    notifyAnnouncements: formData.get("notifyAnnouncements") ?? undefined,
    notifyEvents: formData.get("notifyEvents") ?? undefined,
    notifyFundraisers: formData.get("notifyFundraisers") ?? undefined,
  });
  if (!parsed.success) redirect("/welcome?step=4&error=1");
  await saveMyMember({ ...parsed.data });
  redirect("/welcome?step=5");
}

const step5Schema = z.object({ consent: z.literal("on") });

export async function saveStep5(formData: FormData) {
  const parsed = step5Schema.safeParse({ consent: formData.get("consent") ?? "" });
  if (!parsed.success) redirect("/welcome?step=5&error=1");
  await completeOnboarding();
  redirect("/dashboard");
}
