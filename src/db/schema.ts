import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/* ---------------------------------------------------------------------------
 * Conventions
 * - uuid primary keys via gen_random_uuid()
 * - timestamptz everywhere, JS Date mode
 * - soft delete via deleted_at where rows must survive references/audit
 * - phone is stored encrypted (see src/lib/crypto.ts); never a plaintext column
 * - all tokens are stored as sha256 hashes, never the raw token (rule 6)
 * ------------------------------------------------------------------------- */

const createdAt = () =>
  timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
const deletedAt = () =>
  timestamp("deleted_at", { withTimezone: true, mode: "date" });

/* ----------------------------------- enums ----------------------------------- */

export const userRole = pgEnum("user_role", ["member", "exco", "super_admin"]);
export const userStatus = pgEnum("user_status", [
  "active",
  "invited",
  "suspended",
  "deactivated",
]);
/** Per-field privacy for member profiles. */
export const visibility = pgEnum("visibility", [
  "public", // anyone, including logged-out (only ever used on opt-in public pages)
  "members", // signed-in members only
  "private", // self + exco/super_admin only
]);
export const rsvpStatus = pgEnum("rsvp_status", [
  "going",
  "maybe",
  "declined",
  "waitlist",
]);
export const fundraiserStatus = pgEnum("fundraiser_status", [
  "draft",
  "active",
  "closed",
  "archived",
]);
export const pledgeStatus = pgEnum("pledge_status", [
  "pledged",
  "paid",
  "cancelled",
]);
export const announcementStatus = pgEnum("announcement_status", [
  "draft",
  "published",
  "archived",
]);
export const inviteStatus = pgEnum("invite_status", [
  "pending",
  "accepted",
  "revoked",
  "expired",
]);

/* ----------------------------------- users ----------------------------------- */
/* Auth.js (v5) core user table, extended with platform role/status/lifecycle. */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name"),
    email: text("email").notNull().unique(),
    emailVerified: timestamp("email_verified", {
      withTimezone: true,
      mode: "date",
    }),
    image: text("image"),
    // Optional password login (scrypt hash; src/lib/password.ts). The platform's
    // primary auth is Auth.js magic links; this is an additive credential path
    // the owner asked for. Null = no password set (magic link only).
    passwordHash: text("password_hash"),
    role: userRole("role").notNull().default("member"),
    status: userStatus("status").notNull().default("active"),
    lastSignInAt: timestamp("last_sign_in_at", {
      withTimezone: true,
      mode: "date",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    index("users_role_idx").on(t.role),
    index("users_status_idx").on(t.status),
    index("users_deleted_at_idx").on(t.deletedAt),
  ],
);

/* ------------------------------- Auth.js tables ------------------------------ */

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index("accounts_user_id_idx").on(t.userId),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    sessionToken: text("session_token").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires", { withTimezone: true, mode: "date" }).notNull(),
    // Informational only (never used for auth): captured best-effort at sign-in
    // so /me can show "your devices". See the adapter createSession wrap in
    // src/auth.ts. created_at also powers the "signed in" timestamp there.
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true, mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

/* ---------------------------------- members ---------------------------------- */
/* The PII record. Read/written only through getMemberWithPrivacy() + the DAL,
 * and backstopped by RLS (see src/db/policies.sql). */

