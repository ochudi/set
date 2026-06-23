import { Skeleton } from "@/components/ui/skeleton";

import {
  AnnouncementsSkeleton,
  ColumnSkeleton,
  QuickActionsSkeleton,
  SetCalloutSkeleton,
} from "./sections";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      {/* Welcome strip */}
      <header>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-1 h-5 w-72" />
      </header>

      {/* Quick actions */}
      <QuickActionsSkeleton />

      {/* Three columns */}
      <div className="grid gap-6 lg:grid-cols-3">
        <ColumnSkeleton title="Upcoming events" />
        <ColumnSkeleton title="Birthdays this week" />
        <ColumnSkeleton title="Active campaigns" />
      </div>

      {/* Latest announcements */}
      <AnnouncementsSkeleton />

      {/* Your set */}
      <SetCalloutSkeleton />
    </div>
  );
}
