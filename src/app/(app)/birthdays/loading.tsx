import { PageWrapper } from "@/components/page-wrapper";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <PageWrapper title="Birthdays" description="Celebrate fellow members.">
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Calendar */}
        <Skeleton className="h-80 w-full rounded-lg" />

        {/* Month groups */}
        <div className="space-y-6">
          {Array.from({ length: 2 }).map((_, g) => (
            <section key={g}>
              <Skeleton className="mb-2 h-4 w-24" />
              <div className="divide-y rounded-lg border">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2">
                    <Skeleton className="size-4 w-7 shrink-0" />
                    <Skeleton className="size-8 shrink-0 rounded-full" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </PageWrapper>
  );
}
