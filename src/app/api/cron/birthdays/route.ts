import { NextResponse } from "next/server";

import { isAuthorizedCron } from "@/lib/cron-auth";
import { runBirthdayCron } from "@/lib/dal";

// Data access requires the Node runtime (CLAUDE.md). Never cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily birthday cron (vercel.json: "0 6 * * *" = 07:00 WAT). Sends one wish per
 * celebrant per year (idempotent via birthday_sent), so re-runs are safe. GET is
 * required by Vercel Cron; the CRON_SECRET bearer gates every mutation.
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runBirthdayCron();
  return NextResponse.json({ ok: true, ...result });
}
