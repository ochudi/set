import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { and, eq, gt, sql } from "drizzle-orm";
import { headers } from "next/headers";
import NextAuth from "next-auth";
import type { Adapter } from "next-auth/adapters";
import Resend from "next-auth/providers/resend";

import { authConfig } from "@/auth.config";
import { db } from "@/db";
import {
  accounts,
  auditLog,
  invites,
  members,
  sessions,
  users,
  verificationTokens,
} from "@/db/schema";
import MagicLinkEmail from "@/emails/magic-link";
import { send } from "@/lib/email";

/**
 * auth.ts is the one application module besides src/db and src/lib/dal.ts that
 * is allowed to import src/db (the Drizzle adapter and auth callbacks require
 * the client and tables). This exception is encoded in the eslint fence.
 */

// Mirror of dal.emailIsAllowed — duplicated here to avoid an auth.ts <-> dal.ts
// import cycle (dal imports auth() for the session).
async function emailAllowed(rawEmail: string): Promise<boolean> {
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

const drizzleAdapter = DrizzleAdapter(db, {
  usersTable: users,
  accountsTable: accounts,
  sessionsTable: sessions,
  verificationTokensTable: verificationTokens,
});

// Wrap createSession to record the user agent for the /me "your devices" view.
// The base adapter still owns the insert (so the AdapterSession shape stays
// correct); we only patch user_agent afterwards, best-effort. Sign-in must never
// fail because UA capture failed, hence the swallowed error.
const adapter: Adapter = {
  ...drizzleAdapter,
  async createSession(session) {
    const created = await drizzleAdapter.createSession!(session);
    try {
      const ua = (await headers()).get("user-agent");
      if (ua) {
        await db
          .update(sessions)
          .set({ userAgent: ua })
          .where(eq(sessions.sessionToken, session.sessionToken));
      }
    } catch {
      // best-effort only
    }
    return created;
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter,
  session: {
    strategy: "database",
    maxAge: 60 * 60 * 24 * 7, // 7-day idle window
    updateAge: 60 * 60 * 24,
  },
  providers: [
    Resend({
      // Sending is overridden below to go through lib/email.ts (rule 9), so the
      // provider's own key/from are only placeholders.
      apiKey: process.env.AUTH_RESEND_KEY ?? "re_placeholder",
      from: process.env.RESEND_FROM_EMAIL ?? "Set <onboarding@resend.dev>",
      maxAge: 60 * 10, // magic link valid for 10 minutes
      async sendVerificationRequest({ identifier, url }) {
        // Dev fallback: with no Resend key configured, there is no way to
        // deliver mail, so print the sign-in link to the server console instead
        // of throwing. Never triggers in production, which always has a key.
        if (!process.env.AUTH_RESEND_KEY) {
          console.log(
            `\n  ✉  Magic sign-in link for ${identifier}:\n  ${url}\n`,
          );
          return;
        }
        await send({
          to: identifier,
          subject: "Your sign-in link for Set",
          react: MagicLinkEmail({ url }),
        });
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // Runs at link-request time and at link-use time. Only existing (non-
    // suspended) users or holders of an unexpired invite may sign in.
    async signIn({ user }) {
      const address = (user?.email ?? "").toLowerCase();
      if (!address) return false;
      return emailAllowed(address);
    },
  },
  events: {
    async createUser({ user }) {
      if (!user.id) return;
      const userId = user.id;
      const address = (user.email ?? "").toLowerCase();

      // Apply an invited role and consume the invite, if any.
      const [invite] = await db
        .select()
        .from(invites)
        .where(
          and(
            eq(invites.email, address),
            eq(invites.status, "pending"),
            gt(invites.expiresAt, new Date()),
          ),
        )
        .limit(1);
      if (invite) {
        const seededName =
          user.name ??
          ([invite.firstName, invite.lastName].filter(Boolean).join(" ") ||
            null);
        await db
          .update(users)
          .set({ role: invite.role, status: "active", name: seededName })
          .where(eq(users.id, userId));
        await db
          .update(invites)
          .set({
            status: "accepted",
            acceptedAt: new Date(),
            acceptedUserId: userId,
          })
          .where(eq(invites.id, invite.id));

        // Seed the member row from the invite prefill, RLS-scoped to the new
        // user so the members_access WITH CHECK passes (app.user_id = new id).
        await db.transaction(async (tx) => {
          await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`);
          await tx.execute(sql`select set_config('app.role', ${invite.role}, true)`);
          await tx
            .insert(members)
            .values({
              userId,
              firstName: invite.firstName,
              lastName: invite.lastName,
              dateOfBirth: invite.dateOfBirth,
              graduationYear: invite.graduationYear,
              faculty: invite.faculty,
            })
            .onConflictDoNothing({ target: members.userId });
        });
      }

      // Audit (rule 4). auth.ts is allow-listed to write audit_log directly;
      // the insert policy permits app_user inserts with no RLS context.
      await db.insert(auditLog).values({
        actorId: user.id,
        actorEmail: address,
        action: "user.create",
        entityType: "user",
        entityId: user.id,
        summary: invite ? "User created from invite" : "User created",
      });
    },
    async signIn({ user }) {
      if (user?.id) {
        await db
          .update(users)
          .set({ lastSignInAt: new Date() })
          .where(eq(users.id, user.id));
      }
    },
  },
});
