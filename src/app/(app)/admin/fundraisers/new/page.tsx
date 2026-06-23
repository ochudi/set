import { PageWrapper } from "@/components/page-wrapper";
import { requireRole } from "@/lib/dal";

import { FundraiserForm } from "../fundraiser-form";

export default async function NewFundraiserPage() {
  await requireRole("exco", "super_admin");
  return (
    <PageWrapper title="New campaign" description="Set the goal, story, and dates.">
      <FundraiserForm
        id={null}
        defaults={{
          title: "",
          slug: "",
          status: "draft",
          goalNaira: "",
          startsAt: "",
          endsAt: "",
          coverImage: "",
          description: "",
        }}
      />
    </PageWrapper>
  );
}
