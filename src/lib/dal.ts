import { randomUUID } from "node:crypto";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  aliasedTable,
  and,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { formatInTimeZone } from "date-fns-tz";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { db } from "@/db";
import {
  announcements,
  appSettings,
  auditLog,
  birthdaySent,
  eventRsvps,
  events,
  excoMembers,
  fundraiserPledges,
  fundraiserUpdates,
  fundraisers,
  invites,
  meetingMinutes,
  members,
  rsvpEmailTokens,
  sessions,
  users,
  type Member,
} from "@/db/schema";
export type { Member, MeetingMinutes, ExcoMember } from "@/db/schema";
import { decryptPhone } from "@/lib/crypto";
import { describeDevice } from "@/lib/user-agent";
import { displayName } from "@/lib/member-display";
import { guardRoleChange, guardStatusChange } from "@/lib/admin-guards";
import { validateImportRow, type ImportRowData } from "@/lib/csv-import";
import { generateToken, hashToken, type UnsubCategory } from "@/lib/tokens";
import { formatAuditAction } from "@/lib/audit-format";
import { verifyPassword } from "@/lib/password";
import {
  buildMinutesMessages,
  fallbackMinutes,
  parseMinutesJson,
  type MinutesDraft,
} from "@/lib/minutes";
import JSZip from "jszip";
import { buildEventIcs } from "@/lib/ics";
import { send, sendEach } from "@/lib/email";
import InviteEmail from "@/emails/invite";
import EventInvite from "@/emails/event-invite";
import EventCancelled from "@/emails/event-cancelled";
import BirthdayWish from "@/emails/birthday-wish";
import BirthdayHeadsUp from "@/emails/birthday-heads-up";
import AnnouncementEmail from "@/emails/announcement";
import PledgeReceipt from "@/emails/pledge-receipt";
import { formatNaira } from "@/lib/money";
import {
  ageTurning,
  daysUntilBirthday,
  isBirthdayOn,
  nextBirthday,
  parseDob,
} from "@/lib/birthdays";
import {
  applyMemberPrivacy,
  type MemberRecord,
  type MemberView,
  type Viewer,
} from "@/lib/privacy";

/**
 * Data Access Layer. With src/db and src/auth, this is the only place allowed to
 * import the database client (eslint fence). Every route and server action goes
 * through these guards (rule 1); member/audit access carries the RLS context
 * the policies require (src/db/policies.sql).
 */

type Role = "member" | "exco" | "super_admin";
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// --- session guards -------------------------------------------------------

export const getSession = cache(async () => auth());

export const getSessionUser = cache(async () => (await auth())?.user ?? null);

export const requireSession = cache(async (): Promise<Session> => {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session;
});

export async function requireRole(...roles: Role[]): Promise<Session> {
  const session = await requireSession();
  if (!roles.includes(session.user.role)) redirect("/dashboard");
  return session;
}

export async function requireSuperAdmin(): Promise<Session> {
  return requireRole("super_admin");
}

// --- RLS-scoped reads -----------------------------------------------------
// Wrap work in a transaction that sets the two GUCs the members/audit_log
// policies read, so the restricted app_user role is scoped to the caller.
export async function withUserContext<T>(
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  const session = await auth();
  const userId = session?.user?.id ?? "";
  const role = session?.user?.role ?? "";
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
    await tx.execute(sql`select set_config('app.role', ${role}, true)`);
    return fn(tx);
  });
}

/**
 * System context for scheduled jobs that run with NO session (the birthday and
 * purge crons). Asserts super_admin so the members/audit RLS policies permit the
 * reads/writes. Only ever called from cron routes that have already verified the
 * CRON_SECRET bearer — never from a request-driven path.
 */
export async function withSystemContext<T>(
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', '', true)`);
    await tx.execute(sql`select set_config('app.role', 'super_admin', true)`);
    return fn(tx);
  });
}

async function currentViewer(): Promise<Viewer> {
  const session = await auth();
  if (!session?.user) return { userId: null, role: null };
  return { userId: session.user.id, role: session.user.role };
}

// --- member reads/writes --------------------------------------------------

export const getCurrentMember = cache(async (): Promise<Member | null> => {
  const session = await auth();
  if (!session?.user) return null;
  return withUserContext(async (tx) => {
    const [member] = await tx
      .select()
      .from(members)
      .where(eq(members.userId, session.user.id))
      .limit(1);
    return member ?? null;
  });
});

/** Privacy-safe member search for the command palette (RLS-scoped to the viewer). */
export async function searchMembers(query: string, limit = 8) {
  const trimmed = query.trim();
  if (trimmed.length < 1) return [];
  const pattern = `%${trimmed}%`;
  return withUserContext(async (tx) => {
    return tx
      .select({
        id: members.id,
        firstName: members.firstName,
        lastName: members.lastName,
        preferredName: members.preferredName,
        avatarUrl: members.avatarUrl,
        faculty: members.faculty,
      })
      .from(members)
      .where(
        and(
          isNull(members.deletedAt),
          or(
            ilike(members.firstName, pattern),
            ilike(members.lastName, pattern),
            ilike(members.preferredName, pattern),
          ),
        ),
      )
      .limit(limit);
  });
}

/**
 * Fetch a member with privacy applied for the given viewer (defaults to the
 * current session). The read is RLS-scoped; the per-field rules and the final
 * null/visible decision come from applyMemberPrivacy.
 */
export async function getMemberWithPrivacy(
  memberId: string,
  viewer?: Viewer,
): Promise<MemberView | null> {
  const who = viewer ?? (await currentViewer());

  const row = await withUserContext(async (tx) => {
    const [r] = await tx
      .select({
        id: members.id,
        userId: members.userId,
        firstName: members.firstName,
        lastName: members.lastName,
        preferredName: members.preferredName,
        avatarUrl: members.avatarUrl,
        bio: members.bio,
        faculty: members.faculty,
        programme: members.programme,
        graduationYear: members.graduationYear,
        company: members.company,
        jobTitle: members.jobTitle,
        industry: members.industry,
        city: members.city,
        country: members.country,
        linkedinUrl: members.linkedinUrl,
        websiteUrl: members.websiteUrl,
        phoneEncrypted: members.phoneEncrypted,
        profileVisibility: members.profileVisibility,
        emailVisibility: members.emailVisibility,
        phoneVisibility: members.phoneVisibility,
        createdAt: members.createdAt,
        deletedAt: members.deletedAt,
        email: users.email,
        status: users.status,
        role: users.role,
      })
      .from(members)
      .innerJoin(users, eq(users.id, members.userId))
      .where(eq(members.id, memberId))
      .limit(1);
    return r ?? null;
  });

  if (!row) return null;

  let phone: string | null = null;
  if (row.phoneEncrypted) {
    try {
      phone = decryptPhone(row.phoneEncrypted);
    } catch {
      phone = null;
    }
  }

  const { phoneEncrypted: _drop, ...rest } = row;
  void _drop;
  const record: MemberRecord = { ...rest, phone };
  return applyMemberPrivacy(record, who);
}

/** Upsert the caller's own member row with a partial patch (onboarding steps). */
export async function saveMyMember(
  patch: Partial<typeof members.$inferInsert>,
): Promise<void> {
  const session = await requireSession();
  await withUserContext(async (tx) => {
    await tx
      .insert(members)
      .values({ userId: session.user.id, ...patch })
      .onConflictDoUpdate({ target: members.userId, set: patch });
  });
}

/** Final onboarding step: record consent, mark onboarded, activate the user. */
export async function completeOnboarding(): Promise<void> {
  const session = await requireSession();
  const now = new Date();
  await withUserContext(async (tx) => {
    await tx
      .update(members)
      .set({ consentedAt: now, onboardedAt: now })
      .where(eq(members.userId, session.user.id));
    await tx
      .update(users)
      .set({ status: "active" })
      .where(eq(users.id, session.user.id));
  });
  await audit(session.user.id, "member.onboard", "member", session.user.id);
}

// --- allow-list (used by the login server action) -------------------------

