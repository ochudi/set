import Link from "next/link";

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
import { listAdminFundraisers } from "@/lib/dal";
import { formatNaira } from "@/lib/money";

export default async function AdminFundraisersPage() {
  const rows = await listAdminFundraisers();

  return (
    <PageWrapper
      title="Fundraisers"
      description="Create and manage campaigns."
      actions={
        <Button asChild>
          <Link href="/admin/fundraisers/new">New campaign</Link>
        </Button>
      }
    >
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No campaigns yet. Create your first one.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Raised</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead className="text-right">Goal</TableHead>
                <TableHead className="text-right">Pledgers</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/admin/fundraisers/${f.id}`}
                      className="hover:underline"
                    >
                      {f.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {f.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNaira(f.raised)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNaira(f.received)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {f.goalAmount ? formatNaira(f.goalAmount) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {f.pledgerCount}
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
