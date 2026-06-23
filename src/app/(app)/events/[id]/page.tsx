import Link from "next/link";
import { notFound } from "next/navigation";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  CalendarDays,
  CalendarPlus,
  MapPin,
  Video,
} from "lucide-react";

import { getEvent } from "@/lib/dal";
import { initials } from "@/lib/member-display";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import { EventTime } from "../event-time";
import { DeclinedToggle } from "./declined-toggle";
import { RsvpBar } from "./rsvp-bar";

type Person = { name: string; avatarUrl: string | null };

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();

  const canceled = !!event.canceledAt;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <Link
        href="/events"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Events
      </Link>

      {/* hero */}
      <div className="mt-4 overflow-hidden rounded-lg border">
        {event.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.coverImage}
            alt=""
            className="h-48 w-full object-cover sm:h-60"
          />
        ) : (
          <div className="h-24 w-full bg-gradient-to-br from-brand/30 to-brand-deep/20" />
        )}
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          {canceled ? (
            <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              This event has been cancelled.
            </div>
          ) : null}

          <h1 className="text-2xl font-semibold">{event.title}</h1>

          <div className="mt-3 space-y-1.5 text-sm">
            <p className="flex items-center gap-2">
              <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
              <EventTime at={event.startsAt} withDate />
            </p>
            <p className="flex items-center gap-2">
              {event.isVirtual ? (
                <>
                  <Video className="size-4 shrink-0 text-muted-foreground" />
                  Virtual event
                </>
              ) : (
                <>
                  <MapPin className="size-4 shrink-0 text-muted-foreground" />
                  {event.location ?? "Location to be confirmed"}
                </>
              )}
            </p>
          </div>

          {/* RSVP */}
          {!canceled ? (
            <div className="mt-6">
              <RsvpBar eventId={event.id} current={event.myStatus} />
            </div>
          ) : null}

          {/* meeting link, revealed only after RSVP going/maybe */}
          {event.isVirtual ? (
            <div className="mt-4">
              {event.meetingUrl ? (
                <Button asChild variant="outline">
                  <a href={event.meetingUrl} target="_blank" rel="noopener noreferrer">
                    <Video className="mr-2 size-4" /> Join the meeting
                  </a>
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  RSVP going or maybe to reveal the meeting link.
                </p>
              )}
            </div>
          ) : null}

          <div className="mt-4">
            <Button asChild variant="ghost" size="sm">
              <a href={`/api/events/${event.id}/ics`}>
                <CalendarPlus className="mr-2 size-4" /> Add to calendar
              </a>
            </Button>
          </div>

          {event.description ? (
            <>
              <Separator className="my-6" />
              <div className="space-y-3 text-sm leading-relaxed [&_a]:text-brand [&_a]:underline [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5">
                {/* rule 10: react-markdown WITHOUT rehype-raw */}
                <Markdown remarkPlugins={[remarkGfm]}>{event.description}</Markdown>
              </div>
            </>
          ) : null}
        </div>

        {/* sidebar */}
        <aside className="space-y-6">
          <AttendeeList
            title={`Going · ${event.counts.going}`}
            people={event.going}
            empty="No one yet. Be the first."
          />
          <AttendeeList
            title={`Maybe · ${event.counts.maybe}`}
            people={event.maybe}
          />
          {event.counts.declined > 0 ? (
            <DeclinedToggle people={event.declined} />
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function AttendeeList({
  title,
  people,
  empty,
}: {
  title: string;
  people: Person[];
  empty?: string;
}) {
  if (people.length === 0 && !empty) return null;
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {people.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {people.map((p, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <Avatar className="size-7">
                {p.avatarUrl ? <AvatarImage src={p.avatarUrl} alt="" /> : null}
                <AvatarFallback className="text-[11px]">
                  {initials(p.name)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{p.name}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
