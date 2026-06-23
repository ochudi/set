import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";

import { PageWrapper } from "@/components/page-wrapper";
import { Button } from "@/components/ui/button";
import { listAuditActions, listAuditActors, listAuditLog } from "@/lib/dal";
import { formatAuditAction } from "@/lib/audit-format";

import { AuditTable } from "./audit-table";

const ENTITY_TYPES = [
  "member",
  "user",
  "event",
  "fundraiser",
  "announcement",
  "invite",
  "setting",
];

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring";

type SP = {
  actor?: string;
  action?: string;
  type?: string;
  from?: string;
  to?: string;
  cursor?: string;
  cursorId?: string;
};

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;

  // listAuditLog / listAuditActors / listAuditActions all call requireSuperAdmin.
  const [page, actors, actions] = await Promise.all([
    listAuditLog({
      actorId: sp.actor || null,
      action: sp.action || null,
      entityType: sp.type || null,
      from: sp.from ? new Date(`${sp.from}T00:00:00`) : null,
      to: sp.to ? new Date(`${sp.to}T23:59:59.999`) : null,
      cursor:
        sp.cursor && sp.cursorId
          ? { createdAt: sp.cursor, id: sp.cursorId }
          : null,
    }),
    listAuditActors(),
    listAuditActions(),
  ]);

  const rows = page.rows.map((r) => ({
    id: r.id,
    relative: formatDistanceToNow(r.createdAt, { addSuffix: true }),
    absolute: format(r.createdAt, "d MMM yyyy, HH:mm"),
    actorName: r.actorName,
    actorAvatarUrl: r.actorAvatarUrl,
    summary: r.summary,
    targetLabel: r.targetLabel,
    targetHref: r.targetHref,
    action: r.action,
    metadata: r.metadata,
  }));

  // Preserve filters across pagination; the cursor carries created_at + id.
  const baseParams = new URLSearchParams();
  if (sp.actor) baseParams.set("actor", sp.actor);
  if (sp.action) baseParams.set("action", sp.action);
  if (sp.type) baseParams.set("type", sp.type);
  if (sp.from) baseParams.set("from", sp.from);
  if (sp.to) baseParams.set("to", sp.to);
  const filtersOnly = baseParams.toString();

  let olderHref: string | null = null;
  if (page.nextCursor) {
    const p = new URLSearchParams(baseParams);
    p.set("cursor", page.nextCursor.createdAt);
    p.set("cursorId", page.nextCursor.id);
    olderHref = `/admin/audit?${p.toString()}`;
  }
  const onFirstPage = !sp.cursor;

  return (
    <PageWrapper
      title="Audit log"
      description="Every administrative action, newest first."
    >
      <form
        method="GET"
        className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border bg-card p-3"
      >
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Actor
          <select name="actor" defaultValue={sp.actor ?? ""} className={selectClass}>
            <option value="">Anyone</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Action
          <select name="action" defaultValue={sp.action ?? ""} className={selectClass}>
            <option value="">Any action</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {formatAuditAction(a, null, null)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Target type
          <select name="type" defaultValue={sp.type ?? ""} className={selectClass}>
            <option value="">Any type</option>
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          From
          <input
            type="date"
            name="from"
            defaultValue={sp.from ?? ""}
            className={selectClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          To
          <input
            type="date"
            name="to"
            defaultValue={sp.to ?? ""}
            className={selectClass}
          />
        </label>
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm">
            Apply
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/audit">Clear</Link>
          </Button>
        </div>
      </form>

      <AuditTable rows={rows} />

      <div className="mt-4 flex items-center justify-between">
        {onFirstPage ? (
          <span />
        ) : (
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/audit${filtersOnly ? `?${filtersOnly}` : ""}`}>
              Newest
            </Link>
          </Button>
        )}
        {olderHref ? (
          <Button asChild variant="outline" size="sm">
            <Link href={olderHref}>Older</Link>
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">End of log</span>
        )}
      </div>
    </PageWrapper>
  );
}
