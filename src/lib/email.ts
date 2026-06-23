import type { ReactElement } from "react";
import { Resend } from "resend";

import { unsubscribeToken, type UnsubCategory } from "@/lib/tokens";

/**
 * The single email chokepoint (CLAUDE.md rule 9). NOTHING else may import the
 * `resend` package (enforced by eslint no-restricted-imports).
 *
 * - EMAIL_MODE=sandbox (the default for anything that is not "live") reroutes
 *   every message to SANDBOX_INBOX and prefixes the subject with "[to: original]"
 *   so no mail can reach a real member outside production.
 * - bulk sends go through Resend's batch endpoint in chunks of 100 and always
 *   carry per-recipient List-Unsubscribe + List-Unsubscribe-Post (one-click)
 *   headers signed with a stateless token.
 */

const FROM = process.env.RESEND_FROM_EMAIL ?? "Set <onboarding@resend.dev>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function client(): Resend {
  const key = process.env.AUTH_RESEND_KEY;
  if (!key) throw new Error("AUTH_RESEND_KEY is not set");
  return new Resend(key);
}

function isSandbox(): boolean {
  return process.env.EMAIL_MODE !== "live";
}

function sandboxInbox(): string {
  const inbox = process.env.SANDBOX_INBOX;
  if (!inbox) {
    throw new Error("SANDBOX_INBOX is not set (required when EMAIL_MODE is not live)");
  }
  return inbox;
}

function fromDomain(): string {
  return FROM.match(/@([^>\s]+)/)?.[1] ?? "set.app";
}

function emailAddress(from: string): string {
  return from.match(/<([^>]+)>/)?.[1] ?? from;
}

/**
 * Resolve the effective `from` (with the admin-configured display name) and
 * `reply_to` from settings. Dynamic import of the DAL keeps the email module
 * out of the auth/dal import cycle and respects rule 2 (only the DAL reads db).
 * Falls back to env defaults if settings are unset or unavailable.
 */
async function resolveSender(): Promise<{ from: string; replyTo?: string }> {
  try {
    const { getEmailConfig } = await import("@/lib/dal");
    const cfg = await getEmailConfig();
    const from = cfg.fromName
      ? `${cfg.fromName} <${emailAddress(FROM)}>`
      : FROM;
    return { from, replyTo: cfg.replyTo ?? undefined };
  } catch {
    return { from: FROM };
  }
}

/**
 * List-Unsubscribe (mailto + https) and one-click POST headers for one
 * recipient, scoped to a category so the link flips only the matching notify_*
 * flag. Exported so the header contract is unit-testable.
 */
export function buildUnsubscribeHeaders(
  recipient: string,
  category: UnsubCategory = "all",
): Record<string, string> {
  const token = unsubscribeToken(recipient, category);
  const https = `${APP_URL}/unsubscribe/${token}`;
  const mailto = `mailto:unsubscribe@${fromDomain()}?subject=unsubscribe`;
  return {
    "List-Unsubscribe": `<${mailto}>, <${https}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

export type EmailAttachment = { filename: string; content: Buffer };

type SingleArgs = {
  to: string;
  subject: string;
  react: ReactElement;
  headers?: Record<string, string>;
  attachments?: EmailAttachment[];
  bulk?: false;
};

type BulkArgs = {
  to: string[];
  subject: string;
  react: ReactElement;
  headers?: Record<string, string>;
  // Which notify_* flag the per-recipient List-Unsubscribe link targets.
  category?: UnsubCategory;
  bulk: true;
};

export type SendArgs = SingleArgs | BulkArgs;

/**
 * Dev fallback: with no Resend key there is no way to deliver mail, so log the
 * message instead of throwing. Keeps every email path usable in local dev
 * (magic links, invites, event invites, birthday wishes) without real sends.
 * Never triggers in production, which always has AUTH_RESEND_KEY set.
 */
function devLog(to: string | string[], subject: string): { dev: true } {
  const recipients = Array.isArray(to) ? to.join(", ") : to;
  console.log(`  ✉  [dev:no-resend-key] "${subject}" -> ${recipients}`);
  return { dev: true };
}

export async function send(args: SendArgs) {
  const noKey = !process.env.AUTH_RESEND_KEY;
  const sandbox = isSandbox();

  if (args.bulk) {
    const category = args.category ?? "all";
    if (noKey) {
      // Dev: log one line per recipient, including the category-scoped
      // List-Unsubscribe header, so the bulk contract is visible without sends.
      return args.to.map((recipient) => {
        const h = buildUnsubscribeHeaders(recipient, category);
        console.log(
          `  ✉  [dev:bulk] "${args.subject}" -> ${recipient} | List-Unsubscribe: ${h["List-Unsubscribe"]}`,
        );
        return { dev: true };
      });
    }
    const resend = client();
    const { from, replyTo } = await resolveSender();
    const results = [];
    for (let i = 0; i < args.to.length; i += 100) {
      const chunk = args.to.slice(i, i + 100);
      const batch = chunk.map((recipient) => ({
        from,
        replyTo,
        to: sandbox ? sandboxInbox() : recipient,
        subject: sandbox ? `[to: ${recipient}] ${args.subject}` : args.subject,
        react: args.react,
        headers: { ...buildUnsubscribeHeaders(recipient, category), ...args.headers },
      }));
      results.push(await resend.batch.send(batch));
    }
    return results;
  }

  if (noKey) {
    return devLog(args.to, args.subject);
  }
  const resend = client();
  const { from, replyTo } = await resolveSender();

  return resend.emails.send({
    from,
    replyTo,
    to: sandbox ? sandboxInbox() : args.to,
    subject: sandbox ? `[to: ${args.to}] ${args.subject}` : args.subject,
    react: args.react,
    headers: args.headers,
    attachments: args.attachments,
  });
}

/**
 * Per-recipient bulk send: each message has its own rendered body (e.g. unique
 * RSVP links) and optional attachment (e.g. the event .ics), plus one-click
 * List-Unsubscribe headers. Sent individually because the batch endpoint does
 * not carry attachments; fine at alumni scale, but move to a queue if the list
 * grows into the thousands. Honours EMAIL_MODE sandbox like send().
 */
export async function sendEach(
  messages: Array<{
    to: string;
    subject: string;
    react: ReactElement;
    attachments?: EmailAttachment[];
  }>,
) {
  if (!process.env.AUTH_RESEND_KEY) {
    return messages.map((m) => devLog(m.to, m.subject));
  }
  const resend = client();
  const sandbox = isSandbox();
  const { from, replyTo } = await resolveSender();
  const results = [];
  for (const m of messages) {
    results.push(
      await resend.emails.send({
        from,
        replyTo,
        to: sandbox ? sandboxInbox() : m.to,
        subject: sandbox ? `[to: ${m.to}] ${m.subject}` : m.subject,
        react: m.react,
        headers: buildUnsubscribeHeaders(m.to, "events"),
        attachments: m.attachments,
      }),
    );
  }
  return results;
}
