import ical, { ICalCalendarMethod, ICalEventStatus } from "ical-generator";

/**
 * ICS (iCalendar) builder for events. Server-only (ical-generator is Node).
 *
 * Stable UID = the event uuid, and SEQUENCE comes off the events row (bumped on
 * every edit), so a re-imported file updates the existing calendar entry instead
 * of creating a duplicate. Downloads use METHOD:PUBLISH; the cancellation email
 * attaches a METHOD:CANCEL / STATUS:CANCELLED variant (the cancel flow bumps the
 * stored sequence first).
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const ORGANIZER_NAME = "Set Alumni";

function organizerEmail(): string {
  const from = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
  const angle = from.match(/<([^>]+)>/);
  if (angle) return angle[1];
  return from.includes("@") ? from.trim() : "noreply@set.app";
}

export type IcsEvent = {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  isVirtual: boolean;
  meetingUrl?: string | null;
  startsAt: Date;
  endsAt?: Date | null;
  sequence: number;
};

export function buildEventIcs(
  event: IcsEvent,
  opts: { canceled?: boolean } = {},
): string {
  const cal = ical({
    name: "Set events",
    prodId: { company: "Set", product: "Events", language: "EN" },
  });
  cal.method(
    opts.canceled ? ICalCalendarMethod.CANCEL : ICalCalendarMethod.PUBLISH,
  );

  const url = `${APP_URL}/events/${event.id}`;
  const end =
    event.endsAt ?? new Date(event.startsAt.getTime() + 2 * 60 * 60 * 1000);
  const location = event.isVirtual
    ? (event.meetingUrl ?? "Online")
    : (event.location ?? undefined);

  const description = [event.description?.trim(), `Details: ${url}`]
    .filter(Boolean)
    .join("\n\n");

  const vevent = cal.createEvent({
    id: event.id, // UID — stable across edits
    sequence: event.sequence,
    start: event.startsAt,
    end,
    summary: event.title,
    description,
    location,
    url,
    organizer: { name: ORGANIZER_NAME, email: organizerEmail() },
  });
  vevent.status(
    opts.canceled ? ICalEventStatus.CANCELLED : ICalEventStatus.CONFIRMED,
  );

  return cal.toString();
}
