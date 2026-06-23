import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/dal";

import { FeatureCards } from "./_components/feature-cards";
import { Hero } from "./_components/hero";
import { Reveal } from "./_components/reveal";

const description =
  "Set is the members-only home of the PAU Alumni Association. Find your set, join reunions, and support causes that matter.";

export const metadata: Metadata = {
  title: "Set",
  description,
  // Root layout sets a sitewide noindex. The public landing opts back in.
  robots: { index: true, follow: true },
  openGraph: {
    title: "Set",
    description,
  },
};

export default async function LandingPage() {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  return (
    <main>
      <Hero />

      <div className="mx-auto w-full max-w-5xl px-6">
        <div className="hero-rule" aria-hidden />
      </div>

      {/* Explainer */}
      <section className="mx-auto w-full max-w-5xl px-6 py-24">
        <Reveal className="mb-10 max-w-xl">
          <h2 className="text-balance text-2xl font-semibold tracking-tight">
            Everything your set needs, in one place.
          </h2>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            No more scattered group chats and lost contacts. Set keeps the
            people, the plans, and the giving together.
          </p>
        </Reveal>
        <FeatureCards />
      </section>

      {/* Closing */}
      <section className="mx-auto w-full max-w-5xl px-6 pb-32">
        <Reveal>
          <div className="flex flex-col items-start gap-4 rounded-lg border border-border bg-card p-8 sm:flex-row sm:items-center sm:justify-between sm:p-10">
            <div>
              <h2 className="text-balance text-xl font-semibold tracking-tight">
                Already a member?
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Sign in with your alumni email and pick up where your set left
                off.
              </p>
            </div>
            <Button asChild size="lg" className="h-11 shrink-0 px-6 text-base">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </Reveal>
      </section>
    </main>
  );
}
