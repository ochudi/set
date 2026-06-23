import { describe, expect, it } from "vitest";

import { daysLeft, formatNaira, nairaToKobo, progressPercent } from "./money";

describe("formatNaira", () => {
  it("formats whole naira from kobo with grouping", () => {
    expect(formatNaira(500000)).toContain("5,000");
    expect(formatNaira(500000)).not.toContain(".00");
  });
  it("shows kobo when present", () => {
    expect(formatNaira(500050)).toContain("5,000.50");
  });
});

describe("nairaToKobo", () => {
  it("parses plain and grouped amounts to kobo", () => {
    expect(nairaToKobo("5000")).toBe(500000);
    expect(nairaToKobo("5,000")).toBe(500000);
    expect(nairaToKobo("5000.50")).toBe(500050);
    expect(nairaToKobo("₦ 1,250.5")).toBe(125050);
  });
  it("rejects junk and over-precise input", () => {
    expect(nairaToKobo("")).toBeNull();
    expect(nairaToKobo("abc")).toBeNull();
    expect(nairaToKobo("10.999")).toBeNull();
    expect(nairaToKobo("-5")).toBeNull();
  });
});

describe("progressPercent", () => {
  it("computes a clamped percentage", () => {
    expect(progressPercent(250000, 1000000)).toBe(25);
    expect(progressPercent(2000000, 1000000)).toBe(100);
    expect(progressPercent(100, 0)).toBe(0);
    expect(progressPercent(100, null)).toBe(0);
  });
});

describe("daysLeft", () => {
  it("counts forward and floors at zero", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    expect(daysLeft(new Date("2026-06-11T00:00:00Z"), now)).toBe(10);
    expect(daysLeft(new Date("2026-05-01T00:00:00Z"), now)).toBe(0);
    expect(daysLeft(null, now)).toBe(0);
  });
});