export async function emailIsAllowed(rawEmail: string): Promise<boolean> {
  const email = rawEmail.toLowerCase();
  const [existing] = await db
    .select({ id: users.id, status: users.status, deletedAt: users.deletedAt })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing) {
    return existing.status !== "suspended" && existing.deletedAt === null;
  }
  const [invite] = await db
    .select({ id: invites.id })
    .from(invites)
    .where(
      and(
        eq(invites.email, email),
        eq(invites.status, "pending"),
        gt(invites.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return Boolean(invite);
}

// --- password login (additive to magic links; see src/lib/password.ts) -----
// Verifies email+password and mints a *database* session row (the same kind the
// Auth.js adapter creates), so the existing database session strategy, /me
// "your devices" view, and sign-out all keep working unchanged. Returns the raw
// session token to set as the auth cookie, or null on any failure (uniform, so
// the caller can show one enumeration-safe message).
export async function loginWithPassword(
  rawEmail: string,
  password: string,
): Promise<{ token: string; expires: Date } | null> {
  const email = rawEmail.trim().toLowerCase();
  const [u] = await db
    .select({
      id: users.id,
      status: users.status,
      deletedAt: users.deletedAt,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!u) return null;
  if (u.status === "suspended" || u.deletedAt) return null;
  if (!verifyPassword(password, u.passwordHash)) return null;

  const token = randomUUID();
  const expires = new Date(Date.now() + SESSION_MAX_AGE_MS);
  const userAgent = (await headers()).get("user-agent") ?? null;
  await db.insert(sessions).values({
    sessionToken: token,
    userId: u.id,
    expires,
    userAgent,
  });
  await db
    .update(users)
    .set({ lastSignInAt: new Date() })
    .where(eq(users.id, u.id));
  return { token, expires };
}

// --- audit (rule 4) -------------------------------------------------------
// Captures the request IP (x-forwarded-for) and user agent.
export async function audit(
  actor: string | null,
  action: string,
  targetType: string | null = null,
  targetId: string | null = null,
  metadata: Record<string, unknown> | null = null,
): Promise<void> {
  const h = await headers();
  const ipAddress = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = h.get("user-agent") ?? null;

  await db.insert(auditLog).values({
    actorId: actor,
    action,
    entityType: targetType,
    entityId: targetId,
    metadata,
    ipAddress,
    userAgent,
  });
}

// --- audit log reads (super admin) ----------------------------------------

export type AuditCursor = { createdAt: string; id: string };
export type AuditFilters = {
  actorId?: string | null;
  action?: string | null;
  entityType?: string | null;
  from?: Date | null; // inclusive lower bound on created_at
  to?: Date | null; // inclusive upper bound on created_at
  cursor?: AuditCursor | null;
  limit?: number;
};

export type AuditRow = {
  id: string;
  createdAt: Date;
  action: string;
  actorId: string | null;
  actorName: string;
  actorEmail: string | null;
  actorAvatarUrl: string | null;
  entityType: string | null;
  entityId: string | null;
  targetLabel: string | null;
  targetHref: string | null;
  summary: string;
  metadata: Record<string, unknown> | null;
};

export type AuditPage = { rows: AuditRow[]; nextCursor: AuditCursor | null };

const AUDIT_PAGE_SIZE = 25;

/** Resolve human labels + clickable hrefs for a page of audit targets, batched
 * per entity type so the table can render "clickable target" without N queries. */
async function resolveAuditTargets(
  rows: { entityType: string | null; entityId: string | null }[],
): Promise<Map<string, { label: string; href: string | null }>> {
  const out = new Map<string, { label: string; href: string | null }>();
  const key = (type: string, id: string) => `${type}:${id}`;
  const idsByType = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!r.entityType || !r.entityId) continue;
    if (r.entityType === "setting") {
      out.set(key(r.entityType, r.entityId), { label: r.entityId, href: null });
      continue;
    }
    const set = idsByType.get(r.entityType) ?? new Set<string>();
    set.add(r.entityId);
    idsByType.set(r.entityType, set);
  }

  for (const [type, idSet] of idsByType) {
    const ids = [...idSet];
    if (type === "member") {
      const rs = await db
        .select({
          id: members.id,
          firstName: members.firstName,
          lastName: members.lastName,
          preferredName: members.preferredName,
        })
        .from(members)
        .where(inArray(members.id, ids));
      for (const m of rs)
        out.set(key(type, m.id), { label: displayName(m), href: `/directory/${m.id}` });
    } else if (type === "user") {
      // Audit target is a user id; map to the member row for a directory link.
      const rs = await db
        .select({
          userId: users.id,
          email: users.email,
          memberId: members.id,
          firstName: members.firstName,
          lastName: members.lastName,
          preferredName: members.preferredName,
        })
        .from(users)
        .leftJoin(members, eq(members.userId, users.id))
        .where(inArray(users.id, ids));
      for (const u of rs) {
        const label = u.memberId
          ? displayName({ firstName: u.firstName, lastName: u.lastName, preferredName: u.preferredName })
          : u.email;
        out.set(key(type, u.userId), {
          label,
          href: u.memberId ? `/directory/${u.memberId}` : null,
        });
      }
    } else if (type === "event") {
      const rs = await db
        .select({ id: events.id, title: events.title })
        .from(events)
        .where(inArray(events.id, ids));
      for (const e of rs)
        out.set(key(type, e.id), { label: e.title, href: `/admin/events/${e.id}` });
    } else if (type === "fundraiser") {
      const rs = await db
        .select({ id: fundraisers.id, title: fundraisers.title })
        .from(fundraisers)
        .where(inArray(fundraisers.id, ids));
      for (const f of rs)
        out.set(key(type, f.id), { label: f.title, href: `/admin/fundraisers/${f.id}` });
    } else if (type === "announcement") {
      const rs = await db
        .select({ id: announcements.id, title: announcements.title })
        .from(announcements)
        .where(inArray(announcements.id, ids));
      for (const a of rs)
        out.set(key(type, a.id), {
          label: a.title,
          href: `/admin/announcements/${a.id}`,
        });
    } else if (type === "invite") {
      const rs = await db
        .select({ id: invites.id, email: invites.email })
        .from(invites)
        .where(inArray(invites.id, ids));
      for (const i of rs) out.set(key(type, i.id), { label: i.email, href: null });
    } else if (type === "minutes") {
      const rs = await db
        .select({ id: meetingMinutes.id, title: meetingMinutes.title })
        .from(meetingMinutes)
        .where(inArray(meetingMinutes.id, ids));
      for (const m of rs)
        out.set(key(type, m.id), { label: m.title, href: `/admin/minutes/${m.id}` });
    } else if (type === "exco") {
      const rs = await db
        .select({ id: excoMembers.id, name: excoMembers.name })
        .from(excoMembers)
        .where(inArray(excoMembers.id, ids));
      for (const e of rs)
        out.set(key(type, e.id), { label: e.name, href: "/admin/exco" });
    }
  }
  return out;
}

/** Cursor-paginated audit log, newest first (created_at desc, id desc tiebreak),
 * with optional actor / action / entity-type / date-range filters. */
export async function listAuditLog(filters: AuditFilters = {}): Promise<AuditPage> {
  await requireSuperAdmin();
  const limit = filters.limit ?? AUDIT_PAGE_SIZE;

  const conds = [];
  if (filters.actorId) conds.push(eq(auditLog.actorId, filters.actorId));
  if (filters.action) conds.push(eq(auditLog.action, filters.action));
  if (filters.entityType) conds.push(eq(auditLog.entityType, filters.entityType));
  if (filters.from) conds.push(gte(auditLog.createdAt, filters.from));
  if (filters.to) conds.push(lte(auditLog.createdAt, filters.to));
  if (filters.cursor) {
    const c = new Date(filters.cursor.createdAt);
    conds.push(
      or(
        lt(auditLog.createdAt, c),
        and(eq(auditLog.createdAt, c), lt(auditLog.id, filters.cursor.id)),
      ),
    );
  }

  const actorMembers = aliasedTable(members, "actor_members");
  const raw = await db
    .select({
      id: auditLog.id,
      createdAt: auditLog.createdAt,
      action: auditLog.action,
      actorId: auditLog.actorId,
      actorEmail: auditLog.actorEmail,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      metadata: auditLog.metadata,
      userName: users.name,
      userEmail: users.email,
      firstName: actorMembers.firstName,
      lastName: actorMembers.lastName,
      preferredName: actorMembers.preferredName,
      avatarUrl: actorMembers.avatarUrl,
    })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorId))
    .leftJoin(actorMembers, eq(actorMembers.userId, auditLog.actorId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .limit(limit + 1);

  const hasMore = raw.length > limit;
  const page = hasMore ? raw.slice(0, limit) : raw;
  const targets = await resolveAuditTargets(page);

  const rows: AuditRow[] = page.map((r) => {
    const tKey = r.entityType && r.entityId ? `${r.entityType}:${r.entityId}` : null;
    const target = tKey ? targets.get(tKey) ?? null : null;
    const actorName = r.actorId
      ? r.firstName || r.lastName || r.preferredName
        ? displayName({
            firstName: r.firstName,
            lastName: r.lastName,
            preferredName: r.preferredName,
          })
        : r.userName || r.userEmail || r.actorEmail || "Unknown"
      : "System";
    const metadata = (r.metadata as Record<string, unknown> | null) ?? null;
    return {
      id: r.id,
      createdAt: r.createdAt,
      action: r.action,
      actorId: r.actorId,
      actorName,
      actorEmail: r.userEmail ?? r.actorEmail,
      actorAvatarUrl: r.avatarUrl,
      entityType: r.entityType,
      entityId: r.entityId,
      targetLabel: target?.label ?? null,
      targetHref: target?.href ?? null,
      summary: formatAuditAction(r.action, metadata, target?.label ?? null),
      metadata,
    };
  });

  const last = page[page.length - 1];
  return {
    rows,
    nextCursor: hasMore && last
      ? { createdAt: last.createdAt.toISOString(), id: last.id }
      : null,
  };
}

/** Distinct actors that appear in the audit log, for the filter dropdown. */
export async function listAuditActors(): Promise<
  { id: string; name: string }[]
> {
  await requireSuperAdmin();
  const rows = await db
    .selectDistinct({
      id: users.id,
      name: users.name,
      email: users.email,
      firstName: members.firstName,
      lastName: members.lastName,
      preferredName: members.preferredName,
    })
    .from(auditLog)
    .innerJoin(users, eq(users.id, auditLog.actorId))
    .leftJoin(members, eq(members.userId, users.id));
  return rows
    .map((r) => ({
      id: r.id,
      name:
        r.firstName || r.lastName || r.preferredName
          ? displayName(r)
          : r.name || r.email,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Distinct action keys present in the audit log, for the filter dropdown. */
export async function listAuditActions(): Promise<string[]> {
  await requireSuperAdmin();
  const rows = await db
    .selectDistinct({ action: auditLog.action })
    .from(auditLog)
    .orderBy(auditLog.action);
  return rows.map((r) => r.action);
}

// --- directory + profile reads --------------------------------------------

const directoryColumns = {
  id: members.id,
  firstName: members.firstName,
  lastName: members.lastName,
  preferredName: members.preferredName,
  avatarUrl: members.avatarUrl,
  faculty: members.faculty,
  programme: members.programme,
  graduationYear: members.graduationYear,
  jobTitle: members.jobTitle,
  company: members.company,
  city: members.city,
  country: members.country,
  linkedinUrl: members.linkedinUrl,
  role: users.role,
} as const;

export type DirectoryMember = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
  avatarUrl: string | null;
  faculty: string | null;
  programme: string | null;
  graduationYear: number | null;
  jobTitle: string | null;
  company: string | null;
  city: string | null;
  country: string | null;
  linkedinUrl: string | null;
  role: Role;
};

/**
 * Every browsable member for the directory: active, non-deleted, profile
 * visibility public/members. Privacy-safe fields only — never email/phone.
 * Private profiles are excluded here for everyone (reach those via a direct
 * link or admin). RLS-scoped to the viewer.
 */
export async function listActiveMembers(): Promise<DirectoryMember[]> {
  await requireSession();
  return withUserContext(async (tx) => {
    return tx
      .select(directoryColumns)
      .from(members)
      .innerJoin(users, eq(users.id, members.userId))
      .where(
        and(
          isNull(members.deletedAt),
          eq(users.status, "active"),
          inArray(members.profileVisibility, ["public", "members"]),
        ),
      )
      .orderBy(members.lastName, members.firstName);
  });
}

/** Up to `limit` other members from the same graduating set (privacy-safe). */
export async function getSetmates(
  graduationYear: number | null,
  excludeMemberId: string,
  limit = 5,
): Promise<DirectoryMember[]> {
  if (graduationYear == null) return [];
  await requireSession();
  return withUserContext(async (tx) => {
    return tx
      .select(directoryColumns)
      .from(members)
      .innerJoin(users, eq(users.id, members.userId))
      .where(
        and(
          isNull(members.deletedAt),
          eq(users.status, "active"),
          inArray(members.profileVisibility, ["public", "members"]),
          eq(members.graduationYear, graduationYear),
          ne(members.id, excludeMemberId),
        ),
      )
      .orderBy(members.lastName, members.firstName)
      .limit(limit);
  });
}

/**
 * Dashboard "Your set" callout: total count of setmates plus a small avatar
 * sample, in one round trip. Same privacy filter as the directory.
 */
export async function getSetCallout(
  graduationYear: number | null,
  excludeMemberId: string,
  sampleSize = 5,
): Promise<{ count: number; sample: DirectoryMember[] }> {
  if (graduationYear == null) return { count: 0, sample: [] };
  await requireSession();
  return withUserContext(async (tx) => {
    const where = and(
      isNull(members.deletedAt),
      eq(users.status, "active"),
      inArray(members.profileVisibility, ["public", "members"]),
      eq(members.graduationYear, graduationYear),
      ne(members.id, excludeMemberId),
    );
    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(members)
      .innerJoin(users, eq(users.id, members.userId))
      .where(where);
    const sample = await tx
      .select(directoryColumns)
      .from(members)
      .innerJoin(users, eq(users.id, members.userId))
      .where(where)
      .orderBy(members.lastName, members.firstName)
      .limit(sampleSize);
    return { count, sample };
  });
}

export type MemberEvent = {
  id: string;
  title: string;
  slug: string;
  startsAt: Date;
  location: string | null;
};

/** Future, published events this member has RSVP'd "going" to. */
export async function getMemberUpcomingEvents(
  memberId: string,
  limit = 5,
): Promise<MemberEvent[]> {
  await requireSession();
  const now = new Date();
  return withUserContext(async (tx) => {
    return tx
      .select({
        id: events.id,
        title: events.title,
        slug: events.slug,
        startsAt: events.startsAt,
        location: events.location,
      })
      .from(eventRsvps)
      .innerJoin(events, eq(events.id, eventRsvps.eventId))
      .where(
        and(
          eq(eventRsvps.memberId, memberId),
          eq(eventRsvps.status, "going"),
          gt(events.startsAt, now),
          isNull(events.deletedAt),
          isNotNull(events.publishedAt),
        ),
      )
      .orderBy(events.startsAt)
      .limit(limit);
  });
}

// --- self-service data export --------------------------------------------

/** The caller's own data for "download my data". Phone is decrypted (self). */
export async function exportMyData() {
  const session = await requireSession();
  const userId = session.user.id;
  return withUserContext(async (tx) => {
    const [me] = await tx
      .select()
      .from(members)
      .where(eq(members.userId, userId))
      .limit(1);

    let phone: string | null = null;
    if (me?.phoneEncrypted) {
      try {
        phone = decryptPhone(me.phoneEncrypted);
      } catch {
        phone = null;
      }
    }

    const memberId = me?.id ?? null;

    const rsvps = memberId
      ? await tx
          .select({
            event: events.title,
            slug: events.slug,
            startsAt: events.startsAt,
            status: eventRsvps.status,
            guests: eventRsvps.guests,
            respondedAt: eventRsvps.respondedAt,
          })
          .from(eventRsvps)
          .innerJoin(events, eq(events.id, eventRsvps.eventId))
          .where(eq(eventRsvps.memberId, memberId))
      : [];

    const pledges = memberId
      ? await tx
          .select({
            fundraiser: fundraisers.title,
            amount: fundraiserPledges.amount,
            currency: fundraiserPledges.currency,
            status: fundraiserPledges.status,
            anonymous: fundraiserPledges.anonymous,
            pledgedAt: fundraiserPledges.pledgedAt,
            paidAt: fundraiserPledges.paidAt,
          })
          .from(fundraiserPledges)
          .innerJoin(
            fundraisers,
            eq(fundraisers.id, fundraiserPledges.fundraiserId),
          )
          .where(eq(fundraiserPledges.memberId, memberId))
      : [];

    const authoredAnnouncements = await tx
      .select({
        title: announcements.title,
        slug: announcements.slug,
        status: announcements.status,
        publishedAt: announcements.publishedAt,
        createdAt: announcements.createdAt,
      })
      .from(announcements)
      .where(eq(announcements.authorId, userId));

    let member: Record<string, unknown> | null = null;
    if (me) {
      const { phoneEncrypted: _drop, ...rest } = me;
      void _drop;
      member = { ...rest, phone };
    }

    return {
      exportedAt: new Date().toISOString(),
      account: {
        id: userId,
        email: session.user.email ?? null,
        role: session.user.role,
      },
      member,
      rsvps,
      pledges,
      announcements: authoredAnnouncements,
    };
  });
}

// --- account lifecycle: soft delete, restore, purge -----------------------
// No live spec for this is in the repo (the prompt's "section 04 anonymisation"
// is external) — flag to the owner if their spec differs. The model:
//   delete  -> set members.deleted_at + users.deleted_at = now, status
//              'deactivated', kill all sessions. Data is RETAINED but hidden and
//              recoverable for the grace window.
//   restore -> super admin only, within grace: clear deleted_at, reactivate.
//   purge   -> after grace, scrub every PII column but KEEP the row (id/user_id)
//              so pledges/RSVPs/audit keep referential integrity and render as
//              "Deleted member" (src/lib/member-display.ts).

export const ACCOUNT_DELETION_GRACE_DAYS = 30;
const GRACE_MS = ACCOUNT_DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000;

export async function softDeleteMyAccount(): Promise<void> {
  const session = await requireSession();
  const userId = session.user.id;
  const now = new Date();
  await withUserContext(async (tx) => {
    await tx
      .update(members)
      .set({ deletedAt: now })
      .where(eq(members.userId, userId));
    await tx
      .update(users)
      .set({ deletedAt: now, status: "deactivated" })
      .where(eq(users.id, userId));
    // Sign the member out everywhere.
    await tx.delete(sessions).where(eq(sessions.userId, userId));
  });
  await audit(userId, "account.delete", "user", userId, {
    graceDays: ACCOUNT_DELETION_GRACE_DAYS,
  });
}

export type DeletedMember = {
  id: string;
  userId: string;
  name: string;
  email: string;
  deletedAt: Date;
  restorableUntil: Date;
  expired: boolean;
};

/** Soft-deleted members, newest first (super admin only). */
export async function listDeletedMembers(): Promise<DeletedMember[]> {
  await requireSuperAdmin();
  const rows = await withUserContext(async (tx) => {
    return tx
      .select({
        id: members.id,
        userId: members.userId,
        firstName: members.firstName,
        lastName: members.lastName,
        preferredName: members.preferredName,
        deletedAt: members.deletedAt,
        email: users.email,
      })
      .from(members)
      .innerJoin(users, eq(users.id, members.userId))
      .where(isNotNull(members.deletedAt))
      .orderBy(desc(members.deletedAt));
  });
  return rows.map((r) => {
    const deletedAt = r.deletedAt as Date;
    const restorableUntil = new Date(deletedAt.getTime() + GRACE_MS);
    // Admins need the real name to identify who they are restoring; fall back to
    // email once a row has been purged.
    const name =
      [r.preferredName ?? r.firstName, r.lastName]
        .filter(Boolean)
        .join(" ")
        .trim() || r.email;
    return {
      id: r.id,
      userId: r.userId,
      name,
      email: r.email,
      deletedAt,
      restorableUntil,
      expired: Date.now() > restorableUntil.getTime(),
    };
  });
}

export async function restoreMember(memberId: string): Promise<{
  restored: boolean;
  reason?: "not_found" | "not_deleted" | "grace_expired";
}> {
  const session = await requireSuperAdmin();
  const result = await withUserContext(async (tx) => {
    const [m] = await tx
      .select({
        id: members.id,
        userId: members.userId,
        deletedAt: members.deletedAt,
      })
      .from(members)
      .where(eq(members.id, memberId))
      .limit(1);
    if (!m) return { restored: false, reason: "not_found" as const };
    if (!m.deletedAt)
      return { restored: false, reason: "not_deleted" as const };
    if (Date.now() - m.deletedAt.getTime() > GRACE_MS) {
      return { restored: false, reason: "grace_expired" as const };
    }
    await tx
      .update(members)
      .set({ deletedAt: null })
      .where(eq(members.id, m.id));
    await tx
      .update(users)
      .set({ deletedAt: null, status: "active" })
      .where(eq(users.id, m.userId));
    return { restored: true as const };
  });
  if (result.restored) {
    await audit(session.user.id, "account.restore", "member", memberId);
  }
  return result;
}

/**
 * Permanently anonymise members whose grace window has elapsed. Intended as a
 * scheduled job run in a super-admin context (RLS needs app.role to update
 * member rows). Keeps the row + ids so references survive; nulls every PII
 * column and tombstones the user email.
 */
async function anonymiseExpiredIn(tx: Tx, cutoff: Date): Promise<number> {
  const expired = await tx
    .select({ id: members.id, userId: members.userId })
    .from(members)
    .where(and(isNotNull(members.deletedAt), lt(members.deletedAt, cutoff)));
  for (const m of expired) {
    await tx
      .update(members)
      .set({
        firstName: null,
        lastName: null,
        preferredName: null,
        avatarUrl: null,
        bio: null,
        phoneEncrypted: null,
        faculty: null,
        programme: null,
        company: null,
        jobTitle: null,
        industry: null,
        city: null,
        country: null,
        linkedinUrl: null,
        websiteUrl: null,
        dateOfBirth: null,
      })
      .where(eq(members.id, m.id));
    await tx
      .update(users)
      .set({
        name: null,
        image: null,
        email: `deleted+${m.userId}@deleted.invalid`,
      })
      .where(eq(users.id, m.userId));
  }
  return expired.length;
}

export async function purgeExpiredMembers(): Promise<number> {
  await requireSuperAdmin();
  const cutoff = new Date(Date.now() - GRACE_MS);
  return withUserContext((tx) => anonymiseExpiredIn(tx, cutoff));
}

/**
 * Cron variant of purgeExpiredMembers: no session, runs in system context.
 * Called only from the secret-guarded weekly purge cron. Purges the
 * anonymisation snapshots (soft-deleted member rows) whose 30-day grace has
 * elapsed.
 */
export async function purgeExpiredMembersSystem(): Promise<number> {
  const cutoff = new Date(Date.now() - GRACE_MS);
  return withSystemContext((tx) => anonymiseExpiredIn(tx, cutoff));
}

// --- session / device management ------------------------------------------

const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // mirrors auth.ts session.maxAge

// Session tokens are hashed (sha256 hex) before they reach the client, reusing
// the shared token hasher (rule 6).

async function currentSessionToken(): Promise<string | null> {
  const jar = await cookies();
  return (
    jar.get("authjs.session-token")?.value ??
    jar.get("__Secure-authjs.session-token")?.value ??
    null
  );
}

export type DeviceSession = {
  id: string; // sha256 of the session token — safe to expose to the client
  current: boolean;
  device: string;
  lastActive: Date;
  signedInAt: Date | null;
  expires: Date;
};

export async function listMySessions(): Promise<DeviceSession[]> {
  const session = await requireSession();
  const token = await currentSessionToken();
  const currentId = token ? hashToken(token) : null;
  const rows = await db
    .select({
      sessionToken: sessions.sessionToken,
      expires: sessions.expires,
      userAgent: sessions.userAgent,
      createdAt: sessions.createdAt,
    })
    .from(sessions)
    .where(eq(sessions.userId, session.user.id));
  return rows
    .map((r) => {
      const id = hashToken(r.sessionToken);
      return {
        id,
        current: id === currentId,
        device: describeDevice(r.userAgent),
        // database sessions bump `expires` on use, so expires - maxAge ≈ last use
        lastActive: new Date(r.expires.getTime() - SESSION_MAX_AGE_MS),
        signedInAt: r.createdAt ?? null,
        expires: r.expires,
      };
    })
    .sort((a, b) => {
      if (a.current !== b.current) return a.current ? -1 : 1;
      return b.lastActive.getTime() - a.lastActive.getTime();
    });
}

export async function revokeMySession(id: string): Promise<void> {
  const session = await requireSession();
  const current = await currentSessionToken();
  // Never revoke the current session via this path (that is what Sign out is for).
  if (current && hashToken(current) === id) return;
  const rows = await db
    .select({ sessionToken: sessions.sessionToken })
    .from(sessions)
    .where(eq(sessions.userId, session.user.id));
  const match = rows.find((r) => hashToken(r.sessionToken) === id);
  if (!match) return;
  await db.delete(sessions).where(eq(sessions.sessionToken, match.sessionToken));
  await audit(session.user.id, "session.revoke", "user", session.user.id);
}

export async function signOutOtherSessions(): Promise<void> {
  const session = await requireSession();
  const current = await currentSessionToken();
  const currentId = current ? hashToken(current) : null;
  const rows = await db
    .select({ sessionToken: sessions.sessionToken })
    .from(sessions)
    .where(eq(sessions.userId, session.user.id));
  for (const r of rows) {
    if (currentId && hashToken(r.sessionToken) === currentId) continue;
    await db.delete(sessions).where(eq(sessions.sessionToken, r.sessionToken));
  }
  await audit(session.user.id, "session.revoke_others", "user", session.user.id);
}

// --- member administration (exco+/super admin) ----------------------------
// NOTE on rule 8: getMemberWithPrivacy gates MEMBER-TO-MEMBER PII display. The
// admin roster below is a privileged management surface (exco+), authorized to
// see contact info — consistent with the members_access RLS admin policy. Phone
// is never listed here; only email.

const INVITE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30-day invite window

function inviteUrl(rawToken: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/invite/${rawToken}`;
}

async function sendInviteEmail(
  email: string,
  rawToken: string,
  inviterName: string | null,
): Promise<boolean> {
  try {
    await send({
      to: email,
      subject: "You are invited to Set",
      react: InviteEmail({ url: inviteUrl(rawToken), inviterName }),
    });
    return true;
  } catch {
    return false; // never let a send failure roll back the invite row
  }
}

async function countActiveSuperAdmins(): Promise<number> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.role, "super_admin"),
        eq(users.status, "active"),
        isNull(users.deletedAt),
      ),
    );
  return rows.length;
}

export type AdminRosterRow = {
  kind: "member" | "invite";
  id: string; // memberId or inviteId
  userId: string | null;
  name: string;
  email: string;
  graduationYear: number | null;
  faculty: string | null;
  role: Role;
  status: "active" | "invited" | "suspended" | "deactivated";
  joinedAt: Date;
  lastSignInAt: Date | null;
  avatarUrl: string | null;
};

/** The admin roster: real members (non-deleted) plus pending invites, unioned. */
export async function listAdminRoster(): Promise<AdminRosterRow[]> {
  await requireRole("exco", "super_admin");
  return withUserContext(async (tx) => {
    const memberRows = await tx
      .select({
        id: members.id,
        userId: members.userId,
        firstName: members.firstName,
        lastName: members.lastName,
        preferredName: members.preferredName,
        avatarUrl: members.avatarUrl,
        graduationYear: members.graduationYear,
        faculty: members.faculty,
        createdAt: members.createdAt,
        email: users.email,
        role: users.role,
        status: users.status,
        lastSignInAt: users.lastSignInAt,
      })
      .from(members)
      .innerJoin(users, eq(users.id, members.userId))
      .where(isNull(members.deletedAt));

    const userEmails = new Set(
      (await tx.select({ email: users.email }).from(users)).map((u) =>
        u.email.toLowerCase(),
      ),
    );

    const inviteRows = await tx
      .select({
        id: invites.id,
        firstName: invites.firstName,
        lastName: invites.lastName,
        graduationYear: invites.graduationYear,
        faculty: invites.faculty,
        role: invites.role,
        email: invites.email,
        createdAt: invites.createdAt,
      })
      .from(invites)
      .where(eq(invites.status, "pending"));

    const fromMembers: AdminRosterRow[] = memberRows.map((m) => ({
      kind: "member",
      id: m.id,
      userId: m.userId,
      name: displayName(m),
      email: m.email,
      graduationYear: m.graduationYear,
      faculty: m.faculty,
      role: m.role,
      status: m.status,
      joinedAt: m.createdAt,
      lastSignInAt: m.lastSignInAt,
      avatarUrl: m.avatarUrl,
    }));

    const fromInvites: AdminRosterRow[] = inviteRows
      .filter((i) => !userEmails.has(i.email.toLowerCase()))
      .map((i) => ({
        kind: "invite",
        id: i.id,
        userId: null,
        name:
          [i.firstName, i.lastName].filter(Boolean).join(" ").trim() ||
          "Invited member",
        email: i.email,
        graduationYear: i.graduationYear,
        faculty: i.faculty,
        role: i.role,
        status: "invited",
        joinedAt: i.createdAt,
        lastSignInAt: null,
        avatarUrl: null,
      }));

    return [...fromMembers, ...fromInvites];
  });
}

export type InviteInput = {
  email: string;
  firstName: string;
  lastName?: string | null;
  dateOfBirth?: string | null;
  graduationYear?: number | null;
  faculty?: string | null;
  role: Role;
};

export async function createInvite(
  input: InviteInput,
): Promise<
  { ok: true; id: string; sent: boolean } | { ok: false; error: string }
> {
  const session = await requireRole("exco", "super_admin");
  const email = input.email.trim().toLowerCase();

  // Cap privileges: only a super admin may grant exco; never mint super_admin.
  let role: Role = input.role;
  if (role === "super_admin") role = "exco";
  if (role === "exco" && session.user.role !== "super_admin") role = "member";

  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existingUser) return { ok: false, error: "That email already belongs to a member." };
  const [existingInvite] = await db
    .select({ id: invites.id })
    .from(invites)
    .where(and(eq(invites.email, email), eq(invites.status, "pending")))
    .limit(1);
  if (existingInvite)
    return { ok: false, error: "That email already has a pending invite. Use Resend." };

  const rawToken = generateToken();
  const [row] = await db
    .insert(invites)
    .values({
      email,
      role,
      firstName: input.firstName.trim() || null,
      lastName: input.lastName?.trim() || null,
      dateOfBirth: input.dateOfBirth || null,
      graduationYear: input.graduationYear ?? null,
      faculty: input.faculty || null,
      tokenHash: hashToken(rawToken),
      status: "pending",
      invitedBy: session.user.id,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    })
    .returning({ id: invites.id });

  await audit(session.user.id, "invite.create", "invite", row.id, { email, role });
  const sent = await sendInviteEmail(email, rawToken, session.user.name ?? null);
  return { ok: true, id: row.id, sent };
}

export async function resendInvite(
  inviteId: string,
): Promise<{ ok: boolean; error?: string; sent?: boolean }> {
  const session = await requireRole("exco", "super_admin");
  const [inv] = await db
    .select({ id: invites.id, email: invites.email, status: invites.status })
    .from(invites)
    .where(eq(invites.id, inviteId))
    .limit(1);
  if (!inv) return { ok: false, error: "Invite not found." };
  if (inv.status !== "pending")
    return { ok: false, error: "That invite is no longer pending." };

  const rawToken = generateToken();
  await db
    .update(invites)
    .set({ tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + INVITE_TTL_MS) })
    .where(eq(invites.id, inviteId));
  await audit(session.user.id, "invite.resend", "invite", inviteId, { email: inv.email });
  const sent = await sendInviteEmail(inv.email, rawToken, session.user.name ?? null);
  return { ok: true, sent };
}

export async function revokeInvite(
  inviteId: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireRole("exco", "super_admin");
  const [inv] = await db
    .select({ id: invites.id, email: invites.email, status: invites.status })
    .from(invites)
    .where(eq(invites.id, inviteId))
    .limit(1);
  if (!inv) return { ok: false, error: "Invite not found." };
  if (inv.status !== "pending")
    return { ok: false, error: "That invite is no longer pending." };
  await db.update(invites).set({ status: "revoked" }).where(eq(invites.id, inviteId));
  await audit(session.user.id, "invite.revoke", "invite", inviteId, { email: inv.email });
  return { ok: true };
}

/** Rotate tokens and (re)send pending invites — the "send invites later" bulk action. */
export async function sendPendingInvites(
  inviteIds: string[],
): Promise<{ sent: number; failed: number }> {
  const session = await requireRole("exco", "super_admin");
  const ids = inviteIds.slice(0, 1000);
  if (ids.length === 0) return { sent: 0, failed: 0 };
  const rows = await db
    .select({ id: invites.id, email: invites.email })
    .from(invites)
    .where(and(inArray(invites.id, ids), eq(invites.status, "pending")));
  let sent = 0;
  let failed = 0;
  for (const r of rows) {
    const rawToken = generateToken();
    await db
      .update(invites)
      .set({ tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + INVITE_TTL_MS) })
      .where(eq(invites.id, r.id));
    if (await sendInviteEmail(r.email, rawToken, session.user.name ?? null)) sent++;
    else failed++;
  }
  await audit(session.user.id, "invite.bulk_send", "invite", null, {
    requested: rows.length,
    sent,
    failed,
  });
  return { sent, failed };
}

export async function setMemberRole(
  targetUserId: string,
  newRole: Role,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireSuperAdmin();
  const [target] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);
  if (!target) return { ok: false, error: "Member not found." };

  const guard = guardRoleChange({
    actorUserId: session.user.id,
    targetUserId,
    targetCurrentRole: target.role,
    newRole,
    activeSuperAdminCount: await countActiveSuperAdmins(),
  });
  if (!guard.ok) return { ok: false, error: guard.error };
  if (target.role === newRole) return { ok: true };

  await db.update(users).set({ role: newRole }).where(eq(users.id, targetUserId));
  await audit(session.user.id, "member.role_change", "user", targetUserId, {
    from: target.role,
    to: newRole,
  });
  return { ok: true };
}

export async function setMemberStatus(
  targetUserId: string,
  action: "suspend" | "reactivate",
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireRole("exco", "super_admin");
  const [target] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);
  if (!target) return { ok: false, error: "Member not found." };

  const guard = guardStatusChange({
    targetRole: target.role,
    action,
    activeSuperAdminCount: await countActiveSuperAdmins(),
  });
  if (!guard.ok) return { ok: false, error: guard.error };

  await db
    .update(users)
    .set({ status: action === "suspend" ? "suspended" : "active" })
    .where(eq(users.id, targetUserId));
  if (action === "suspend") {
    // Kill sessions immediately on suspend (defensive requirement).
    await db.delete(sessions).where(eq(sessions.userId, targetUserId));
  }
  await audit(
    session.user.id,
    action === "suspend" ? "member.suspend" : "member.reactivate",
    "user",
    targetUserId,
  );
  return { ok: true };
}

/** Admin-initiated soft delete (the same anonymisation flow as self-deletion). */
export async function adminDeleteMember(
  memberId: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireRole("exco", "super_admin");
  const row = await withUserContext(async (tx) => {
    const [m] = await tx
      .select({ id: members.id, userId: members.userId })
      .from(members)
      .where(eq(members.id, memberId))
      .limit(1);
    return m ?? null;
  });
  if (!row) return { ok: false, error: "Member not found." };

  const [u] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, row.userId))
    .limit(1);
  const guard = guardStatusChange({
    targetRole: u?.role ?? "member",
    action: "delete",
    activeSuperAdminCount: await countActiveSuperAdmins(),
  });
  if (!guard.ok) return { ok: false, error: guard.error };

  const now = new Date();
  await withUserContext(async (tx) => {
    await tx.update(members).set({ deletedAt: now }).where(eq(members.id, memberId));
    await tx
      .update(users)
      .set({ deletedAt: now, status: "deactivated" })
      .where(eq(users.id, row.userId));
    await tx.delete(sessions).where(eq(sessions.userId, row.userId));
  });
  await audit(session.user.id, "member.delete", "member", memberId, {
    graceDays: ACCOUNT_DELETION_GRACE_DAYS,
  });
  return { ok: true };
}

export async function bulkSuspendMembers(
  userIds: string[],
): Promise<{ suspended: number; skipped: number }> {
  const session = await requireRole("exco", "super_admin");
  const ids = userIds.slice(0, 1000);
  let suspended = 0;
  let skipped = 0;
  for (const id of ids) {
    const [target] = await db
      .select({ role: users.role, status: users.status })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!target || target.status === "suspended") {
      skipped++;
      continue;
    }
    // Recompute per iteration so we never suspend the final super admin.
    const guard = guardStatusChange({
      targetRole: target.role,
      action: "suspend",
      activeSuperAdminCount: await countActiveSuperAdmins(),
    });
    if (!guard.ok) {
      skipped++;
      continue;
    }
    await db.update(users).set({ status: "suspended" }).where(eq(users.id, id));
    await db.delete(sessions).where(eq(sessions.userId, id));
    suspended++;
  }
  await audit(session.user.id, "member.bulk_suspend", "user", null, { suspended, skipped });
  return { suspended, skipped };
}

/** Admin edit of a member's profile fields (RLS-scoped; admin role). */
export async function updateMemberAsAdmin(
  memberId: string,
  patch: Partial<typeof members.$inferInsert>,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireRole("exco", "super_admin");
  const found = await withUserContext(async (tx) => {
    const [m] = await tx
      .select({ id: members.id })
      .from(members)
      .where(eq(members.id, memberId))
      .limit(1);
    if (!m) return false;
    await tx.update(members).set(patch).where(eq(members.id, memberId));
    return true;
  });
  if (!found) return { ok: false, error: "Member not found." };
  await audit(session.user.id, "member.update", "member", memberId, {
    fields: Object.keys(patch),
  });
  return { ok: true };
}

function csvCell(value: unknown): string {
  const s = String(value ?? "");
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Export the (optionally selected) roster as CSV, capped at 1,000 rows. */
export async function exportRosterCsv(
  selectedIds?: string[],
): Promise<{ csv: string; count: number; capped: boolean }> {
  const session = await requireRole("exco", "super_admin");
  let roster = await listAdminRoster();
  if (selectedIds && selectedIds.length > 0) {
    const set = new Set(selectedIds);
    roster = roster.filter((r) => set.has(r.id));
  }
  const capped = roster.slice(0, 1000);
  const header = ["name", "email", "set", "role", "status", "joined", "last_sign_in"];
  const lines = [header.join(",")];
  for (const r of capped) {
    lines.push(
      [
        r.name,
        r.email,
        r.graduationYear ?? "",
        r.role,
        r.status,
        r.joinedAt.toISOString().slice(0, 10),
        r.lastSignInAt ? r.lastSignInAt.toISOString().slice(0, 10) : "",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  await audit(session.user.id, "member.export_csv", null, null, {
    count: capped.length,
    capped: roster.length > 1000,
  });
  return { csv: lines.join("\r\n"), count: capped.length, capped: roster.length > 1000 };
}

export type ImportSummary = {
  total: number;
  created: number;
  sent: number;
  skipped: { email: string; reason: string }[];
};

/** Server-authoritative CSV import: validates, dedupes, creates invites. */
export async function importMembers(
  rawRows: Record<string, string>[],
  sendInvites: boolean,
): Promise<ImportSummary> {
  const session = await requireRole("exco", "super_admin");
  const rows = rawRows.slice(0, 1000);

  const existingUsers = new Set(
    (await db.select({ email: users.email }).from(users)).map((u) =>
      u.email.toLowerCase(),
    ),
  );
  const existingInvites = new Set(
    (
      await db
        .select({ email: invites.email })
        .from(invites)
        .where(eq(invites.status, "pending"))
    ).map((i) => i.email.toLowerCase()),
  );

  const seen = new Set<string>();
  const skipped: { email: string; reason: string }[] = [];
  const toCreate: ImportRowData[] = [];

  rows.forEach((raw, i) => {
    const res = validateImportRow(i, raw);
    if (!res.ok) {
      skipped.push({ email: res.email || `row ${i + 2}`, reason: res.errors.join("; ") });
      return;
    }
    const email = res.data.email;
    if (existingUsers.has(email)) {
      skipped.push({ email, reason: "already a member" });
      return;
    }
    if (existingInvites.has(email)) {
      skipped.push({ email, reason: "already invited" });
      return;
    }
    if (seen.has(email)) {
      skipped.push({ email, reason: "duplicate in file" });
      return;
    }
    seen.add(email);
    toCreate.push(res.data);
  });

  let created = 0;
  let sent = 0;
  for (const r of toCreate) {
    const [firstName, ...rest] = r.fullName.trim().split(/\s+/);
    const rawToken = generateToken();
    await db.insert(invites).values({
      email: r.email,
      role: "member",
      firstName: firstName || null,
      lastName: rest.join(" ") || null,
      dateOfBirth: r.birthday || null,
      graduationYear: r.graduatingYear ? Number(r.graduatingYear) : null,
      faculty: r.faculty || null,
      tokenHash: hashToken(rawToken),
      status: "pending",
      invitedBy: session.user.id,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    });
    created++;
    if (sendInvites && (await sendInviteEmail(r.email, rawToken, session.user.name ?? null))) {
      sent++;
    }
  }

  await audit(session.user.id, "member.import", "invite", null, {
    total: rows.length,
    created,
    skipped: skipped.length,
    sent,
  });
  return { total: rows.length, created, sent, skipped };
}

export type InviteLookup = {
  email: string;
  inviterName: string | null;
  valid: boolean;
  reason?: "expired" | "used";
};

/** Public invite lookup for /invite/[token] (token hashed before lookup, rule 6). */
export async function getInviteByToken(rawToken: string): Promise<InviteLookup | null> {
  const tokenHash = hashToken(rawToken);
  const [inv] = await db
    .select({
      email: invites.email,
      status: invites.status,
      expiresAt: invites.expiresAt,
      inviterName: users.name,
    })
    .from(invites)
    .leftJoin(users, eq(users.id, invites.invitedBy))
    .where(eq(invites.tokenHash, tokenHash))
    .limit(1);
  if (!inv) return null;
  if (inv.status !== "pending") {
    return { email: inv.email, inviterName: inv.inviterName, valid: false, reason: "used" };
  }
  if (inv.expiresAt.getTime() < Date.now()) {
    return { email: inv.email, inviterName: inv.inviterName, valid: false, reason: "expired" };
  }
  return { email: inv.email, inviterName: inv.inviterName, valid: true };
}

// --- email unsubscribe (no session; authorized by a signed token upstream) --
// The caller (the /unsubscribe route) has already verified the HMAC-signed token
// and extracted the email, so this turns off the member's bulk-email opt-ins.
// There is no session, so we scope the GUC to the matched user for the members
// RLS WITH CHECK; idempotent if the email has no member.
const UNSUB_FLAGS: Record<UnsubCategory, Partial<typeof members.$inferInsert>> = {
  announcements: { notifyAnnouncements: false },
  events: { notifyEvents: false },
  fundraisers: { notifyFundraisers: false },
  all: {
    notifyAnnouncements: false,
    notifyEvents: false,
    notifyFundraisers: false,
  },
};

/** Turn off the notify_* flag(s) for a category. Idempotent if no member. */
export async function unsubscribeEmail(
  rawEmail: string,
  category: UnsubCategory = "all",
): Promise<{ ok: boolean; found: boolean }> {
  const email = rawEmail.toLowerCase();
  const [u] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!u) return { ok: true, found: false };

  await db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${u.id}, true)`);
    await tx.execute(sql`select set_config('app.role', 'member', true)`);
    await tx
      .update(members)
      .set(UNSUB_FLAGS[category])
      .where(eq(members.userId, u.id));
  });
  await audit(null, "member.unsubscribe", "user", u.id, {
    scope: category,
    via: "email_link",
  });
  return { ok: true, found: true };
}

/** @deprecated retained for callers; prefer unsubscribeEmail(email, "all"). */
export async function unsubscribeEmailFromAll(rawEmail: string) {
  return unsubscribeEmail(rawEmail, "all");
}

// ============================ events ======================================

const WAT = "Africa/Lagos";
/** Format an instant in West Africa Time, for emails and server-rendered labels. */
export function formatWat(d: Date): string {
  return formatInTimeZone(d, WAT, "EEE d MMM yyyy, HH:mm 'WAT'");
}

export type RsvpStatus = "going" | "maybe" | "declined" | "waitlist";
type Attendee = { name: string; avatarUrl: string | null };

async function myMemberId(tx: Tx, userId: string): Promise<string | null> {
  const [m] = await tx
    .select({ id: members.id })
    .from(members)
    .where(eq(members.userId, userId))
    .limit(1);
  return m?.id ?? null;
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "event"
  );
}

