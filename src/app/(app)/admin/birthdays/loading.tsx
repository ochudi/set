import { PageWrapper } from "@/components/page-wrapper";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <PageWrapper
      title="Birthdays"
      description="Wishes send automatically each morning. Send or re-send by hand here."
    >
      <div className="overflow-hidden rounded-lg border">
        <div className="border-b bg-muted/40 px-4 py-2.5">
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="divide-y">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-8 w-24 shrink-0 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </PageWrapper>
  );
}
