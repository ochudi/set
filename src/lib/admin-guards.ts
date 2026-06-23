/**
 * Server-enforced guardrails for member administration. Pure (no db/auth) so the
 * rules are unit-testable; the DAL fetches the facts (target role, active
 * super-admin count) and calls these before mutating.
 *
 * Rules (CLAUDE.md is security-first; these are binding):
 *   - an admin cannot demote their own account
 *   - the last (active) super admin cannot be demoted, suspended, or deleted
 */

export type Role = "member" | "exco" | "super_admin";

const RANK: Record<Role, number> = { member: 0, exco: 1, super_admin: 2 };

export type GuardResult = { ok: true } | { ok: false; error: string };

export type RoleChangeInput = {
  actorUserId: string;
  targetUserId: string;
  targetCurrentRole: Role;
  newRole: Role;
  /** active, non-deleted super admins (including the target if it is one) */
  activeSuperAdminCount: number;
};

export function guardRoleChange(i: RoleChangeInput): GuardResult {
  if (
    i.actorUserId === i.targetUserId &&
    RANK[i.newRole] < RANK[i.targetCurrentRole]
  ) {
    return { ok: false, error: "You cannot demote your own account." };
  }
  if (
    i.targetCurrentRole === "super_admin" &&
    i.newRole !== "super_admin" &&
    i.activeSuperAdminCount <= 1
  ) {
    return { ok: false, error: "You cannot remove the last super admin." };
  }
  return { ok: true };
}

export type StatusAction = "suspend" | "delete" | "reactivate";

export type StatusChangeInput = {
  targetRole: Role;
  action: StatusAction;
  activeSuperAdminCount: number;
};

export function guardStatusChange(i: StatusChangeInput): GuardResult {
  if (i.action === "reactivate") return { ok: true };
  if (i.targetRole === "super_admin" && i.activeSuperAdminCount <= 1) {
    const verb = i.action === "delete" ? "delete" : "suspend";
    return { ok: false, error: `You cannot ${verb} the last super admin.` };
  }
  return { ok: true };
}
