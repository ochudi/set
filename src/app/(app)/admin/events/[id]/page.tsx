import { notFound } from "next/navigation";
import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

import { PageWrapper } from "@/components/page-wrapper";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAdminEvent, listEventRsvps } from "@/lib/dal";

import { EventForm, type EventFormValues } from "../event-form";
import { EventControls } from "./event-controls";

function toLocal(d: Date): string {
  return formatInTimeZone(new Date(d), "Africa/Lagos", "yyyy-MM-dd'T'HH:mm");
}

export default async function AdminEventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ev = await getAdminEvent(id);
  if (!ev) notFound();

  const rsvps = await listEventRsvps(id);
  const now = new Date();
  const status: "draft" | "published" | "past" | "canceled" = ev.canceledAt
    ? "canceled"
    : !ev.publishedAt
      ? "draft"
      : ev.startsAt < now
        ? "past"
        : "published";

  const defaults: EventFormValues = {
    title: ev.title,
    description: ev.description ?? "",
    isVirtual: ev.isVirtual,
    location: ev.location ?? "",
    meetingUrl: ev.meetingUrl ?? "",
    startsAtLocal: toLocal(ev.startsAt),
    endsAtLocal: ev.endsAt ? toLocal(ev.endsAt) : "",
    capacity: ev.capacity ? String(ev.capacity) : "",
    coverImage: ev.coverImage ?? "",
  };

  return (
    <PageWrapper title={ev.title} description={`Status: ${status}`}>
      <EventControls eventId={ev.id} status={status} />

      <Separator className="my-6" />
      <h2 className="mb-4 text-lg font-semibold">Details</h2>
      <EventForm mode="edit" eventId={ev.id} defaults={defaults} />

      <Separator className="my-6" />
      <h2 className="mb-4 text-lg font-semibold">RSVPs ({rsvps.length})</h2>
      {rsvps.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No RSVPs yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Guests</TableHead>
                <TableHead>Responded</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rsvps.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">
                    {r.email}
                  </TableCell>
                  <TableCell className="text-[13px] capitalize">{r.status}</TableCell>
                  <TableCell className="text-right text-[13px] tabular-nums">
                    {r.guests}
                  </TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">
                    {format(r.respondedAt, "d MMM yyyy")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </PageWrapper>
  );
}
