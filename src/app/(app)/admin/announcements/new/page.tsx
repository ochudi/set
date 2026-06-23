import { PageWrapper } from "@/components/page-wrapper";
import { announcementRecipientCount, requireRole } from "@/lib/dal";

import { AnnouncementForm } from "../announcement-form";

export default async function NewAnnouncementPage() {
  await requireRole("exco", "super_admin");
  const recipientCount = await announcementRecipientCount();

  return (
    <PageWrapper
      title="New announcement"
      description="Write in markdown, preview, then save or publish."
    >
      <AnnouncementForm
        id={null}
        defaults={{ title: "", body: "", pinned: false }}
        recipientCount={recipientCount}
      />
    </PageWrapper>
  );
}
