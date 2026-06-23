import Link from "next/link";

import { PageWrapper } from "@/components/page-wrapper";
import { Badge } from "@/components/ui/badge";
import {
  listFundraisers,
  type FundraiserCard,
  type FundraiserTab,
} from "@/lib/dal";
import { daysLeft, formatNaira, progressPercent } from "@/lib/money";

const TABS: { key: FundraiserTab; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
  { key: "archived", label: "Archived" },
];

function Card({ f }: { f: FundraiserCard }) {
  const pct = progressPercent(f.raised, f.goalAmount);
  const left = daysLeft(f.endsAt);
  return (
    <Link
      href={`/fundraisers/${f.id}`}
      className="group overflow-hidden rounded-lg border bg-card transition-colors hover:border-brand"
    >
      <div className="aspect-[1200/630] w-full overflow-hidden bg-muted">
        {f.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={f.coverImage} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-brand/30 to-brand-deep/20" />
        )}
      </div>
      <div className="p-4">
        <h3 className="font-semibold leading-snug group-hover:text-brand">
          {f.title}
        </h3>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-brand"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-2 flex items-baseline justify-between text-sm">
          <span className="font-medium">{formatNaira(f.raised)}</span>
          {f.goalAmount ? (
            <span className="text-muted-foreground">
              of {formatNaira(f.goalAmount)}
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {f.pledgerCount} pledger{f.pledgerCount === 1 ? "" : "s"}
          </span>
          {f.status === "active" ? (
            <span>
              {left > 0 ? `${left} day${left === 1 ? "" : "s"} left` : "Ending soon"}
            </span>
          ) : (
            <Badge variant="secondary" className="capitalize">
              {f.status === "closed" ? "completed" : f.status}
            </Badge>
          )}
        </div>
      </div>
    </Link>
  );
}

export default async function FundraisersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const active: FundraiserTab = TABS.some((t) => t.key === tab)
    ? (tab as FundraiserTab)
    : "active";
  const items = await listFundraisers(active);

  return (
    <PageWrapper title="Fundraisers" description="Support the community's goals.">
      <div className="mb-6 flex gap-1 border-b">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/fundraisers?tab=${t.key}`}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              t.key === active
                ? "border-brand font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nothing here yet.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((f) => (
            <Card key={f.id} f={f} />
          ))}
        </div>
      )}
    </PageWrapper>
  );
}
