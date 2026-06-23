"use client";

import Link from "next/link";
import { Video } from "lucide-react";

import type { EventCard } from "@/lib/dal";
import { initials } from "@/lib/member-display";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { EventTime, watDayParts } from "./event-time";

const RSVP_LABEL: Record<string, string> = {
  going: "Going",
  maybe: "Maybe",
  declined: "Can't go",
  waitlist: "Waitlisted",
};

export function EventsBrowser({
  upcoming,
  past,
}: {
  upcoming: EventCard[];
  past: EventCard[];
}) {
  return (
    <Tabs defaultValue="upcoming" className="w-full">
      <TabsList className="mb-6">
        <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
        <TabsTrigger value="past">Past</TabsTrigger>
      </TabsList>
      <TabsContent value="upcoming">
        <EventGrid events={upcoming} empty="No upcoming events yet. Check back soon." />
      </TabsContent>
      <TabsContent value="past">
        <EventGrid events={past} empty="No past events to show." />
      </TabsContent>
    </Tabs>
  );
}

function EventGrid({ events, empty }: { events: EventCard[]; empty: string }) {
  if (events.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        {empty}
      </p>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((e) => (
        <EventCardItem key={e.id} event={e} />
      ))}
    </div>
  );
}

function EventCardItem({ event }: { event: EventCard }) {
  const { day, month } = watDayParts(event.startsAt);
  const canceled = !!event.canceledAt;
  return (
    <Link
      href={`/events/${event.id}`}
      className={cn(
        "group flex flex-col gap-3 rounded-lg border bg-card p-4 transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-brand hover:shadow-sm",
        canceled && "opacity-70",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex w-12 shrink-0 flex-col items-center rounded-md border bg-background py-1.5">
          <span className="text-lg font-semibold leading-none tabular-nums">{day}</span>
          <span className="font-mono text-[11px] uppercase text-muted-foreground">
            {month}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold">{event.title}</h3>
            {canceled ? <Badge variant="destructive">Cancelled</Badge> : null}
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {event.isVirtual ? (
              <span className="inline-flex items-center gap-1">
                <Video className="size-3.5" /> Virtual
              </span>
            ) : (
              (event.location ?? "Location to be confirmed")
            )}
          </p>
          <p className="font-mono text-xs text-muted-foreground">
            <EventTime at={event.startsAt} />
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {event.avatars.map((a, i) => (
              <Avatar key={i} className="size-6 ring-2 ring-card">
                {a.avatarUrl ? <AvatarImage src={a.avatarUrl} alt="" /> : null}
                <AvatarFallback className="text-[10px]">
                  {initials(a.name)}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">
            {event.attendeeCount} going
          </span>
        </div>
        {event.myStatus ? (
          <Badge variant="secondary">{RSVP_LABEL[event.myStatus]}</Badge>
        ) : null}
      </div>
    </Link>
  );
}
