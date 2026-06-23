"use server";

import { revalidatePath } from "next/cache";

import {
  createFundraiser,
  exportFundraiserPledgesCsv,
  markPledgeReceived,
  postFundraiserUpdate,
  updateFundraiser,
  type FundraiserInput,
} from "@/lib/dal";

export type FundraiserFormValues = {
  title: string;
  description: string;
  goalKobo: number | null;
  startsAt: string | null; // ISO date or null
  endsAt: string | null;
  coverImage: string;
  slug: string;
  status: "draft" | "active" | "closed" | "archived";
};

function toInput(values: FundraiserFormValues): FundraiserInput {
  return {
    title: values.title.trim(),
    description: values.description.trim() || null,
    goalAmount: values.goalKobo,
    startsAt: values.startsAt ? new Date(values.startsAt) : null,
    endsAt: values.endsAt ? new Date(values.endsAt) : null,
    coverImage: values.coverImage.trim() || null,
    slug: values.slug.trim(),
    status: values.status,
  };
}

export async function saveFundraiserAction(
  id: string | null,
  values: FundraiserFormValues,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const input = toInput(values);
  if (!input.title) return { ok: false, error: "Add a title." };
  const res = id
    ? { ...(await updateFundraiser(id, input)), id }
    : await createFundraiser(input);
  if (res.ok) {
    revalidatePath("/admin/fundraisers");
    revalidatePath("/fundraisers");
  }
  return res;
}

export async function markReceivedAction(
  pledgeId: string,
  fundraiserId: string,
) {
  const res = await markPledgeReceived(pledgeId);
  if (res.ok) {
    revalidatePath(`/admin/fundraisers/${fundraiserId}`);
    revalidatePath(`/fundraisers/${fundraiserId}`);
  }
  return res;
}

export async function postUpdateAction(
  fundraiserId: string,
  input: { title: string | null; body: string },
) {
  const res = await postFundraiserUpdate(fundraiserId, input);
  if (res.ok) {
    revalidatePath(`/admin/fundraisers/${fundraiserId}`);
    revalidatePath(`/fundraisers/${fundraiserId}`);
  }
  return res;
}

export async function exportPledgesAction(fundraiserId: string) {
  return exportFundraiserPledgesCsv(fundraiserId);
}