export const members = pgTable(
  "members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // identity (nullable so onboarding can save step-by-step; completeness is
    // enforced by onboarded_at + per-step Zod validation)
    firstName: text("first_name"),
    lastName: text("last_name"),
    preferredName: text("preferred_name"),
    avatarUrl: text("avatar_url"),
    bio: text("bio"),

    // contact (phone is AES-256-GCM encrypted: iv:tag:cipher)
    phoneEncrypted: text("phone_encrypted"),

    // PAU academic record. faculty (school) and programme (degree/course) are
    // validated against the constants in src/lib/pau.ts at the app layer.
    // programme is nullable: e.g. LBS executive-education alumni may have a
    // school but no formal degree programme.
    faculty: text("faculty"),
    programme: text("programme"),
    graduationYear: integer("graduation_year"),

    // professional + location
    company: text("company"),
    jobTitle: text("job_title"),
    industry: text("industry"),
    city: text("city"),
    country: text("country"),
    linkedinUrl: text("linkedin_url"),
    websiteUrl: text("website_url"),

    // birthday
    dateOfBirth: date("date_of_birth", { mode: "string" }),
    showAge: boolean("show_age").notNull().default(false),

    // privacy (per-field visibility)
    profileVisibility: visibility("profile_visibility").notNull().default("members"),
    emailVisibility: visibility("email_visibility").notNull().default("members"),
    phoneVisibility: visibility("phone_visibility").notNull().default("private"),

    // notification opt-ins
    notifyAnnouncements: boolean("notify_announcements").notNull().default(true),
    notifyEvents: boolean("notify_events").notNull().default(true),
    notifyFundraisers: boolean("notify_fundraisers").notNull().default(true),
    // Controls the "heads-up" email when a setmate has a birthday (not the
    // member's own birthday wish, which always sends).
    notifyBirthdays: boolean("notify_birthdays").notNull().default(true),

    onboardedAt: timestamp("onboarded_at", { withTimezone: true, mode: "date" }),
    // Set when the member accepts the privacy policy + terms in onboarding step 5.
    consentedAt: timestamp("consented_at", { withTimezone: true, mode: "date" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    uniqueIndex("members_user_id_key").on(t.userId),
    index("members_faculty_idx").on(t.faculty),
    index("members_programme_idx").on(t.programme),
    index("members_graduation_year_idx").on(t.graduationYear),
    index("members_last_name_idx").on(t.lastName),
    index("members_deleted_at_idx").on(t.deletedAt),
    check(
      "members_graduation_year_check",
      sql`${t.graduationYear} between 1990 and 2100`,
    ),
  ],
);

/* ---------------------------------- events ----------------------------------- */

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"), // markdown, rendered without rehype-raw (rule 10)
    coverImage: text("cover_image"),
    location: text("location"),
    // Virtual events carry a meeting_url that is only revealed to members who
    // RSVP'd going/maybe (see getEvent in the DAL).
    isVirtual: boolean("is_virtual").notNull().default(false),
    meetingUrl: text("meeting_url"),
    startsAt: timestamp("starts_at", { withTimezone: true, mode: "date" }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true, mode: "date" }),
    capacity: integer("capacity"),
    rsvpDeadline: timestamp("rsvp_deadline", {
      withTimezone: true,
      mode: "date",
    }),
    publishedAt: timestamp("published_at", { withTimezone: true, mode: "date" }),
    // Cancellation (METHOD:CANCEL ics, EventCancelled email). The row is kept.
    canceledAt: timestamp("canceled_at", { withTimezone: true, mode: "date" }),
    // ICS SEQUENCE: bumped on every edit so re-imported calendars update in
    // place (stable UID = event id) rather than duplicating.
    sequence: integer("sequence").notNull().default(0),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    index("events_starts_at_idx").on(t.startsAt),
    index("events_published_at_idx").on(t.publishedAt),
  ],
);

export const eventRsvps = pgTable(
  "event_rsvps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    status: rsvpStatus("status").notNull().default("going"),
    guests: integer("guests").notNull().default(0),
    note: text("note"),
    respondedAt: timestamp("responded_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("event_rsvps_event_member_key").on(t.eventId, t.memberId),
    index("event_rsvps_member_idx").on(t.memberId),
  ],
);

/* -------------------------------- fundraisers -------------------------------- */

export const fundraisers = pgTable(
  "fundraisers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"), // markdown
    coverImage: text("cover_image"),
    // Money is stored in KOBO (integer) to avoid float drift; render with
    // Intl.NumberFormat("en-NG", NGN) over value/100 (see src/lib/money.ts).
    goalAmount: integer("goal_amount"),
    currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
    status: fundraiserStatus("status").notNull().default("draft"),
    startsAt: timestamp("starts_at", { withTimezone: true, mode: "date" }),
    endsAt: timestamp("ends_at", { withTimezone: true, mode: "date" }),
    publishedAt: timestamp("published_at", { withTimezone: true, mode: "date" }),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    index("fundraisers_status_idx").on(t.status),
    index("fundraisers_published_at_idx").on(t.publishedAt),
  ],
);

