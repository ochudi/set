"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export type CalendarEntry = {
  memberId: string;
  name: string;
  month: number; // 1-12
  day: number; // 1-31
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function daysInMonth(year: number, month1: number): number {
  return new Date(year, month1, 0).getDate();
}

export function BirthdayCalendar({
  entries,
  todayYear,
  todayMonth,
  todayDay,
}: {
  entries: CalendarEntry[];
  todayYear: number;
  todayMonth: number;
  todayDay: number;
}) {
  const [year, setYear] = useState(todayYear);
  const [month, setMonth] = useState(todayMonth); // 1-12
  const [selectedDay, setSelectedDay] = useState<number | null>(todayDay);

  const dim = daysInMonth(year, month);

  // Map effective day-of-month -> entries (Feb 29 falls on the 28th in non-leap
  // years, so clamp any day past the month length onto the last day).
  const byDay = useMemo(() => {
    const map = new Map<number, CalendarEntry[]>();
    for (const e of entries) {
      if (e.month !== month) continue;
      const d = Math.min(e.day, dim);
      const list = map.get(d) ?? [];
      list.push(e);
      map.set(d, list);
    }
    return map;
  }, [entries, month, dim]);

  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: dim }, (_, i) => i + 1),
  ];

  function step(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setMonth(m);
    setYear(y);
    setSelectedDay(null);
  }

  const selected = selectedDay ? (byDay.get(selectedDay) ?? []) : [];

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          {MONTHS[month - 1]} {year}
        </h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => step(-1)}
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => step(1)}
            aria-label="Next month"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="pb-1 font-mono text-[11px] text-muted-foreground"
          >
            {w}
          </div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={`b${i}`} />;
          const has = byDay.has(d);
          const isToday =
            year === todayYear && month === todayMonth && d === todayDay;
          const isSelected = d === selectedDay;
          return (
            <button
              key={d}
              type="button"
              onClick={() => setSelectedDay(d)}
              className={`relative flex aspect-square flex-col items-center justify-center rounded-md text-sm transition-colors hover:bg-muted ${
                isToday ? "border border-brand font-medium" : ""
              } ${isSelected && !isToday ? "bg-muted" : ""}`}
            >
              <span>{d}</span>
              {has ? (
                <span className="absolute bottom-1 size-1.5 rounded-full bg-brand" />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-3 border-t pt-3">
        {selected.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {selectedDay
              ? "No birthdays on this day."
              : "Select a day to see who is celebrating."}
          </p>
        ) : (
          <ul className="space-y-1">
            {selected.map((e) => (
              <li key={e.memberId} className="text-sm">
                <Link
                  href={`/directory/${e.memberId}`}
                  className="text-brand underline-offset-2 hover:underline"
                >
                  {e.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
