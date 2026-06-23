import { describe, expect, it } from "vitest";

import { displayName, initials } from "./member-display";

describe("displayName", () => {
  it("prefers the preferred name over the first name", () => {
    expect(
      displayName({ firstName: "Adaeze", preferredName: "Ada", lastName: "Obi" }),
    ).toBe("Ada Obi");
  });

  it("falls back to first + last when there is no preferred name", () => {
    expect(displayName({ firstName: "Bola", lastName: "Ade" })).toBe("Bola Ade");
  });

  it("renders a deleted member as 'Deleted member' even with a name present", () => {
    expect(
      displayName({
        firstName: "Ada",
        lastName: "Obi",
        deletedAt: new Date("2026-06-01"),
      }),
    ).toBe("Deleted member");
  });

  it("renders a purged (name-null) deleted member as 'Deleted member'", () => {
    expect(
      displayName({ firstName: null, lastName: null, deletedAt: new Date() }),
    ).toBe("Deleted member");
  });

  it("falls back to 'Member' for a live row with no name yet", () => {
    expect(displayName({ firstName: null, lastName: null })).toBe("Member");
  });
});

describe("initials", () => {
  it("takes up to two uppercase initials", () => {
    expect(initials("Ada Obi")).toBe("AO");
    expect(initials("Bola Ngozi Ade")).toBe("BN");
  });

  it("handles a single name", () => {
    expect(initials("Ada")).toBe("A");
  });

  it("falls back to M for empty input", () => {
    expect(initials("")).toBe("M");
  });
});
