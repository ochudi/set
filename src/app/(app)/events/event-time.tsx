"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

const WAT = "Africa/Lagos";

/**
 * Shows the event time in WAT, and appends the viewer's local time only when
 * their device timezone differs. The local part is computed after mount to avoid
 * a hydration mismatch (the WAT part is timezone-fixed, so it matches on server
 * and client).
 */
export function EventTime({
  at,
  withDate = false,
}: {
  at: Date;
  withDate?: boolean;
}) {
  const [local, setLocal] = useState<string | null>(null);

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && tz !== WAT) setLocal(format(new Date(at), "HH:mm"));
  }, [at]);

  const wat = formatInTimeZone(
    new Date(at),
    WAT,
    withDate ? "EEE d MMM yyyy, HH:mm 'WAT'" : "HH:mm 'WAT'",
  );

  return (
    <>
      {wat}
      {local ? ` (${local} your time)` : ""}
    </>
  );
}

/** Big date strip for cards: returns the day number and month in WAT. */
export function watDayParts(at: Date): { day: string; month: string } {
  return {
    day: formatInTimeZone(new Date(at), WAT, "dd"),
    month: formatInTimeZone(new Date(at), WAT, "MMM"),
  };
}
