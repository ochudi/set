import { z } from "zod";

import { isPauFaculty } from "@/lib/pau";

/**
 * CSV member-import contract. Pure (no db) so the SAME validation runs in the
 * client preview (inline errors) and again on the server (trust nothing). Dates
 * are accepted ONLY as YYYY-MM-DD: Nigerian spreadsheets mix DD/MM and MM/DD, so
 * we refuse ambiguous formats rather than guess.
 */

export const CSV_TEMPLATE =
  "full_name,email,birthday,graduating_year,faculty\r\n" +
  "Ada Obi,ada@example.com,1990-05-12,2015,Lagos Business School\r\n";

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** Strict calendar check: matches YYYY-MM-DD AND is a real date (rejects 2020-13-40). */
function isRealYmd(v: string): boolean {
  if (!YMD.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export const importRowSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(160),
  email: z.string().trim().min(1, "Email is required").email("Invalid email"),
  birthday: z
    .string()
    .trim()
    .refine((v) => v === "" || isRealYmd(v), "Use date format YYYY-MM-DD"),
  graduating_year: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{4}$/.test(v), "Enter a 4-digit year")
    .refine(
      (v) => v === "" || (Number(v) >= 1990 && Number(v) <= 2100),
      "Year must be 1990-2100",
    ),
  faculty: z
    .string()
    .trim()
    .refine((v) => v === "" || isPauFaculty(v), "Faculty not recognised"),
});

export type ImportRowData = {
  fullName: string;
  email: string;
  birthday: string;
  graduatingYear: string;
  faculty: string;
};

export type RowResult =
  | { index: number; ok: true; data: ImportRowData }
  | { index: number; ok: false; email: string; errors: string[] };

/** Validate one raw CSV record (header-keyed). index is 0-based over data rows. */
export function validateImportRow(
  index: number,
  raw: Record<string, string | undefined>,
): RowResult {
  const input = {
    full_name: raw.full_name ?? "",
    email: raw.email ?? "",
    birthday: raw.birthday ?? "",
    graduating_year: raw.graduating_year ?? "",
    faculty: raw.faculty ?? "",
  };
  const parsed = importRowSchema.safeParse(input);
  if (!parsed.success) {
    return {
      index,
      ok: false,
      email: input.email,
      errors: parsed.error.issues.map(
        (i) => `${String(i.path[0] ?? "row")}: ${i.message}`,
      ),
    };
  }
  const d = parsed.data;
  return {
    index,
    ok: true,
    data: {
      fullName: d.full_name,
      email: d.email.toLowerCase(),
      birthday: d.birthday,
      graduatingYear: d.graduating_year,
      faculty: d.faculty,
    },
  };
}
