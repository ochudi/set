# Set conventions

## What this is
Members-only alumni platform holding PII. Security and data decisions in
this file are binding. When a prompt conflicts with this file, this file
wins and you flag the conflict.

## Stack (decided, do not substitute)
Next.js 15 App Router + TypeScript strict. Tailwind CSS v4 (CSS-first
tokens via @theme; there is no tailwind.config.ts token file) + shadcn/ui.
Postgres on Supabase; Drizzle ORM via postgres-js on the Supavisor
transaction pooler (prepare: false); DIRECT_URL session connection for
migrations only; all data access runs in the Node runtime. Auth.js v5 with Drizzle adapter,
Resend magic links, DATABASE session strategy. Resend + React Email.
Upstash Redis rate limiting. Supabase Storage for avatars. Cloudflare Turnstile
on public forms. Zod everywhere. @tanstack/react-table for admin tables.
Framer Motion, restrained. Sentry.

## Security rules (binding)
1. Routes are protected by the DAL, not middleware. Middleware only
   redirects when the session cookie is absent.
2. Nothing imports src/db except src/db itself and src/lib/dal.ts.
   Nothing imports resend except src/lib/email.ts. Both enforced by
   eslint no-restricted-imports.
3. Every server action starts with a DAL guard (requireSession /
   requireRole / requireSuperAdmin) and validates input with Zod.
4. Every admin mutation calls audit(). No exceptions.
5. No GET handler or server component mutates state.
6. Tokens (invite, rsvp, unsubscribe) are stored as sha256 hashes.
7. Phone numbers encrypt with AES-256-GCM before insert (lib/crypto.ts).
8. Member PII renders only through getMemberWithPrivacy().
9. All email goes through lib/email.ts, which obeys EMAIL_MODE
   (sandbox reroutes to SANDBOX_INBOX). Bulk sends carry List-Unsubscribe
   and List-Unsubscribe-Post headers.
10. Markdown renders with react-markdown WITHOUT rehype-raw. Never add
    rehype-raw.

## Design tokens
page #FAFAFA, ink #0A0A0A, muted #737373, border #E5E5E5. One brand colour:
PAU blue #14346B (brand-deep #0F2750); dark mode brightens it to #3464C4.
There is no warm accent. Primary buttons are white-on-blue (white on #14346B,
~10.9:1 AA; dark #3464C4, ~4.9:1 AA). All accents (icons, focus ring, active
nav, links, selection) use the one brand blue via the --brand / --color-brand
tokens in globals.css. Radius 8px. Borders 1px. Inter (opsz axis) for display
and body, Geist Mono for meta. Type: page title 24/600, section 18/600,
body 14/1.6, table 13, caption 12. Glass only on navbar-after-scroll,
overlays, toasts, palette, mobile action bar; never on tables, forms,
cards, emails; blur 20px desktop, 12px under 768px, @supports fallback.

## Motion
200ms cubic-bezier(0.22,1,0.36,1). Modals fade+scale 0.96 to 1. Dashboard
stagger 60ms once. Skeletons on every async surface. Everything respects
prefers-reduced-motion. No bounces, no parallax.

## Copy voice
Plain language, sentence case, no em dashes anywhere, specific over
clever. Buttons say what they do. Errors say what happened and what to do
next. Empty states invite the next action in one sentence.
