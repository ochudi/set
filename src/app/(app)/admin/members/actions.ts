"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  adminDeleteMember,
  bulkSuspendMembers,
  createInvite,
  exportRosterCsv,
  getMemberWithPrivacy,
  importMembers,
  requireRole,
  requireSuperAdmin,
  resendInvite,
  restoreMember,
  revokeInvite,
  sendPendingInvites,
  setMemberRole,
  setMemberStatus,
  updateMemberAsAdmin,
  type ImportSummary,
} from "@/lib/dal";
import { isPauFaculty } from "@/lib/pau";

export type ActionResult = { ok: boolean; error?: string };

const uuid = z.string().uuid();
const optionalYear = z.preprocess(
  (v) => (v === "" || v == null ? undefined : Number(v)),
  z.number().int().min(1990).max(2100).optional(),
);
const optionalFaculty = z
  .string()
  .trim()
  .refine((v) => v === "" || isPauFaculty(v), "Choose a faculty from the list");

// --- add a single member (invite) -----------------------------------------

const addSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().max(80),
  email: z.string().trim().email("Enter a valid email"),
  dateOfBirth: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Use YYYY-MM-DD"),
  graduationYear: optionalYear,
  faculty: optionalFaculty,
  role: z.enum(["member", "exco"]),
});

export async function addMember(
  values: z.input<typeof addSchema>,
): Promise<ActionResult & { sent?: boolean }> {
  await requireRole("exco", "super_admin");
  const parsed = addSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const d = parsed.data;
  const res = await createInvite({
    email: d.email,
    firstName: d.firstName,
    lastName: d.lastName || null,
    dateOfBirth: d.dateOfBirth || null,
    graduationYear: d.graduationYear ?? null,
    faculty: d.faculty || null,
    role: d.role,
  });
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/admin/members");
  return { ok: true, sent: res.sent };
}

// --- edit a member's profile fields ----------------------------------------

const editSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().max(80),
  preferredName: z.string().trim().max(80),
  graduationYear: optionalYear,
  faculty: optionalFaculty,
  city: z.string().trim().max(120),
  country: z.string().trim().max(120),
  jobTitle: z.string().trim().max(160),
  company: z.string().trim().max(160),
});

export type EditableMember = {
  firstName: string;
  lastName: string;
  preferredName: string;
  graduationYear: string;
  faculty: string;
  city: string;
  country: string;
  jobTitle: string;
  company: string;
};

/** Load a member's editable fields for the admin Edit sheet (admin sees all). */
export async function loadMemberForEdit(
  memberId: string,
): Promise<EditableMember | null> {
  await requireRole("exco", "super_admin");
  if (!uuid.safeParse(memberId).success) return null;
  const m = await getMemberWithPrivacy(memberId);
  if (!m) return null;
  return {
    firstName: m.firstName ?? "",
    lastName: m.lastName ?? "",
    preferredName: m.preferredName ?? "",
    graduationYear: m.graduationYear ? String(m.graduationYear) : "",
    faculty: m.faculty ?? "",
    city: m.city ?? "",
    country: m.country ?? "",
    jobTitle: m.jobTitle ?? "",
    company: m.company ?? "",
  };
}

export async function editMember(
  memberId: string,
  values: z.input<typeof editSchema>,
): Promise<ActionResult> {
  await requireRole("exco", "super_admin");
  if (!uuid.safeParse(memberId).success) return { ok: false, error: "Invalid member." };
  const parsed = editSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const d = parsed.data;
  const res = await updateMemberAsAdmin(memberId, {
    firstName: d.firstName,
    lastName: d.lastName || null,
    preferredName: d.preferredName || null,
    graduationYear: d.graduationYear ?? null,
    faculty: d.faculty || null,
    city: d.city || null,
    country: d.country || null,
    jobTitle: d.jobTitle || null,
    company: d.company || null,
  });
  if (res.ok) revalidatePath("/admin/members");
  return res;
}

// --- role / status / delete ------------------------------------------------

