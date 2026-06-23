import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { getPublicFundraiser } from "@/lib/dal";
import { daysLeft, formatNaira, progressPercent } from "@/lib/money";

import { ExternalPledgeForm } from "./external-pledge-form";

const MD =
  "text-sm leading-relaxed [&_a]:text-brand [&_a]:underline [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_li]:my-1 [&_p]:my-3 [&_ul]:list-disc [&_ul]:pl-5";

function plain(md: string | null, max = 160): string {
  if (!md) return "Support this campaign.";
  const text = md
    .replace(/[#>*_`~\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const f = await getPublicFundraiser(slug);
  if (!f) return { title: "Campaign not found", robots: { index: false } };

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const url = `${base}/p/${f.slug}`;
  const description = plain(f.description);
  const images = f.coverImage
    ? [{ url: f.coverImage, width: 1200, height: 630, alt: f.title }]
    : undefined;

  return {
    title: f.title,
    description,
    // This page (and only this page) opts back into indexing — it is meant to be
    // shared publicly, especially on WhatsApp.
    robots: { index: true, follow: true },
    alternates: { canonical: url },
    openGraph: {
      title: f.title,
      description,
      url,
      type: "website",
      siteName: "Set",
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: f.title,
      description,
      images: f.coverImage ? [f.coverImage] : undefined,
    },
  };
}

export default async function PublicFundraiserPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const f = await getPublicFundraiser(slug);
  if (!f) notFound();

  const pct = progressPercent(f.raised, f.goalAmount);
  const left = daysLeft(f.endsAt);
  const siteKey = process.env.TURNSTILE_SITE_KEY ?? null;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <p className="mb-6 font-sans text-xl font-semibold italic tracking-tight">
          Set.
        </p>

        <div className="overflow-hidden rounded-lg border">
          {f.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={f.coverImage}
              alt=""
              className="aspect-[1200/630] w-full object-cover"
            />
          ) : (
            <div className="h-32 w-full bg-gradient-to-br from-brand/30 to-brand-deep/20" />
          )}
        </div>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight">{f.title}</h1>

        <div className="mt-4 rounded-lg border bg-card p-4">
          <p className="text-2xl font-semibold">{formatNaira(f.raised)}</p>
          {f.goalAmount ? (
            <p className="text-sm text-muted-foreground">
              pledged of {formatNaira(f.goalAmount)} goal
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">pledged so far</p>
          )}
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-brand"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {f.pledgerCount} pledger{f.pledgerCount === 1 ? "" : "s"}
            </span>
            <span>
              {left > 0 ? `${left} day${left === 1 ? "" : "s"} left` : "Ending soon"}
            </span>
          </div>
        </div>

        {f.description ? (
          <div className={`mt-6 ${MD}`}>
            {/* rule 10: react-markdown WITHOUT rehype-raw */}
            <Markdown remarkPlugins={[remarkGfm]}>{f.description}</Markdown>
          </div>
        ) : null}

        <div className="mt-8">
          <ExternalPledgeForm slug={f.slug} siteKey={siteKey} />
        </div>
      </div>
    </main>
  );
}