export type EventCard = {
  id: string;
  title: string;
  slug: string;
  startsAt: Date;
  endsAt: Date | null;
  location: string | null;
  isVirtual: boolean;
  coverImage: string | null;
  canceledAt: Date | null;
  attendeeCount: number;
  avatars: Attendee[];
  myStatus: RsvpStatus | null;
};

export async function listEvents(
  scope: "upcoming" | "past",
): Promise<EventCard[]> {
  const session = await requireSession();
  const now = new Date();
  return withUserContext(async (tx) => {
    const meId = await myMemberId(tx, session.user.id);
    const rows = await tx
      .select({
        id: events.id,
        title: events.title,
        slug: events.slug,
        startsAt: events.startsAt,
        endsAt: events.endsAt,
        location: events.location,
        isVirtual: events.isVirtual,
        coverImage: events.coverImage,
        canceledAt: events.canceledAt,
      })
      .from(events)
      .where(
        and(
          isNull(events.deletedAt),
          isNotNull(events.publishedAt),
          scope === "upcoming"
            ? gte(events.startsAt, now)
            : lt(events.startsAt, now),
        ),
      )
      .orderBy(scope === "upcoming" ? events.startsAt : desc(events.startsAt));
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);

    const counts = await tx
      .select({ eventId: eventRsvps.eventId, c: sql<number>`count(*)::int` })
      .from(eventRsvps)
      .where(and(inArray(eventRsvps.eventId, ids), eq(eventRsvps.status, "going")))
      .groupBy(eventRsvps.eventId);
    const countMap = new Map(counts.map((c) => [c.eventId, c.c]));

    const mine = meId
      ? await tx
          .select({ eventId: eventRsvps.eventId, status: eventRsvps.status })
          .from(eventRsvps)
          .where(
            and(inArray(eventRsvps.eventId, ids), eq(eventRsvps.memberId, meId)),
          )
      : [];
    const mineMap = new Map<string, RsvpStatus>(
      mine.map((m) => [m.eventId, m.status]),
    );

    // Attendee avatars are bounded by members RLS (private profiles excluded);
    // the count above is the accurate total from event_rsvps.
    const goers = await tx
      .select({
        eventId: eventRsvps.eventId,
        firstName: members.firstName,
        lastName: members.lastName,
        preferredName: members.preferredName,
        avatarUrl: members.avatarUrl,
      })
      .from(eventRsvps)
      .innerJoin(members, eq(members.id, eventRsvps.memberId))
      .where(
        and(
          inArray(eventRsvps.eventId, ids),
          eq(eventRsvps.status, "going"),
          isNull(members.deletedAt),
        ),
      );
    const avatarMap = new Map<string, Attendee[]>();
    for (const g of goers) {
      const list = avatarMap.get(g.eventId) ?? [];
      if (list.length < 5) list.push({ name: displayName(g), avatarUrl: g.avatarUrl });
      avatarMap.set(g.eventId, list);
    }

    return rows.map((r) => ({
      ...r,
      attendeeCount: countMap.get(r.id) ?? 0,
      avatars: avatarMap.get(r.id) ?? [],
      myStatus: mineMap.get(r.id) ?? null,
    }));
  });
}

