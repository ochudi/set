import { NextResponse } from "next/server";

import { exportMyData, getSessionUser } from "@/lib/dal";

// Read-only data export (rule 5: GET never mutates). Runs in the Node runtime
// like all data access. Decryption of the caller's own phone happens in the DAL.
export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await exportMyData();
  const body = JSON.stringify(data, null, 2);
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="set-data-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