export const fundraiserPledges = pgTable(
  "fundraiser_pledges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fundraiserId: uuid("fundraiser_id")
      .notNull()
      .references(() => fundraisers.id, { onDelete: "cascade" }),
    // Nullable: external pledges from the public page have no member; they carry
    // external_name / external_email instead.
    memberId: uuid("member_id").references(() => members.id, {
      onDelete: "cascade",
    }),
    externalName: text("external_name"),
    externalEmail: text("external_email"),
    amount: integer("amount").notNull(), // kobo
    currency: varchar("currency", { length: 3 }).notNull().default("NGN"),
    channel: text("channel"), // transfer | cash | card | other
    status: pledgeStatus("status").notNull().default("pledged"),
    anonymous: boolean("anonymous").notNull().default(false),
    message: text("message"),
    // Who recorded it (admin for logged pledges, self for own). Null = external.
    loggedBy: uuid("logged_by").references(() => users.id, {
      onDelete: "set null",
    }),
    pledgedAt: timestamp("pledged_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    // Set when the treasurer marks the pledge received (status -> paid).
    paidAt: timestamp("paid_at", { withTimezone: true, mode: "date" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("fundraiser_pledges_fundraiser_idx").on(t.fundraiserId),
    index("fundraiser_pledges_member_idx").on(t.memberId),
  ],
);

export const fundraiserUpdates = pgTable(
  "fundraiser_updates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fundraiserId: uuid("fundraiser_id")
      .notNull()
      .references(() => fundraisers.id, { onDelete: "cascade" }),
    title: text("title"),
    body: text("body").notNull(), // markdown
    postedBy: uuid("posted_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
  },
  (t) => [index("fundraiser_updates_fundraiser_idx").on(t.fundraiserId)],
);

/* ------------------------------- announcements ------------------------------- */

export const announcements = pgTable(
  "announcements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    slug: text("slug").notNull().unique(),
    body: text("body").notNull(), // markdown, rendered without rehype-raw (rule 10)
    status: announcementStatus("status").notNull().default("draft"),
    pinned: boolean("pinned").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true, mode: "date" }),
    authorId: uuid("author_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    index("announcements_status_idx").on(t.status),
    index("announcements_published_at_idx").on(t.publishedAt),
  ],
);

/* --------------------------------- audit_log --------------------------------- */
/* Append-only. Every admin mutation writes here (rule 4). Immutability is
 * enforced by RLS + REVOKE + a trigger in src/db/policies.sql. */

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    actorEmail: text("actor_email"), // denormalized so the trail survives user deletion
    action: text("action").notNull(), // e.g. "member.update", "invite.create"
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    summary: text("summary"),
    metadata: jsonb("metadata"), // before/after diff or extra context
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_log_actor_idx").on(t.actorId),
    index("audit_log_entity_idx").on(t.entityType, t.entityId),
    index("audit_log_created_at_idx").on(t.createdAt),
  ],
);

/* ---------------------------------- invites ---------------------------------- */

export const invites = pgTable(
  "invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    role: userRole("role").notNull().default("member"),
    // Prefill captured at invite time (Add member / CSV import). Used to populate
    // the admin roster before acceptance and to seed the member row on first
    // sign-in (see the createUser event in src/auth.ts).
    firstName: text("first_name"),
    lastName: text("last_name"),
    dateOfBirth: date("date_of_birth", { mode: "string" }),
    graduationYear: integer("graduation_year"),
    faculty: text("faculty"),
    tokenHash: text("token_hash").notNull(), // sha256 of the raw invite token (rule 6)
    status: inviteStatus("status").notNull().default("pending"),
    invitedBy: uuid("invited_by").references(() => users.id, {
      onDelete: "set null",
    }),
    acceptedUserId: uuid("accepted_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: "date" }),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("invites_token_hash_key").on(t.tokenHash),
    index("invites_email_idx").on(t.email),
    index("invites_status_idx").on(t.status),
  ],
);

/* ------------------------------- birthday_sent ------------------------------- */
/* One row per member per calendar year once their birthday email has gone out;
 * the unique constraint makes the send idempotent. */

export const birthdaySent = pgTable(
  "birthday_sent",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("birthday_sent_member_year_key").on(t.memberId, t.year)],
);

/* ----------------------------- rsvp_email_tokens ----------------------------- */
/* One-click RSVP links emailed to members. Raw token is hashed (rule 6). */

export const rsvpEmailTokens = pgTable(
  "rsvp_email_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(), // sha256 of the raw token (rule 6)
    status: rsvpStatus("status"), // the response this link records, if any
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true, mode: "date" }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("rsvp_email_tokens_token_hash_key").on(t.tokenHash),
    index("rsvp_email_tokens_event_member_idx").on(t.eventId, t.memberId),
  ],
);

/* -------------------------------- app_settings ------------------------------- */
/* Small key-value store for admin-tunable platform settings (e.g. the daily
 * bulk-email cap). Read through getSetting() in the DAL with a code default. */

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: updatedAt(),
});

/* ------------------------------ meeting minutes ------------------------------ */
/* Secretary tool: AI-assisted meeting minutes. The transcript is structured into
 * editable sections/action items, then exported (DOCX / print to PDF). */

export type MinutesSection = { heading: string; points: string[] };
export type MinutesAction = { task: string; owner: string; due: string };