export type EventDetail = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverImage: string | null;
  location: string | null;
  isVirtual: boolean;
  meetingUrl: string | null; // gated: only when myStatus is going/maybe
  startsAt: Date;
  endsAt: Date | null;
  canceledAt: Date | null;
  myStatus: RsvpStatus | null;
  counts: { going: number; maybe: number; declined: number };
  going: Attendee[];
  maybe: Attendee[];
  declined: Attendee[];
};

export async function getEvent(id: string): Promise<EventDetail | null> {
  const session = await requireSession();
  return withUserContext(async (tx) => {
    const [ev] = await tx
      .select()
      .from(events)
      .where(
        and(
          eq(events.id, id),
          isNull(events.deletedAt),
          isNotNull(events.publishedAt),
        ),
      )
      .limit(1);
    if (!ev) return null;

    const meId = await myMemberId(tx, session.user.id);
    let myStatus: RsvpStatus | null = null;
    if (meId) {
      const [r] = await tx
        .select({ status: eventRsvps.status })
        .from(eventRsvps)
        .where(and(eq(eventRsvps.eventId, id), eq(eventRsvps.memberId, meId)))
        .limit(1);
      myStatus = r?.status ?? null;
    }

    const cnt = await tx
      .select({ status: eventRsvps.status, c: sql<number>`count(*)::int` })
      .from(eventRsvps)
      .where(eq(eventRsvps.eventId, id))
      .groupBy(eventRsvps.status);
    const cmap = new Map(cnt.map((c) => [c.status, c.c]));

    const att = await tx
      .select({
        status: eventRsvps.status,
        firstName: members.firstName,
        lastName: members.lastName,
        preferredName: members.preferredName,
        avatarUrl: members.avatarUrl,
      })
      .from(eventRsvps)
      .innerJoin(members, eq(members.id, eventRsvps.memberId))
      .where(and(eq(eventRsvps.eventId, id), isNull(members.deletedAt)));
    const going: Attendee[] = [];
    const maybe: Attendee[] = [];
    const declined: Attendee[] = [];
    for (const a of att) {
      const who = { name: displayName(a), avatarUrl: a.avatarUrl };
      if (a.status === "going") going.push(who);
      else if (a.status === "maybe") maybe.push(who);
      else if (a.status === "declined") declined.push(who);
    }

    const canSeeMeeting = myStatus === "going" || myStatus === "maybe";
    return {
      id: ev.id,
      title: ev.title,
      slug: ev.slug,
      description: ev.description,
      coverImage: ev.coverImage,
      location: ev.location,
      isVirtual: ev.isVirtual,
      meetingUrl: canSeeMeeting ? ev.meetingUrl : null,
      startsAt: ev.startsAt,
      endsAt: ev.endsAt,
      canceledAt: ev.canceledAt,
      myStatus,
      counts: {
        going: cmap.get("going") ?? 0,
        maybe: cmap.get("maybe") ?? 0,
        declined: cmap.get("declined") ?? 0,
      },
      going,
      maybe,
      declined,
    };
  });
}

export async function rsvpToEvent(
  eventId: string,
  status: RsvpStatus,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireSession();
  return withUserContext(async (tx) => {
    const meId = await myMemberId(tx, session.user.id);
    if (!meId) return { ok: false, error: "Complete your profile first." };
    const [ev] = await tx
      .select({ id: events.id, canceledAt: events.canceledAt })
      .from(events)
      .where(
        and(
          eq(events.id, eventId),
          isNull(events.deletedAt),
          isNotNull(events.publishedAt),
        ),
      )
      .limit(1);
    if (!ev) return { ok: false, error: "Event not found." };
    if (ev.canceledAt) return { ok: false, error: "This event has been cancelled." };
    await tx
      .insert(eventRsvps)
      .values({ eventId, memberId: meId, status })
      .onConflictDoUpdate({
        target: [eventRsvps.eventId, eventRsvps.memberId],
        set: { status, respondedAt: new Date() },
      });
    return { ok: true };
  });
}

// --- one-click RSVP from email (no session; token-authorized) --------------

export type RsvpTokenView = {
  event: {
    id: string;
    title: string;
    slug: string;
    startsAt: Date;
    location: string | null;
    isVirtual: boolean;
    canceledAt: Date | null;
  };
  valid: boolean;
  reason?: "expired";
};

export async function getRsvpToken(rawToken: string): Promise<RsvpTokenView | null> {
  const tokenHash = hashToken(rawToken);
  const [t] = await db
    .select({ eventId: rsvpEmailTokens.eventId, expiresAt: rsvpEmailTokens.expiresAt })
    .from(rsvpEmailTokens)
    .where(eq(rsvpEmailTokens.tokenHash, tokenHash))
    .limit(1);
  if (!t) return null;
  const [ev] = await db
    .select({
      id: events.id,
      title: events.title,
      slug: events.slug,
      startsAt: events.startsAt,
      location: events.location,
      isVirtual: events.isVirtual,
      canceledAt: events.canceledAt,
      deletedAt: events.deletedAt,
    })
    .from(events)
    .where(eq(events.id, t.eventId))
    .limit(1);
  if (!ev || ev.deletedAt) return null;
  const valid = t.expiresAt.getTime() >= Date.now();
  const { deletedAt: _d, ...event } = ev;
  void _d;
  return { event, valid, reason: valid ? undefined : "expired" };
}

/** Record a one-click RSVP. Called only from the POST handler (rule 5). */
export async function recordRsvpByToken(
  rawToken: string,
  status: RsvpStatus,
): Promise<{ ok: boolean; error?: string }> {
  const tokenHash = hashToken(rawToken);
  const [t] = await db
    .select({
      id: rsvpEmailTokens.id,
      eventId: rsvpEmailTokens.eventId,
      memberId: rsvpEmailTokens.memberId,
      expiresAt: rsvpEmailTokens.expiresAt,
    })
    .from(rsvpEmailTokens)
    .where(eq(rsvpEmailTokens.tokenHash, tokenHash))
    .limit(1);
  if (!t) return { ok: false, error: "This RSVP link is not valid." };
  if (t.expiresAt.getTime() < Date.now())
    return { ok: false, error: "This RSVP link has expired." };
  const [ev] = await db
    .select({ canceledAt: events.canceledAt, deletedAt: events.deletedAt })
    .from(events)
    .where(eq(events.id, t.eventId))
    .limit(1);
  if (!ev || ev.deletedAt) return { ok: false, error: "Event not found." };
  if (ev.canceledAt) return { ok: false, error: "This event has been cancelled." };

  await db
    .insert(eventRsvps)
    .values({ eventId: t.eventId, memberId: t.memberId, status })
    .onConflictDoUpdate({
      target: [eventRsvps.eventId, eventRsvps.memberId],
      set: { status, respondedAt: new Date() },
    });
  await db
    .update(rsvpEmailTokens)
    .set({ usedAt: new Date(), status })
    .where(eq(rsvpEmailTokens.id, t.id));
  return { ok: true };
}

// --- admin: events ---------------------------------------------------------

export type AdminEventRow = {
  id: string;
  title: string;
  slug: string;
  startsAt: Date;
  endsAt: Date | null;
  isVirtual: boolean;
  location: string | null;
  publishedAt: Date | null;
  canceledAt: Date | null;
  status: "draft" | "published" | "canceled" | "past";
  goingCount: number;
};

export async function listAdminEvents(): Promise<AdminEventRow[]> {
  await requireRole("exco", "super_admin");
  const now = new Date();
  const rows = await db
    .select({
      id: events.id,
      title: events.title,
      slug: events.slug,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      isVirtual: events.isVirtual,
      location: events.location,
      publishedAt: events.publishedAt,
      canceledAt: events.canceledAt,
    })
    .from(events)
    .where(isNull(events.deletedAt))
    .orderBy(desc(events.startsAt));
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const counts = await db
    .select({ eventId: eventRsvps.eventId, c: sql<number>`count(*)::int` })
    .from(eventRsvps)
    .where(and(inArray(eventRsvps.eventId, ids), eq(eventRsvps.status, "going")))
    .groupBy(eventRsvps.eventId);
  const cmap = new Map(counts.map((c) => [c.eventId, c.c]));
  return rows.map((r) => ({
    ...r,
    goingCount: cmap.get(r.id) ?? 0,
    status: r.canceledAt
      ? "canceled"
      : !r.publishedAt
        ? "draft"
        : r.startsAt < now
          ? "past"
          : "published",
  }));
}

export async function getAdminEvent(id: string) {
  await requireRole("exco", "super_admin");
  const [ev] = await db
    .select()
    .from(events)
    .where(and(eq(events.id, id), isNull(events.deletedAt)))
    .limit(1);
  return ev ?? null;
}

export type EventInput = {
  title: string;
  description?: string | null;
  location?: string | null;
  isVirtual: boolean;
  meetingUrl?: string | null;
  startsAt: Date;
  endsAt?: Date | null;
  capacity?: number | null;
  coverImage?: string | null;
};

export async function createEvent(
  input: EventInput,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const session = await requireRole("exco", "super_admin");
  let slug = slugify(input.title);
  const clash = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.slug, slug))
    .limit(1);
  if (clash.length) slug = `${slug}-${Math.floor(Date.now() / 1000) % 100000}`;

  const [row] = await db
    .insert(events)
    .values({
      title: input.title,
      slug,
      description: input.description ?? null,
      location: input.isVirtual ? null : (input.location ?? null),
      isVirtual: input.isVirtual,
      meetingUrl: input.isVirtual ? (input.meetingUrl ?? null) : null,
      startsAt: input.startsAt,
      endsAt: input.endsAt ?? null,
      capacity: input.capacity ?? null,
      coverImage: input.coverImage ?? null,
      sequence: 0,
      createdBy: session.user.id,
    })
    .returning({ id: events.id });
  await audit(session.user.id, "event.create", "event", row.id, {
    title: input.title,
  });
  return { ok: true, id: row.id };
}

export async function updateEvent(
  id: string,
  input: EventInput,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireRole("exco", "super_admin");
  const [ev] = await db
    .select({ id: events.id, sequence: events.sequence })
    .from(events)
    .where(and(eq(events.id, id), isNull(events.deletedAt)))
    .limit(1);
  if (!ev) return { ok: false, error: "Event not found." };
  await db
    .update(events)
    .set({
      title: input.title,
      description: input.description ?? null,
      location: input.isVirtual ? null : (input.location ?? null),
      isVirtual: input.isVirtual,
      meetingUrl: input.isVirtual ? (input.meetingUrl ?? null) : null,
      startsAt: input.startsAt,
      endsAt: input.endsAt ?? null,
      capacity: input.capacity ?? null,
      coverImage: input.coverImage ?? null,
      sequence: ev.sequence + 1, // bump so re-imports update, not duplicate
    })
    .where(eq(events.id, id));
  await audit(session.user.id, "event.update", "event", id, {
    sequence: ev.sequence + 1,
  });
  return { ok: true };
}

export async function publishEvent(
  id: string,
  emailMembers: boolean,
): Promise<{ ok: boolean; error?: string; emailed?: number }> {
  const session = await requireRole("exco", "super_admin");
  const [ev] = await db
    .select({ id: events.id, publishedAt: events.publishedAt })
    .from(events)
    .where(and(eq(events.id, id), isNull(events.deletedAt)))
    .limit(1);
  if (!ev) return { ok: false, error: "Event not found." };
  if (!ev.publishedAt) {
    await db.update(events).set({ publishedAt: new Date() }).where(eq(events.id, id));
  }
  let emailed = 0;
  if (emailMembers) emailed = (await sendEventInvites(id)).recipients;
  await audit(session.user.id, "event.publish", "event", id, { emailed });
  return { ok: true, emailed };
}

