"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { Video } from "lucide-react";

import type { AdminEventRow } from "@/lib/dal";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring";

const STATUS: Record<AdminEventRow["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
  past: "bg-muted text-muted-foreground",
  canceled: "bg-destructive/10 text-destructive",
};

export function EventsTable({ rows }: { rows: AdminEventRow[] }) {
  const [status, setStatus] = useState("");

  const filtered = useMemo(
    () => (status ? rows.filter((r) => r.status === status) : rows),
    [rows, status],
  );

  return (
    <div className="space-y-3">
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className={selectClass}
        aria-label="Filter by status"
      >
        <option value="">All events</option>
        <option value="draft">Draft</option>
        <option value="published">Published</option>
        <option value="past">Past</option>
        <option value="canceled">Cancelled</option>
      </select>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead>When (WAT)</TableHead>
              <TableHead>Where</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Going</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                  No events.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link
                      href={`/admin/events/${r.id}`}
                      className="font-medium hover:underline"
                    >
                      {r.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">
                    {formatInTimeZone(
                      new Date(r.startsAt),
                      "Africa/Lagos",
                      "d MMM yyyy, HH:mm",
                    )}
                  </TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">
                    {r.isVirtual ? (
                      <span className="inline-flex items-center gap-1">
                        <Video className="size-3.5" /> Virtual
                      </span>
                    ) : (
                      (r.location ?? "—")
                    )}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex rounded-md px-2 py-0.5 text-xs font-medium capitalize",
                        STATUS[r.status],
                      )}
                    >
                      {r.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-[13px] tabular-nums">
                    {r.goingCount}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
