"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { initials } from "@/lib/member-display";

export type AuditRowView = {
  id: string;
  relative: string;
  absolute: string;
  actorName: string;
  actorAvatarUrl: string | null;
  summary: string;
  targetLabel: string | null;
  targetHref: string | null;
  action: string;
  metadata: Record<string, unknown> | null;
};

export function AuditTable({ rows }: { rows: AuditRowView[] }) {
  const [open, setOpen] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        No matching activity. Try widening the filters.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>When</TableHead>
            <TableHead>Who</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Target</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const isOpen = open === r.id;
            const hasMeta = r.metadata && Object.keys(r.metadata).length > 0;
            return (
              <Fragment key={r.id}>
                <TableRow
                  className="cursor-pointer"
                  onClick={() => setOpen(isOpen ? null : r.id)}
                >
                  <TableCell className="align-top text-muted-foreground">
                    {hasMeta ? (
                      isOpen ? (
                        <ChevronDown className="size-4" />
                      ) : (
                        <ChevronRight className="size-4" />
                      )
                    ) : null}
                  </TableCell>
                  <TableCell className="align-top whitespace-nowrap">
                    <span className="text-sm">{r.relative}</span>
                    <span className="block font-mono text-[11px] text-muted-foreground">
                      {r.absolute}
                    </span>
                  </TableCell>
                  <TableCell className="align-top">
                    <span className="flex items-center gap-2">
                      <Avatar className="size-6">
                        {r.actorAvatarUrl ? (
                          <AvatarImage src={r.actorAvatarUrl} alt="" />
                        ) : null}
                        <AvatarFallback className="text-[10px]">
                          {initials(r.actorName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{r.actorName}</span>
                    </span>
                  </TableCell>
                  <TableCell className="align-top text-sm">{r.summary}</TableCell>
                  <TableCell className="align-top text-sm">
                    {r.targetHref && r.targetLabel ? (
                      <Link
                        href={r.targetHref}
                        className="text-brand hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {r.targetLabel}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">
                        {r.targetLabel ?? "—"}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
                {isOpen && hasMeta ? (
                  <TableRow key={`${r.id}-meta`} className="bg-muted/40">
                    <TableCell />
                    <TableCell colSpan={4} className="py-3">
                      <p className="mb-1 font-mono text-[11px] uppercase text-muted-foreground">
                        {r.action} · metadata
                      </p>
                      <pre className="overflow-x-auto rounded-md border bg-background p-3 font-mono text-xs">
                        {JSON.stringify(r.metadata, null, 2)}
                      </pre>
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