/** Send EventInvite (with .ics) + per-member one-click RSVP tokens to opted-in members. */
export async function sendEventInvites(
  eventId: string,
): Promise<{ recipients: number }> {
  const session = await requireRole("exco", "super_admin");
  const [ev] = await db
    .select()
    .from(events)
    .where(and(eq(events.id, eventId), isNull(events.deletedAt)))
    .limit(1);
  if (!ev) return { recipients: 0 };

  const recipients = await withUserContext(async (tx) =>
    tx
      .select({ memberId: members.id, email: users.email })
      .from(members)
      .innerJoin(users, eq(users.id, members.userId))
      .where(
        and(
          isNull(members.deletedAt),
          eq(users.status, "active"),
          eq(members.notifyEvents, true),
        ),
      ),
  );
  if (recipients.length === 0) {
    await audit(session.user.id, "event.invite", "event", eventId, { recipients: 0 });
    return { recipients: 0 };
  }

  const ics = Buffer.from(buildEventIcs(ev));
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const whenLabel = formatWat(ev.startsAt);
  const whereLabel = ev.isVirtual ? "Virtual" : (ev.location ?? "To be confirmed");
  const eventUrl = `${base}/events/${ev.id}`;
  const expiresAt = new Date(ev.startsAt.getTime() + 24 * 60 * 60 * 1000);

  const messages = [];
  for (const r of recipients) {
    const rawToken = generateToken();
    await db.insert(rsvpEmailTokens).values({
      eventId,
      memberId: r.memberId,
      tokenHash: hashToken(rawToken),
      status: null,
      expiresAt,
    });
    const link = (s: RsvpStatus) => `${base}/rsvp/${rawToken}?r=${s}`;
    messages.push({
      to: r.email,
      subject: `You are invited: ${ev.title}`,
      react: EventInvite({
        title: ev.title,
        whenLabel,
        whereLabel,
        eventUrl,
        rsvpUrls: { going: link("going"), maybe: link("maybe"), declined: link("declined") },
      }),
      attachments: [{ filename: "event.ics", content: ics }],
    });
  }
  try {
    await sendEach(messages);
  } catch {
    // delivery failures are non-fatal; tokens are created regardless
  }
  await audit(session.user.id, "event.invite", "event", eventId, {
    recipients: recipients.length,
  });
  return { recipients: recipients.length };
}

export async function cancelEvent(
  id: string,
): Promise<{ ok: boolean; error?: string; notified?: number }> {
  const session = await requireRole("exco", "super_admin");
  const [ev] = await db
    .select()
    .from(events)
    .where(and(eq(events.id, id), isNull(events.deletedAt)))
    .limit(1);
  if (!ev) return { ok: false, error: "Event not found." };
  if (ev.canceledAt) return { ok: false, error: "This event is already cancelled." };

  const newSequence = ev.sequence + 1;
  await db
    .update(events)
    .set({ canceledAt: new Date(), sequence: newSequence })
    .where(eq(events.id, id));

  const recipients = await withUserContext(async (tx) =>
    tx
      .select({ email: users.email })
      .from(eventRsvps)
      .innerJoin(members, eq(members.id, eventRsvps.memberId))
      .innerJoin(users, eq(users.id, members.userId))
      .where(
        and(
          eq(eventRsvps.eventId, id),
          inArray(eventRsvps.status, ["going", "maybe"]),
          isNull(members.deletedAt),
        ),
      ),
  );

  if (recipients.length > 0) {
    const ics = Buffer.from(
      buildEventIcs({ ...ev, sequence: newSequence }, { canceled: true }),
    );
    const whenLabel = formatWat(ev.startsAt);
    try {
      await sendEach(
        recipients.map((r) => ({
          to: r.email,
          subject: `Cancelled: ${ev.title}`,
          react: EventCancelled({ title: ev.title, whenLabel }),
          attachments: [{ filename: "event.ics", content: ics }],
        })),
      );
    } catch {
      // non-fatal
    }
  }
  await audit(session.user.id, "event.cancel", "event", id, {
    notified: recipients.length,
  });
  return { ok: true, notified: recipients.length };
}

export async function deleteEvent(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireRole("exco", "super_admin");
  const [ev] = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.id, id), isNull(events.deletedAt)))
    .limit(1);
  if (!ev) return { ok: false, error: "Event not found." };
  await db.update(events).set({ deletedAt: new Date() }).where(eq(events.id, id));
  await audit(session.user.id, "event.delete", "event", id);
  return { ok: true };
}

export type EventRsvpRow = {
  name: string;
  email: string;
  status: RsvpStatus;
  guests: number;
  respondedAt: Date;
};

export async function listEventRsvps(eventId: string): Promise<EventRsvpRow[]> {
  await requireRole("exco", "super_admin");
  return withUserContext(async (tx) => {
    const rows = await tx
      .select({
        firstName: members.firstName,
        lastName: members.lastName,
        preferredName: members.preferredName,
        deletedAt: members.deletedAt,
        email: users.email,
        status: eventRsvps.status,
        guests: eventRsvps.guests,
        respondedAt: eventRsvps.respondedAt,
      })
      .from(eventRsvps)
      .innerJoin(members, eq(members.id, eventRsvps.memberId))
      .innerJoin(users, eq(users.id, members.userId))
      .where(eq(eventRsvps.eventId, eventId))
      .orderBy(desc(eventRsvps.respondedAt));
    return rows.map((r) => ({
      name: displayName(r),
      email: r.email,
      status: r.status,
      guests: r.guests,
      respondedAt: r.respondedAt,
    }));
  });
}

export async function exportEventRsvpsCsv(
  eventId: string,
): Promise<{ csv: string; count: number }> {
  const session = await requireRole("exco", "super_admin");
  const rows = await listEventRsvps(eventId);
  const header = ["name", "email", "status", "guests", "responded"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [r.name, r.email, r.status, r.guests, r.respondedAt.toISOString().slice(0, 10)]
        .map(csvCell)
        .join(","),
    );
  }
  await audit(session.user.id, "event.rsvp_export", "event", eventId, {
    count: rows.length,
  });
  return { csv: lines.join("\r\n"), count: rows.length };
}

/** ICS for the "Add to calendar" download (session-gated). */
export async function getEventIcs(
  id: string,
): Promise<{ ics: string; filename: string } | null> {
  await requireSession();
  const [ev] = await db
    .select()
    .from(events)
    .where(
      and(
        eq(events.id, id),
        isNull(events.deletedAt),
        isNotNull(events.publishedAt),
      ),
    )
    .limit(1);
  if (!ev) return null;
  return {
    ics: buildEventIcs(ev, { canceled: !!ev.canceledAt }),
    filename: `${ev.slug || "event"}.ics`,
  };
}

// ============================ birthdays ====================================
// Birthdays are date-only and celebrated in West Africa Time. The pure date
// math (incl. the 29 Feb -> 28 Feb rule) lives in src/lib/birthdays.ts.

/** The WAT calendar "today" as y/m/d numbers. */
function watToday(now: Date): { year: number; month: number; day: number } {
  const [year, month, day] = formatInTimeZone(now, WAT, "yyyy-MM-dd")
    .split("-")
    .map(Number);
  return { year, month, day };
}

export type BirthdayPerson = {
  memberId: string;
  name: string;
  avatarUrl: string | null;
  month: number; // birthday month (1-12)
  day: number; // birthday day of month
  daysUntil: number; // from WAT today (0 = today)
  isToday: boolean;
  showAge: boolean;
  // Only populated when the member chose to show their age (never leak the birth
  // year otherwise — that is equivalent to leaking age, rule 8 spirit).
  turnsAge: number | null;
};

/**
 * Every browsable member who has a birthday on file, with privacy-safe fields
 * and the days-until computed in WAT. Mirrors the directory's visibility filter
 * (active, non-deleted, public/members). Sorted by soonest first.
 */
export async function listAllBirthdays(): Promise<BirthdayPerson[]> {
  await requireSession();
  const today = watToday(new Date());
  const from = new Date(Date.UTC(today.year, today.month - 1, today.day));
  return withUserContext(async (tx) => {
    const rows = await tx
      .select({
        memberId: members.id,
        firstName: members.firstName,
        lastName: members.lastName,
        preferredName: members.preferredName,
        avatarUrl: members.avatarUrl,
        dateOfBirth: members.dateOfBirth,
        showAge: members.showAge,
      })
      .from(members)
      .innerJoin(users, eq(users.id, members.userId))
      .where(
        and(
          isNull(members.deletedAt),
          eq(users.status, "active"),
          inArray(members.profileVisibility, ["public", "members"]),
          isNotNull(members.dateOfBirth),
        ),
      );

    const people: BirthdayPerson[] = [];
    for (const r of rows) {
      const dob = r.dateOfBirth;
      if (!dob) continue;
      const md = parseDob(dob);
      if (!md) continue;
      const daysUntil = daysUntilBirthday(dob, from) ?? 0;
      const next = nextBirthday(dob, from);
      const celebrationYear = next ? next.getUTCFullYear() : today.year;
      people.push({
        memberId: r.memberId,
        name: displayName(r),
        avatarUrl: r.avatarUrl,
        month: md.month,
        day: md.day,
        daysUntil,
        isToday: daysUntil === 0,
        showAge: r.showAge,
        turnsAge: r.showAge ? ageTurning(dob, celebrationYear) : null,
      });
    }
    return people.sort((a, b) => a.daysUntil - b.daysUntil);
  });
}

export type BirthdayContact = BirthdayPerson & {
  // Email is resolved through getMemberWithPrivacy (rule 8) so the dashboard's
  // "wish them" mailto only appears when the celebrant's email is visible to
  // the viewer. null = hidden by privacy or none on file.
  email: string | null;
};

/**
 * Birthdays today + within the next 7 days, each carrying a privacy-resolved
 * email for the "wish them" mailto. The within-week set is tiny, so a per-person
 * getMemberWithPrivacy call keeps rule 8 the single source of truth for PII.
 */
export async function listBirthdaysThisWeek(): Promise<BirthdayContact[]> {
  const all = await listAllBirthdays();
  const soon = all.filter((p) => p.daysUntil <= 7);
  const viewer = await currentViewer();
  return Promise.all(
    soon.map(async (p) => {
      const view = await getMemberWithPrivacy(p.memberId, viewer);
      return { ...p, email: view?.email ?? null };
    }),
  );
}

// --- birthday cron ---------------------------------------------------------

export type BirthdayCronResult = {
  date: string; // WAT yyyy-MM-dd
  year: number;
  celebrants: number;
  sent: number;
  skipped: number;
  failed: number;
  setmatesNotified: number;
};

/**
 * Send birthday wishes for everyone whose birthday is today (WAT). Idempotent
 * per (member, year) via birthday_sent: a celebrant already recorded for this
 * year is skipped, so a second run sends nothing. Each celebrant is wrapped in
 * its own try/catch so one failure never kills the batch, and every outcome is
 * logged as a structured line. Runs in system context (no session); the route
 * must verify the CRON_SECRET first.
 */
export async function runBirthdayCron(
  now: Date = new Date(),
): Promise<BirthdayCronResult> {
  const today = watToday(now);
  const dateLabel = `${today.year}-${String(today.month).padStart(2, "0")}-${String(today.day).padStart(2, "0")}`;
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const everyone = await withSystemContext(async (tx) =>
    tx
      .select({
        memberId: members.id,
        firstName: members.firstName,
        lastName: members.lastName,
        preferredName: members.preferredName,
        dateOfBirth: members.dateOfBirth,
        graduationYear: members.graduationYear,
        notifyBirthdays: members.notifyBirthdays,
        email: users.email,
      })
      .from(members)
      .innerJoin(users, eq(users.id, members.userId))
      .where(
        and(
          isNull(members.deletedAt),
          eq(users.status, "active"),
          isNotNull(members.dateOfBirth),
        ),
      ),
  );

  const celebrants = everyone.filter(
    (m) =>
      m.dateOfBirth &&
      isBirthdayOn(m.dateOfBirth, today.year, today.month, today.day),
  );

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  let setmatesNotified = 0;

  for (const c of celebrants) {
    try {
      const existing = await db
        .select({ id: birthdaySent.id })
        .from(birthdaySent)
        .where(
          and(
            eq(birthdaySent.memberId, c.memberId),
            eq(birthdaySent.year, today.year),
          ),
        )
        .limit(1);
      if (existing.length > 0) {
        skipped++;
        console.log(
          JSON.stringify({
            job: "birthdays",
            date: dateLabel,
            memberId: c.memberId,
            result: "skipped",
          }),
        );
        continue;
      }

      await send({
        to: c.email,
        subject: "Happy birthday from Set",
        react: BirthdayWish({ name: displayName(c) }),
      });
      await db
        .insert(birthdaySent)
        .values({ memberId: c.memberId, year: today.year })
        .onConflictDoNothing({
          target: [birthdaySent.memberId, birthdaySent.year],
        });
      sent++;
      console.log(
        JSON.stringify({
          job: "birthdays",
          date: dateLabel,
          memberId: c.memberId,
          result: "sent",
        }),
      );

      // Optionally notify opted-in setmates (same graduating set).
      if (c.graduationYear != null) {
        const setmates = everyone.filter(
          (m) =>
            m.graduationYear === c.graduationYear &&
            m.memberId !== c.memberId &&
            m.notifyBirthdays,
        );
        if (setmates.length > 0) {
          try {
            await sendEach(
              setmates.map((s) => ({
                to: s.email,
                subject: `It is ${displayName(c)}'s birthday today`,
                react: BirthdayHeadsUp({
                  celebrantName: displayName(c),
                  directoryUrl: `${base}/directory/${c.memberId}`,
                }),
              })),
            );
            setmatesNotified += setmates.length;
          } catch {
            // heads-ups are best-effort; never fail the wish over them
          }
        }
      }
    } catch (err) {
      failed++;
      console.log(
        JSON.stringify({
          job: "birthdays",
          date: dateLabel,
          memberId: c.memberId,
          result: "failed",
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  await audit(null, "cron.birthdays", null, null, {
    date: dateLabel,
    celebrants: celebrants.length,
    sent,
    skipped,
    failed,
    setmatesNotified,
  });

  return {
    date: dateLabel,
    year: today.year,
    celebrants: celebrants.length,
    sent,
    skipped,
    failed,
    setmatesNotified,
  };
}

// --- admin: birthdays ------------------------------------------------------

export type AdminUpcomingBirthday = {
  memberId: string;
  name: string;
  email: string;
  month: number;
  day: number;
  daysUntil: number;
  isToday: boolean;
  sentThisYear: boolean;
};

export async function listAdminUpcomingBirthdays(
  days = 30,
): Promise<AdminUpcomingBirthday[]> {
  await requireRole("exco", "super_admin");
  const today = watToday(new Date());
  const from = new Date(Date.UTC(today.year, today.month - 1, today.day));
  return withUserContext(async (tx) => {
    const rows = await tx
      .select({
        memberId: members.id,
        firstName: members.firstName,
        lastName: members.lastName,
        preferredName: members.preferredName,
        dateOfBirth: members.dateOfBirth,
        email: users.email,
      })
      .from(members)
      .innerJoin(users, eq(users.id, members.userId))
      .where(
        and(
          isNull(members.deletedAt),
          eq(users.status, "active"),
          isNotNull(members.dateOfBirth),
        ),
      );

    const sentRows = await tx
      .select({ memberId: birthdaySent.memberId })
      .from(birthdaySent)
      .where(eq(birthdaySent.year, today.year));
    const sentSet = new Set(sentRows.map((s) => s.memberId));

    const out: AdminUpcomingBirthday[] = [];
    for (const r of rows) {
      const dob = r.dateOfBirth;
      if (!dob) continue;
      const md = parseDob(dob);
      if (!md) continue;
      const daysUntil = daysUntilBirthday(dob, from) ?? 0;
      if (daysUntil > days) continue;
      out.push({
        memberId: r.memberId,
        name: displayName(r),
        email: r.email,
        month: md.month,
        day: md.day,
        daysUntil,
        isToday: daysUntil === 0,
        sentThisYear: sentSet.has(r.memberId),
      });
    }
    return out.sort((a, b) => a.daysUntil - b.daysUntil);
  });
}

export type BirthdaySendLogRow = {
  memberId: string;
  name: string;
  email: string;
  year: number;
  sentAt: Date;
};

export async function listBirthdaySendLog(
  limit = 100,
): Promise<BirthdaySendLogRow[]> {
  await requireRole("exco", "super_admin");
  return withUserContext(async (tx) => {
    const rows = await tx
      .select({
        memberId: birthdaySent.memberId,
        year: birthdaySent.year,
        sentAt: birthdaySent.sentAt,
        firstName: members.firstName,
        lastName: members.lastName,
        preferredName: members.preferredName,
        deletedAt: members.deletedAt,
        email: users.email,
      })
      .from(birthdaySent)
      .innerJoin(members, eq(members.id, birthdaySent.memberId))
      .innerJoin(users, eq(users.id, members.userId))
      .orderBy(desc(birthdaySent.sentAt))
      .limit(limit);
    return rows.map((r) => ({
      memberId: r.memberId,
      name: displayName(r),
      email: r.email,
      year: r.year,
      sentAt: r.sentAt,
    }));
  });
}

/**
 * Manually (re)send a birthday wish. Available to exco+, but re-sending when one
 * has already gone out this year is a "duplicate" only a super admin may force.
 * Audited either way.
 */
export async function manualBirthdaySend(
  memberId: string,
  override = false,
): Promise<{ ok: boolean; error?: string; needsOverride?: boolean }> {
  const session = await requireRole("exco", "super_admin");
  const year = watToday(new Date()).year;

  const target = await withUserContext(async (tx) => {
    const [m] = await tx
      .select({
        id: members.id,
        firstName: members.firstName,
        lastName: members.lastName,
        preferredName: members.preferredName,
        deletedAt: members.deletedAt,
        email: users.email,
        status: users.status,
      })
      .from(members)
      .innerJoin(users, eq(users.id, members.userId))
      .where(eq(members.id, memberId))
      .limit(1);
    return m ?? null;
  });
  if (!target || target.deletedAt) return { ok: false, error: "Member not found." };

  const already = await db
    .select({ id: birthdaySent.id })
    .from(birthdaySent)
    .where(and(eq(birthdaySent.memberId, memberId), eq(birthdaySent.year, year)))
    .limit(1);

  if (already.length > 0) {
    if (!override) {
      return {
        ok: false,
        needsOverride: true,
        error: "A birthday email already went out this year.",
      };
    }
    if (session.user.role !== "super_admin") {
      return { ok: false, error: "Only a super admin can re-send a duplicate." };
    }
  }

  try {
    await send({
      to: target.email,
      subject: "Happy birthday from Set",
      react: BirthdayWish({ name: displayName(target) }),
    });
  } catch {
    return { ok: false, error: "Could not send the email. Try again." };
  }
  await db
    .insert(birthdaySent)
    .values({ memberId, year })
    .onConflictDoNothing({ target: [birthdaySent.memberId, birthdaySent.year] });
  await audit(session.user.id, "birthday.manual_send", "member", memberId, {
    year,
    override: already.length > 0,
  });
  return { ok: true };
}

// ============================ settings =====================================

const ANNOUNCEMENT_DAILY_CAP_KEY = "announcement_daily_cap";
const DEFAULT_DAILY_BULK_CAP = 5;

export async function getSetting(key: string): Promise<string | null> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, key))
    .limit(1);
  return row?.value ?? null;
}

/** Daily cap on announcement bulk-email campaigns (default 5, admin-tunable). */
export async function getDailyBulkCap(): Promise<number> {
  const raw = await getSetting(ANNOUNCEMENT_DAILY_CAP_KEY);
  const n = raw == null ? NaN : Number.parseInt(raw, 10);
  return Number.isInteger(n) && n >= 0 ? n : DEFAULT_DAILY_BULK_CAP;
}

export async function setDailyBulkCap(
  cap: number,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireSuperAdmin();
  if (!Number.isInteger(cap) || cap < 0 || cap > 1000) {
    return { ok: false, error: "Enter a whole number between 0 and 1000." };
  }
  await db
    .insert(appSettings)
    .values({ key: ANNOUNCEMENT_DAILY_CAP_KEY, value: String(cap) })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: String(cap), updatedAt: new Date() },
    });
  await audit(session.user.id, "settings.update", "setting", ANNOUNCEMENT_DAILY_CAP_KEY, {
    cap,
  });
  return { ok: true };
}

