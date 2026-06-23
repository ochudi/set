import { format } from "date-fns";

import { PageWrapper } from "@/components/page-wrapper";
import {
  getSessionUser,
  listAdminRoster,
  listDeletedMembers,
} from "@/lib/dal";

import { MembersAdmin } from "./members-admin";
import { RestoreButton } from "./restore-button";

export default async function AdminMembersPage() {
  // The /admin layout restricts this to exco+. Role change, restore and the
  // deleted-accounts panel are gated to super admins (server-enforced too).
  const user = await getSessionUser();
  const isSuperAdmin = user?.role === "super_admin";

  const [roster, deleted] = await Promise.all([
    listAdminRoster(),
    isSuperAdmin ? listDeletedMembers() : Promise.resolve([]),
  ]);

  return (
    <PageWrapper
      title="Members"
      description="Manage member accounts and invitations."
    >
      <MembersAdmin
        rows={roster}
        viewerId={user?.id ?? ""}
        isSuperAdmin={isSuperAdmin}
      />

      {isSuperAdmin && deleted.length > 0 ? (
        <section className="mt-12">
          <h2 className="text-lg font-semibold">Deleted accounts</h2>
          <p className="mb-3 mt-1 text-sm text-muted-foreground">
            Restore within the grace window to reactivate; once it lapses the
            account is anonymised and cannot be recovered.
          </p>
          <ul className="divide-y rounded-lg border">
            {deleted.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{m.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {m.email} · deleted {format(m.deletedAt, "d MMM yyyy")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {m.expired
                      ? `Grace expired ${format(m.restorableUntil, "d MMM yyyy")}`
                      : `Restorable until ${format(m.restorableUntil, "d MMM yyyy")}`}
                  </span>
                  <RestoreButton id={m.id} disabled={m.expired} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </PageWrapper>
  );
}