export async function changeRole(
  userId: string,
  role: "member" | "exco" | "super_admin",
): Promise<ActionResult> {
  await requireSuperAdmin();
  const parsed = z
    .object({ userId: uuid, role: z.enum(["member", "exco", "super_admin"]) })
    .safeParse({ userId, role });
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const res = await setMemberRole(parsed.data.userId, parsed.data.role);
  if (res.ok) revalidatePath("/admin/members");
  return res;
}

export async function setStatus(
  userId: string,
  action: "suspend" | "reactivate",
): Promise<ActionResult> {
  await requireRole("exco", "super_admin");
  const parsed = z
    .object({ userId: uuid, action: z.enum(["suspend", "reactivate"]) })
    .safeParse({ userId, action });
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  const res = await setMemberStatus(parsed.data.userId, parsed.data.action);
  if (res.ok) revalidatePath("/admin/members");
  return res;
}

export async function deleteMemberAction(memberId: string): Promise<ActionResult> {
  await requireRole("exco", "super_admin");
  if (!uuid.safeParse(memberId).success) return { ok: false, error: "Invalid member." };
  const res = await adminDeleteMember(memberId);
  if (res.ok) revalidatePath("/admin/members");
  return res;
}

// --- invites ---------------------------------------------------------------

export async function resendInviteAction(
  inviteId: string,
): Promise<ActionResult & { sent?: boolean }> {
  await requireRole("exco", "super_admin");
  if (!uuid.safeParse(inviteId).success) return { ok: false, error: "Invalid invite." };
  const res = await resendInvite(inviteId);
  if (res.ok) revalidatePath("/admin/members");
  return res;
}

export async function revokeInviteAction(inviteId: string): Promise<ActionResult> {
  await requireRole("exco", "super_admin");
  if (!uuid.safeParse(inviteId).success) return { ok: false, error: "Invalid invite." };
  const res = await revokeInvite(inviteId);
  if (res.ok) revalidatePath("/admin/members");
  return res;
}

export async function sendInvitesAction(
  inviteIds: string[],
): Promise<{ sent: number; failed: number }> {
  await requireRole("exco", "super_admin");
  const parsed = z.array(uuid).max(1000).safeParse(inviteIds);
  if (!parsed.success) return { sent: 0, failed: 0 };
  const res = await sendPendingInvites(parsed.data);
  revalidatePath("/admin/members");
  return res;
}

// --- bulk ------------------------------------------------------------------

export async function bulkSuspendAction(
  userIds: string[],
): Promise<{ suspended: number; skipped: number }> {
  await requireRole("exco", "super_admin");
  const parsed = z.array(uuid).max(1000).safeParse(userIds);
  if (!parsed.success) return { suspended: 0, skipped: 0 };
  const res = await bulkSuspendMembers(parsed.data);
  revalidatePath("/admin/members");
  return res;
}

export async function exportCsvAction(
  selectedIds: string[],
): Promise<{ csv: string; count: number; capped: boolean }> {
  await requireRole("exco", "super_admin");
  const parsed = z.array(uuid).max(5000).safeParse(selectedIds);
  return exportRosterCsv(parsed.success ? parsed.data : []);
}

// --- CSV import ------------------------------------------------------------

export async function importMembersAction(
  rawRows: Record<string, string>[],
  sendInvites: boolean,
): Promise<ImportSummary> {
  await requireRole("exco", "super_admin");
  const rows = Array.isArray(rawRows) ? rawRows.slice(0, 1000) : [];
  const res = await importMembers(rows, Boolean(sendInvites));
  revalidatePath("/admin/members");
  return res;
}

// --- restore (super admin; kept from the account-deletion work) ------------

export async function restoreMemberAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireSuperAdmin();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Invalid member." };
  const res = await restoreMember(id);
  if (!res.restored) {
    const error =
      res.reason === "grace_expired"
        ? "The grace window has expired; this account can no longer be restored."
        : res.reason === "not_deleted"
          ? "This account is not deleted."
          : "Member not found.";
    return { ok: false, error };
  }
  revalidatePath("/admin/members");
  return { ok: true };
}
