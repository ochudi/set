# Set

Set is a members-only platform for the Pan-Atlantic University Alumni
Association (PAUAA). It holds member personal data (PII), so security and data
decisions are binding and live in CLAUDE.md. When anything here conflicts with
CLAUDE.md, CLAUDE.md wins.

This README gets you running locally. For operations, deployment, and incident
handling see:

- [OPERATIONS.md](./OPERATIONS.md) runbooks for day to day admin work
- [DEPLOY.md](./DEPLOY.md) ordered runbook to ship to production
- [INCIDENT.md](./INCIDENT.md) data breach response under the NDPA

## What it does

A private directory and community hub for one alumni set. Members sign in,
complete a profile, browse the directory, see events and RSVP, read
announcements, mark birthdays, and pledge to fundraisers. Exco members and a
super admin manage members, invites, events, announcements, fundraisers, and an
audit log. The platform is invite only and never sends mail to real members
outside production.

## Stack

- Next.js 15 App Router, TypeScript strict
- Tailwind CSS v4 (CSS first tokens via @theme, no tailwind.config token file) and shadcn/ui
- Postgres on Supabase, Drizzle ORM via postgres-js on the Supavisor transaction pooler (prepare: false)
- DIRECT_URL session connection for migrations only; all data access runs in the Node runtime
- Auth.js v5 with the Drizzle adapter, Resend magic links, DATABASE session strategy
- Resend and React Email for mail, through one chokepoint (src/lib/email.ts)
- Upstash Redis for rate limiting (fails open if unset)
- Supabase Storage for avatars and event covers
- Cloudflare Turnstile on public forms
- Zod for validation, @tanstack/react-table for admin tables, Framer Motion (restrained), Sentry

## Security model (summary)

- Routes are protected by the DAL (src/lib/dal.ts), not middleware. Middleware only redirects when the session cookie is absent.
- Only src/db and src/lib/dal.ts may import src/db. Only src/lib/email.ts may import resend. Enforced by eslint no-restricted-imports.
- Row level security on members and audit_log via the GUCs app.user_id and app.role (src/db/policies.sql), applied separately from migrations.
- Tokens (invite, rsvp, unsubscribe) are stored as sha256 hashes.
- Phone numbers are AES-256-GCM encrypted before insert (src/lib/crypto.ts, PHONE_ENC_KEY).
- Member PII renders only through getMemberWithPrivacy().
- All email goes through src/lib/email.ts, which obeys EMAIL_MODE.

## Quick start (local)

Local dev runs against a local Postgres, not Supabase. Supabase is used only for
Storage uploads. Email and rate limiting both fall back gracefully when their
keys are empty.

1. Clone the repository and install dependencies.

   ```bash
   npm install
   ```

2. Create a local Postgres 18 database named `set` and make sure you can connect
   to it. The committed local config connects as your OS user with no password,
   for example `postgresql://<you>@localhost:5432/set`.

3. Copy the env template and fill it in.

   ```bash
   cp .env.example .env.local
   ```

   For a local run you need at minimum DATABASE_URL, DIRECT_URL, AUTH_SECRET,
   PHONE_ENC_KEY, SUPER_ADMIN_EMAIL, and NEXT_PUBLIC_APP_URL. Leave
   AUTH_RESEND_KEY empty so magic links print to the console, and keep
   EMAIL_MODE=sandbox. See the env table below.

4. Apply migrations.

   ```bash
   npm run db:migrate
   ```

   Migrations live in `drizzle/`. The row level security policies in
   `src/db/policies.sql` are applied separately (see OPERATIONS.md and
   DEPLOY.md); they are not required for a basic local run but match production.

5. Seed the super admin. This bootstraps the SUPER_ADMIN_EMAIL address to the
   super_admin role with a user and member row. It is idempotent.

   ```bash
   npm run db:seed
   ```

6. Start the dev server.

   ```bash
   npm run dev
   ```

7. Sign in. Go to http://localhost:3000, request a magic link for your
   SUPER_ADMIN_EMAIL, and open the link that is printed to the dev server
   console (no real mail is sent locally). You can also set a password with
   `npm run set-password -- <email> <password>` and sign in with it.

Optional demo data for clicking around locally: `npm run seed-dashboard` and
`npm run seed-audit`, plus `tsx scripts/seed-bus.ts` for the public bus
fundraiser. Do not run any demo seed against production.

## Environment variables

Document only the names here; never commit real values. Variables without the
NEXT_PUBLIC_ prefix are server only.

