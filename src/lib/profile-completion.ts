/**
 * Profile completion = filled core fields / total core fields. Pure so it is
 * unit-testable and shared between the dashboard quick action and (later) the
 * profile page. "Core" is the set of fields that make a member findable and
 * useful to setmates; name is assumed present from onboarding so it is excluded.
 */

export type CompletionInput = {
  avatarUrl: string | null;
  bio: string | null;
  faculty: string | null;
  programme: string | null;
  graduationYear: number | null;
  city: string | null;
  country: string | null;
  jobTitle: string | null;
  company: string | null;
  linkedinUrl: string | null;
  dateOfBirth: string | null;
  hasPhone: boolean;
};

const CORE_KEYS: (keyof CompletionInput)[] = [
  "avatarUrl",
  "bio",
  "faculty",
  "programme",
  "graduationYear",
  "city",
  "country",
  "jobTitle",
  "company",
  "linkedinUrl",
  "dateOfBirth",
  "hasPhone",
];

function isFilled(value: CompletionInput[keyof CompletionInput]): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "boolean") return value;
  return true; // number present
}

export function profileCompletion(input: CompletionInput): {
  filled: number;
  total: number;
  percent: number;
} {
  const total = CORE_KEYS.length;
  const filled = CORE_KEYS.reduce(
    (n, k) => n + (isFilled(input[k]) ? 1 : 0),
    0,
  );
  return { filled, total, percent: Math.round((filled / total) * 100) };
}
