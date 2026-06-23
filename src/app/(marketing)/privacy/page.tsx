import type { Metadata } from "next";

import { getSetting } from "@/lib/dal";

// Privacy policy: accurate to what the platform does today and aligned with the
// Nigeria Data Protection Act (NDPA). Counsel must review and sign this off
// before launch.
const description =
  "How Set collects, uses, retains, and protects the personal data of PAU alumni, aligned with the Nigeria Data Protection Act.";

export const metadata: Metadata = {
  title: "Privacy policy",
  description,
  robots: { index: true, follow: true },
};

export default async function PrivacyPage() {
  const contactEmail = await getSetting("org_contact_email");

  return (
    <article className="mx-auto w-full max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-semibold">Privacy policy</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Last updated 21 June 2026
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed">
        <section className="space-y-2">
          <p>
            Set is a private, members-only platform for Pan-Atlantic University
            alumni, run by the alumni committee. This policy explains what
            personal data we collect, why we collect it, how long we keep it,
            and the rights you have over it. It covers the platform only, not
            the university.
          </p>
          <p>
            We process your personal data in line with the Nigeria Data
            Protection Act (NDPA). The alumni committee is the data controller
            for the information described here.
          </p>
        </section>

        <Section title="What personal data we collect">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Details you give us: name, email, phone number, photo, bio,
              location, and work information.
            </li>
            <li>
              Your academic record at the university: school and graduating set.
            </li>
            <li>
              Activity you take part in: event RSVPs, fundraiser pledges, and
              announcements you author.
            </li>
            <li>
              Basic technical data needed to keep your account secure, such as
              sign-in times and the devices you use.
            </li>
          </ul>
        </Section>

        <Section title="Why we use it and our legal basis">
          <p>
            We use your personal data to run the alumni directory, organise
            events and fundraisers, secure your account, and send the updates
            you have opted into. Under the NDPA our legal bases are your consent
            for optional communications, the performance of our membership
            arrangement with you, our legitimate interest in running a community
            for alumni, and compliance with legal obligations. We do not sell
            your data or share it with advertisers.
          </p>
        </Section>

        <Section title="Who can see your profile">
          <p>
            You choose the visibility of your profile and of your email and
            phone individually: anyone signed in, the committee only, or off.
            Set those controls any time under Privacy in your account.
            Administrators on the alumni committee can see member records to run
            the platform, and every administrative action is logged.
          </p>
        </Section>

        <Section title="How we protect your data">
          <p>
            Access is restricted to signed-in members, sensitive fields such as
            phone numbers are encrypted, and the database enforces who can read
            what as a second layer of defence. No system is perfect, so please
            use a unique email and tell us if anything looks wrong.
          </p>
        </Section>

        <Section title="Email and unsubscribing">
          <p>
            You control which emails you receive under Notifications in your
            account. Every bulk email also carries a one-click unsubscribe link.
            Sign-in links and essential account notices are always sent.
          </p>
        </Section>

        <Section title="How long we keep your data">
          <p>
            We keep your personal data for as long as you are a member. When you
            delete your account, your profile is hidden immediately and then
            permanently purged or anonymised after a 30-day grace period.
            During that grace period an administrator can restore your account.
            After the grace period passes we anonymise your record while keeping
            the integrity of shared history, so items others rely on, such as
            past pledges, remain but are shown as belonging to a deleted member.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            Under the NDPA you have the right to access your personal data, to
            correct it, to delete it, and to object to or restrict how it is
            used. In the platform you can:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Access and download a copy of your data from the Data tab in your
              account.
            </li>
            <li>Correct your details any time from your profile.</li>
            <li>
              Delete your account from the Data tab, which starts the 30-day
              deletion flow described above.
            </li>
            <li>
              Object to optional communications by changing your notification
              settings or using any unsubscribe link.
            </li>
          </ul>
          <p>
            If you believe your data has been mishandled, you may also lodge a
            complaint with the Nigeria Data Protection Commission.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            For any question about your data or this policy, or to exercise your
            rights,{" "}
            {contactEmail ? (
              <a href={`mailto:${contactEmail}`} className="underline">
                contact us by email
              </a>
            ) : (
              "contact the alumni committee"
            )}
            .
          </p>
        </Section>
      </div>
    </article>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}