| Variable | What it is | Where used | Local vs production |
| --- | --- | --- | --- |
| DATABASE_URL | Runtime database connection | src/db (app data via Drizzle) | Local Postgres locally. In production the Supavisor transaction pooler (:6543) connecting as the restricted app_user role, never the owner |
| DIRECT_URL | Session connection, migrations only | drizzle-kit migrate/push | Local Postgres locally. In production the Supabase session connection (:5432) as the owner; kept out of Vercel and used only when running migrations |
| SUPABASE_URL | Supabase project URL | src/lib/storage.ts (Storage only) | Same shared project in both; Storage only |
| SUPABASE_SERVICE_ROLE_KEY | Service role key for signed Storage uploads | src/lib/storage.ts (Storage only) | Present ONLY for Storage. Never used for app data, never sent to the browser |
| AUTH_SECRET | Signs cookies and encrypts tokens | Auth.js v5 | Required in both. Generate with `npx auth secret` or `openssl rand -base64 33` |
| AUTH_RESEND_KEY | Resend API key for magic links and all mail | Auth.js Resend provider and src/lib/email.ts | Empty locally so magic links and emails print to the console. Real key in production |
| RESEND_FROM_EMAIL | Sender address | src/lib/email.ts | Must be a Resend verified domain address. You cannot send from a gmail.com address. In production use a verified domain with the PAUAA display name and set reply-to to the secretary gmail in Settings > Email |
| EMAIL_MODE | Delivery mode | src/lib/email.ts | sandbox everywhere except production (reroutes all mail to SANDBOX_INBOX). live ONLY in production |
| SANDBOX_INBOX | Catch all inbox when not live | src/lib/email.ts | Required whenever EMAIL_MODE is not live |
| SUPER_ADMIN_EMAIL | Address bootstrapped to super_admin | src/db/seed.ts | Set in both. Bootstrapped by db:seed |
| PHONE_ENC_KEY | AES-256-GCM key for phone numbers | src/lib/crypto.ts | Required in both. Must decode (base64) to exactly 32 bytes. Generate with `openssl rand -base64 32` |
| UPSTASH_REDIS_REST_URL | Upstash Redis REST URL | src/lib/redis.ts, src/lib/ratelimit.ts | Optional. Rate limiting fails open if unset |
| UPSTASH_REDIS_REST_TOKEN | Upstash Redis REST token | src/lib/redis.ts, src/lib/ratelimit.ts | Optional. Rate limiting fails open if unset |
| TURNSTILE_SITE_KEY | Cloudflare Turnstile site key (public by design) | public forms / src/lib/turnstile.ts | Set in production for live bot protection |
| TURNSTILE_SECRET_KEY | Turnstile secret, server side verification | src/lib/turnstile.ts | Set in production |
| SENTRY_DSN | Sentry DSN for server error reporting | Sentry | Set in production |
| CRON_SECRET | Bearer token guarding the cron routes | src/lib/cron-auth.ts | Required in production. Generate with `openssl rand -hex 32` |
| NEXT_PUBLIC_APP_URL | Public base URL of the deployment | absolute links in emails and redirects | http://localhost:3000 locally; the real domain in production |

## Commands

From package.json:

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server (Turbopack) |
| `npm run build` | Production build (Turbopack) |
| `npm run start` | Start the built app |
| `npm run lint` | Run eslint |
| `npm run db:generate` | Generate a Drizzle migration from schema changes |
| `npm run db:migrate` | Apply migrations (uses DIRECT_URL) |
| `npm run db:push` | Push schema directly without a migration file |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run db:seed` | Bootstrap the super admin (SUPER_ADMIN_EMAIL), idempotent |
| `npm run set-password -- <email> <password>` | Set or reset a user password |
| `npm run seed-dashboard` | Seed demo dashboard data (local only) |
| `npm run seed-audit` | Seed demo audit log entries (local only) |
| `npm run test` | Run the Vitest suite |

The public bus fundraiser used in the smoke test is seeded with
`tsx scripts/seed-bus.ts` (no dedicated npm script). It creates a fundraiser
with slug `bus`, reachable at `/p/bus`.

## Crons

Defined in vercel.json and registered by Vercel:

- Birthdays daily at 06:00 UTC (`0 6 * * *`) calls GET /api/cron/birthdays
- Purge weekly on Monday at 07:00 UTC (`0 7 * * 1`) calls GET /api/cron/purge

Both require `Authorization: Bearer ${CRON_SECRET}`. They are GET handlers
because Vercel Cron is GET only. This is a deliberate, documented deviation from
the rule that no GET mutates state, and it stays safe because nothing runs
unless the constant time bearer check passes (src/lib/cron-auth.ts). See
OPERATIONS.md to run them by hand.
# set
