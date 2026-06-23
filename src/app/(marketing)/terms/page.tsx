import type { Metadata } from "next";

import { getSetting } from "@/lib/dal";

// Terms of use: accurate to how the platform behaves today. Counsel must review
// and sign this off before launch.
const description =
  "The terms for using Set, the members-only platform for PAU alumni, governed by the laws of the Federal Republic of Nigeria.";

export const metadata: Metadata = {
  title: "Terms of use",
  description,
  robots: { index: true, follow: true },
};

export default async function TermsPage() {
  const contactEmail = await getSetting("org_contact_email");

  return (
    <article className="mx-auto w-full max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-semibold">Terms of use</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Last updated 21 June 2026
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed">
        <section className="space-y-2">
          <p>
            By using Set you agree to these terms. Set is a private community for
            Pan-Atlantic University alumni, run by the alumni committee.
          </p>
        </section>

        <Section title="Who can join">
          <p>
            Membership is by invitation and is intended for alumni of the
            university. Invitations are personal to you, so do not share your
            sign-in links.
          </p>
        </Section>

        <Section title="Your account">
          <p>
            Keep your profile accurate and your email current, since that is how
            you sign in. You are responsible for activity under your account.
            Tell the committee straight away if you think someone else has
            access.
          </p>
        </Section>

        <Section title="Acceptable use">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Use other members&apos; contact details only for genuine alumni
              purposes.
            </li>
            <li>Do not scrape, copy, or redistribute the member directory.</li>
            <li>
              Do not harass other members or post unlawful or misleading
              content.
            </li>
            <li>
              Do not attempt to bypass access controls or disrupt the service.
            </li>
          </ul>
        </Section>

        <Section title="Content you post">
          <p>
            You keep ownership of what you post, such as announcements and
            pledge messages, and you are responsible for it. You give Set
            permission to show it to other members as part of running the
            platform.
          </p>
        </Section>

        <Section title="Suspension and removal">
          <p>
            The committee may suspend or remove accounts that breach these terms
            or misuse member data. You can delete your own account at any time
            from your account settings.
          </p>
        </Section>

        <Section title="Availability and liability">
          <p>
            Set is provided as is, without warranties. We work to keep it
            available and accurate but cannot guarantee it will always be
            error-free or uninterrupted. To the extent the law allows, the
            committee is not liable for losses arising from your use of the
            platform.
          </p>
        </Section>

        <Section title="Governing law">
          <p>
            These terms are governed by the laws of the Federal Republic of
            Nigeria. Any dispute arising from them or from your use of Set is
            subject to the jurisdiction of the Nigerian courts.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            We may update these terms as the platform evolves. We will note the
            date of the latest version at the top of this page.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            For any question about these terms,{" "}
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
