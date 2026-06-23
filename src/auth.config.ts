import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js config: pages + the session callback shape only. No adapter,
 * no Node-only providers or DB access here, so it can be imported anywhere.
 * auth.ts spreads this and adds the Drizzle adapter, the Resend provider, and
 * the Node-only callbacks/events.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
    verifyRequest: "/login/verify",
    error: "/login",
  },
  providers: [],
  callbacks: {
    // Database session strategy: map the adapter user row onto session.user.
    session({ session, user }) {
      session.user.id = user.id;
      session.user.role = user.role;
      session.user.status = user.status;
      return session;
    },
  },
} satisfies NextAuthConfig;
