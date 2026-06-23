"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, LayoutGrid, List, Search } from "lucide-react";

import type { DirectoryMember } from "@/lib/dal";
import { displayName, initials } from "@/lib/member-display";
import { cn } from "@/lib/utils";
import { LinkedinIcon } from "@/components/icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type View = "grid" | "list";

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring";

function nameOf(m: DirectoryMember) {
  return displayName(m);
}

function setLabel(year: number | null) {
  return year ? `Set of ${year}` : "Set unknown";
}

export function DirectoryBrowser({ members }: { members: DirectoryMember[] }) {
  // Seed filters from the URL so deep links like /directory?year=2010 (the
  // dashboard "Browse my set" pill) land pre-filtered. State is then local.
  const params = useSearchParams();
  const [query, setQuery] = useState("");
  const [faculty, setFaculty] = useState(() => params.get("faculty") ?? "");
  const [year, setYear] = useState(() => params.get("year") ?? "");
  const [view, setView] = useState<View>("grid");

  const faculties = useMemo(
    () =>
      Array.from(
        new Set(members.map((m) => m.faculty).filter(Boolean) as string[]),
      ).sort(),
    [members],
  );
  const years = useMemo(
    () =>
      Array.from(
        new Set(
          members.map((m) => m.graduationYear).filter(Boolean) as number[],
        ),
      ).sort((a, b) => b - a),
    [members],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((m) => {
      if (q) {
        const haystack = [nameOf(m), m.company, m.jobTitle, m.city]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (faculty && m.faculty !== faculty) return false;
      if (year && String(m.graduationYear) !== year) return false;
      return true;
    });
  }, [members, query, faculty, year]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-48">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, role, company"
            className="pl-8"
            aria-label="Search members"
          />
        </div>

        <select
          value={faculty}
          onChange={(e) => setFaculty(e.target.value)}
          className={selectClass}
          aria-label="Filter by faculty"
        >
          <option value="">All schools</option>
          {faculties.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>

        <select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className={selectClass}
          aria-label="Filter by set"
        >
          <option value="">All sets</option>
          {years.map((y) => (
            <option key={y} value={String(y)}>
              Set of {y}
            </option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-1">
          <Button
            type="button"
            variant={view === "grid" ? "secondary" : "ghost"}
            size="icon"
            aria-label="Grid view"
            aria-pressed={view === "grid"}
            onClick={() => setView("grid")}
          >
            <LayoutGrid className="size-4" />
          </Button>
          <Button
            type="button"
            variant={view === "list" ? "secondary" : "ghost"}
            size="icon"
            aria-label="List view"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            <List className="size-4" />
          </Button>
        </div>
      </div>

      <p className="font-mono text-xs text-muted-foreground">
        Showing {filtered.length} of {members.length}
      </p>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No members match your filters. Try clearing the search.
        </p>
      ) : view === "grid" ? (
        <GridView members={filtered} />
      ) : (
        <ListView members={filtered} />
      )}
    </div>
  );
}

function MemberAvatar({ m, size }: { m: DirectoryMember; size: string }) {
  const name = nameOf(m);
  return (
    <Avatar className={size}>
      {m.avatarUrl ? <AvatarImage src={m.avatarUrl} alt="" /> : null}
      <AvatarFallback>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}

function GridView({ members }: { members: DirectoryMember[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {members.map((m) => {
        const name = nameOf(m);
        const role = [m.jobTitle, m.city].filter(Boolean).join(" · ");
        return (
          <Link
            key={m.id}
            href={`/directory/${m.id}`}
            className="group flex flex-col gap-3 rounded-lg border bg-card p-4 transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-brand hover:shadow-sm focus-visible:border-brand"
          >
            <div className="flex items-start gap-3">
              <MemberAvatar m={m} size="size-12" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-base font-semibold">
                    {name}
                  </span>
                  {m.role !== "member" ? (
                    <Badge variant="secondary" className="shrink-0 capitalize">
                      {m.role === "super_admin" ? "Admin" : "Exco"}
                    </Badge>
                  ) : null}
                </div>
                <p className="truncate font-mono text-[13px] text-muted-foreground">
                  {[m.faculty, setLabel(m.graduationYear)]
                    .filter(Boolean)
                    .join(" / ")}
                </p>
              </div>
            </div>
            {role ? (
              <p className="truncate text-sm text-muted-foreground">{role}</p>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}

function ListView({ members }: { members: DirectoryMember[] }) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "name", desc: false },
  ]);

  const columns = useMemo<ColumnDef<DirectoryMember>[]>(
    () => [
      {
        id: "name",
        accessorFn: (m) => nameOf(m),
        header: ({ column }) => <SortHeader column={column}>Name</SortHeader>,
        cell: ({ row }) => {
          const m = row.original;
          return (
            <Link
              href={`/directory/${m.id}`}
              className="flex items-center gap-3 font-medium hover:underline"
            >
              <MemberAvatar m={m} size="size-8" />
              <span className="truncate">{nameOf(m)}</span>
            </Link>
          );
        },
      },
      {
        id: "set",
        accessorFn: (m) => m.graduationYear ?? 0,
        header: ({ column }) => <SortHeader column={column}>Set</SortHeader>,
        cell: ({ row }) => (
          <span className="font-mono text-[13px] text-muted-foreground">
            {row.original.graduationYear ?? "—"}
          </span>
        ),
      },
      {
        id: "city",
        accessorFn: (m) => m.city ?? "",
        header: ({ column }) => <SortHeader column={column}>City</SortHeader>,
        cell: ({ row }) => row.original.city ?? "—",
      },
      {
        id: "linkedin",
        header: () => <span className="sr-only">LinkedIn</span>,
        enableSorting: false,
        cell: ({ row }) =>
          row.original.linkedinUrl ? (
            <a
              href={normalizeUrl(row.original.linkedinUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex text-muted-foreground hover:text-foreground"
              aria-label={`${nameOf(row.original)} on LinkedIn`}
              onClick={(e) => e.stopPropagation()}
            >
              <LinkedinIcon />
            </a>
          ) : null,
      },
    ],
    [],
  );

  const table = useReactTable({
    data: members,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead key={h.id} className="text-[13px]">
                  {h.isPlaceholder
                    ? null
                    : flexRender(h.column.columnDef.header, h.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} className="text-[13px]">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SortHeader({
  column,
  children,
}: {
  column: { toggleSorting: (desc?: boolean) => void; getIsSorted: () => false | "asc" | "desc" };
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1 hover:text-foreground",
        column.getIsSorted() && "text-foreground",
      )}
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {children}
      <ArrowUpDown className="size-3" />
    </button>
  );
}

function normalizeUrl(url: string) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}
