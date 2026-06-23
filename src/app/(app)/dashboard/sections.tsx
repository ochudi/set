import { cache } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  Cake,
  CalendarDays,
  HandCoins,
  Mail,
  Megaphone,
  UserRoundPlus,
  Users,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getSetCallout,
  listBirthdaysThisWeek,
  listEvents,
  listFundraisers,
  listPublishedAnnouncements,
  type EventCard,
  type Member,
} from "@/lib/dal";
import { initials } from "@/lib/member-display";
import { formatNaira, progressPercent } from "@/lib/money";
import { profileCompletion } from "@/lib/profile-completion";

// Cached loaders dedupe the queries that feed both the subtitle/quick actions
// and the columns within a single render pass (React cache()).
const loadEvents = cache(() => listEvents("upcoming"));
const loadFundraisers = cache(() => listFundraisers("active"));
const loadBirthdays = cache(() => listBirthdaysThisWeek());
const loadAnnouncements = cache(() => listPublishedAnnouncements(1));

const RSVP_BADGE: Record<string, { label: string; variant: "secondary" | "outline" }> = {
  going: { label: "Going", variant: "secondary" },
  maybe: { label: "Maybe", variant: "outline" },
  waitlist: { label: "Waitlist", variant: "outline" },
  declined: { label: "Declined", variant: "outline" },
};

function plural(n: number, one: string, many = `${one}s`): string {
  return n === 1 ? one : many;
}

function birthdayWhen(daysUntil: number): string {
  if (daysUntil === 0) return "today";
  if (daysUntil === 1) return "tomorrow";
  return `in ${daysUntil} days`;
}

// --- shared shells --------------------------------------------------------

