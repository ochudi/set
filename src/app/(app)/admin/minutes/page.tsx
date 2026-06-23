import Link from "next/link";
import { format } from "date-fns";
import { FileText, Plus } from "lucide-react";

import { PageWrapper } from "@/components/page-wrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listMinutes, requireRole } from "@/lib/dal";

export default async function MinutesListPage() {
  await requireRole("exco", "super_admin");
  const rows = await listMinutes();

  return (
    <PageWrapper
      title="Meeting minutes"
      description="Turn a transcript into clean minutes, edit, then export."
      actions={
        <Button asChild>
          <Link href="/admin/minutes/new">
            <Plus className="size-4" /> New minutes
          </Link>
        </Button>
      }
    >
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <FileText className="mx-auto mb-3 size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No minutes yet. Paste a transcript to create your first set.
          </p>
          <Button asChild className="mt-4">
            <Link href="/admin/minutes/new">Create minutes</Link>
          </Button>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/admin/minutes/${r.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.meetingDate
                      ? format(new Date(r.meetingDate), "d MMM yyyy")
                      : "No date"}{" "}
                    · edited {format(r.updatedAt, "d MMM")}
                  </p>
                </div>
                <Badge variant={r.status === "final" ? "secondary" : "outline"}>
                  {r.status}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageWrapper>
  );
}
