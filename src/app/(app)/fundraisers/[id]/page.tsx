import Link from "next/link";
import { notFound } from "next/navigation";

import { getFundraiser } from "@/lib/dal";
import { daysLeft, formatNaira, progressPercent } from "@/lib/money";

import { FundraiserTabs } from "./fundraiser-tabs";
import { PledgeModal } from "./pledge-modal";

export default async function FundraiserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const f = await getFundraiser(id);
  if (!f) notFound();

  const pct = progressPercent(f.raised, f.goalAmount);
  const left = daysLeft(f.endsAt);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <Link
        href="/fundraisers"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Fundraisers
      </Link>

      <div className="mt-4 overflow-hidden rounded-lg border">
        {f.coverImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={f.coverImage}
            alt=""
            className="aspect-[1200/630] w-full object-cover"
          />
        ) : (
          <div className="h-32 w-full bg-gradient-to-br from-brand/30 to-brand-deep/20" />
        )}
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{f.title}</h1>
          <FundraiserTabs detail={f} />
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-2xl font-semibold">{formatNaira(f.raised)}</p>
            {f.goalAmount ? (
              <p className="text-sm text-muted-foreground">
                pledged of {formatNaira(f.goalAmount)} goal
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">pledged so far</p>
            )}
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-brand"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span>
                <span className="font-medium">{f.pledgerCount}</span>{" "}
                <span className="text-muted-foreground">
                  pledger{f.pledgerCount === 1 ? "" : "s"}
                </span>
              </span>
              {f.status === "active" ? (
                <span className="text-muted-foreground">
                  {left > 0 ? `${left} day${left === 1 ? "" : "s"} left` : "Ending soon"}
                </span>
              ) : (
                <span className="capitalize text-muted-foreground">
                  {f.status === "closed" ? "completed" : f.status}
                </span>
              )}
            </div>
            <div className="mt-4">
              {f.canPledge ? (
                <PledgeModal fundraiserId={f.id} />
              ) : (
                <p className="text-center text-sm text-muted-foreground">
                  This campaign is not taking pledges right now.
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
