import Link from "next/link";
import { format } from "date-fns";
import { Pin } from "lucide-react";

import { PageWrapper } from "@/components/page-wrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listAdminAnnouncements } from "@/lib/dal";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  published: "default",
  draft: "secondary",
  archived: "outline",
};

export default async function AdminAnnouncementsPage() {
  const rows = await listAdminAnnouncements();

  return (
    <PageWrapper
      title="Announcements"
      description="Drafts and published posts."
      actions={
        <Button asChild>
          <Link href="/admin/announcements/new">New announcement</Link>
        </Button>
      }
    >
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No announcements yet. Create your first one.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pinned</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/admin/announcements/${a.id}`}
                      className="hover:underline"
                    >
                      {a.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[a.status] ?? "secondary"}>
                      {a.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {a.pinned ? (
                      <Pin className="size-4 text-brand" />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">
                    {format(a.publishedAt ?? a.updatedAt, "d MMM yyyy")}
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
