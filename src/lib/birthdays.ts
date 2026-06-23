/**
 * Pure birthday date helpers (no db/auth imports, so they unit-test in
 * isolation). Birthdays are date-only; all reference dates are interpreted in
 * UTC parts. Callers that care about West Africa Time compute the WAT calendar
 * date at the edge (date-fns-tz) and feed the y/m/d in here.
 *
 * Leap-day rule: a 29 Feb birthday is celebrated on 28 Feb in non-leap years.
 */

export type MonthDay = { month: number; day: number }; // 1-based month

const DAY_MS = 24 * 60 * 60 * 1000;

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Parse "YYYY-MM-DD" into {month, day}, or null if malformed. */
export function parseDob(dob: string): MonthDay | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!m) return null;
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { month, day };
}

export function birthYear(dob: string): number | null {
  const m = /^(\d{4})-/.exec(dob);
  return m ? Number(m[1]) : null;
}

/**
 * The month/day a birthday is celebrated on in a specific calendar year,
 * applying the 29 Feb -> 28 Feb rule when `year` is not a leap year.
 */
export function celebratedOn(md: MonthDay, year: number): MonthDay {
  if (md.month === 2 && md.day === 29 && !isLeapYear(year)) {
    return { month: 2, day: 28 };
  }
  return md;
}

/** Is the given dob celebrated on this exact calendar date? */
export function isBirthdayOn(
  dob: string,
  year: number,
  month: number,
  day: number,
): boolean {
  const md = parseDob(dob);
  if (!md) return false;
  const eff = celebratedOn(md, year);
  return eff.month === month && eff.day === day;
}

function dateOnlyUTC(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * The next occurrence of this birthday on/after `from` (UTC date-only),
 * with the leap rule applied. Returns a UTC midnight Date, or null.
 */
export function nextBirthday(dob: string, from: Date): Date | null {
  const md = parseDob(dob);
  if (!md) return null;
  const fromMs = dateOnlyUTC(from);
  const startYear = from.getUTCFullYear();
  // Check this year then next year (covers the year wrap).
  for (let y = startYear; y <= startYear + 1; y++) {
    const eff = celebratedOn(md, y);
    const candidate = Date.UTC(y, eff.month - 1, eff.day);
    if (candidate >= fromMs) return new Date(candidate);
  }
  return null;
}

/** Whole days from `from` until the next birthday (0 = today). */
export function daysUntilBirthday(dob: string, from: Date): number | null {
  const next = nextBirthday(dob, from);
  if (next === null) return null;
  return Math.round((next.getTime() - dateOnlyUTC(from)) / DAY_MS);
}

/** The age the person reaches on the given celebration year. */
export function ageTurning(dob: string, celebrationYear: number): number | null {
  const by = birthYear(dob);
  if (by === null) return null;
  return celebrationYear - by;
}