// --- organization + email settings ----------------------------------------

const SK = {
  orgName: "org_name",
  orgContactEmail: "org_contact_email",
  orgFoundingYear: "org_founding_year",
  emailFromName: "email_from_name",
  emailReplyTo: "email_reply_to",
} as const;

async function getSettingsMap(keys: string[]): Promise<Record<string, string>> {
  if (keys.length === 0) return {};
  const rows = await db
    .select({ key: appSettings.key, value: appSettings.value })
    .from(appSettings)
    .where(inArray(appSettings.key, keys));
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

/** Upsert several settings, treating "" as "clear" (delete the key). */
async function putSettings(entries: Record<string, string>): Promise<void> {
  const now = new Date();
  for (const [key, raw] of Object.entries(entries)) {
    const value = raw.trim();
    if (value === "") {
      await db.delete(appSettings).where(eq(appSettings.key, key));
      continue;
    }
    await db
      .insert(appSettings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value, updatedAt: now },
      });
  }
}

export type OrgSettings = {
  name: string | null;
  contactEmail: string | null;
  foundingYear: string | null;
};

export async function getOrgSettings(): Promise<OrgSettings> {
  const m = await getSettingsMap([SK.orgName, SK.orgContactEmail, SK.orgFoundingYear]);
  return {
    name: m[SK.orgName] ?? null,
    contactEmail: m[SK.orgContactEmail] ?? null,
    foundingYear: m[SK.orgFoundingYear] ?? null,
  };
}

export async function setOrgSettings(
  input: OrgSettings,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireSuperAdmin();
  await putSettings({
    [SK.orgName]: input.name ?? "",
    [SK.orgContactEmail]: input.contactEmail ?? "",
    [SK.orgFoundingYear]: input.foundingYear ?? "",
  });
  await audit(session.user.id, "settings.update", "setting", null, {
    keys: ["organization"],
  });
  return { ok: true };
}

export type EmailSettings = { fromName: string | null; replyTo: string | null };

/** Email presentation config applied by lib/email.ts at send time (from display
 * name + reply-to). No guard: read on every send, including system crons. */
export async function getEmailConfig(): Promise<EmailSettings> {
  const m = await getSettingsMap([SK.emailFromName, SK.emailReplyTo]);
  return {
    fromName: m[SK.emailFromName] ?? null,
    replyTo: m[SK.emailReplyTo] ?? null,
  };
}

export async function setEmailSettings(
  input: EmailSettings,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireSuperAdmin();
  await putSettings({
    [SK.emailFromName]: input.fromName ?? "",
    [SK.emailReplyTo]: input.replyTo ?? "",
  });
  await audit(session.user.id, "settings.update", "setting", null, {
    keys: ["email"],
  });
  return { ok: true };
}

// --- danger zone: full export + super admin transfer ----------------------

function toCsv(
  header: string[],
  rows: (string | number | null | undefined)[][],
): string {
  const lines = [header.map(csvCell).join(",")];
  for (const r of rows) lines.push(r.map(csvCell).join(","));
  return lines.join("\r\n");
}

const EXPORT_ROW_CAP = 10000;

/**
 * Full platform export as a zip of CSVs (super admin, audited). Encrypted phone
 * numbers are intentionally omitted; this is a portability/backup snapshot, not
 * a decryption tool. Each table is capped at 10k rows.
 */
export async function exportAllDataZip(): Promise<{
  buffer: Buffer;
  filename: string;
  counts: Record<string, number>;
}> {
  const session = await requireSuperAdmin();
  const zip = new JSZip();
  const counts: Record<string, number> = {};

  const memberRows = await db
    .select({
      firstName: members.firstName,
      lastName: members.lastName,
      email: users.email,
      graduationYear: members.graduationYear,
      faculty: members.faculty,
      role: users.role,
      status: users.status,
      city: members.city,
      country: members.country,
      createdAt: members.createdAt,
      deletedAt: members.deletedAt,
    })
    .from(members)
    .innerJoin(users, eq(users.id, members.userId))
    .limit(EXPORT_ROW_CAP);
  counts.members = memberRows.length;
  zip.file(
    "members.csv",
    toCsv(
      ["first_name", "last_name", "email", "set", "faculty", "role", "status", "city", "country", "joined", "deleted_at"],
      memberRows.map((m) => [
        m.firstName,
        m.lastName,
        m.email,
        m.graduationYear ?? "",
        m.faculty ?? "",
        m.role,
        m.status,
        m.city ?? "",
        m.country ?? "",
        m.createdAt.toISOString().slice(0, 10),
        m.deletedAt ? m.deletedAt.toISOString().slice(0, 10) : "",
      ]),
    ),
  );

  const eventRows = await db
    .select({
      title: events.title,
      startsAt: events.startsAt,
      location: events.location,
      isVirtual: events.isVirtual,
      publishedAt: events.publishedAt,
      canceledAt: events.canceledAt,
    })
    .from(events)
    .limit(EXPORT_ROW_CAP);
  counts.events = eventRows.length;
  zip.file(
    "events.csv",
    toCsv(
      ["title", "starts_at", "location", "virtual", "published_at", "canceled_at"],
      eventRows.map((e) => [
        e.title,
        e.startsAt.toISOString(),
        e.location ?? "",
        e.isVirtual ? "yes" : "no",
        e.publishedAt ? e.publishedAt.toISOString() : "",
        e.canceledAt ? e.canceledAt.toISOString() : "",
      ]),
    ),
  );

  const rsvpRows = await db
    .select({
      event: events.title,
      status: eventRsvps.status,
      guests: eventRsvps.guests,
      member: members.firstName,
      last: members.lastName,
      createdAt: eventRsvps.createdAt,
    })
    .from(eventRsvps)
    .innerJoin(events, eq(events.id, eventRsvps.eventId))
    .leftJoin(members, eq(members.id, eventRsvps.memberId))
    .limit(EXPORT_ROW_CAP);
  counts.rsvps = rsvpRows.length;
  zip.file(
    "event_rsvps.csv",
    toCsv(
      ["event", "member", "status", "guests", "created_at"],
      rsvpRows.map((r) => [
        r.event,
        [r.member, r.last].filter(Boolean).join(" "),
        r.status,
        r.guests,
        r.createdAt.toISOString(),
      ]),
    ),
  );

  const fundraiserRows = await db
    .select({
      title: fundraisers.title,
      goalAmount: fundraisers.goalAmount,
      status: fundraisers.status,
      createdAt: fundraisers.createdAt,
    })
    .from(fundraisers)
    .limit(EXPORT_ROW_CAP);
  counts.fundraisers = fundraiserRows.length;
  zip.file(
    "fundraisers.csv",
    toCsv(
      ["title", "goal_kobo", "status", "created_at"],
      fundraiserRows.map((f) => [
        f.title,
        f.goalAmount ?? "",
        f.status,
        f.createdAt.toISOString().slice(0, 10),
      ]),
    ),
  );

  const pledgeRows = await db
    .select({
      campaign: fundraisers.title,
      amount: fundraiserPledges.amount,
      status: fundraiserPledges.status,
      channel: fundraiserPledges.channel,
      anonymous: fundraiserPledges.anonymous,
      externalName: fundraiserPledges.externalName,
      memberFirst: members.firstName,
      memberLast: members.lastName,
      createdAt: fundraiserPledges.createdAt,
    })
    .from(fundraiserPledges)
    .innerJoin(fundraisers, eq(fundraisers.id, fundraiserPledges.fundraiserId))
    .leftJoin(members, eq(members.id, fundraiserPledges.memberId))
    .limit(EXPORT_ROW_CAP);
  counts.pledges = pledgeRows.length;
  zip.file(
    "pledges.csv",
    toCsv(
      ["campaign", "pledger", "amount_kobo", "channel", "status", "created_at"],
      pledgeRows.map((p) => [
        p.campaign,
        p.anonymous
          ? "Anonymous"
          : [p.memberFirst, p.memberLast].filter(Boolean).join(" ") ||
            p.externalName ||
            "",
        p.amount,
        p.channel ?? "",
        p.status,
        p.createdAt.toISOString(),
      ]),
    ),
  );

  const announcementRows = await db
    .select({
      title: announcements.title,
      status: announcements.status,
      pinned: announcements.pinned,
      publishedAt: announcements.publishedAt,
      createdAt: announcements.createdAt,
    })
    .from(announcements)
    .limit(EXPORT_ROW_CAP);
  counts.announcements = announcementRows.length;
  zip.file(
    "announcements.csv",
    toCsv(
      ["title", "status", "pinned", "published_at", "created_at"],
      announcementRows.map((a) => [
        a.title,
        a.status,
        a.pinned ? "yes" : "no",
        a.publishedAt ? a.publishedAt.toISOString() : "",
        a.createdAt.toISOString(),
      ]),
    ),
  );

  const auditRows = await db
    .select({
      createdAt: auditLog.createdAt,
      action: auditLog.action,
      actorEmail: auditLog.actorEmail,
      actorId: auditLog.actorId,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
    })
    .from(auditLog)
    .orderBy(desc(auditLog.createdAt))
    .limit(EXPORT_ROW_CAP);
  counts.audit_log = auditRows.length;
  zip.file(
    "audit_log.csv",
    toCsv(
      ["created_at", "action", "actor", "entity_type", "entity_id"],
      auditRows.map((a) => [
        a.createdAt.toISOString(),
        a.action,
        a.actorEmail ?? a.actorId ?? "system",
        a.entityType ?? "",
        a.entityId ?? "",
      ]),
    ),
  );

  const stamp = new Date().toISOString().slice(0, 10);
  zip.file(
    "README.txt",
    `Set platform export — ${stamp}\n\n` +
      `This archive contains CSV snapshots of the platform's core data.\n` +
      `Encrypted phone numbers are intentionally omitted. Each table is capped ` +
      `at ${EXPORT_ROW_CAP} rows.\n\n` +
      Object.entries(counts)
        .map(([k, v]) => `${k}: ${v} rows`)
        .join("\n") +
      `\n`,
  );

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  await audit(session.user.id, "data.export_all", null, null, { counts });
  return { buffer, filename: `set-export-${stamp}.zip`, counts };
}

/** Active members (excluding the caller) eligible to receive super admin. */
export async function listSuperAdminCandidates(): Promise<
  { userId: string; name: string; email: string }[]
