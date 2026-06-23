# Operations

Runbooks for running Set day to day. These assume production is set up per
DEPLOY.md. For a breach, use INCIDENT.md instead.

## Reset or manage a member account

All member admin happens in the app at /admin/members, performed by an exco or
super admin. Every mutation is written to the audit log.

- Suspend a member: in /admin/members, suspend the account. This sets the user
  status to suspended and kills their sessions immediately, so they are signed
  out everywhere. Implemented by the suspend/reactivate action in
  src/lib/dal.ts; audited as member.suspend.
- Reactivate a member: reactivate from the same screen. Status returns to
  active. Audited as member.reactivate.
- Change a role: set a member to member, exco, or super_admin via the role
  control (setMemberRole in src/lib/dal.ts). Role changes are guarded and
  audited.
- Password reset: members normally sign in with a magic link, so the usual fix
  is to ask them to request a fresh link. If you need to set a password
  directly (for example to recover access), run from a trusted machine against
  the right database:

  ```bash
  npm run set-password -- <email> <password>
  ```

  This overwrites the stored password hash for that email and is idempotent. It
  does nothing else.

## Run the birthday cron manually

The daily birthday job is GET /api/cron/birthdays. It is idempotent (one wish
per celebrant per year via birthday_sent), so re-running is safe. It requires
the CRON_SECRET bearer.

Local:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/birthdays
```

Production:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://set.paualumni.org/api/cron/birthdays
```

A correct call returns `{ "ok": true, ... }`. A missing or wrong bearer returns
401 and does nothing. The weekly purge job at /api/cron/purge works the same way
with the same bearer.

## Handle a data deletion request

The model is soft delete, then a 30-day grace period, then anonymise on the
weekly purge cron. Records are kept (not row-deleted) so shared history such as
pledges, RSVPs, and the audit trail keeps referential integrity and renders as a
deleted member. Constants and logic live in src/lib/dal.ts
(ACCOUNT_DELETION_GRACE_DAYS = 30).

What happens, and who does what:

1. Soft delete (immediate). The member deletes their own account
   (softDeleteMyAccount), which sets deleted_at on the member and user rows,
   sets user status to deactivated, and deletes all of their sessions so they
   are signed out. The profile is hidden from the directory at once. Audited as
   account.delete. The data is retained but hidden and recoverable during grace.
2. Grace period (30 days). A super admin can restore within this window. In
   /admin/members the deleted members are listed (listDeletedMembers) with a
   restorable-until date. Restoring (restoreMember) clears deleted_at and sets
   status back to active. Audited as account.restore. After grace expires,
   restore is refused with grace_expired.
3. Anonymise (after grace, on the weekly purge cron). The Monday purge cron
   (purgeExpiredMembersSystem) nulls every PII column on the member row
   (names, avatar, bio, encrypted phone, faculty, programme, employer, location,
   links, date of birth) and tombstones the user email to
   `deleted+<userId>@deleted.invalid`. The row and ids survive so references
   stay intact. A super admin can also trigger this in-session via
   purgeExpiredMembers, but the routine path is the cron.

To honour a request faster than the cron cadence: soft delete the account, and
once you are sure no restore is wanted, a super admin can run the in-session
purge rather than wait for Monday. Note that the spec for anonymisation in this
repo is inferred; if the association has a written data policy that differs,
flag it and reconcile before changing behaviour.

## Restore a backup

Production data lives in the Supabase Postgres database. Storage objects
(avatars, event covers) live in Supabase Storage.

- Confirm retention. In the Supabase dashboard, confirm the project is on a plan
  with daily backups (Supabase Pro) and check the actual retention window listed
  there. Do not assume; read the number.
- Restore procedure (non-destructive verification): restore the backup into a
  SCRATCH Supabase project or into a local Postgres, not over production. Then
  point a local checkout at that restored database (DATABASE_URL / DIRECT_URL)
  and click around to confirm members, events, announcements, fundraisers, and
  the audit log are present and coherent.
- Real recovery: only after verifying a backup is good, follow Supabase's
  point in time or backup restore for the production project. Treat restoring
  over production as a high-risk action and take a fresh backup first.
- Belt and braces (optional, recommended): schedule a weekly offsite `pg_dump`
  to storage you control, so recovery does not depend on a single provider.

## Restore drill

An untested backup is a hope, not a backup. This drill must be executed by a
HUMAN against a real backup before launch. It cannot be run from a development
or CI environment.

Steps:

1. Take or pick a recent production backup.
2. Restore it into a scratch Supabase project or a local Postgres (never over
   production).
3. Point a local checkout at the restored database and run `npm run dev`.
4. Verify: sign in works, the member directory loads, an event renders, an
   announcement renders, a fundraiser renders, and the audit log loads as super
   admin.
5. Record the result and any issues found.
6. Tear down the scratch project.

Sign-off:

Restore drill performed by ___________________ on ____________________.

Do not launch until this line is signed.

## Rotate PHONE_ENC_KEY

PHONE_ENC_KEY is the AES-256-GCM key that encrypts member phone numbers at rest
(src/lib/crypto.ts, encryptPhone / decryptPhone). The stored format is
`iv:tag:cipher`, each segment base64.

The concern: every existing phone number is encrypted with the CURRENT key. If
you just swap PHONE_ENC_KEY, decryptPhone will fail on all existing values (the
GCM auth tag will not verify), so existing phones become unreadable. Rotation
therefore requires re-encrypting data, not just changing the env var.

There is NO built-in rotation script yet. Flag this: a one-off migration script
is needed before any rotation. The approach:

1. Generate the new 32 byte key: `openssl rand -base64 32`.
2. Write a one-off script (modelled on scripts/set-password.ts and using the
   crypto helpers in src/lib/crypto.ts) that, inside a transaction and a
   super-admin database context, reads every member.phone_encrypted, decrypts it
   with the OLD key, re-encrypts it with the NEW key, and writes it back. The
   script needs both keys available at once, for example the old one in
   PHONE_ENC_KEY and the new one passed in separately, since getKey() in
   crypto.ts reads a single env var.
3. Run the script against a restored copy first and confirm phones still
   decrypt.
4. Run it against production during a short maintenance window, then set
   PHONE_ENC_KEY to the new key in Vercel and redeploy.
5. Confirm a member profile shows the correct phone, then retire the old key.

Until that script exists, do not rotate PHONE_ENC_KEY in production.
