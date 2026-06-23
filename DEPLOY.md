# Deploy

An ordered runbook to ship Set to production on Vercel and Supabase. Read it top
to bottom. Some steps must be done by a human and cannot be automated from a
development environment; those are marked HUMAN.

The deployment target: a Vercel project for the Next.js app, a production
Supabase project for Postgres and Storage, Resend for mail, Upstash for rate
limiting, Cloudflare Turnstile for public forms, and a custom domain at
set.paualumni.org.

## 1. Private GitHub repository

HUMAN.

- Create a PRIVATE GitHub repository. This codebase holds PII and security
  config, so it must never be public.
- Turn ON GitHub secret scanning and push protection for the repository, so a
  committed secret is blocked before it lands.
- Confirm `.env.local` and any other secret files are gitignored before the
  first push (they are by default in this repo).
- Push the code.

## 2. Provision production Supabase and wire least privilege

HUMAN for project creation and SQL editor steps.

- Create the production Supabase project.
- From Settings > Database, collect both connection strings:
  - The Supavisor TRANSACTION pooler URL on port 6543 (for the running app).
  - The session connection URL on port 5432 (owner, for migrations only).
- Create the restricted runtime role and policies by applying
  `src/db/policies.sql` (see step 3). That script creates the `app_user` role
  with `nobypassrls` and grants it DML. Set its password out of band in the
  Supabase SQL editor:

  ```sql
  alter role app_user with password '<from your secret manager>';
  ```

- DATABASE_URL in Vercel must be the transaction pooler URL connecting as
  app_user (least privilege), for example
  `postgresql://app_user:<password>@<host>:6543/postgres`.
- The owner/postgres session URL (port 5432) stays OUT of Vercel. It is used
  only locally to run migrations and apply policies. If you set DIRECT_URL in
  Vercel at all, it is not used by the running app.
- SUPABASE_SERVICE_ROLE_KEY is present in Vercel ONLY for Supabase Storage
  (avatar and event cover uploads via src/lib/storage.ts). It is never used for
  app data access and never exposed to the browser.

## 3. Apply migrations and RLS policies to production

HUMAN runs these from a trusted machine, pointed at the production database.

- Apply migrations against the owner session connection. drizzle-kit reads
  DIRECT_URL, so set DIRECT_URL to the owner :5432 URL in your local shell, then:

  ```bash
  npm run db:migrate
  ```

- Apply the row level security backstop. Open `src/db/policies.sql` and run it
  in the Supabase SQL editor AS THE TABLE OWNER, AFTER migrations. It is
  idempotent and safe to re-run. This creates app_user, enables RLS on members
  and audit_log, installs the access and directory policies, and installs the
  append-only trigger on audit_log.

## 4. Seed only the super admin

HUMAN, run once against production.

- Set SUPER_ADMIN_EMAIL to the real super admin address and run:

  ```bash
  npm run db:seed
  ```

- This bootstraps that address to the super_admin role with a user and member
  row, through the app_user runtime connection and the real RLS write path. It
  is idempotent.
- Do NOT run any demo seed (seed-dashboard, seed-audit, seed-bus) against
  production. They are for local clicking around only.

## 5. Set all environment variables in Vercel

HUMAN, in the Vercel project settings.

- Set every variable from the README env table for the Production environment:
  DATABASE_URL (app_user pooler), SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
  (Storage only), AUTH_SECRET, AUTH_RESEND_KEY (real Resend key),
  RESEND_FROM_EMAIL (a Resend verified domain address with the PAUAA display
  name; reply-to is the secretary gmail, set in Settings > Email),
  SANDBOX_INBOX, SUPER_ADMIN_EMAIL, PHONE_ENC_KEY (32 byte base64),
  UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, TURNSTILE_SITE_KEY,
  TURNSTILE_SECRET_KEY, SENTRY_DSN, CRON_SECRET, and
  NEXT_PUBLIC_APP_URL (https://set.paualumni.org).
- EMAIL_MODE=live ONLY in the Production environment. Preview and Development
  environments stay EMAIL_MODE=sandbox so no preview deploy can mail real
  members.
- Do not put the owner/postgres session URL in Vercel. Generate fresh secrets
  for production (AUTH_SECRET, PHONE_ENC_KEY, CRON_SECRET, AUTH_RESEND_KEY);
  never reuse the local development values.

## 6. Deploy

HUMAN.

```bash
vercel --prod
```

## 7. Custom domain and SSL

HUMAN, DNS work cannot be automated here.

- Add set.paualumni.org to the Vercel project and follow the DNS instructions.
- Confirm SSL is issued and the domain serves over https.
- Confirm NEXT_PUBLIC_APP_URL matches the live domain exactly.

## 8. Confirm both crons are registered

HUMAN, in the Vercel dashboard.

- Open the project Cron Jobs view and confirm both jobs from vercel.json are
  listed:
  - /api/cron/birthdays on `0 6 * * *`
  - /api/cron/purge on `0 7 * * 1`
- Vercel sends the `Authorization: Bearer ${CRON_SECRET}` header automatically
  when CRON_SECRET is set, so make sure CRON_SECRET is set in Production.

## 9. Verify the sender reputation

HUMAN, external service.

- Confirm the Resend domain is verified (SPF, DKIM, and a DMARC record in DNS).
- Send a test from the production sender to a fresh address from
  https://www.mail-tester.com and confirm it scores 10/10. Fix any SPF, DKIM, or
  DMARC findings before launch.

## Smoke test (run on production)

HUMAN walks through this once on the live site, signed in as the super admin or
a test member. With EMAIL_MODE=live this sends real mail, so use addresses you
control.

- [ ] Fresh sign in: request a magic link, receive it, and land signed in.
- [ ] /welcome onboarding completes and writes a member profile.
- [ ] Create an event in the admin area.
- [ ] RSVP to that event as a member.
- [ ] Import the event .ics into a calendar and confirm it parses.
- [ ] Draft an announcement and SAVE IT AS A DRAFT. Do NOT send it to members.
- [ ] Pledge on the seeded bus campaign at /p/bus (seed it first if needed with `tsx scripts/seed-bus.ts`, or skip if you do not want demo data in production).
- [ ] Open the audit log as super admin and confirm it shows the actions above.
- [ ] Mobile pass: repeat the key flows at phone width and confirm layout and the mobile action bar behave.

If anything fails, do not announce the launch. Fix and re-run the affected
checks.
