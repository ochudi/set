import { describe, expect, it } from "vitest";

import {
  ageTurning,
  celebratedOn,
  daysUntilBirthday,
  isBirthdayOn,
  isLeapYear,
  nextBirthday,
  parseDob,
} from "./birthdays";

describe("isLeapYear", () => {
  it("applies the Gregorian rule", () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2025)).toBe(false);
    expect(isLeapYear(1900)).toBe(false); // divisible by 100, not 400
    expect(isLeapYear(2000)).toBe(true); // divisible by 400
  });
});

describe("parseDob", () => {
  it("parses valid dates and rejects junk", () => {
    expect(parseDob("1990-05-20")).toEqual({ month: 5, day: 20 });
    expect(parseDob("not-a-date")).toBeNull();
    expect(parseDob("1990-13-01")).toBeNull();
  });
});

describe("celebratedOn (Feb 29 rule)", () => {
  it("keeps 29 Feb in a leap year", () => {
    expect(celebratedOn({ month: 2, day: 29 }, 2024)).toEqual({
      month: 2,
      day: 29,
    });
  });

  it("shifts 29 Feb to 28 Feb in a non-leap year", () => {
    expect(celebratedOn({ month: 2, day: 29 }, 2025)).toEqual({
      month: 2,
      day: 28,
    });
  });

  it("leaves ordinary dates untouched", () => {
    expect(celebratedOn({ month: 7, day: 4 }, 2025)).toEqual({
      month: 7,
      day: 4,
    });
  });
});

describe("isBirthdayOn", () => {
  it("matches a leap-day birthday on 28 Feb in a non-leap year", () => {
    expect(isBirthdayOn("2000-02-29", 2025, 2, 28)).toBe(true);
    // ...and NOT on 29 Feb (which does not exist that year)
    expect(isBirthdayOn("2000-02-29", 2025, 2, 29)).toBe(false);
  });

  it("matches a leap-day birthday on 29 Feb in a leap year", () => {
    expect(isBirthdayOn("2000-02-29", 2024, 2, 29)).toBe(true);
    // ...and NOT on 28 Feb that year
    expect(isBirthdayOn("2000-02-29", 2024, 2, 28)).toBe(false);
  });

  it("matches an ordinary birthday on its month/day", () => {
    expect(isBirthdayOn("1990-05-20", 2026, 5, 20)).toBe(true);
    expect(isBirthdayOn("1990-05-20", 2026, 5, 21)).toBe(false);
  });
});

describe("nextBirthday / daysUntilBirthday", () => {
  it("returns today when the birthday is today (0 days)", () => {
    const today = new Date(Date.UTC(2026, 4, 20)); // 20 May 2026
    expect(daysUntilBirthday("1990-05-20", today)).toBe(0);
  });

  it("counts forward within the year", () => {
    const today = new Date(Date.UTC(2026, 4, 20));
    expect(daysUntilBirthday("1990-05-25", today)).toBe(5);
  });

  it("wraps to next year once the birthday has passed", () => {
    const today = new Date(Date.UTC(2026, 11, 31)); // 31 Dec 2026
    const next = nextBirthday("1990-01-01", today);
    expect(next?.getUTCFullYear()).toBe(2027);
    expect(daysUntilBirthday("1990-01-01", today)).toBe(1);
  });

  it("points a leap-day birthday at 28 Feb in a non-leap year", () => {
    const today = new Date(Date.UTC(2025, 1, 1)); // 1 Feb 2025 (non-leap)
    const next = nextBirthday("2000-02-29", today);
    expect(next?.getUTCMonth()).toBe(1); // February
    expect(next?.getUTCDate()).toBe(28);
  });
});

describe("ageTurning", () => {
  it("computes the age reached on the celebration year", () => {
    expect(ageTurning("1990-05-20", 2026)).toBe(36);
    expect(ageTurning("2000-02-29", 2025)).toBe(25);
  });
});
