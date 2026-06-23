import { describe, expect, it } from "vitest";

import { validateImportRow } from "./csv-import";

const FACULTY = "Lagos Business School";

function row(over: Partial<Record<string, string>> = {}) {
  return {
    full_name: "Ada Obi",
    email: "ada@example.com",
    birthday: "1990-05-12",
    graduating_year: "2015",
    faculty: FACULTY,
    ...over,
  };
}

describe("validateImportRow", () => {
  it("accepts a well-formed row and normalises the email", () => {
    const r = validateImportRow(0, row({ email: "ADA@Example.com" }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.email).toBe("ada@example.com");
      expect(r.data.fullName).toBe("Ada Obi");
      expect(r.data.graduatingYear).toBe("2015");
    }
  });

  it("requires name and email", () => {
    expect(validateImportRow(0, row({ full_name: "" })).ok).toBe(false);
    expect(validateImportRow(0, row({ email: "" })).ok).toBe(false);
    expect(validateImportRow(0, row({ email: "not-an-email" })).ok).toBe(false);
  });

  it("refuses ambiguous / non-ISO dates and impossible dates", () => {
    expect(validateImportRow(0, row({ birthday: "12/05/1990" })).ok).toBe(false); // DD/MM
    expect(validateImportRow(0, row({ birthday: "05/12/1990" })).ok).toBe(false); // MM/DD
    expect(validateImportRow(0, row({ birthday: "1990-13-40" })).ok).toBe(false); // impossible
    expect(validateImportRow(0, row({ birthday: "" })).ok).toBe(true); // optional
  });

  it("validates the faculty against the canonical list", () => {
    expect(validateImportRow(0, row({ faculty: "School of Law" })).ok).toBe(false);
    expect(validateImportRow(0, row({ faculty: "" })).ok).toBe(true); // optional
  });

  it("enforces the graduating-year range", () => {
    expect(validateImportRow(0, row({ graduating_year: "1980" })).ok).toBe(false);
    expect(validateImportRow(0, row({ graduating_year: "abcd" })).ok).toBe(false);
  });

  // DONE: a 20-row import with exactly 2 bad rows is split 18 good / 2 rejected.
  it("splits a 20-row file with 2 bad rows", () => {
    const rows: Record<string, string>[] = [];
    for (let i = 0; i < 18; i++) {
      rows.push(row({ email: `member${i}@example.com` }));
    }
    rows.push(row({ email: "bad-date@example.com", birthday: "31/12/1990" })); // bad date
    rows.push(row({ email: "bad-faculty@example.com", faculty: "Hogwarts" })); // bad faculty

    const results = rows.map((r, i) => validateImportRow(i, r));
    const ok = results.filter((r) => r.ok);
    const bad = results.filter((r) => !r.ok);
    expect(ok).toHaveLength(18);
    expect(bad).toHaveLength(2);
  });
});