> {
  const session = await requireSuperAdmin();
  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      name: users.name,
      firstName: members.firstName,
      lastName: members.lastName,
      preferredName: members.preferredName,
    })
    .from(users)
    .leftJoin(members, eq(members.userId, users.id))
    .where(and(eq(users.status, "active"), ne(users.id, session.user.id)));
  return rows
    .map((r) => ({
      userId: r.userId,
      email: r.email,
      name:
        r.firstName || r.lastName || r.preferredName
          ? displayName(r)
          : r.name || r.email,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Transfer the super admin role to another active user, demoting the caller to
 * exco (a true hand-over). Requires typing the target's exact email to confirm.
 * Audited. Guarded so at least one super admin always remains.
 */
export async function transferSuperAdmin(
  targetUserId: string,
  confirmEmail: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireSuperAdmin();
  if (targetUserId === session.user.id) {
    return { ok: false, error: "You already hold super admin." };
  }
  const [target] = await db
    .select({ id: users.id, email: users.email, status: users.status })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);
  if (!target) return { ok: false, error: "That account was not found." };
  if (target.status !== "active") {
    return { ok: false, error: "The new super admin must be an active member." };
  }
  if (confirmEmail.trim().toLowerCase() !== target.email.toLowerCase()) {
    return { ok: false, error: "The confirmation email did not match." };
  }

  // Promote first so there are always two super admins before the self-demote,
  // satisfying the "never zero super admins" invariant.
  await db
    .update(users)
    .set({ role: "super_admin" })
    .where(eq(users.id, targetUserId));
  await db
    .update(users)
    .set({ role: "exco" })
    .where(eq(users.id, session.user.id));

  await audit(session.user.id, "superadmin.transfer", "user", targetUserId, {
    demotedSelfTo: "exco",
  });
  return { ok: true };
}

// ============================ meeting minutes (exco) ========================

/**
 * Structure a transcript + notes into a minutes draft. Uses the Anthropic API
 * when ANTHROPIC_API_KEY is set; otherwise returns a deterministic starting
 * point (real attendees extracted, notes seeded) the secretary edits. Never
 * throws on an AI failure: it falls back so the tool always works.
 */
export async function generateMinutes(
  transcript: string,
  notes: string,
): Promise<{ draft: MinutesDraft; usedAi: boolean }> {
  await requireRole("exco", "super_admin");
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { draft: fallbackMinutes(transcript, notes), usedAi: false };

  try {
    const { system, user } = buildMinutesMessages(transcript, notes);
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
        max_tokens: 4096,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}`);
    const data = (await res.json()) as {
      content?: { type: string; text?: string }[];
    };
    const text = data.content?.map((c) => c.text ?? "").join("") ?? "";
    return { draft: parseMinutesJson(text), usedAi: true };
  } catch {
    return { draft: fallbackMinutes(transcript, notes), usedAi: false };
  }
}

export type MinutesListRow = {
  id: string;
  title: string;
  meetingDate: string | null;
  status: string;
  updatedAt: Date;
};

export async function listMinutes(): Promise<MinutesListRow[]> {
  await requireRole("exco", "super_admin");
  return db
    .select({
      id: meetingMinutes.id,
      title: meetingMinutes.title,
      meetingDate: meetingMinutes.meetingDate,
      status: meetingMinutes.status,
      updatedAt: meetingMinutes.updatedAt,
    })
    .from(meetingMinutes)
    .orderBy(desc(meetingMinutes.updatedAt));
}

export async function getMinutes(id: string) {
  await requireRole("exco", "super_admin");
  const [row] = await db
    .select()
    .from(meetingMinutes)
    .where(eq(meetingMinutes.id, id))
    .limit(1);
  return row ?? null;
}

function cleanDraft(input: MinutesDraft): MinutesDraft {
  return {
    title: input.title.trim() || "Untitled minutes",
    meetingDate: input.meetingDate.trim(),
    location: input.location.trim(),
    facilitator: input.facilitator.trim(),
    minutesBy: input.minutesBy.trim(),
    attendees: input.attendees.map((a) => a.trim()).filter(Boolean),
    sections: input.sections
      .map((s) => ({
        heading: s.heading.trim(),
        points: s.points.map((p) => p.trim()).filter(Boolean),
      }))
      .filter((s) => s.heading || s.points.length),
    actionItems: input.actionItems
      .map((a) => ({ task: a.task.trim(), owner: a.owner.trim(), due: a.due.trim() }))
      .filter((a) => a.task),
    decisions: input.decisions.map((d) => d.trim()).filter(Boolean),
  };
}

export async function createMinutes(
  input: MinutesDraft & { rawTranscript?: string; status?: string },
): Promise<{ id: string }> {
  const session = await requireRole("exco", "super_admin");
  const d = cleanDraft(input);
  const [row] = await db
    .insert(meetingMinutes)
    .values({
      ...d,
      meetingDate: d.meetingDate || null,
      rawTranscript: input.rawTranscript ?? null,
      status: input.status === "final" ? "final" : "draft",
      createdBy: session.user.id,
    })
    .returning({ id: meetingMinutes.id });
  await audit(session.user.id, "minutes.create", "minutes", row.id, {
    title: d.title,
  });
  return { id: row.id };
}

export async function updateMinutes(
  id: string,
  input: MinutesDraft & { status?: string },
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireRole("exco", "super_admin");
  const d = cleanDraft(input);
  const res = await db
    .update(meetingMinutes)
    .set({
      ...d,
      meetingDate: d.meetingDate || null,
      status: input.status === "final" ? "final" : "draft",
    })
    .where(eq(meetingMinutes.id, id))
    .returning({ id: meetingMinutes.id });
  if (res.length === 0) return { ok: false, error: "Minutes not found." };
  await audit(session.user.id, "minutes.update", "minutes", id, { title: d.title });
  return { ok: true };
}

export async function deleteMinutes(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireRole("exco", "super_admin");
  const res = await db
    .delete(meetingMinutes)
    .where(eq(meetingMinutes.id, id))
    .returning({ id: meetingMinutes.id });
  if (res.length === 0) return { ok: false, error: "Minutes not found." };
  await audit(session.user.id, "minutes.delete", "minutes", id);
  return { ok: true };
}

// ============================ exco directory ===============================

export type ExcoView = {
  id: string;
  name: string;
  role: string;
  email: string | null;
  photoUrl: string | null;
  bio: string | null;
  setLabel: string | null;
  group: string;
  sortOrder: number;
};

/** The exco + alumni office, for the members-facing /exco page. */
export async function listExco(): Promise<ExcoView[]> {
  await requireSession();
  return db
    .select()
    .from(excoMembers)
    .orderBy(excoMembers.group, excoMembers.sortOrder, excoMembers.name);
}

export async function getExcoMember(id: string): Promise<ExcoView | null> {
  await requireRole("exco", "super_admin");
  const [row] = await db
    .select()
    .from(excoMembers)
    .where(eq(excoMembers.id, id))
    .limit(1);
  return row ?? null;
}

export type ExcoInput = {
  name: string;
  role: string;
  email: string | null;
  photoUrl: string | null;
  bio: string | null;
  setLabel: string | null;
  group: string;
  sortOrder: number;
};

export async function createExcoMember(
  input: ExcoInput,
): Promise<{ id: string }> {
  const session = await requireRole("exco", "super_admin");
  const [row] = await db
    .insert(excoMembers)
    .values(input)
    .returning({ id: excoMembers.id });
  await audit(session.user.id, "exco.create", "exco", row.id, { name: input.name });
  return { id: row.id };
}

export async function updateExcoMember(
  id: string,
  input: ExcoInput,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireRole("exco", "super_admin");
  const res = await db
    .update(excoMembers)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(excoMembers.id, id))
    .returning({ id: excoMembers.id });
  if (res.length === 0) return { ok: false, error: "Member not found." };
  await audit(session.user.id, "exco.update", "exco", id, { name: input.name });
  return { ok: true };
}

export async function deleteExcoMember(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireRole("exco", "super_admin");
  const res = await db
    .delete(excoMembers)
    .where(eq(excoMembers.id, id))
    .returning({ id: excoMembers.id });
  if (res.length === 0) return { ok: false, error: "Member not found." };
  await audit(session.user.id, "exco.delete", "exco", id);
  return { ok: true };
}

// ============================ announcements ================================

function announcementExcerpt(body: string, max = 200): string {
  const plain = body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`~\-]+/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > max ? `${plain.slice(0, max).trimEnd()}…` : plain;
}

function authorDisplay(r: {
  authorName: string | null;
  authorFirst: string | null;
  authorLast: string | null;
  authorPreferred: string | null;
}): string {
  const fromMember = [r.authorPreferred ?? r.authorFirst, r.authorLast]
    .filter(Boolean)
    .join(" ")
    .trim();
  return fromMember || r.authorName || "Set";
}

export type AnnouncementCard = {
  id: string;
  title: string;
  slug: string;
  body: string;
  pinned: boolean;
  publishedAt: Date | null;
  authorName: string;
  authorAvatarUrl: string | null;
};

const announcementAuthorColumns = {
  id: announcements.id,
  title: announcements.title,
  slug: announcements.slug,
  body: announcements.body,
  pinned: announcements.pinned,
  publishedAt: announcements.publishedAt,
  authorName: users.name,
  authorFirst: members.firstName,
  authorLast: members.lastName,
  authorPreferred: members.preferredName,
  authorAvatar: members.avatarUrl,
} as const;

export const ANNOUNCEMENTS_PER_PAGE = 20;

/** Published announcements, pinned first then newest, paginated (members). */
export async function listPublishedAnnouncements(
  page = 1,
): Promise<{
  items: AnnouncementCard[];
  page: number;
  totalPages: number;
  total: number;
}> {
  await requireSession();
  const perPage = ANNOUNCEMENTS_PER_PAGE;
  const current = Math.max(1, Math.floor(page));
  const where = and(
    eq(announcements.status, "published"),
    isNull(announcements.deletedAt),
  );

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(announcements)
    .where(where);

  const rows = await db
    .select(announcementAuthorColumns)
    .from(announcements)
    .leftJoin(users, eq(users.id, announcements.authorId))
    .leftJoin(members, eq(members.userId, announcements.authorId))
    .where(where)
    .orderBy(desc(announcements.pinned), desc(announcements.publishedAt))
    .limit(perPage)
    .offset((current - 1) * perPage);

  return {
    items: rows.map((r) => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      body: r.body,
      pinned: r.pinned,
      publishedAt: r.publishedAt,
      authorName: authorDisplay(r),
      authorAvatarUrl: r.authorAvatar,
    })),
    page: current,
    total,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

/** A single published announcement (drafts are invisible to members). */
export async function getPublishedAnnouncement(
  id: string,
): Promise<(AnnouncementCard & { createdAt: Date }) | null> {
  await requireSession();
  const [r] = await db
    .select({ ...announcementAuthorColumns, createdAt: announcements.createdAt })
    .from(announcements)
    .leftJoin(users, eq(users.id, announcements.authorId))
    .leftJoin(members, eq(members.userId, announcements.authorId))
    .where(
      and(
        eq(announcements.id, id),
        eq(announcements.status, "published"),
        isNull(announcements.deletedAt),
      ),
    )
    .limit(1);
  if (!r) return null;
  return {
    id: r.id,
    title: r.title,
    slug: r.slug,
    body: r.body,
    pinned: r.pinned,
    publishedAt: r.publishedAt,
    authorName: authorDisplay(r),
    authorAvatarUrl: r.authorAvatar,
    createdAt: r.createdAt,
  };
}

export type AdminAnnouncementRow = {
  id: string;
  title: string;
  status: "draft" | "published" | "archived";
  pinned: boolean;
  publishedAt: Date | null;
  updatedAt: Date;
};

export async function listAdminAnnouncements(): Promise<AdminAnnouncementRow[]> {
  await requireRole("exco", "super_admin");
  const rows = await db
    .select({
      id: announcements.id,
      title: announcements.title,
      status: announcements.status,
      pinned: announcements.pinned,
      publishedAt: announcements.publishedAt,
      updatedAt: announcements.updatedAt,
    })
    .from(announcements)
    .where(isNull(announcements.deletedAt))
    .orderBy(desc(announcements.updatedAt));
  return rows;
}

export async function getAdminAnnouncement(id: string) {
  await requireRole("exco", "super_admin");
  const [a] = await db
    .select()
    .from(announcements)
    .where(and(eq(announcements.id, id), isNull(announcements.deletedAt)))
    .limit(1);
  return a ?? null;
}

export type AnnouncementInput = {
  title: string;
  body: string;
  pinned: boolean;
};

export async function createAnnouncement(
  input: AnnouncementInput,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const session = await requireRole("exco", "super_admin");
  let slug = slugify(input.title);
  const clash = await db
    .select({ id: announcements.id })
    .from(announcements)
    .where(eq(announcements.slug, slug))
    .limit(1);
  if (clash.length) slug = `${slug}-${Math.floor(Date.now() / 1000) % 100000}`;

  const [row] = await db
    .insert(announcements)
    .values({
      title: input.title,
      slug,
      body: input.body,
      pinned: input.pinned,
      status: "draft",
      authorId: session.user.id,
    })
    .returning({ id: announcements.id });
  await audit(session.user.id, "announcement.create", "announcement", row.id, {
    title: input.title,
  });
  return { ok: true, id: row.id };
}

export async function updateAnnouncement(
  id: string,
  input: AnnouncementInput,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireRole("exco", "super_admin");
  const [a] = await db
    .select({ id: announcements.id })
    .from(announcements)
    .where(and(eq(announcements.id, id), isNull(announcements.deletedAt)))
    .limit(1);
  if (!a) return { ok: false, error: "Announcement not found." };
  await db
    .update(announcements)
    .set({ title: input.title, body: input.body, pinned: input.pinned })
    .where(eq(announcements.id, id));
  await audit(session.user.id, "announcement.update", "announcement", id, {
    fields: ["title", "body", "pinned"],
  });
  return { ok: true };
}

/** Active members opted in to announcement emails — the live recipient count. */
export async function announcementRecipientCount(): Promise<number> {
  await requireRole("exco", "super_admin");
  return withUserContext(async (tx) => {
    const [{ c }] = await tx
      .select({ c: sql<number>`count(*)::int` })
      .from(members)
      .innerJoin(users, eq(users.id, members.userId))
      .where(
        and(
          isNull(members.deletedAt),
          eq(users.status, "active"),
          eq(members.notifyAnnouncements, true),
        ),
      );
    return c;
  });
}

async function announcementCampaignsToday(): Promise<number> {
  const now = new Date();
  const startOfDay = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const [{ c }] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.action, "announcement.email"),
        gte(auditLog.createdAt, startOfDay),
      ),
    );
  return c;
}

export type PublishResult = {
  ok: boolean;
  emailed: number;
  batches: number;
  capExceeded?: boolean;
  error?: string;
};

/**
 * Publish an announcement and optionally email opted-in members via the bulk
 * helper. The send is blocked once the daily campaign cap is reached; the
 * announcement is still published so members see it on the page. Audits the
 * email send with {recipients, batches}.
 */
export async function publishAnnouncement(
  id: string,
  emailMembers: boolean,
): Promise<PublishResult> {
  const session = await requireRole("exco", "super_admin");
  const [a] = await db
    .select({
      id: announcements.id,
      title: announcements.title,
      body: announcements.body,
      status: announcements.status,
      publishedAt: announcements.publishedAt,
    })
    .from(announcements)
    .where(and(eq(announcements.id, id), isNull(announcements.deletedAt)))
    .limit(1);
  if (!a) return { ok: false, emailed: 0, batches: 0, error: "Announcement not found." };

  if (a.status !== "published") {
    await db
      .update(announcements)
      .set({
        status: "published",
        publishedAt: a.publishedAt ?? new Date(),
      })
      .where(eq(announcements.id, id));
  }
  await audit(session.user.id, "announcement.publish", "announcement", id);

  if (!emailMembers) return { ok: true, emailed: 0, batches: 0 };

  const cap = await getDailyBulkCap();
  const usedToday = await announcementCampaignsToday();
  if (usedToday >= cap) {
    return {
      ok: true,
      emailed: 0,
      batches: 0,
      capExceeded: true,
      error: `Daily email cap of ${cap} reached. The announcement is published, but no emails were sent. Try again tomorrow.`,
    };
  }

  const recipients = await withUserContext(async (tx) =>
    tx
      .select({ email: users.email })
      .from(members)
      .innerJoin(users, eq(users.id, members.userId))
      .where(
        and(
          isNull(members.deletedAt),
          eq(users.status, "active"),
          eq(members.notifyAnnouncements, true),
        ),
      ),
  );
  const emails = recipients.map((r) => r.email);
  if (emails.length === 0) {
    await audit(session.user.id, "announcement.email", "announcement", id, {
      recipients: 0,
      batches: 0,
    });
    return { ok: true, emailed: 0, batches: 0 };
  }

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const batches = Math.ceil(emails.length / 100);
  try {
    await send({
      bulk: true,
      to: emails,
      subject: a.title,
      react: AnnouncementEmail({
        title: a.title,
        excerpt: announcementExcerpt(a.body),
        url: `${base}/announcements/${id}`,
      }),
      category: "announcements",
    });
  } catch {
    // delivery failures are non-fatal; the announcement is already published
  }
  await audit(session.user.id, "announcement.email", "announcement", id, {
    recipients: emails.length,
    batches,
  });
  return { ok: true, emailed: emails.length, batches };
}

export async function deleteAnnouncement(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireRole("exco", "super_admin");
  const [a] = await db
    .select({ id: announcements.id })
    .from(announcements)
    .where(and(eq(announcements.id, id), isNull(announcements.deletedAt)))
    .limit(1);
  if (!a) return { ok: false, error: "Announcement not found." };
  await db
    .update(announcements)
    .set({ deletedAt: new Date() })
    .where(eq(announcements.id, id));
  await audit(session.user.id, "announcement.delete", "announcement", id);
  return { ok: true };
}

// ============================ fundraisers ==================================
// Money is integer KOBO throughout (see src/lib/money.ts). "raised" = total
// pledged that is not cancelled; "received" = pledges marked paid.

type PledgeTotals = { raised: number; received: number; count: number };

async function pledgeTotalsFor(
  ids: string[],
): Promise<Map<string, PledgeTotals>> {
  const map = new Map<string, PledgeTotals>();
  if (ids.length === 0) return map;
  const rows = await db
    .select({
      fundraiserId: fundraiserPledges.fundraiserId,
      raised: sql<number>`(coalesce(sum(${fundraiserPledges.amount}) filter (where ${fundraiserPledges.status} <> 'cancelled'), 0))::int`,
      received: sql<number>`(coalesce(sum(${fundraiserPledges.amount}) filter (where ${fundraiserPledges.status} = 'paid'), 0))::int`,
      count: sql<number>`(count(*) filter (where ${fundraiserPledges.status} <> 'cancelled'))::int`,
    })
    .from(fundraiserPledges)
    .where(inArray(fundraiserPledges.fundraiserId, ids))
    .groupBy(fundraiserPledges.fundraiserId);
  for (const r of rows) {
    map.set(r.fundraiserId, {
      raised: r.raised,
      received: r.received,
      count: r.count,
    });
  }
  return map;
}

const EMPTY_TOTALS: PledgeTotals = { raised: 0, received: 0, count: 0 };

export type FundraiserTab = "active" | "completed" | "archived";
const TAB_STATUS: Record<FundraiserTab, "active" | "closed" | "archived"> = {
  active: "active",
  completed: "closed",
  archived: "archived",
};

export type FundraiserCard = {
  id: string;
  title: string;
  slug: string;
  coverImage: string | null;
  status: string;
  goalAmount: number | null;
  raised: number;
  pledgerCount: number;
  endsAt: Date | null;
};

export async function listFundraisers(
  tab: FundraiserTab,
): Promise<FundraiserCard[]> {
  await requireSession();
  const rows = await db
    .select({
      id: fundraisers.id,
      title: fundraisers.title,
      slug: fundraisers.slug,
      coverImage: fundraisers.coverImage,
      status: fundraisers.status,
      goalAmount: fundraisers.goalAmount,
      endsAt: fundraisers.endsAt,
    })
    .from(fundraisers)
    .where(
      and(
        isNull(fundraisers.deletedAt),
        eq(fundraisers.status, TAB_STATUS[tab]),
      ),
    )
    .orderBy(desc(fundraisers.startsAt), desc(fundraisers.createdAt));
  const totals = await pledgeTotalsFor(rows.map((r) => r.id));
  return rows.map((r) => {
    const t = totals.get(r.id) ?? EMPTY_TOTALS;
    return { ...r, raised: t.raised, pledgerCount: t.count };
  });
}

export type FundraiserPledger = {
  name: string;
  amount: number | null; // null unless the viewer is exco+ (rule 8 spirit)
  status: string;
  anonymous: boolean;
  pledgedAt: Date;
};

export type FundraiserUpdate = {
  id: string;
  title: string | null;
  body: string;
  createdAt: Date;
};

