import { PageWrapper } from "@/components/page-wrapper";
import { listExco, requireRole } from "@/lib/dal";

import { ExcoManager } from "./exco-manager";

export default async function AdminExcoPage() {
  await requireRole("exco", "super_admin");
  const members = await listExco();
  return (
    <PageWrapper
      title="Leadership"
      description="Manage the executive council and alumni office shown to members."
    >
      <ExcoManager members={members} />
    </PageWrapper>
  );
}
