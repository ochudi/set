import { notFound } from "next/navigation";

import { PageWrapper } from "@/components/page-wrapper";
import {
  announcementRecipientCount,
  getAdminAnnouncement,
  requireRole,
} from "@/lib/dal";

import { AnnouncementForm } from "../announcement-form";

export default async function EditAnnouncementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("exco", "super_admin");
  const { id } = await params;
  const a = await getAdminAnnouncement(id);
  if (!a) notFound();

  const recipientCount = await announcementRecipientCount();

  return (
    <PageWrapper title="Edit announcement" description={`Status: ${a.status}`}>
      <AnnouncementForm
        id={a.id}
        defaults={{ title: a.title, body: a.body, pinned: a.pinned }}
        recipientCount={recipientCount}
      />
    </PageWrapper>
  );
}
