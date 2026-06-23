import { PageWrapper } from "@/components/page-wrapper";
import {
  getDailyBulkCap,
  getEmailConfig,
  getOrgSettings,
  listSuperAdminCandidates,
  requireSuperAdmin,
} from "@/lib/dal";

import { DangerZone } from "./danger-zone";
import { SettingsForm } from "./settings-form";

export default async function AdminSettingsPage() {
  await requireSuperAdmin();
  const [org, email, dailyCap, candidates] = await Promise.all([
    getOrgSettings(),
    getEmailConfig(),
    getDailyBulkCap(),
    listSuperAdminCandidates(),
  ]);

  return (
    <PageWrapper
      title="Settings"
      description="Platform configuration. Every control here does something."
    >
      <SettingsForm
        org={{
          name: org.name ?? "",
          contactEmail: org.contactEmail ?? "",
          foundingYear: org.foundingYear ?? "",
        }}
        email={{
          fromName: email.fromName ?? "",
          replyTo: email.replyTo ?? "",
        }}
        dailyCap={dailyCap}
      />
      <div className="mt-6">
        <DangerZone candidates={candidates} />
      </div>
    </PageWrapper>
  );
}
