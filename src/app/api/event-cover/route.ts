import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";

import { getSessionUser } from "@/lib/dal";
import { EVENT_COVER_BUCKET, getStorageClient } from "@/lib/storage";

// Event cover upload. CLAUDE.md fixes storage to Supabase (not Vercel Blob), so
// "cover via Blob" is implemented on the same Supabase Storage path as avatars.
// Admin-only; re-encodes to a 1200x630 webp and strips EXIF (sharp default).
export const runtime = "nodejs";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || (user.role !== "exco" && user.role !== "super_admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: "Unsupported file type. Use JPG, PNG, or WebP." },
      { status: 415 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large" }, { status: 413 });
  }

  const input = Buffer.from(await file.arrayBuffer());
  const output = await sharp(input)
    .rotate()
    .resize(1200, 630, { fit: "cover" })
    .webp({ quality: 82 })
    .toBuffer();

  const supabase = getStorageClient();
  const path = `${randomUUID()}.webp`;
  const { error } = await supabase.storage
    .from(EVENT_COVER_BUCKET)
    .upload(path, output, { contentType: "image/webp", upsert: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data } = supabase.storage.from(EVENT_COVER_BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
