import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";

import { PageWrapper } from "@/components/page-wrapper";
import { Badge } from "@/components/ui/badge";
import {
  ACCOUNT_DELETION_GRACE_DAYS,
  getCurrentMember,
  getMemberWithPrivacy,
  listMyPledges,
  listMySessions,
  requireSession,
} from "@/lib/dal";
import { formatNaira } from "@/lib/money";

import { AccountTabs } from "./account-tabs";

export default async function AccountPage() {
  await requireSession();
  const member = await getCurrentMember();
  if (!member) redirect("/welcome");

  // PII (name, phone) is read back through getMemberWithPrivacy so even the
  // self-edit form obeys rule 8; the non-PII flags come off the raw row.
  const self = await getMemberWithPrivacy(member.id);
  const sessions = await listMySessions();
  const pledges = await listMyPledges();

  return (
    <PageWrapper
      title="Your account"
      description="Manage your profile, privacy, and devices."
    >
      <AccountTabs
        profile={{
          firstName: self?.firstName ?? "",
          lastName: self?.lastName ?? "",
          preferredName: self?.preferredName ?? "",
          avatarUrl: self?.avatarUrl ?? "",
          bio: self?.bio ?? "",
          graduationYear: self?.graduationYear ?? null,
          faculty: self?.faculty ?? "",
          programme: self?.programme ?? "",
          phone: self?.phone ?? "",
          city: self?.city ?? "",
          country: self?.country ?? "",
          jobTitle: self?.jobTitle ?? "",
          company: self?.company ?? "",
          linkedinUrl: self?.linkedinUrl ?? "",
        }}
        privacy={{
          profileVisibility: member.profileVisibility,
          emailVisibility: member.emailVisibility,
          phoneVisibility: member.phoneVisibility,
        }}
        notifications={{
          notifyAnnouncements: member.notifyAnnouncements,
          notifyEvents: member.notifyEvents,
          notifyFundraisers: member.notifyFundraisers,
        }}
        sessions={sessions}
        graceDays={ACCOUNT_DELETION_GRACE_DAYS}
      />

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">My pledges</h2>
        {pledges.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            You have not pledged to anything yet.{" "}
            <Link href="/fundraisers" className="text-brand underline">
              Browse fundraisers
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {pledges.map((p, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <Link
                    href={`/fundraisers/${p.campaignId}`}
                    className="font-medium hover:underline"
                  >
                    {p.campaign}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {format(p.pledgedAt, "d MMM yyyy")}
                    {p.channel ? ` · ${p.channel}` : ""}
                    {p.anonymous ? " · anonymous" : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {p.status === "paid" ? (
                    <Badge variant="secondary">received</Badge>
                  ) : p.status === "cancelled" ? (
                    <Badge variant="outline">cancelled</Badge>
                  ) : (
                    <Badge variant="outline">pledged</Badge>
                  )}
                  <span className="tabular-nums">{formatNaira(p.amount)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageWrapper>
  );
}
