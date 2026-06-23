import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <Skeleton className="h-5 w-24" />

      <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_280px]">
        <div className="min-w-0">
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Skeleton className="size-24 shrink-0 rounded-full" />
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>

          {/* Stats */}
          <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-28" />
          </div>

          {/* Body */}
          <div className="mt-6 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>

          {/* Contact */}
          <div className="mt-8 space-y-3">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-3/4" />
          </div>
        </div>

        {/* Sidebar */}
        <aside className="space-y-3">
          <Skeleton className="h-4 w-28" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="size-7 shrink-0 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
