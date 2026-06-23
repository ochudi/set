import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";

import { PageWrapper } from "@/components/page-wrapper";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/member-display";
import { listAllBirthdays } from "@/lib/dal";

import { BirthdayCalendar } from "./birthday-calendar";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function BirthdaysPage() {
  const people = await listAllBirthdays();
  const [ty, tm, td] = formatInTimeZone(new Date(), "Africa/Lagos", "yyyy-MM-dd")
    .split("-")
    .map(Number);

  const entries = people.map((p) => ({
    memberId: p.memberId,
    name: p.name,
    month: p.month,
    day: p.day,
  }));

  // Month groups ordered from the current month forward, non-empty only.
  const order = Array.from({ length: 12 }, (_, i) => ((tm - 1 + i) % 12) + 1);
  const groups = order
    .map((m) => ({
      month: m,
      people: people
        .filter((p) => p.month === m)
        .sort((a, b) => a.day - b.day),
    }))
    .filter((g) => g.people.length > 0);

  return (
    <PageWrapper title="Birthdays" description="Celebrate fellow members.">
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div>
          <BirthdayCalendar
            entries={entries}
            todayYear={ty}
            todayMonth={tm}
            todayDay={td}
          />
        </div>

        <div className="space-y-6">
          {groups.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No birthdays on file yet. They appear here once members add their
              date of birth.
            </p>
          ) : (
            groups.map((g) => (
              <section key={g.month}>
                <h2 className="mb-2 text-sm font-semibold">
                  {MONTHS[g.month - 1]}
                </h2>
                <ul className="divide-y rounded-lg border">
                  {g.people.map((p) => (
                    <li
                      key={p.memberId}
                      className="flex items-center gap-3 px-3 py-2"
                    >
                      <span className="w-7 shrink-0 text-center font-mono text-xs text-muted-foreground tabular-nums">
                        {p.day}
                      </span>
                      <Avatar className="size-8">
                        {p.avatarUrl ? (
                          <AvatarImage src={p.avatarUrl} alt="" />
                        ) : null}
                        <AvatarFallback className="text-[11px]">
                          {initials(p.name)}
                        </AvatarFallback>
                      </Avatar>
                      <Link
                        href={`/directory/${p.memberId}`}
                        className="min-w-0 flex-1 truncate text-sm hover:underline"
                      >
                        {p.name}
                      </Link>
                      {p.showAge && p.turnsAge != null ? (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          turns {p.turnsAge}
                        </span>
                      ) : null}
                      {p.isToday ? (
                        <span className="shrink-0 rounded border border-brand px-1.5 py-0.5 text-[11px] font-medium text-brand">
                          today
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
