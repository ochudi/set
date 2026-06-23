# Incident response: data breach (NDPA)

A one-page plan for responding to a personal data breach on Set, under the
Nigeria Data Protection Act (NDPA). Set holds member PII, so a breach is a legal
and trust matter, not just a technical one. Fill in the role placeholders with
real exco names and contacts before launch.

## What counts as a breach

A personal data breach is any security incident that leads to the accidental or
unlawful loss, destruction, alteration, unauthorised disclosure of, or access to
member personal data. Examples for Set:

- Member PII exposed to someone who should not see it (a directory leak, a wrong
  recipient on a bulk email, a misconfigured Storage bucket).
- A leaked or committed secret: DATABASE_URL, AUTH_SECRET, PHONE_ENC_KEY,
  SUPABASE_SERVICE_ROLE_KEY, AUTH_RESEND_KEY, CRON_SECRET, or Upstash tokens.
- Account takeover, or unauthorised access to an admin or super admin account.
- Loss or corruption of the database or backups.
- Decryption of stored phone numbers by an unauthorised party.

When in doubt, treat it as a breach and triage. Under-reacting is the bigger
risk.

## Notification requirements (NDPA)

- Notify the Nigeria Data Protection Commission (NDPC) without undue delay, and
  within 72 hours of becoming aware of the breach where feasible. If you cannot
  report within 72 hours, document why and report as soon as you can.
- Notify affected data subjects (the members) when the breach is likely to
  result in a high risk to their rights and freedoms. Tell them in plain
  language what happened, what data was involved, what you are doing about it,
  and what they should do (for example reset access, watch for phishing).
- Keep a record of the breach and the decisions made, whether or not it is
  reportable.

## Roles (fill in)

- Detect and triage: ____________________ (first responder; confirms it is a
  breach and assesses scope).
- Decide: ____________________ (the data controller decision maker; decides on
  containment, NDPC notification, and member notification).
- Communicate: ____________________ (drafts and sends member and NDPC
  communications).
- Point of contact: ____________________ (named contact for the NDPC and for
  members, with phone and email).
- Technical lead: ____________________ (executes containment and recovery; in
  practice the super admin).

## Immediate containment

Move fast on the steps that stop the bleeding, in roughly this order:

1. Rotate the exposed secret(s). For any leaked credential, generate a new value
   and update it in Vercel: AUTH_SECRET, PHONE_ENC_KEY (see the rotation note in
   OPERATIONS.md, since existing phone data must be re-encrypted),
   SUPABASE_SERVICE_ROLE_KEY (rotate in Supabase), AUTH_RESEND_KEY (rotate in
   Resend), CRON_SECRET, and the app_user database password. Redeploy.
2. Revoke sessions. Rotating AUTH_SECRET invalidates existing sessions. For a
   specific compromised account, suspend it in /admin/members, which kills its
   sessions immediately.
3. Take affected surfaces offline. If a route, form, or the public fundraiser
   page is leaking, disable or roll back that surface, or take the deployment
   down, until it is fixed.
4. Close the hole. Fix the misconfiguration (bucket permissions, a query, a bad
   recipient list) before bringing the surface back.

## Evidence preservation

- Do not wipe logs or the database in a panic; you need them for the report and
  the review.
- Capture Vercel logs, Sentry events, and the relevant audit_log rows (the audit
  log is append-only and cannot be altered, by design in src/db/policies.sql).
- Note timestamps: when it started, when it was detected, when it was contained.
- Record who accessed what, the data categories involved, and how many members
  are affected.

## Post-incident review

Within a short, fixed window after containment (for example one week), hold a
brief review: what happened, the root cause, what stopped it, what notifications
went out and when, and the concrete fixes to prevent a repeat. Record the
actions with owners and dates, and update this document if the process needs to
change.

## Sign-off

Incident handled and review completed.

Decision maker: ____________________  Date: ____________

Technical lead: ____________________  Date: ____________

NDPC notified (date/ref): ____________________________________

Members notified (date): ____________________________________
