/**
 * Canonical PAU (Pan-Atlantic University) academic constants.
 *
 * Single source of truth for the alumni "faculty" (school) and "programme"
 * fields. Validators (Zod) and the seed import from here. This lives in src/lib
 * (not src/db) so validators can import it WITHOUT importing src/db, which
 * CLAUDE.md rule 2 forbids for anything other than the DAL.
 */

/**
 * Schools / faculties.
 *
 * Confirmed by the project owner on 2026-06-14 (the live pau.edu.ng site is
 * behind a captcha, so this is owner-attested rather than scraped). "School of
 * Law" was explicitly removed — PAU has no law faculty. If a school is ever
 * added or renamed, update this one constant.
 */
export const PAU_FACULTIES = [
  "School of Management and Social Sciences",
  "School of Media and Communication",
  "School of Science and Technology",
  "Lagos Business School",
] as const;

export type PauFaculty = (typeof PAU_FACULTIES)[number];

export const PAU_FACULTY_SET: ReadonlySet<string> = new Set(PAU_FACULTIES);

export function isPauFaculty(value: string): value is PauFaculty {
  return PAU_FACULTY_SET.has(value);
}

/**
 * Programmes / degrees — the finer-grained field paired with the school.
 *
 * ⚠️ NOT YET POPULATED. The full programme catalog still needs to be sourced
 * and verified. While this array is empty, isPauProgramme() accepts any
 * non-empty value (free text); it automatically tightens to a strict allow-list
 * as soon as entries are added here.
 */
export const PAU_PROGRAMMES: readonly string[] = [];

const PAU_PROGRAMME_SET: ReadonlySet<string> = new Set(PAU_PROGRAMMES);

export function isPauProgramme(value: string): boolean {
  if (PAU_PROGRAMME_SET.size === 0) return value.trim().length > 0;
  return PAU_PROGRAMME_SET.has(value);
}
