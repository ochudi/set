import { describe, expect, it } from "vitest";

import { profileCompletion, type CompletionInput } from "./profile-completion";

const EMPTY: CompletionInput = {
  avatarUrl: null,
  bio: null,
  faculty: null,
  programme: null,
  graduationYear: null,
  city: null,
  country: null,
  jobTitle: null,
  company: null,
  linkedinUrl: null,
  dateOfBirth: null,
  hasPhone: false,
};

describe("profileCompletion", () => {
  it("is 0% when nothing is filled", () => {
    expect(profileCompletion(EMPTY)).toEqual({
      filled: 0,
      total: 12,
      percent: 0,
    });
  });

  it("is 100% when everything is filled", () => {
    const full: CompletionInput = {
      avatarUrl: "a",
      bio: "b",
      faculty: "SMC",
      programme: "MBA",
      graduationYear: 2010,
      city: "Lagos",
      country: "NG",
      jobTitle: "PM",
      company: "Co",
      linkedinUrl: "x",
      dateOfBirth: "1988-02-29",
      hasPhone: true,
    };
    expect(profileCompletion(full).percent).toBe(100);
  });

  it("treats blank/whitespace strings as unfilled", () => {
    const r = profileCompletion({ ...EMPTY, bio: "   ", city: "Lagos" });
    expect(r.filled).toBe(1);
  });

  it("counts a present number and a true boolean", () => {
    const r = profileCompletion({
      ...EMPTY,
      graduationYear: 2010,
      hasPhone: true,
    });
    expect(r.filled).toBe(2);
    expect(r.percent).toBe(Math.round((2 / 12) * 100));
  });
});
