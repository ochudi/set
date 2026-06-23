import { NextResponse } from "next/server";

import { getEventIcs } from "@/lib/dal";

// "Add to calendar" download. Session-gated (the button lives on the authed
// event page); read-only (rule 5). The ICS body carries METHOD and SEQUENCE.
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await getEventIcs(id);
  if (!result) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(result.ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
