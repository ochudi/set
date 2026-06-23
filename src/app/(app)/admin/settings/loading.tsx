import { PageWrapper } from "@/components/page-wrapper";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <PageWrapper
      title="Settings"
      description="Platform configuration. Every control here does something."
    >
      <div className="space-y-6">
        {Array.from({ length: 2 }).map((_, s) => (
          <section key={s} className="space-y-4 rounded-lg border bg-card p-5">
            <Skeleton className="h-5 w-40" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-10 w-full max-w-md" />
              </div>
            ))}
            <Skeleton className="h-9 w-28" />
          </section>
        ))}

        {/* Danger zone */}
        <section className="space-y-3 rounded-lg border border-destructive/30 bg-card p-5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full max-w-lg" />
          <Skeleton className="h-9 w-40" />
        </section>
      </div>
    </PageWrapper>
  );
}
