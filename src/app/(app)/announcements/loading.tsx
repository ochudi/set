import { PageWrapper } from "@/components/page-wrapper";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <PageWrapper title="Announcements" description="News from the community.">
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <article key={i} className="rounded-lg border bg-card p-5">
            <Skeleton className="h-5 w-2/3" />
            <div className="mb-3 mt-2 flex items-center gap-2">
              <Skeleton className="size-5 shrink-0 rounded-full" />
              <Skeleton className="h-3 w-40" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </article>
        ))}
      </div>
    </PageWrapper>
  );
}
