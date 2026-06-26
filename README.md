# Set

**The members-only home of the Pan-Atlantic University Alumni Association (PAUAA).**

Set is a private community platform for one alumni set: a directory, events with
RSVP, announcements, birthdays, fundraisers, and secretary tooling, wrapped in an
audited admin back office. It holds member personal data (PII), so its security
and data-handling decisions are binding and documented in
[CLAUDE.md](./CLAUDE.md). **When anything in this README conflicts with CLAUDE.md,
CLAUDE.md wins.**

| | |
| --- | --- |
| **Stack** | Next.js 15 (App Router) · TypeScript (strict) · Tailwind v4 · Drizzle/Postgres · Auth.js v5 |
| **Runtime** | Node.js 20+ · all data access server-side |
| **Quality gates** | `typecheck` · `lint` · `test` (92 unit) · `test:e2e` · `knip` (dead-code) — all green |
| **Companion docs** | [DEPLOY.md](./DEPLOY.md) · [OPERATIONS.md](./OPERATIONS.md) · [INCIDENT.md](./INCIDENT.md) · [CLAUDE.md](./CLAUDE.md) |

---

## Table of contents

- [What it does](#what-it-does)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Security model](#security-model)
- [Data model](#data-model)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Scripts](#scripts)
- [Testing and quality gates](#testing-and-quality-gates)
- [Database and migrations](#database-and-migrations)
- [Background jobs (crons)](#background-jobs-crons)
- [Email](#email)
- [Design system](#design-system)
- [Deployment](#deployment)
- [Documentation](#documentation)

---

## What it does

The platform is **invite-only**. An exco member invites an alumnus by email; the
invite stays pending until first sign-in, then becomes a full member record.
Members sign in with a magic link (or password), complete a profile, and from
there can:

- browse the alumni **directory** and keep their own details current,
- see **events**, RSVP in one tap, and add them to a calendar (ICS),
- read **announcements** and manage per-category email preferences,
- see whose **birthday** is coming up,
- **pledge** to fundraisers and track progress.

**Exco** members and a **super admin** run the back office: members and invites,
events, announcements, fundraisers, meeting minutes, the leadership directory,
organisation settings, and a full **audit log** of every mutation. Outside
production the platform never sends mail to real members.

There are three roles: `member`, `exco`, and `super_admin`.

---

## Features

| Area | Member-facing | Admin (exco / super admin) |
| --- | --- | --- |
| **Members & directory** | Browse directory, view profiles, edit own profile, privacy controls | Roster (members + pending invites), invite by email, CSV import with row-level validation, role/status changes |
| **Events** | Event list and detail, one-tap RSVP, calendar download (ICS) | Create/edit/cancel events, cover images, view and export the RSVP list |
| **Announcements** | Read announcements, per-category email opt-out | Compose (Markdown), publish, bulk send with a daily cap |
| **Birthdays** | Upcoming birthdays widget and page | Heads-up controls; idempotent daily birthday cron |
| **Fundraisers** | Pledge (internal), see progress; public campaign pages at `/p/[slug]` | Create/edit campaigns, internal + external pledges, mark received, stats |
| **Secretary — minutes** | — | AI meeting-minutes tool: paste a transcript + notes, generate a structured draft, edit, export to **Word (.docx)** or **PDF** (print view) |
| **Leadership** | Public `/exco` directory of the executive council and alumni office | Add/edit/remove leadership entries |
| **Account** | Magic-link / password sign-in, self-service data export, account deletion with grace period | — |
| **Audit & settings** | — | Cursor-paginated audit viewer; org/email settings; full data export (ZIP); super-admin transfer |

Cross-cutting: every async surface has a skeleton (`loading.tsx`) and an error
boundary (`error.tsx`) reporting to Sentry; public forms are protected by
Cloudflare Turnstile; sensitive endpoints are rate-limited via Upstash.

---

## Tech stack

- **Next.js 15** App Router, **React 19**, **TypeScript** strict, Turbopack.
- **Tailwind CSS v4** — CSS-first tokens via `@theme` in
  [src/app/globals.css](./src/app/globals.css); there is no `tailwind.config`
  token file. UI primitives from **shadcn/ui** (Radix under the hood).
- **Postgres on Supabase** via **Drizzle ORM** on `postgres-js`, against the
  Supavisor **transaction pooler** (`prepare: false`). A separate session
  connection (`DIRECT_URL`) is used **only** for migrations. All data access
  runs in the Node runtime.
- **Auth.js v5** with the Drizzle adapter, **Resend** magic links, and a
  **database** session strategy.
- **Resend + React Email** for all mail, through a single chokepoint
  ([src/lib/email.ts](./src/lib/email.ts)).
- **Upstash Redis** rate limiting (fails open if unconfigured).
- **Supabase Storage** for avatars and event covers.
- **Cloudflare Turnstile** on public forms.
- **Zod** for validation, **@tanstack/react-table** for admin tables,
  **Framer Motion** (restrained), **Sentry** for monitoring (with PII scrubbing).
- **Anthropic** API for the minutes generator, with a deterministic offline
  fallback.

---

## Architecture

### Request lifecycle

1. **Middleware** ([src/middleware.ts](./src/middleware.ts)) does one thing: if the session cookie is
   absent on a protected path, redirect to `/login`. It performs **no**
   authorization — it cannot read the database in the edge runtime.
2. **The DAL** ([src/lib/dal.ts](./src/lib/dal.ts)) is the real security
   boundary. Every server action and every protected read begins with a guard:
   `requireSession()`, `requireRole(...)`, or `requireSuperAdmin()`. These run in
   the Node runtime and redirect/throw on failure.
3. **Server actions / route handlers** validate input with **Zod**, perform the
   work through the DAL, and — for every admin mutation — call `audit()`.
4. **Row-level security** scopes the restricted `app_user` Postgres role.
   DAL reads run inside a transaction that sets two GUCs (`app.user_id`,
   `app.role`) which the RLS policies in
   [src/db/policies.sql](./src/db/policies.sql) read.

### Import fences (enforced by ESLint `no-restricted-imports`)

- Nothing imports `src/db` except `src/db` itself, `src/lib/dal.ts`, and
  `src/auth.ts`.
- Nothing imports `resend` except `src/lib/email.ts`.

These are not conventions — they fail the lint build.

### Route groups

- `src/app/(marketing)/` — public landing, privacy, terms (indexable; the rest of
  the site is `noindex`).
- `src/app/(app)/` — the authenticated app (dashboard, directory, events, etc.)
  and `(app)/admin/` for the back office. Shares the app chrome (navbar/sidebar).
- Top-level routes that need no app chrome: `login`, `welcome`, `invite/[token]`,
  `rsvp/[token]`, `unsubscribe/[token]`, `p/[slug]` (public campaigns), and
  `print/minutes/[id]` (chrome-free printable view).
- `src/app/api/` — auth, storage proxies (avatar, event-cover), ICS, exports,
  the minutes `.docx` route, and the two cron endpoints.

---

## Security model

The binding rules live in [CLAUDE.md](./CLAUDE.md). In summary:

1. **Routes are protected by the DAL, not middleware.** Middleware only redirects
   when the session cookie is absent.
2. **Import fences**: only `src/db`, `src/lib/dal.ts`, and `src/auth.ts` touch the
   database; only `src/lib/email.ts` touches Resend. ESLint-enforced.
3. Every server action starts with a DAL guard and validates input with Zod.
4. **Every admin mutation calls `audit()`.**
5. No GET handler or server component mutates state (the two cron GETs are a
   documented, bearer-guarded exception — see [Background jobs](#background-jobs-crons)).
6. Tokens (invite, RSVP, unsubscribe) are stored as **sha256 hashes**.
7. Phone numbers are **AES-256-GCM** encrypted before insert
   ([src/lib/crypto.ts](./src/lib/crypto.ts), `PHONE_ENC_KEY`).
8. Member PII renders only through `getMemberWithPrivacy()`.
9. All email goes through `src/lib/email.ts`, which obeys `EMAIL_MODE` (sandbox
   reroutes everything to `SANDBOX_INBOX`; `live` only in production). Bulk sends
   carry `List-Unsubscribe` headers.
10. Markdown renders with `react-markdown` **without** `rehype-raw`.

Defense in depth: row-level security, Cloudflare Turnstile on public forms,
Upstash rate limiting, constant-time cron-bearer checks, and Sentry `beforeSend`
scrubbing of emails, phones, and metadata.

---

## Data model

Drizzle schema in [src/db/schema.ts](./src/db/schema.ts). Eighteen tables:

- **Auth (Auth.js):** `users`, `accounts`, `sessions`, `verification_tokens`.
- **Membership:** `members` (the alumni record, encrypted phone, privacy flags),
  `invites` (hashed token, pending until first sign-in).
- **Events:** `events`, `event_rsvps`, `rsvp_email_tokens` (hashed).
- **Fundraisers:** `fundraisers`, `fundraiser_pledges` (amounts in kobo),
  `fundraiser_updates`.
- **Comms:** `announcements`, `birthday_sent` (idempotency ledger for the cron).
- **Secretary:** `meeting_minutes`, `exco_members`.
- **Platform:** `audit_log`, `app_settings`.

Money is stored in **kobo** (integer minor units). Dates that represent calendar
days (birthdays, event dates) are stored as `date` strings to avoid timezone
drift; instants are formatted in West Africa Time for display.

---

## Project structure

```
set/
├── src/
│   ├── app/
│   │   ├── (marketing)/        # public landing, privacy, terms, OG image
│   │   ├── (app)/              # authenticated app
│   │   │   ├── admin/          # back office (members, events, minutes, exco, audit, settings, …)
│   │   │   ├── dashboard/  directory/  events/  announcements/
│   │   │   ├── birthdays/  fundraisers/  exco/  me/  profile/
│   │   │   └── _components/    # app chrome (navbar, sidebar, nav-config)
│   │   ├── api/                # auth, avatar, event-cover, ics, exports, minutes docx, cron/*
│   │   ├── login/  welcome/  invite/  rsvp/  unsubscribe/  p/  print/
│   │   ├── globals.css         # Tailwind v4 @theme tokens (the design system)
│   │   └── global-error.tsx
│   ├── db/                     # schema.ts, index.ts (Drizzle client), policies.sql, seed.ts
│   ├── emails/                 # React Email templates
│   ├── lib/                    # dal.ts (the security boundary) + domain modules
│   └── components/ui/          # shadcn/ui primitives
├── drizzle/                    # generated SQL migrations
├── scripts/                    # seed/admin utilities (tsx)
├── e2e/ + playwright.config.ts # Playwright smoke tests
├── CLAUDE.md  DEPLOY.md  OPERATIONS.md  INCIDENT.md
└── knip.json  drizzle.config.ts  vercel.json
```

The `src/lib` modules are small, mostly pure, and individually unit-tested:
`birthdays`, `crypto`, `csv-import`, `ics`, `money`, `privacy`,
`profile-completion`, `tokens`, `audit-format`, `sentry-scrub`, `minutes`, and
more — each with a colocated `*.test.ts`.

---

## Getting started

Local development runs against a **local Postgres**, not Supabase. Supabase is
used only for Storage uploads. Email and rate limiting both fall back gracefully
when their keys are empty (magic links print to the dev console; rate limiting is
a no-op).

**Prerequisites:** Node.js 20+, npm, and a local PostgreSQL 16+ instance.

```bash
# 1. Install dependencies
npm install

# 2. Create a local database named "set"
#    The default local connection uses your OS user with no password, e.g.
#    postgresql://<you>@localhost:5432/set
createdb set

# 3. Configure environment
cp .env.example .env.local
#    Minimum for a local run: DATABASE_URL, DIRECT_URL, AUTH_SECRET,
#    PHONE_ENC_KEY, SUPER_ADMIN_EMAIL, NEXT_PUBLIC_APP_URL.
#    Leave AUTH_RESEND_KEY empty and keep EMAIL_MODE=sandbox.

# 4. Apply migrations (uses DIRECT_URL)
npm run db:migrate

# 5. Bootstrap the super admin (idempotent; uses SUPER_ADMIN_EMAIL)
npm run db:seed

# 6. Run
npm run dev
```

Then open <http://localhost:3000>, request a magic link for your
`SUPER_ADMIN_EMAIL`, and click the link printed to the dev-server console — no
real mail is sent locally. Alternatively set a password:

```bash
npm run set-password -- <email> <password>
```

**Optional local demo data** (never run against production):

```bash
npm run seed-dashboard   # demo dashboard content
npm run seed-audit       # demo audit-log entries
npm run seed-exco        # real leadership directory
npm run seed-bus         # public "bus" fundraiser at /p/bus
```

The row-level security policies in [src/db/policies.sql](./src/db/policies.sql)
are applied separately from migrations (see [DEPLOY.md](./DEPLOY.md)); they are
not required for a basic local run but mirror production.

---

## Environment variables

Names only — never commit real values. Variables without the `NEXT_PUBLIC_`
prefix are server-only. Full annotated template in [.env.example](./.env.example).

| Variable | What it is | Local vs production |
| --- | --- | --- |
| `DATABASE_URL` | Runtime DB connection (Drizzle) | Local Postgres locally. In prod the Supavisor **transaction** pooler (`:6543`) as the restricted `app_user`, never the owner |
| `DIRECT_URL` | Session connection, **migrations only** | Local Postgres locally. In prod the Supabase session connection (`:5432`); kept out of Vercel, used only when migrating |
| `SUPABASE_URL` | Supabase project URL | Storage only, same project both environments |
| `SUPABASE_SERVICE_ROLE_KEY` | Signed Storage uploads | **Storage only.** Never used for app data, never sent to the browser |
| `AUTH_SECRET` | Signs cookies, encrypts tokens | Required both. `npx auth secret` or `openssl rand -base64 33` |
| `AUTH_RESEND_KEY` | Resend key for magic links + all mail | Empty locally (mail prints to console). Real key in prod |
| `RESEND_FROM_EMAIL` | Sender address | Must be a Resend-**verified domain** address — you cannot send from a gmail.com address |
| `EMAIL_MODE` | Delivery mode | `sandbox` everywhere except prod (reroutes to `SANDBOX_INBOX`); `live` **only** in prod |
| `SANDBOX_INBOX` | Catch-all inbox when not live | Required whenever `EMAIL_MODE` ≠ `live` |
| `SUPER_ADMIN_EMAIL` | Address bootstrapped to `super_admin` | Set in both; applied by `db:seed` |
| `PHONE_ENC_KEY` | AES-256-GCM key for phones | Required both. Must base64-decode to exactly 32 bytes. `openssl rand -base64 32` |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Rate limiting | Optional; rate limiting fails open if unset |
| `TURNSTILE_SITE_KEY` / `_SECRET_KEY` | Cloudflare Turnstile (site key is public) | Set in prod for live bot protection |
| `CRON_SECRET` | Bearer guarding the cron routes | Required in prod. `openssl rand -hex 32` |
| `NEXT_PUBLIC_APP_URL` | Public base URL | `http://localhost:3000` locally; the real domain in prod |
| `SENTRY_DSN` | Server error reporting | Set in prod (`SENTRY_ORG`/`SENTRY_PROJECT` for source maps; `NEXT_PUBLIC_SENTRY_DSN` if client Sentry is added) |
| `ANTHROPIC_API_KEY` | Minutes generator (optional) | Empty → deterministic offline fallback. Set for fuller drafts |
| `ANTHROPIC_MODEL` | Model id for minutes | Defaults to `claude-sonnet-4-6` |

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server (Turbopack) |
| `npm run build` | Production build (Turbopack) |
| `npm run start` | Start the built app |
| `npm run lint` | ESLint (includes the import-fence rules) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest unit suite |
| `npm run test:e2e` | Playwright smoke tests |
| `npm run knip` | Dead-code / unused-dependency check |
| `npm run db:generate` | Generate a Drizzle migration from schema changes |
| `npm run db:migrate` | Apply migrations (uses `DIRECT_URL`) |
| `npm run db:push` | Push schema without a migration file |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run db:seed` | Bootstrap the super admin (idempotent) |
| `npm run set-password -- <email> <password>` | Set or reset a password |
| `npm run seed-dashboard` / `seed-audit` / `seed-exco` / `seed-bus` | Local demo/seed data |

---

## Testing and quality gates

The repository is kept clean across five gates — all currently green:

```bash
npm run typecheck   # strict TypeScript, no errors
npm run lint        # ESLint, no warnings (import fences enforced)
npm run test        # 92 unit tests (Vitest)
npm run knip        # no dead code / unused dependencies
npm run build       # production build, 37 routes
```

- **Unit tests** (`vitest`) cover the pure domain modules in `src/lib`
  (crypto, tokens, money, birthdays, ICS, CSV import, privacy, minutes, …).
- **End-to-end** (`@playwright/test`) smoke tests assert the security-critical
  paths: a member session cannot load `/admin/members`, the magic-link login
  round-trip completes (reading the verification token from the test database),
  and a public campaign page renders without a session.
- **Dead-code** is enforced with [knip](https://knip.dev) ([knip.json](./knip.json)).
  The vendored shadcn `ui/` kit is treated as a library (its full primitive API
  is intentionally kept); everything else must be reachable.

> **Note on `npm audit`:** the remaining advisories are transitive, dev/build-time
> only (esbuild inside `drizzle-kit`'s loader; postcss inside Next's own bundle).
> Their only "fixes" are breaking downgrades of `next`/`drizzle-kit`, so they are
> **not** applied. Do not run `npm audit fix --force`.

---

## Database and migrations

- Schema is the source of truth: edit [src/db/schema.ts](./src/db/schema.ts),
  then `npm run db:generate` to produce a migration in `drizzle/`, then
  `npm run db:migrate` to apply it.
- Migrations connect via `DIRECT_URL` (session connection), never the runtime
  pooler.
- **Row-level security** policies in [src/db/policies.sql](./src/db/policies.sql)
  are applied **separately** from migrations (they target the restricted
  `app_user` role and read the `app.user_id` / `app.role` GUCs set by the DAL).
  See [DEPLOY.md](./DEPLOY.md) and [OPERATIONS.md](./OPERATIONS.md).

---

## Background jobs (crons)

Defined in [vercel.json](./vercel.json) and registered by Vercel:

| Job | Schedule (UTC) | Endpoint |
| --- | --- | --- |
| Birthday wishes | `0 6 * * *` (daily, 07:00 WAT) | `GET /api/cron/birthdays` |
| Purge expired members | `0 7 * * 1` (Mon, 08:00 WAT) | `GET /api/cron/purge` |

Both require `Authorization: Bearer ${CRON_SECRET}` and reject anything else with
a constant-time check ([src/lib/cron-auth.ts](./src/lib/cron-auth.ts)). They are
GET handlers because Vercel Cron is GET-only — a deliberate, documented deviation
from rule 5 that stays safe because nothing runs unless the bearer check passes.
The birthday job is idempotent (guarded by the `birthday_sent` ledger). See
[OPERATIONS.md](./OPERATIONS.md) to invoke them by hand.

---

## Email

Every message — magic links and all transactional/bulk mail — flows through the
single chokepoint [src/lib/email.ts](./src/lib/email.ts), which obeys
`EMAIL_MODE`. In `sandbox` (everywhere but production) all mail is rerouted to
`SANDBOX_INBOX`, so **no message reaches a real member outside production**.
Templates are React Email components in [src/emails/](./src/emails). Bulk sends
carry `List-Unsubscribe` / `List-Unsubscribe-Post` headers, and unsubscribe
links are per-recipient, category-aware, signed tokens.

> Resend cannot send from a `gmail.com` address — production needs a verified
> sending domain. See [DEPLOY.md](./DEPLOY.md).

---

## Design system

One brand colour: **PAU blue** (`#14346B`, brightened to `#3464C4` in dark mode),
defined as CSS-first tokens in [src/app/globals.css](./src/app/globals.css)
(`--brand`, `--primary`, `--ring`, sidebar). Surfaces are page `#FAFAFA`, ink
`#0A0A0A`, muted `#737373`, border `#E5E5E5`; radius 8px, 1px borders. Primary
buttons are white-on-blue (AA, ~10.9:1 light / ~4.9:1 dark). Glass is reserved
for the scrolled navbar, overlays, toasts, the command palette, and the mobile
action bar — never tables, forms, cards, or emails. Motion is restrained
(200ms, single entrance) and respects `prefers-reduced-motion`. The full tokens,
type scale, and copy voice are specified in [CLAUDE.md](./CLAUDE.md).

---

## Deployment

Production runs on **Vercel** against a **Supabase** Postgres. The full ordered
runbook — private repo + secret scanning, the `app_user` pooler URL in Vercel
(owner URL kept out), service key for Storage only, migrations + `policies.sql`,
seeding the super admin only, `EMAIL_MODE=live` only in production, custom domain
and SSL, registering both crons, and a mail-tester pass — is in
**[DEPLOY.md](./DEPLOY.md)**. Day-to-day runbooks are in
**[OPERATIONS.md](./OPERATIONS.md)**; the NDPA breach response is in
**[INCIDENT.md](./INCIDENT.md)**.

Before launch: download a backup and perform one full restore drill. An untested
backup is a hope, not a backup.

---

## Documentation

| Doc | Purpose |
| --- | --- |
| [CLAUDE.md](./CLAUDE.md) | Binding conventions and security rules — the source of truth |
| [DEPLOY.md](./DEPLOY.md) | Ordered runbook to ship to production |
| [OPERATIONS.md](./OPERATIONS.md) | Day-to-day admin runbooks |
| [INCIDENT.md](./INCIDENT.md) | Data-breach response under the NDPA |

---

Private and members-only. © Pan-Atlantic University Alumni Association.
