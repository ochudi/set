import { notFound } from "next/navigation";

import { PageWrapper } from "@/components/page-wrapper";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  fundraiserStats,
  getAdminFundraiser,
  listFundraiserPledges,
  requireRole,
} from "@/lib/dal";
import { formatNaira } from "@/lib/money";

import { FundraiserForm } from "../fundraiser-form";
import {
  CsvExportButton,
  MarkReceivedButton,
  PostUpdateForm,
} from "../fundraiser-admin";

function toDateInput(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export default async function AdminFundraiserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("exco", "super_admin");
  const { id } = await params;
  const f = await getAdminFundraiser(id);
  if (!f) notFound();

  const [stats, pledges] = await Promise.all([
    fundraiserStats(id),
    listFundraiserPledges(id),
  ]);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return (
    <PageWrapper title={f.title} description={`Status: ${f.status}`}>
      {/* stats */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Pledged" value={formatNaira(stats.pledgedTotal)} />
        <Stat label="Received" value={formatNaira(stats.receivedTotal)} />
        <Stat label="Completion" value={`${stats.completionPercent}%`} />
        <Stat label="Pledgers" value={String(stats.pledgerCount)} />
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        Public page:{" "}
        <a
          href={`${appUrl}/p/${f.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand underline"
        >
          /p/{f.slug}
        </a>
      </p>

      <Separator className="my-6" />
      <h2 className="mb-4 text-lg font-semibold">Details</h2>
      <FundraiserForm
        id={f.id}
        defaults={{
          title: f.title,
          slug: f.slug,
          status: f.status,
          goalNaira: f.goalAmount != null ? String(f.goalAmount / 100) : "",
          startsAt: toDateInput(f.startsAt),
          endsAt: toDateInput(f.endsAt),
          coverImage: f.coverImage ?? "",
          description: f.description ?? "",
        }}
      />

      <Separator className="my-6" />
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Pledges ({pledges.length})</h2>
        {pledges.length > 0 ? (
          <CsvExportButton fundraiserId={f.id} slug={f.slug} />
        ) : null}
      </div>
      {pledges.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          No pledges yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pledger</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Logged by</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pledges.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {p.kind}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNaira(p.amount)}
                  </TableCell>
                  <TableCell className="text-[13px] capitalize text-muted-foreground">
                    {p.channel ?? "—"}
                  </TableCell>
                  <TableCell className="text-[13px] capitalize">
                    {p.status}
                  </TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">
                    {p.loggedBy ?? (p.kind === "external" ? "self (public)" : "—")}
                  </TableCell>
                  <TableCell className="text-right">
                    <MarkReceivedButton
                      pledgeId={p.id}
                      fundraiserId={f.id}
                      received={p.status === "paid"}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Separator className="my-6" />
      <h2 className="mb-4 text-lg font-semibold">Post an update</h2>
      <div className="max-w-xl">
        <PostUpdateForm fundraiserId={f.id} />
      </div>
    </PageWrapper>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
