"use client";

import { CalendarDays, HandCoins, Users, type LucideIcon } from "lucide-react";

import { Reveal } from "./reveal";

type Feature = {
  icon: LucideIcon;
  title: string;
  body: string;
};

const features: Feature[] = [
  {
    icon: Users,
    title: "Members",
    body: "Find and connect with your set. Browse the alumni directory and keep your own details current.",
  },
  {
    icon: CalendarDays,
    title: "Events",
    body: "See upcoming reunions and meetups, then RSVP in one tap and get the details by email.",
  },
  {
    icon: HandCoins,
    title: "Fundraisers",
    body: "Back causes your community is raising for. Pledge, track progress, and see where the money goes.",
  },
];

/**
 * Three solid cards (bg-card, 1px border, 8px radius per CLAUDE.md: no glass).
 * Staggered fade + rise on load, with a calm hover lift and brand border tint.
 */
export function FeatureCards() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {features.map(({ icon: Icon, title, body }, i) => (
        <Reveal key={title} index={i} rise={12}>
          <div className="group h-full rounded-lg border border-border bg-card p-6 transition-all duration-200 hover:-translate-y-1 hover:border-brand/40 hover:shadow-md">
            <span className="inline-flex size-10 items-center justify-center rounded-lg border border-border bg-background transition-colors duration-200 group-hover:border-brand/40">
              <Icon className="size-5 text-brand" aria-hidden />
            </span>
            <h3 className="mt-5 text-lg font-semibold">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {body}
            </p>
          </div>
        </Reveal>
      ))}
    </div>
  );
}
