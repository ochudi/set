"use server";

import { signOut } from "@/auth";
import { requireSession, searchMembers } from "@/lib/dal";
import { peopleSearchLimiter } from "@/lib/ratelimit";

export type PersonResult = {
  id: string;
  name: string;
  faculty: string | null;
  avatarUrl: string | null;
};

export async function searchPeople(query: string): Promise<PersonResult[]> {
  const session = await requireSession();
  if (query.trim().length < 1) return [];

  // 20 / user / minute. If the limiter is unreachable, allow the search.
  try {
    const { success } = await peopleSearchLimiter().limit(session.user.id);
    if (!success) return [];
  } catch {
    // limiter down — proceed
  }

  const rows = await searchMembers(query);
  return rows.map((r) => ({
    id: r.id,
    name:
      [r.preferredName ?? r.firstName, r.lastName].filter(Boolean).join(" ") ||
      "Member",
    faculty: r.faculty,
    avatarUrl: r.avatarUrl,
  }));
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
