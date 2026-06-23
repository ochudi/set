import { PageWrapper } from "@/components/page-wrapper";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <PageWrapper
      title="Audit log"
      description="Every administrative action, newest first."
    >
      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border bg-card p-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-32" />
        ))}
        <Skeleton className="h-9 w-20" />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border">
        <div className="divide-y">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="size-7 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageWrapper>
  );
}