export type FundraiserDetail = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverImage: string | null;
  status: string;
  goalAmount: number | null;
  raised: number;
  pledgerCount: number;
  endsAt: Date | null;
  canPledge: boolean;
  canSeeAmounts: boolean;
  pledgers: FundraiserPledger[];
  updates: FundraiserUpdate[];
};

export async function getFundraiser(
  id: string,
): Promise<FundraiserDetail | null> {
  const session = await requireSession();
  const canSeeAmounts =
    session.user.role === "exco" || session.user.role === "super_admin";

  const [f] = await db
    .select()
    .from(fundraisers)
    .where(
      and(
        eq(fundraisers.id, id),
        isNull(fundraisers.deletedAt),
        ne(fundraisers.status, "draft"),
      ),
    )
    .limit(1);
  if (!f) return null;

  const totals = (await pledgeTotalsFor([f.id])).get(f.id) ?? EMPTY_TOTALS;

  const pledgers = await withUserContext(async (tx) => {
    const rows = await tx
      .select({
        amount: fundraiserPledges.amount,
        status: fundraiserPledges.status,
        anonymous: fundraiserPledges.anonymous,
        pledgedAt: fundraiserPledges.pledgedAt,
        externalName: fundraiserPledges.externalName,
        firstName: members.firstName,
        lastName: members.lastName,
        preferredName: members.preferredName,
        deletedAt: members.deletedAt,
      })
      .from(fundraiserPledges)
      .leftJoin(members, eq(members.id, fundraiserPledges.memberId))
      .where(
        and(
          eq(fundraiserPledges.fundraiserId, f.id),
          ne(fundraiserPledges.status, "cancelled"),
        ),
      )
      .orderBy(desc(fundraiserPledges.pledgedAt));
    return rows.map((r): FundraiserPledger => {
      const memberName = r.firstName
        ? displayName(r)
        : (r.externalName ?? "Someone");
      return {
        name: r.anonymous ? "Anonymous" : memberName,
        amount: canSeeAmounts ? r.amount : null,
        status: r.status,
        anonymous: r.anonymous,
        pledgedAt: r.pledgedAt,
      };
    });
  });

  const updates = await db
    .select({
      id: fundraiserUpdates.id,
      title: fundraiserUpdates.title,
      body: fundraiserUpdates.body,
      createdAt: fundraiserUpdates.createdAt,
    })
    .from(fundraiserUpdates)
    .where(eq(fundraiserUpdates.fundraiserId, f.id))
    .orderBy(desc(fundraiserUpdates.createdAt));

  return {
    id: f.id,
    title: f.title,
    slug: f.slug,
    description: f.description,
    coverImage: f.coverImage,
    status: f.status,
    goalAmount: f.goalAmount,
    raised: totals.raised,
    pledgerCount: totals.count,
    endsAt: f.endsAt,
    canPledge: f.status === "active",
    canSeeAmounts,
    pledgers,
    updates,
  };
}

export async function pledge(input: {
  fundraiserId: string;
  amountKobo: number;
  channel: string | null;
  note: string | null;
  anonymous: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const session = await requireSession();
  if (!Number.isInteger(input.amountKobo) || input.amountKobo <= 0) {
    return { ok: false, error: "Enter a valid amount." };
  }
  const result = await withUserContext(async (tx) => {
    const meId = await myMemberId(tx, session.user.id);
    if (!meId) return { ok: false as const, error: "Complete your profile first." };
    const [f] = await tx
      .select({
        id: fundraisers.id,
        title: fundraisers.title,
        status: fundraisers.status,
        deletedAt: fundraisers.deletedAt,
      })
      .from(fundraisers)
      .where(eq(fundraisers.id, input.fundraiserId))
      .limit(1);
    if (!f || f.deletedAt || f.status !== "active") {
      return { ok: false as const, error: "This campaign is not active." };
    }
    await tx.insert(fundraiserPledges).values({
      fundraiserId: f.id,
      memberId: meId,
      amount: input.amountKobo,
      channel: input.channel,
      message: input.note,
      anonymous: input.anonymous,
      status: "pledged",
      loggedBy: session.user.id,
    });
    return { ok: true as const, title: f.title };
  });
  if (!result.ok) return result;

  if (session.user.email) {
    try {
      await send({
        to: session.user.email,
        subject: "Your pledge is logged",
        react: PledgeReceipt({
          name: session.user.name ?? "there",
          amount: formatNaira(input.amountKobo),
          campaign: result.title,
        }),
      });
    } catch {
      // receipt is best-effort; the pledge is recorded regardless
    }
  }
  return { ok: true };
}

export type MyPledge = {
  campaignId: string;
  campaign: string;
  slug: string;
  amount: number;
  status: string;
  channel: string | null;
  anonymous: boolean;
  pledgedAt: Date;
};

export async function listMyPledges(): Promise<MyPledge[]> {
  const session = await requireSession();
  return withUserContext(async (tx) => {
    const meId = await myMemberId(tx, session.user.id);
    if (!meId) return [];
    return tx
      .select({
        campaignId: fundraisers.id,
        campaign: fundraisers.title,
        slug: fundraisers.slug,
        amount: fundraiserPledges.amount,
        status: fundraiserPledges.status,
        channel: fundraiserPledges.channel,
        anonymous: fundraiserPledges.anonymous,
        pledgedAt: fundraiserPledges.pledgedAt,
      })
      .from(fundraiserPledges)
      .innerJoin(fundraisers, eq(fundraisers.id, fundraiserPledges.fundraiserId))
      .where(eq(fundraiserPledges.memberId, meId))
      .orderBy(desc(fundraiserPledges.pledgedAt));
  });
}

// --- public (no session) ---------------------------------------------------

export type PublicFundraiser = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverImage: string | null;
  goalAmount: number | null;
  raised: number;
  pledgerCount: number;
  endsAt: Date | null;
};

/** Active campaign by slug for the public page. No PII, no pledger list. */
export async function getPublicFundraiser(
  slug: string,
): Promise<PublicFundraiser | null> {
  const [f] = await db
    .select({
      id: fundraisers.id,
      title: fundraisers.title,
      slug: fundraisers.slug,
      description: fundraisers.description,
      coverImage: fundraisers.coverImage,
      goalAmount: fundraisers.goalAmount,
      endsAt: fundraisers.endsAt,
    })
    .from(fundraisers)
    .where(
      and(
        eq(fundraisers.slug, slug),
        eq(fundraisers.status, "active"),
        isNull(fundraisers.deletedAt),
      ),
    )
    .limit(1);
  if (!f) return null;
  const totals = (await pledgeTotalsFor([f.id])).get(f.id) ?? EMPTY_TOTALS;
  return { ...f, raised: totals.raised, pledgerCount: totals.count };
}

/**
 * Record an external pledge from the public page. No session. Turnstile and the
 * rate limit are enforced by the caller (the public action) before this runs.
 * fundraiser_pledges has no RLS, so a plain insert is correct.
 */
export async function recordExternalPledge(
  slug: string,
  data: { name: string; email: string; amountKobo: number; channel: string | null },
): Promise<{ ok: boolean; error?: string }> {
  const [f] = await db
    .select({
      id: fundraisers.id,
      title: fundraisers.title,
      status: fundraisers.status,
      deletedAt: fundraisers.deletedAt,
    })
    .from(fundraisers)
    .where(eq(fundraisers.slug, slug))
    .limit(1);
  if (!f || f.deletedAt || f.status !== "active") {
    return { ok: false, error: "This campaign is not accepting pledges." };
  }
  await db.insert(fundraiserPledges).values({
    fundraiserId: f.id,
    memberId: null,
    externalName: data.name,
    externalEmail: data.email,
    amount: data.amountKobo,
    channel: data.channel,
    status: "pledged",
    anonymous: false,
  });
  await audit(null, "pledge.external", "fundraiser", f.id, {
    amount: data.amountKobo,
    via: "public_page",
  });
  try {
    await send({
      to: data.email,
      subject: "Your pledge is logged",
      react: PledgeReceipt({
        name: data.name,
        amount: formatNaira(data.amountKobo),
        campaign: f.title,
      }),
    });
  } catch {
    // best-effort receipt
  }
  return { ok: true };
}

// --- admin: fundraisers ----------------------------------------------------

export type AdminFundraiserRow = {
  id: string;
  title: string;
  slug: string;
  status: string;
  goalAmount: number | null;
  raised: number;
  received: number;
  pledgerCount: number;
  endsAt: Date | null;
};

export async function listAdminFundraisers(): Promise<AdminFundraiserRow[]> {
  await requireRole("exco", "super_admin");
  const rows = await db
    .select({
      id: fundraisers.id,
      title: fundraisers.title,
      slug: fundraisers.slug,
      status: fundraisers.status,
      goalAmount: fundraisers.goalAmount,
      endsAt: fundraisers.endsAt,
    })
    .from(fundraisers)
    .where(isNull(fundraisers.deletedAt))
    .orderBy(desc(fundraisers.createdAt));
  const totals = await pledgeTotalsFor(rows.map((r) => r.id));
  return rows.map((r) => {
    const t = totals.get(r.id) ?? EMPTY_TOTALS;
    return {
      ...r,
      raised: t.raised,
      received: t.received,
      pledgerCount: t.count,
    };
  });
}

export async function getAdminFundraiser(id: string) {
  await requireRole("exco", "super_admin");
  const [f] = await db
    .select()
    .from(fundraisers)
    .where(and(eq(fundraisers.id, id), isNull(fundraisers.deletedAt)))
    .limit(1);
  return f ?? null;
}

async function uniqueFundraiserSlug(
  desired: string,
  excludeId?: string,
): Promise<string> {
  const base = slugify(desired);
  const rows = await db
    .select({ id: fundraisers.id })
    .from(fundraisers)
    .where(eq(fundraisers.slug, base));
  const clash = rows.some((r) => r.id !== excludeId);
  return clash ? `${base}-${Math.floor(Date.now() / 1000) % 100000}` : base;
}

export type FundraiserInput = {
  title: string;
  description: string | null;
  goalAmount: number | null; // kobo
  startsAt: Date | null;
  endsAt: Date | null;
  coverImage: string | null;
  slug: string;
  status: "draft" | "active" | "closed" | "archived";
};

export async function createFundraiser(
  input: FundraiserInput,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const session = await requireRole("exco", "super_admin");
  const slug = await uniqueFundraiserSlug(input.slug || input.title);
  const [row] = await db
    .insert(fundraisers)
    .values({
      title: input.title,
      slug,
      description: input.description,
      goalAmount: input.goalAmount,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      coverImage: input.coverImage,
      status: input.status,
      publishedAt: input.status === "active" ? new Date() : null,
      createdBy: session.user.id,
    })
    .returning({ id: fundraisers.id });
  await audit(session.user.id, "fundraiser.create", "fundraiser", row.id, {
    title: input.title,
    status: input.status,
  });
  return { ok: true, id: row.id };
}

export async function updateFundraiser(
  id: string,
  input: FundraiserInput,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireRole("exco", "super_admin");
  const [existing] = await db
    .select({ id: fundraisers.id, slug: fundraisers.slug, publishedAt: fundraisers.publishedAt })
    .from(fundraisers)
    .where(and(eq(fundraisers.id, id), isNull(fundraisers.deletedAt)))
    .limit(1);
  if (!existing) return { ok: false, error: "Fundraiser not found." };
  const slug =
    input.slug && input.slug !== existing.slug
      ? await uniqueFundraiserSlug(input.slug, id)
      : existing.slug;
  await db
    .update(fundraisers)
    .set({
      title: input.title,
      slug,
      description: input.description,
      goalAmount: input.goalAmount,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      coverImage: input.coverImage,
      status: input.status,
      publishedAt:
        input.status === "active" && !existing.publishedAt
          ? new Date()
          : existing.publishedAt,
    })
    .where(eq(fundraisers.id, id));
  await audit(session.user.id, "fundraiser.update", "fundraiser", id, {
    status: input.status,
  });
  return { ok: true };
}

export type AdminPledgeRow = {
  id: string;
  name: string;
  kind: "member" | "external";
  amount: number;
  channel: string | null;
  status: string;
  loggedBy: string | null;
  pledgedAt: Date;
  paidAt: Date | null;
};

export async function listFundraiserPledges(
  fundraiserId: string,
): Promise<AdminPledgeRow[]> {
  await requireRole("exco", "super_admin");
  return withUserContext(async (tx) => {
    const loggers = aliasedTable(users, "loggers");
    const rows = await tx
      .select({
        id: fundraiserPledges.id,
        amount: fundraiserPledges.amount,
        channel: fundraiserPledges.channel,
        status: fundraiserPledges.status,
        anonymous: fundraiserPledges.anonymous,
        pledgedAt: fundraiserPledges.pledgedAt,
        paidAt: fundraiserPledges.paidAt,
        externalName: fundraiserPledges.externalName,
        memberId: fundraiserPledges.memberId,
        firstName: members.firstName,
        lastName: members.lastName,
        preferredName: members.preferredName,
        deletedAt: members.deletedAt,
        loggedByName: loggers.name,
      })
      .from(fundraiserPledges)
      .leftJoin(members, eq(members.id, fundraiserPledges.memberId))
      .leftJoin(loggers, eq(loggers.id, fundraiserPledges.loggedBy))
      .where(eq(fundraiserPledges.fundraiserId, fundraiserId))
      .orderBy(desc(fundraiserPledges.pledgedAt));
    return rows.map((r): AdminPledgeRow => ({
      id: r.id,
      name: r.memberId
        ? displayName(r)
        : (r.externalName ?? "External pledger"),
      kind: r.memberId ? "member" : "external",
      amount: r.amount,
      channel: r.channel,
      status: r.status,
      loggedBy: r.loggedByName ?? null,
      pledgedAt: r.pledgedAt,
      paidAt: r.paidAt,
    }));
  });
}

export async function markPledgeReceived(
  pledgeId: string,
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireRole("exco", "super_admin");
  const [p] = await db
    .select({
      id: fundraiserPledges.id,
      fundraiserId: fundraiserPledges.fundraiserId,
      amount: fundraiserPledges.amount,
      status: fundraiserPledges.status,
    })
    .from(fundraiserPledges)
    .where(eq(fundraiserPledges.id, pledgeId))
    .limit(1);
  if (!p) return { ok: false, error: "Pledge not found." };
  if (p.status === "paid") return { ok: true };
  await db
    .update(fundraiserPledges)
    .set({ status: "paid", paidAt: new Date() })
    .where(eq(fundraiserPledges.id, pledgeId));
  await audit(session.user.id, "pledge.received", "fundraiser", p.fundraiserId, {
    pledgeId,
    amount: p.amount,
  });
  return { ok: true };
}

export async function postFundraiserUpdate(
  fundraiserId: string,
  input: { title: string | null; body: string },
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireRole("exco", "super_admin");
  if (!input.body.trim()) return { ok: false, error: "Write an update first." };
  const [f] = await db
    .select({ id: fundraisers.id })
    .from(fundraisers)
    .where(and(eq(fundraisers.id, fundraiserId), isNull(fundraisers.deletedAt)))
    .limit(1);
  if (!f) return { ok: false, error: "Fundraiser not found." };
  await db.insert(fundraiserUpdates).values({
    fundraiserId,
    title: input.title,
    body: input.body,
    postedBy: session.user.id,
  });
  await audit(session.user.id, "fundraiser.post_update", "fundraiser", fundraiserId);
  return { ok: true };
}

export type FundraiserStats = {
  pledgedTotal: number;
  receivedTotal: number;
  completionPercent: number;
  pledgerCount: number;
};

export async function fundraiserStats(
  fundraiserId: string,
): Promise<FundraiserStats> {
  await requireRole("exco", "super_admin");
  const [f] = await db
    .select({ goalAmount: fundraisers.goalAmount })
    .from(fundraisers)
    .where(eq(fundraisers.id, fundraiserId))
    .limit(1);
  const t = (await pledgeTotalsFor([fundraiserId])).get(fundraiserId) ?? EMPTY_TOTALS;
  const goal = f?.goalAmount ?? 0;
  return {
    pledgedTotal: t.raised,
    receivedTotal: t.received,
    completionPercent: goal > 0 ? Math.min(100, Math.round((t.received / goal) * 100)) : 0,
    pledgerCount: t.count,
  };
}

export async function exportFundraiserPledgesCsv(
  fundraiserId: string,
): Promise<{ csv: string; count: number }> {
  const session = await requireRole("exco", "super_admin");
  const rows = await listFundraiserPledges(fundraiserId);
  const header = ["name", "kind", "amount_ngn", "channel", "status", "logged_by", "pledged", "received"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.name,
        r.kind,
        (r.amount / 100).toFixed(2),
        r.channel ?? "",
        r.status,
        r.loggedBy ?? "",
        r.pledgedAt.toISOString().slice(0, 10),
        r.paidAt ? r.paidAt.toISOString().slice(0, 10) : "",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  await audit(session.user.id, "fundraiser.pledges_export", "fundraiser", fundraiserId, {
    count: rows.length,
  });
  return { csv: lines.join("\r\n"), count: rows.length };
}
