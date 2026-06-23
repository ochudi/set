"use server";

import { revalidatePath } from "next/cache";

import { manualBirthdaySend } from "@/lib/dal";

export async function sendBirthdayAction(memberId: string, override: boolean) {
  const res = await manualBirthdaySend(memberId, override);
  if (res.ok) revalidatePath("/admin/birthdays");
  return res;
}