export const meetingMinutes = pgTable(
  "meeting_minutes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    meetingDate: date("meeting_date", { mode: "string" }),
    location: text("location"),
    facilitator: text("facilitator"),
    minutesBy: text("minutes_by"),
    attendees: jsonb("attendees")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    sections: jsonb("sections")
      .$type<MinutesSection[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    actionItems: jsonb("action_items")
      .$type<MinutesAction[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    decisions: jsonb("decisions")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    rawTranscript: text("raw_transcript"),
    status: text("status").notNull().default("draft"), // draft | final
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("meeting_minutes_created_at_idx").on(t.createdAt)],
);

/* ------------------------------- exco members ------------------------------- */
/* The association's executive council + alumni office, shown on a public page so
 * every member can see who leads. Managed by admins. Not tied to user accounts. */

export const excoMembers = pgTable(
  "exco_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    role: text("role").notNull(),
    email: text("email"),
    photoUrl: text("photo_url"),
    bio: text("bio"),
    setLabel: text("set_label"), // e.g. "FT9, 2018"
    group: text("group").notNull().default("exco"), // exco | alumni_office
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("exco_members_group_idx").on(t.group, t.sortOrder)],
);

/* --------------------------------- relations --------------------------------- */

export const usersRelations = relations(users, ({ one, many }) => ({
  member: one(members, {
    fields: [users.id],
    references: [members.userId],
  }),
  accounts: many(accounts),
  sessions: many(sessions),
  auditEntries: many(auditLog),
  invitesSent: many(invites, { relationName: "invitedBy" }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const membersRelations = relations(members, ({ one, many }) => ({
  user: one(users, { fields: [members.userId], references: [users.id] }),
  rsvps: many(eventRsvps),
  pledges: many(fundraiserPledges),
  birthdaysSent: many(birthdaySent),
  rsvpTokens: many(rsvpEmailTokens),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [events.createdBy],
    references: [users.id],
  }),
  rsvps: many(eventRsvps),
  rsvpTokens: many(rsvpEmailTokens),
}));

export const eventRsvpsRelations = relations(eventRsvps, ({ one }) => ({
  event: one(events, { fields: [eventRsvps.eventId], references: [events.id] }),
  member: one(members, {
    fields: [eventRsvps.memberId],
    references: [members.id],
  }),
}));

export const fundraisersRelations = relations(fundraisers, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [fundraisers.createdBy],
    references: [users.id],
  }),
  pledges: many(fundraiserPledges),
  updates: many(fundraiserUpdates),
}));

export const fundraiserPledgesRelations = relations(
  fundraiserPledges,
  ({ one }) => ({
    fundraiser: one(fundraisers, {
      fields: [fundraiserPledges.fundraiserId],
      references: [fundraisers.id],
    }),
    member: one(members, {
      fields: [fundraiserPledges.memberId],
      references: [members.id],
    }),
  }),
);

export const fundraiserUpdatesRelations = relations(
  fundraiserUpdates,
  ({ one }) => ({
    fundraiser: one(fundraisers, {
      fields: [fundraiserUpdates.fundraiserId],
      references: [fundraisers.id],
    }),
    postedByUser: one(users, {
      fields: [fundraiserUpdates.postedBy],
      references: [users.id],
    }),
  }),
);

export const announcementsRelations = relations(announcements, ({ one }) => ({
  author: one(users, {
    fields: [announcements.authorId],
    references: [users.id],
  }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  actor: one(users, { fields: [auditLog.actorId], references: [users.id] }),
}));

export const invitesRelations = relations(invites, ({ one }) => ({
  invitedByUser: one(users, {
    fields: [invites.invitedBy],
    references: [users.id],
    relationName: "invitedBy",
  }),
  acceptedUser: one(users, {
    fields: [invites.acceptedUserId],
    references: [users.id],
  }),
}));

export const birthdaySentRelations = relations(birthdaySent, ({ one }) => ({
  member: one(members, {
    fields: [birthdaySent.memberId],
    references: [members.id],
  }),
}));

export const rsvpEmailTokensRelations = relations(rsvpEmailTokens, ({ one }) => ({
  event: one(events, {
    fields: [rsvpEmailTokens.eventId],
    references: [events.id],
  }),
  member: one(members, {
    fields: [rsvpEmailTokens.memberId],
    references: [members.id],
  }),
}));

/* ------------------------------- inferred types ------------------------------ */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Member = typeof members.$inferSelect;
export type NewMember = typeof members.$inferInsert;
export type Event = typeof events.$inferSelect;
export type AuditLogEntry = typeof auditLog.$inferSelect;
export type Invite = typeof invites.$inferSelect;
export type MeetingMinutes = typeof meetingMinutes.$inferSelect;
export type ExcoMember = typeof excoMembers.$inferSelect;
