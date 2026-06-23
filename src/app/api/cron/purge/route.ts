import { NextResponse } from "next/server";

import { isAuthorizedCron } from "@/lib/cron-auth";
import { purgeExpiredMembersSystem } from "@/lib/dal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Weekly purge cron (vercel.json: "0 7 * * 1" = Monday 08:00 WAT). Permanently
 * anonymises soft-deleted members whose 30-day grace has elapsed. GET is
 * required by Vercel Cron; the CRON_SECRET bearer gates the mutation.
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const purged = await purgeExpiredMembersSystem();
  console.log(JSON.stringify({ job: "purge", purged }));
  return NextResponse.json({ ok: true, purged });
}
