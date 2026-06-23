import { notFound } from "next/navigation";

import { PageWrapper } from "@/components/page-wrapper";
import { getMinutes, requireRole } from "@/lib/dal";

import { MinutesWorkbench } from "../minutes-workbench";

export default async function EditMinutesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("exco", "super_admin");
  const { id } = await params;
  const m = await getMinutes(id);
  if (!m) notFound();

  return (
    <PageWrapper title="Edit minutes" description="Review, edit, then export.">
      <MinutesWorkbench
        id={m.id}
        initialTranscript={m.rawTranscript ?? ""}
        initialDraft={{
          title: m.title,
          meetingDate: m.meetingDate ?? "",
          location: m.location ?? "",
          facilitator: m.facilitator ?? "",
          minutesBy: m.minutesBy ?? "",
          attendees: m.attendees,
          sections: m.sections,
          actionItems: m.actionItems,
          decisions: m.decisions,
        }}
      />
    </PageWrapper>
  );
}
