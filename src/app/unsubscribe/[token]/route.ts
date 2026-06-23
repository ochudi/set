import { NextResponse } from "next/server";

import { unsubscribeEmail } from "@/lib/dal";
import { readUnsubscribeToken, type UnsubCategory } from "@/lib/tokens";

const CATEGORY_NOUN: Record<UnsubCategory, string> = {
  announcements: "announcement",
  events: "event",
  fundraisers: "fundraiser",
  all: "announcement, event, and fundraiser",
};

// One URL serves both the human page (GET) and RFC 8058 one-click unsubscribe
// (POST to the List-Unsubscribe header URL set in src/lib/email.ts). GET never
// mutates (rule 5); the POST does the opt-out. The token is a stateless
// HMAC-signed value (see the flag in tokens.ts), so no DB lookup is needed to
// authenticate it.
export const runtime = "nodejs";

function page(title: string, body: string, status = 200): NextResponse {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${title} · Set</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    background:#FAFAFA; color:#0A0A0A; font-family:Inter,Arial,sans-serif; padding:24px; }
  .card { width:100%; max-width:420px; background:#fff; border:1px solid #E5E5E5; border-radius:8px;
    padding:32px; box-shadow:0 1px 2px rgba(0,0,0,0.04); }
  h1 { font-size:22px; font-weight:600; font-style:italic; letter-spacing:-0.02em; margin:0 0 16px; }
  p { font-size:14px; line-height:1.6; color:#0A0A0A; margin:0 0 12px; }
  .muted { color:#737373; font-size:13px; }
  button { background:#14346B; color:#FFFFFF; border:0; border-radius:8px; padding:12px 18px;
    font-size:14px; font-weight:600; cursor:pointer; font-family:inherit; }
  a { color:#14346B; }
</style>
</head>
<body><div class="card"><h1>Set.</h1>${body}</div></body>
</html>`;
  return new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

const INVALID = `<p>This unsubscribe link is not valid or has expired.</p>
<p class="muted">If you keep getting emails you did not expect, contact the committee.</p>`;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const parsed = readUnsubscribeToken(token);
  if (!parsed) return page("Unsubscribe", INVALID, 400);
  const noun = CATEGORY_NOUN[parsed.category];

  return page(
    "Unsubscribe",
    `<p>Stop receiving ${noun} emails for <strong>${escapeHtml(parsed.email)}</strong>?</p>
     <form method="post" style="margin-top:16px">
       <button type="submit">Unsubscribe</button>
     </form>
     <p class="muted" style="margin-top:16px">Account and sign-in emails are always sent.
       You can fine-tune these in your account settings.</p>`,
  );
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const parsed = readUnsubscribeToken(token);
  if (!parsed) return page("Unsubscribe", INVALID, 400);

  // Flip only the matching notify_* flag. Also serves the RFC 8058 one-click
  // POST (the List-Unsubscribe-Post header), which needs no page — any 200 is
  // accepted by the mail client.
  await unsubscribeEmail(parsed.email, parsed.category);
  const noun = CATEGORY_NOUN[parsed.category];
  return page(
    "Unsubscribed",
    `<p>Done. <strong>${escapeHtml(parsed.email)}</strong> will no longer receive ${noun}
      emails.</p>
     <p class="muted">Changed your mind? Turn them back on under Notifications in your
       account settings.</p>`,
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
