/**
 * Money helpers. All amounts are stored as integer KOBO; naira = kobo / 100.
 * Display goes through Intl.NumberFormat("en-NG", NGN). Pure + unit-tested.
 */

/** Format kobo as Nigerian naira, e.g. 500000 -> "₦5,000" (or "₦5,000.50"). */
export function formatNaira(kobo: number): string {
  const naira = kobo / 100;
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: kobo % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(naira);
}

/**
 * Parse a naira amount the user typed (e.g. "5,000" or "5000.50") into integer
 * kobo. Returns null if it is not a valid non-negative money value.
 */
export function nairaToKobo(input: string): number | null {
  const cleaned = input.replace(/[₦,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number.parseFloat(cleaned) * 100);
}

/** Completion percentage (0-100, clamped). 0 when there is no goal. */
export function progressPercent(raisedKobo: number, goalKobo: number | null): number {
  if (!goalKobo || goalKobo <= 0) return 0;
  return Math.min(100, Math.round((raisedKobo / goalKobo) * 100));
}

/** Whole days from now until `end` (0 if past/missing). */
export function daysLeft(end: Date | null, now: Date = new Date()): number {
  if (!end) return 0;
  const ms = end.getTime() - now.getTime();
  return ms <= 0 ? 0 : Math.ceil(ms / (24 * 60 * 60 * 1000));
}
