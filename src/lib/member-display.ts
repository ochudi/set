/**
 * Member name presentation. Pure (no db/auth) so it is unit-testable and safe to
 * import from client and server alike.
 *
 * Deleted members keep their row so pledges, RSVPs and audit references survive
 * (see the soft-delete + anonymisation flow in src/lib/dal.ts). Anywhere a
 * member's name is shown off a joined row, render it through displayName() so a
 * deleted member reads as "Deleted member" rather than leaking a stale name or
 * showing a blank.
 */

export type NameParts = {
  firstName?: string | null;
  lastName?: string | null;
  preferredName?: string | null;
  deletedAt?: Date | string | null;
};

export const DELETED_MEMBER_LABEL = "Deleted member";

export function displayName(parts: NameParts): string {
  if (parts.deletedAt) return DELETED_MEMBER_LABEL;
  const name = [parts.preferredName ?? parts.firstName, parts.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  return name || "Member";
}

/** Up to two uppercase initials for an avatar fallback. */
export function initials(name: string): string {
  const letters = name
    .split(/\s+/)
    .map((part) => part[0])
    .filter((ch) => ch && /[a-z0-9]/i.test(ch))
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return letters || "M";
}