function Column({
  icon,
  title,
  href,
  linkLabel,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  href?: string;
  linkLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-brand">{icon}</span>
        <h2 className="text-sm font-semibold">{title}</h2>
        {href && linkLabel ? (
          <Link
            href={href}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground"
          >
            {linkLabel}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

// --- welcome subtitle -----------------------------------------------------

export async function DashboardSubtitle() {
  const [events, birthdays, announcements] = await Promise.all([
    loadEvents(),
    loadBirthdays(),
    loadAnnouncements(),
  ]);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const newAnnouncements = announcements.items.filter(
    (a) => a.publishedAt && a.publishedAt >= weekAgo,
  ).length;

  const parts = [
    `${newAnnouncements} new ${plural(newAnnouncements, "announcement")}`,
    `${events.length} upcoming ${plural(events.length, "event")}`,
    `${birthdays.length} ${plural(birthdays.length, "birthday")} this week`,
  ];
  return (
    <p className="mt-1 text-sm text-muted-foreground">{parts.join(" · ")}</p>
  );
}

export function SubtitleSkeleton() {
  return <Skeleton className="mt-1 h-5 w-72" />;
}

// --- quick actions --------------------------------------------------------

function Pill({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  // Per CLAUDE.md ("Glass only on navbar/overlays/toasts/palette/mobile bar")
  // these are solid pills, not the glass the brief asked for — see flag.
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-full border border-brand/40 bg-brand/10 px-3.5 py-1.5 text-sm font-medium text-brand-deep transition-colors hover:bg-brand/20"
    >
      <span className="shrink-0">{icon}</span>
      {children}
    </Link>
  );
}

export async function QuickActions({ member }: { member: Member }) {
  const [events, fundraisers] = await Promise.all([
    loadEvents(),
    loadFundraisers(),
  ]);

  const pendingEvent = events.find((e) => !e.canceledAt && e.myStatus == null);
  const openCampaign = fundraisers[0] ?? null;
  const { percent } = profileCompletion({
    avatarUrl: member.avatarUrl,
    bio: member.bio,
    faculty: member.faculty,
    programme: member.programme,
    graduationYear: member.graduationYear,
    city: member.city,
    country: member.country,
    jobTitle: member.jobTitle,
    company: member.company,
    linkedinUrl: member.linkedinUrl,
    dateOfBirth: member.dateOfBirth,
    hasPhone: member.phoneEncrypted != null,
  });

  const pills: React.ReactNode[] = [];
  if (pendingEvent) {
    pills.push(
      <Pill
        key="rsvp"
        href={`/events/${pendingEvent.id}`}
        icon={<CalendarDays className="size-4" />}
      >
        RSVP to {pendingEvent.title}
      </Pill>,
    );
  }
  if (openCampaign) {
    pills.push(
      <Pill
        key="campaign"
        href={`/fundraisers/${openCampaign.id}`}
        icon={<HandCoins className="size-4" />}
      >
        View {openCampaign.title}
      </Pill>,
    );
  }
  if (percent < 80) {
    pills.push(
      <Pill key="profile" href="/me" icon={<UserRoundPlus className="size-4" />}>
        Complete your profile ({percent}%)
      </Pill>,
    );
  }

  if (pills.length === 0) return null;
  return <div className="flex flex-wrap gap-2">{pills}</div>;
}

export function QuickActionsSkeleton() {
  return (
    <div className="flex flex-wrap gap-2">
      <Skeleton className="h-9 w-44 rounded-full" />
      <Skeleton className="h-9 w-40 rounded-full" />
    </div>
  );
}

// --- events column --------------------------------------------------------

function EventRow({ event }: { event: EventCard }) {
  const badge = event.myStatus ? RSVP_BADGE[event.myStatus] : null;
  return (
    <Link
      href={`/events/${event.id}`}
      className="flex items-center gap-3 rounded-md border border-transparent px-2 py-2 text-sm transition-colors hover:border-border hover:bg-muted"
    >
      <div className="flex w-11 shrink-0 flex-col items-center rounded-md border bg-background py-1">
        <span className="text-base font-semibold leading-none tabular-nums">
          {format(event.startsAt, "d")}
        </span>
        <span className="font-mono text-[10px] uppercase text-muted-foreground">
          {format(event.startsAt, "MMM")}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{event.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {event.isVirtual ? "Virtual" : (event.location ?? "Location to be confirmed")}
        </p>
      </div>
      {event.canceledAt ? (
        <Badge variant="destructive">Cancelled</Badge>
      ) : badge ? (
        <Badge variant={badge.variant}>{badge.label}</Badge>
      ) : (
        <Badge variant="outline" className="text-muted-foreground">
          No RSVP
        </Badge>
      )}
    </Link>
  );
}

export async function EventsColumn() {
  const events = (await loadEvents()).slice(0, 3);
  return (
    <Column
      icon={<CalendarDays className="size-4" />}
      title="Upcoming events"
      href="/events"
      linkLabel="All events"
    >
      {events.length === 0 ? (
        <Empty>
          Nothing on the calendar yet.{" "}
          <Link href="/events" className="text-brand underline">
            Browse events
          </Link>
          .
        </Empty>
      ) : (
        <div className="space-y-1">
          {events.map((e) => (
            <EventRow key={e.id} event={e} />
          ))}
        </div>
      )}
    </Column>
  );
}

// --- birthdays column -----------------------------------------------------

export async function BirthdaysColumn() {
  const people = await loadBirthdays();
  return (
    <Column
      icon={<Cake className="size-4" />}
      title="Birthdays this week"
      href="/birthdays"
      linkLabel="All birthdays"
    >
      {people.length === 0 ? (
        <Empty>No birthdays in the next 7 days.</Empty>
      ) : (
        <ul className="space-y-1">
          {people.map((p) => (
            <li
              key={p.memberId}
              className={`flex items-center gap-3 rounded-md px-2 py-1.5 ${
                p.isToday ? "border border-brand" : "border border-transparent"
              }`}
            >
              <Avatar className="size-8">
                {p.avatarUrl ? <AvatarImage src={p.avatarUrl} alt="" /> : null}
                <AvatarFallback className="text-[11px]">
                  {initials(p.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/directory/${p.memberId}`}
                  className="truncate text-sm font-medium hover:underline"
                >
                  {p.name}
                </Link>
                <p
                  className={`text-xs ${
                    p.isToday ? "font-medium text-brand" : "text-muted-foreground"
                  }`}
                >
                  {birthdayWhen(p.daysUntil)}
                  {p.showAge && p.turnsAge != null ? ` · turns ${p.turnsAge}` : ""}
                </p>
              </div>
              {p.email ? (
                <a
                  href={`mailto:${p.email}?subject=${encodeURIComponent("Happy birthday!")}`}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-brand-deep transition-colors hover:bg-brand/10"
                  title={`Email ${p.name}`}
                >
                  <Mail className="size-3.5" /> Wish them
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Column>
  );
}

// --- campaigns column -----------------------------------------------------

export async function CampaignsColumn() {
  const campaigns = (await loadFundraisers()).slice(0, 2);
  return (
    <Column
      icon={<HandCoins className="size-4" />}
      title="Active campaigns"
      href="/fundraisers"
      linkLabel="All campaigns"
    >
      {campaigns.length === 0 ? (
        <Empty>No active campaigns right now.</Empty>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => {
            const pct = progressPercent(c.raised, c.goalAmount);
            return (
              <Link
                key={c.id}
                href={`/fundraisers/${c.id}`}
                className="block rounded-md border border-transparent px-2 py-2 transition-colors hover:border-border hover:bg-muted"
              >
                <p className="truncate text-sm font-medium">{c.title}</p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {formatNaira(c.raised)}
                  </span>
                  {c.goalAmount != null ? ` of ${formatNaira(c.goalAmount)}` : ""} ·{" "}
                  {pct}%
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </Column>
  );
}

export function ColumnSkeleton({ title }: { title: string }) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Skeleton className="size-4 rounded" />
        <span className="text-sm font-semibold text-muted-foreground/40">
          {title}
        </span>
      </div>
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-9 shrink-0 rounded-md" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// --- latest announcements -------------------------------------------------

function teaser(markdown: string): string {
  return markdown
    .replace(/[#*_>`-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

export async function LatestAnnouncements() {
  const { items } = await loadAnnouncements();
  const latest = items.slice(0, 3);
  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Megaphone className="size-4 text-brand" />
        <h2 className="text-sm font-semibold">Latest announcements</h2>
        <Link
          href="/announcements"
          className="ml-auto text-xs text-muted-foreground hover:text-foreground"
        >
          All announcements
        </Link>
      </div>
      {latest.length === 0 ? (
        <Empty>No announcements yet. Check back soon.</Empty>
      ) : (
        <ul className="divide-y">
          {latest.map((a) => (
            <li key={a.id} className="py-3 first:pt-0 last:pb-0">
              <Link href={`/announcements/${a.id}`} className="group block">
                <div className="flex items-center gap-2">
                  {a.pinned ? (
                    <Badge variant="secondary" className="shrink-0">
                      Pinned
                    </Badge>
                  ) : null}
                  <h3 className="truncate font-medium group-hover:underline">
                    {a.title}
                  </h3>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {teaser(a.body)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {a.authorName}
                  {a.publishedAt ? ` · ${format(a.publishedAt, "d MMM yyyy")}` : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function AnnouncementsSkeleton() {
  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Skeleton className="size-4 rounded" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        ))}
      </div>
    </section>
  );
}

// --- set callout ----------------------------------------------------------

export async function SetCallout({ member }: { member: Member }) {
  if (member.graduationYear == null) {
    return (
      <section className="rounded-lg border bg-card p-5">
        <div className="mb-1 flex items-center gap-2">
          <Users className="size-4 text-brand" />
          <h2 className="text-sm font-semibold">Your set</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Add your graduation year to find your setmates.{" "}
          <Link href="/me" className="text-brand underline">
            Update your profile
          </Link>
          .
        </p>
      </section>
    );
  }

  const { count, sample } = await getSetCallout(
    member.graduationYear,
    member.id,
  );
  const facultyLine = [member.faculty, `Set of ${member.graduationYear}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="rounded-lg border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <Users className="size-4 text-brand" />
            <h2 className="text-sm font-semibold">Your set</h2>
          </div>
          <p className="text-lg font-semibold">{facultyLine}</p>
          <p className="text-sm text-muted-foreground">
            {count} {plural(count, "setmate")} on Set
          </p>
        </div>
        <div className="flex items-center gap-3">
          {sample.length > 0 ? (
            <div className="flex -space-x-2">
              {sample.map((m) => (
                <Avatar key={m.id} className="size-9 ring-2 ring-card">
                  {m.avatarUrl ? <AvatarImage src={m.avatarUrl} alt="" /> : null}
                  <AvatarFallback className="text-[11px]">
                    {initials(
                      m.preferredName || `${m.firstName ?? ""} ${m.lastName ?? ""}`,
                    )}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
          ) : null}
          <Link
            href={`/directory?year=${member.graduationYear}`}
            className="inline-flex items-center gap-2 rounded-full border border-brand/40 bg-brand/10 px-3.5 py-1.5 text-sm font-medium text-brand-deep transition-colors hover:bg-brand/20"
          >
            Browse my set
          </Link>
        </div>
      </div>
    </section>
  );
}

export function SetCalloutSkeleton() {
  return (
    <section className="rounded-lg border bg-card p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-9 w-32 rounded-full" />
      </div>
    </section>
  );
}
