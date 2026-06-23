/**
 * Human-readable rendering of an audit_log row's action. Pure (no db/auth) so it
 * is unit-testable and reused by the admin audit table. Given the action key,
 * its metadata, and a resolved target label, returns a sentence describing what
 * happened, e.g. "Changed role for Ada from member to exco".
 *
 * The actor is rendered separately (avatar + name) by the table, so these
 * strings are the predicate only, starting with a capitalised verb.
 */

export type AuditMeta = Record<string, unknown> | null | undefined;

function str(meta: AuditMeta, key: string): string | null {
  const v = meta?.[key];
  return v == null ? null : String(v);
}

function num(meta: AuditMeta, key: string): number | null {
  const v = meta?.[key];
  return typeof v === "number" ? v : null;
}

/** "member.role_change" -> "Member role change" (fallback for unknown actions). */
function humanizeAction(action: string): string {
  const words = action.replace(/[._]/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function withTarget(verb: string, target: string | null): string {
  return target ? `${verb} ${target}` : verb;
}

export function formatAuditAction(
  action: string,
  metadata: AuditMeta,
  target: string | null,
): string {
  const t = target;
  switch (action) {
    // members / roles
    case "member.role_change": {
      const from = str(metadata, "from");
      const to = str(metadata, "to");
      const who = t ?? "a member";
      if (from && to) return `Changed role for ${who} from ${from} to ${to}`;
      return `Changed role for ${who}`;
    }
    case "member.suspend":
      return withTarget("Suspended", t);
    case "member.reactivate":
      return withTarget("Reactivated", t);
    case "member.delete":
      return t ? `Deleted ${t}'s account` : "Deleted a member account";
    case "member.update": {
      const fields = Array.isArray(metadata?.fields)
        ? (metadata!.fields as string[])
        : [];
      const who = t ? `${t}'s profile` : "a profile";
      return fields.length
        ? `Updated ${who} (${fields.join(", ")})`
        : `Updated ${who}`;
    }
    case "member.bulk_suspend": {
      const n = num(metadata, "suspended") ?? 0;
      return `Suspended ${n} ${n === 1 ? "member" : "members"} in bulk`;
    }
    case "member.export_csv": {
      const n = num(metadata, "count");
      return n == null ? "Exported the member roster" : `Exported the member roster (${n} rows)`;
    }
    case "member.import": {
      const n = num(metadata, "created");
      return n == null ? "Imported members" : `Imported members (${n} created)`;
    }
    case "member.onboard":
      return "Completed onboarding";
    case "member.unsubscribe": {
      const cat = str(metadata, "category");
      return cat ? `Unsubscribed from ${cat}` : "Unsubscribed from emails";
    }

    // invites
    case "invite.create": {
      const email = str(metadata, "email");
      const role = str(metadata, "role");
      if (email && role) return `Invited ${email} as ${role}`;
      return email ? `Invited ${email}` : "Created an invite";
    }
    case "invite.resend":
      return withTarget("Resent the invite to", str(metadata, "email"));
    case "invite.revoke":
      return withTarget("Revoked the invite for", str(metadata, "email"));
    case "invite.bulk_send": {
      const n = num(metadata, "count") ?? num(metadata, "sent") ?? 0;
      return `Sent ${n} pending ${n === 1 ? "invite" : "invites"}`;
    }

    // events
    case "event.create":
      return withTarget("Created event", t);
    case "event.update":
      return withTarget("Updated event", t);
    case "event.publish": {
      const n = num(metadata, "emailed");
      const base = withTarget("Published event", t);
      return n ? `${base} (emailed ${n})` : base;
    }
    case "event.invite": {
      const n = num(metadata, "recipients") ?? 0;
      return `Emailed ${n} ${n === 1 ? "invite" : "invites"}${t ? ` for ${t}` : ""}`;
    }
    case "event.cancel":
      return withTarget("Cancelled event", t);
    case "event.delete":
      return withTarget("Deleted event", t);
    case "event.rsvp_export":
      return withTarget("Exported RSVPs for", t);

    // announcements
    case "announcement.create":
      return withTarget("Created announcement", t);
    case "announcement.update":
      return withTarget("Updated announcement", t);
    case "announcement.publish":
      return withTarget("Published announcement", t);
    case "announcement.email": {
      const n = num(metadata, "recipients") ?? 0;
      return `Emailed announcement${t ? ` ${t}` : ""} to ${n} ${n === 1 ? "member" : "members"}`;
    }
    case "announcement.delete":
      return withTarget("Deleted announcement", t);

    // fundraisers / pledges
    case "fundraiser.create":
      return withTarget("Created campaign", t);
    case "fundraiser.update":
      return withTarget("Updated campaign", t);
    case "fundraiser.post_update":
      return withTarget("Posted an update to", t);
    case "fundraiser.pledges_export":
      return withTarget("Exported pledges for", t);
    case "pledge.received":
      return t ? `Marked a pledge received on ${t}` : "Marked a pledge received";
    case "pledge.external":
      return t ? `Logged an external pledge on ${t}` : "Logged an external pledge";

    // birthdays
    case "birthday.manual_send":
      return withTarget("Sent a birthday wish to", t);
    case "cron.birthdays": {
      const n = num(metadata, "sent");
      return n == null ? "Ran the birthday cron" : `Ran the birthday cron (${n} sent)`;
    }

    // account self-service
    case "account.delete":
      return "Deleted their own account";
    case "account.restore":
      return t ? `Restored ${t}'s account` : "Restored an account";
    case "session.revoke":
      return "Revoked a device session";
    case "session.revoke_others":
      return "Signed out other devices";

    // settings / super admin
    case "settings.update": {
      const keys = Array.isArray(metadata?.keys)
        ? (metadata!.keys as string[])
        : null;
      if (keys?.length) return `Updated settings (${keys.join(", ")})`;
      return t ? `Updated setting ${t}` : "Updated settings";
    }
    case "data.export_all":
      return "Exported all platform data";

    // minutes + leadership
    case "minutes.create":
      return withTarget("Created minutes", t ?? str(metadata, "title"));
    case "minutes.update":
      return withTarget("Updated minutes", t ?? str(metadata, "title"));
    case "minutes.delete":
      return withTarget("Deleted minutes", t ?? str(metadata, "title"));
    case "exco.create":
      return withTarget("Added to leadership", t ?? str(metadata, "name"));
    case "exco.update":
      return withTarget("Updated leadership entry", t ?? str(metadata, "name"));
    case "exco.delete":
      return "Removed a leadership entry";
    case "superadmin.transfer":
      return withTarget("Transferred super admin to", t);

    default:
      return withTarget(humanizeAction(action), t);
  }
}
