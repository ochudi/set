import { PageWrapper } from "@/components/page-wrapper";
import { requireRole } from "@/lib/dal";
import { EMPTY_DRAFT } from "@/lib/minutes";

import { MinutesWorkbench } from "../minutes-workbench";

export default async function NewMinutesPage() {
  await requireRole("exco", "super_admin");
  return (
    <PageWrapper
      title="New minutes"
      description="Paste a transcript and your notes, then generate a first draft."
    >
      <MinutesWorkbench initialDraft={EMPTY_DRAFT} initialTranscript="" />
    </PageWrapper>
  );
}
