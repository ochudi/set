"use server";

import { revalidatePath } from "next/cache";

import { pledge } from "@/lib/dal";

export async function pledgeAction(input: {
  fundraiserId: string;
  amountKobo: number;
  channel: string | null;
  note: string | null;
  anonymous: boolean;
}) {
  const res = await pledge(input);
  if (res.ok) {
    revalidatePath(`/fundraisers/${input.fundraiserId}`);
    revalidatePath("/me");
  }
  return res;
}
