/**
 * Member privacy rules (CLAUDE.md rule 8 — PII renders only through
 * getMemberWithPrivacy). This module is PURE (no db/auth imports) so the rules
 * are unit-testable in isolation. The DAL fetches the record (RLS-scoped),
 * decrypts the phone, then runs it through applyMemberPrivacy.
 *
 * Visibility levels:
 *   public  — anyone, including logged-out (opt-in public profile pages)
 *   members — any signed-in member
 *   private — self and exco/super_admin only ("excos-only" for everyone else)
 */

export type Role = "member" | "exco" | "super_admin";
export type Visibility = "public" | "members" | "private";
export type UserStatus = "active" | "invited" | "suspended" | "deactivated";

export type Viewer = { userId: string | null; role: Role | null };

export type MemberRecord = {
  id: string;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  faculty: string | null;
  programme: string | null;
  graduationYear: number | null;
  company: string | null;
  jobTitle: string | null;
  industry: string | null;
  city: string | null;
  country: string | null;
  linkedinUrl: string | null;
  websiteUrl: string | null;
  email: string | null; // from users
  phone: string | null; // already decrypted, or null
  status: UserStatus; // from users
  role: Role; // from users — platform role (drives the exco/admin badge)
  profileVisibility: Visibility;
  emailVisibility: Visibility;
  phoneVisibility: Visibility;
  createdAt: Date; // when the member joined (from members.created_at)
  deletedAt: Date | null;
};

export type MemberView = Omit<MemberRecord, "email" | "phone"> & {
  email: string | null;
  phone: string | null;
  isSelf: boolean;
  // True when a value exists on the record but is withheld from this viewer by
  // privacy settings (vs simply not provided) — lets the UI show a quiet
  // "hidden by privacy settings" note instead of dropping the row silently.
  emailHidden: boolean;
  phoneHidden: boolean;
};

function present(target: MemberRecord, email: string | null, phone: string | null, isSelf: boolean): MemberView {
  // Drop the raw contact fields, then re-add the privacy-resolved ones.
  const { email: _e, phone: _p, ...rest } = target;
  void _e;
  void _p;
  return {
    ...rest,
    email,
    phone,
    isSelf,
    emailHidden: email === null && target.email !== null,
    phoneHidden: phone === null && target.phone !== null,
  };
}

export function applyMemberPrivacy(
  target: MemberRecord,
  viewer: Viewer,
): MemberView | null {
  const isAuthenticated = viewer.userId != null;
  const isSelf = isAuthenticated && viewer.userId === target.userId;
  const isAdmin = viewer.role === "exco" || viewer.role === "super_admin";

  // Soft-deleted members are invisible to everyone but admins.
  if (target.deletedAt && !isAdmin) return null;

  // Self and admins see the full record (incl. suspended/private).
  if (isSelf || isAdmin) {
    return present(target, target.email, target.phone, isSelf);
  }

  // Logged-out viewers only ever see opt-in public profiles.
  if (!isAuthenticated) {
    if (target.profileVisibility !== "public") return null;
    return present(
      target,
      target.emailVisibility === "public" ? target.email : null,
      target.phoneVisibility === "public" ? target.phone : null,
      false,
    );
  }

  // A regular signed-in member viewing someone else.
  if (target.status === "suspended") return null;
  if (target.profileVisibility === "private") return null;

  return present(
    target,
    target.emailVisibility === "private" ? null : target.email,
    target.phoneVisibility === "private" ? null : target.phone,
    false,
  );
}
