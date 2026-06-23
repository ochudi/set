import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <Skeleton className="h-5 w-28" />

      {/* Cover */}
      <Skeleton className="mt-4 aspect-[1200/630] w-full rounded-lg" />

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          <Skeleton className="h-7 w-2/3" />
          <div className="mt-4 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>

        {/* Sidebar stats card */}
        <aside>
          <div className="space-y-3 rounded-lg border bg-card p-4">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-2 w-full rounded-full" />
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
        </aside>
      </div>
    </div>
  );
}
