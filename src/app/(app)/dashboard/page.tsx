import { Suspense } from "react";
import { redirect } from "next/navigation";

import { getCurrentMember, requireSession } from "@/lib/dal";

import { Greeting } from "./greeting";
import { Reveal } from "./reveal";
import {
  AnnouncementsSkeleton,
  BirthdaysColumn,
  CampaignsColumn,
  ColumnSkeleton,
  DashboardSubtitle,
  EventsColumn,
  LatestAnnouncements,
  QuickActions,
  QuickActionsSkeleton,
  SetCallout,
  SetCalloutSkeleton,
  SubtitleSkeleton,
} from "./sections";

export default async function DashboardPage() {
  await requireSession();
  const member = await getCurrentMember();
  if (!member) redirect("/welcome");
  const name = member.preferredName || member.firstName || "there";

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      {/* Welcome strip */}
      <header>
        <Greeting name={name} />
        <Suspense fallback={<SubtitleSkeleton />}>
          <DashboardSubtitle />
        </Suspense>
      </header>

      {/* Quick actions */}
      <Suspense fallback={<QuickActionsSkeleton />}>
        <QuickActions member={member} />
      </Suspense>

      {/* Three columns */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Reveal index={0}>
          <Suspense fallback={<ColumnSkeleton title="Upcoming events" />}>
            <EventsColumn />
          </Suspense>
        </Reveal>
        <Reveal index={1}>
          <Suspense fallback={<ColumnSkeleton title="Birthdays this week" />}>
            <BirthdaysColumn />
          </Suspense>
        </Reveal>
        <Reveal index={2}>
          <Suspense fallback={<ColumnSkeleton title="Active campaigns" />}>
            <CampaignsColumn />
          </Suspense>
        </Reveal>
      </div>

      {/* Latest announcements */}
      <Reveal index={3}>
        <Suspense fallback={<AnnouncementsSkeleton />}>
          <LatestAnnouncements />
        </Suspense>
      </Reveal>

      {/* Your set */}
      <Reveal index={4}>
        <Suspense fallback={<SetCalloutSkeleton />}>
          <SetCallout member={member} />
        </Suspense>
      </Reveal>
    </div>
  );
}
