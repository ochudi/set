"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { format } from "date-fns";
import { ArrowUpDown, Download, MoreHorizontal, Search, Upload, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { initials } from "@/lib/member-display";
import { cn } from "@/lib/utils";
import { PAU_FACULTIES } from "@/lib/pau";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  bulkSuspendAction,
  changeRole,
  deleteMemberAction,
  exportCsvAction,
  resendInviteAction,
  revokeInviteAction,
  sendInvitesAction,
  setStatus,
} from "./actions";
import { AddMemberSheet } from "./add-member-sheet";
import { EditMemberSheet } from "./edit-member-sheet";
import { ImportCsvDialog } from "./import-csv-dialog";

type Role = "member" | "exco" | "super_admin";

export type RosterRow = {
  kind: "member" | "invite";
  id: string;
  userId: string | null;
  name: string;
  email: string;
  graduationYear: number | null;
  faculty: string | null;
  role: Role;
  status: "active" | "invited" | "suspended" | "deactivated";
  joinedAt: Date;
  lastSignInAt: Date | null;
  avatarUrl: string | null;
};

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring";

function downloadCsv(csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `set-members-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

type Confirm = {
  title: string;
  body: string;
  confirmLabel: string;
  destructive?: boolean;
  run: () => Promise<{ ok: boolean; error?: string }>;
};

export function MembersAdmin({
  rows,
  viewerId,
  isSuperAdmin,
}: {
  rows: RosterRow[];
  viewerId: string;
  isSuperAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [query, setQuery] = useState("");
  const [faculty, setFaculty] = useState("");
  const [year, setYear] = useState("");
  const [status, setStatusFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([{ id: "name", desc: false }]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const [editTarget, setEditTarget] = useState<RosterRow | null>(null);
  const [roleTarget, setRoleTarget] = useState<RosterRow | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const stats = useMemo(() => {
    let active = 0;
    let invited = 0;
    let suspended = 0;
    const sets = new Set<number>();
    for (const r of rows) {
      if (r.status === "active") active++;
      else if (r.status === "invited") invited++;
      else if (r.status === "suspended") suspended++;
      if (r.kind === "member" && r.graduationYear) sets.add(r.graduationYear);
    }
    return { active, invited, suspended, sets: sets.size };
  }, [rows]);

  const years = useMemo(
    () =>
      Array.from(
        new Set(rows.map((r) => r.graduationYear).filter(Boolean) as number[]),
      ).sort((a, b) => b - a),
    [rows],
  );

  const data = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !`${r.name} ${r.email}`.toLowerCase().includes(q)) return false;
      if (faculty && r.faculty !== faculty) return false;
      if (year && String(r.graduationYear) !== year) return false;
      if (status && r.status !== status) return false;
      return true;
    });
  }, [rows, query, faculty, year, status]);

  function runAction(c: Confirm) {
    startTransition(async () => {
      const res = await c.run();
      if (res.ok) {
        toast.success("Done");
        router.refresh();
      } else {
        toast.error(res.error ?? "Something went wrong");
      }
      setConfirm(null);
    });
  }

  const columns = useMemo<ColumnDef<RosterRow>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllRowsSelected()
                ? true
                : table.getIsSomeRowsSelected()
                  ? "indeterminate"
                  : false
            }
            onCheckedChange={(v) => table.toggleAllRowsSelected(!!v)}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
      },
      {
        id: "name",
        accessorFn: (r) => r.name,
        header: ({ column }) => <SortHeader column={column}>Name</SortHeader>,
        cell: ({ row }) => {
          const r = row.original;
          const inner = (
            <span className="flex items-center gap-3">
              <Avatar className="size-8">
                {r.avatarUrl ? <AvatarImage src={r.avatarUrl} alt="" /> : null}
                <AvatarFallback>{initials(r.name)}</AvatarFallback>
              </Avatar>
              <span className="truncate font-medium">{r.name}</span>
            </span>
          );
          return r.kind === "member" ? (
            <Link href={`/directory/${r.id}`} className="hover:underline">
              {inner}
            </Link>
          ) : (
            inner
          );
        },
      },
      {
        id: "email",
        accessorFn: (r) => r.email,
        header: "Email",
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.email}</span>
        ),
      },
      {
        id: "set",
        accessorFn: (r) => r.graduationYear ?? 0,
        header: ({ column }) => <SortHeader column={column}>Set</SortHeader>,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.graduationYear ?? "—"}
          </span>
        ),
      },
      {
        id: "role",
        accessorFn: (r) => r.role,
        header: "Role",
        cell: ({ row }) => <RoleBadge role={row.original.role} />,
      },
      {
        id: "status",
        accessorFn: (r) => r.status,
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "joined",
        accessorFn: (r) => r.joinedAt.getTime(),
        header: ({ column }) => <SortHeader column={column}>Joined</SortHeader>,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {format(row.original.joinedAt, "d MMM yyyy")}
          </span>
        ),
      },
      {
        id: "lastSignIn",
        accessorFn: (r) => r.lastSignInAt?.getTime() ?? 0,
        header: "Last sign-in",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original.lastSignInAt
              ? format(row.original.lastSignInAt, "d MMM yyyy")
              : "—"}
          </span>
        ),
      },
      {
        id: "actions",
        enableSorting: false,
        cell: ({ row }) => (
          <RowMenu
            row={row.original}
            viewerId={viewerId}
            isSuperAdmin={isSuperAdmin}
            onEdit={() => setEditTarget(row.original)}
            onChangeRole={() => setRoleTarget(row.original)}
            onConfirm={setConfirm}
            onResend={(r) =>
              startTransition(async () => {
                const res = await resendInviteAction(r.id);
                if (res.ok)
                  toast.success(res.sent ? "Invite re-sent" : "Invite updated (email not sent)");
                else toast.error(res.error ?? "Could not resend");
                router.refresh();
              })
            }
          />
        ),
      },
    ],
    [viewerId, isSuperAdmin, router],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, rowSelection },
    getRowId: (r) => r.id,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const selected = table.getSelectedRowModel().rows.map((r) => r.original);
  const selectedSuspendable = selected.filter(
    (r) => r.kind === "member" && r.status === "active" && r.userId,
  );
  const selectedInvites = selected.filter((r) => r.kind === "invite");

  function bulkSuspend() {
    const ids = selectedSuspendable.map((r) => r.userId!).filter(Boolean);
    if (ids.length === 0) return;
    startTransition(async () => {
      const res = await bulkSuspendAction(ids);
      toast.success(`Suspended ${res.suspended}, skipped ${res.skipped}`);
      setRowSelection({});
      router.refresh();
    });
  }

  function bulkSendInvites() {
    const ids = selectedInvites.map((r) => r.id);
    if (ids.length === 0) return;
    startTransition(async () => {
      const res = await sendInvitesAction(ids);
      toast.success(`Sent ${res.sent}${res.failed ? `, ${res.failed} failed` : ""}`);
      setRowSelection({});
      router.refresh();
    });
  }

  function bulkExport() {
    const ids = selected.map((r) => r.id);
    startTransition(async () => {
      const res = await exportCsvAction(ids);
      downloadCsv(res.csv);
      toast.success(
        `Exported ${res.count} row${res.count === 1 ? "" : "s"}${
          res.capped ? " (capped at 1,000)" : ""
        }`,
      );
    });
  }

  return (
    <div className="space-y-5">
      {/* stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Active" value={stats.active} />
        <Stat label="Invited" value={stats.invited} />
        <Stat label="Suspended" value={stats.suspended} />
        <Stat label="Sets" value={stats.sets} />
      </div>

      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-48">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or email"
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
          {PAU_FACULTIES.map((f) => (
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
              {y}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={selectClass}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="invited">Invited</option>
          <option value="suspended">Suspended</option>
        </select>
        <div className="ml-auto flex items-center gap-2">
          <ImportCsvDialog>
            <Button variant="outline">
              <Upload className="mr-2 size-4" /> Import CSV
            </Button>
          </ImportCsvDialog>
          <AddMemberSheet isSuperAdmin={isSuperAdmin}>
            <Button>
              <UserPlus className="mr-2 size-4" /> Add member
            </Button>
          </AddMemberSheet>
        </div>
      </div>

      {/* bulk bar */}
      {selected.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          <span className="font-medium">{selected.length} selected</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={pending || selectedSuspendable.length === 0}
              onClick={bulkSuspend}
            >
              Suspend ({selectedSuspendable.length})
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending || selectedInvites.length === 0}
              onClick={bulkSendInvites}
            >
              Send invites ({selectedInvites.length})
            </Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={bulkExport}>
              <Download className="mr-2 size-4" /> Export CSV
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRowSelection({})}>
              Clear
            </Button>
          </div>
        </div>
      ) : null}

      <p className="font-mono text-xs text-muted-foreground">
        Showing {data.length} of {rows.length}
      </p>

      {/* table */}
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id} className="text-xs">
                    {h.isPlaceholder
                      ? null
                      : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  No members match your filters.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="text-[13px]">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* edit sheet */}
      <EditMemberSheet
        member={editTarget}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
      />

      {/* change-role dialog */}
      <RoleDialog
        member={roleTarget}
        onOpenChange={(open) => {
          if (!open) setRoleTarget(null);
        }}
      />

      {/* confirm dialog */}
      <Dialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          {confirm ? (
            <>
              <DialogHeader>
                <DialogTitle>{confirm.title}</DialogTitle>
                <DialogDescription>{confirm.body}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setConfirm(null)}>
                  Cancel
                </Button>
                <Button
                  variant={confirm.destructive ? "destructive" : "default"}
                  disabled={pending}
                  onClick={() => runAction(confirm)}
                >
                  {confirm.confirmLabel}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function RoleBadge({ role }: { role: Role }) {
  if (role === "super_admin")
    return <Badge className="bg-primary text-primary-foreground">Admin</Badge>;
  if (role === "exco") return <Badge variant="secondary">Exco</Badge>;
  return <span className="text-xs text-muted-foreground">Member</span>;
}

function StatusBadge({ status }: { status: RosterRow["status"] }) {
  const map: Record<RosterRow["status"], { label: string; cls: string }> = {
    active: { label: "Active", cls: "bg-emerald-600/10 text-emerald-700 dark:text-emerald-400" },
    invited: { label: "Invited", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
    suspended: { label: "Suspended", cls: "bg-destructive/10 text-destructive" },
    deactivated: { label: "Deactivated", cls: "bg-muted text-muted-foreground" },
  };
  const s = map[status];
  return (
    <span className={cn("inline-flex rounded-md px-2 py-0.5 text-xs font-medium", s.cls)}>
      {s.label}
    </span>
  );
}

function SortHeader({
  column,
  children,
}: {
  column: {
    toggleSorting: (desc?: boolean) => void;
    getIsSorted: () => false | "asc" | "desc";
  };
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 hover:text-foreground"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {children}
      <ArrowUpDown className="size-3" />
    </button>
  );
}

function RowMenu({
  row,
  viewerId,
  isSuperAdmin,
  onEdit,
  onChangeRole,
  onConfirm,
  onResend,
}: {
  row: RosterRow;
  viewerId: string;
  isSuperAdmin: boolean;
  onEdit: () => void;
  onChangeRole: () => void;
  onConfirm: (c: Confirm) => void;
  onResend: (row: RosterRow) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Row actions">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {row.kind === "invite" ? (
          <>
            <DropdownMenuItem onSelect={() => onResend(row)}>
              Resend invite
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onSelect={() =>
                onConfirm({
                  title: "Revoke invite",
                  body: `Revoke the invitation for ${row.email}? The link will stop working.`,
                  confirmLabel: "Revoke",
                  destructive: true,
                  run: () => revokeInviteAction(row.id),
                })
              }
            >
              Revoke invite
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem onSelect={onEdit}>Edit</DropdownMenuItem>
            {isSuperAdmin ? (
              <DropdownMenuItem onSelect={onChangeRole}>Change role</DropdownMenuItem>
            ) : null}
            {row.status === "active" ? (
              <DropdownMenuItem
                onSelect={() =>
                  onConfirm({
                    title: "Suspend member",
                    body: `Suspend ${row.name}? They will be signed out immediately and cannot sign back in until reactivated.`,
                    confirmLabel: "Suspend",
                    destructive: true,
                    run: () => setStatus(row.userId!, "suspend"),
                  })
                }
              >
                Suspend
              </DropdownMenuItem>
            ) : row.status === "suspended" ? (
              <DropdownMenuItem
                onSelect={() =>
                  onConfirm({
                    title: "Reactivate member",
                    body: `Reactivate ${row.name}? They will be able to sign in again.`,
                    confirmLabel: "Reactivate",
                    run: () => setStatus(row.userId!, "reactivate"),
                  })
                }
              >
                Reactivate
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onSelect={() =>
                onConfirm({
                  title: "Delete member",
                  body: `Delete ${row.name}? Their profile is hidden immediately and permanently removed after the grace period. Pledges and event history are kept as "Deleted member".`,
                  confirmLabel: "Delete",
                  destructive: true,
                  run: () => deleteMemberAction(row.id),
                })
              }
            >
              Delete
            </DropdownMenuItem>
          </>
        )}
        {row.userId && row.userId === viewerId ? (
          <p className="px-2 py-1 text-[11px] text-muted-foreground">This is you</p>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RoleDialog({
  member,
  onOpenChange,
}: {
  member: RosterRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [role, setRole] = useState<Role>("member");
  const open = !!member;

  // Initialise the select to the target's current role whenever it changes.
  useEffect(() => {
    if (member) setRole(member.role);
  }, [member]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change role</DialogTitle>
          <DialogDescription>
            {member ? `Set the platform role for ${member.name}.` : ""}
          </DialogDescription>
        </DialogHeader>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className={cn(selectClass, "w-full")}
        >
          <option value="member">Member</option>
          <option value="exco">Exco</option>
          <option value="super_admin">Super admin</option>
        </select>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={pending}
            onClick={() => {
              if (!member?.userId) return;
              startTransition(async () => {
                const res = await changeRole(member.userId!, role);
                if (res.ok) {
                  toast.success("Role updated");
                  router.refresh();
                  onOpenChange(false);
                } else {
                  toast.error(res.error ?? "Could not change role");
                }
              });
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
