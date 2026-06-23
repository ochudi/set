import { NextResponse } from "next/server";

import { exportAllDataZip, getSessionUser } from "@/lib/dal";

// Full-platform export. POST (not GET) because it writes an audit row, so it is
// a state change and must not be a GET (rule 5). Runs in the Node runtime.
export const runtime = "nodejs";

export async function POST() {
  const user = await getSessionUser();
  if (!user || user.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // exportAllDataZip re-checks requireSuperAdmin and records the audit entry.
  const { buffer, filename } = await exportAllDataZip();

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
