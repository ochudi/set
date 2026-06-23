import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";

import { getSessionUser } from "@/lib/dal";
import { AVATAR_BUCKET, getStorageClient } from "@/lib/storage";

export const runtime = "nodejs";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Unsupported file type. Use JPG, PNG, or WebP." },
      { status: 415 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large" }, { status: 413 });
  }

  // Re-encode to a square 512px webp. sharp drops all metadata (incl. EXIF/GPS)
  // by default; .rotate() applies orientation first so the image stays upright.
  const input = Buffer.from(await file.arrayBuffer());
  const output = await sharp(input)
    .rotate()
    .resize(512, 512, { fit: "cover" })
    .webp({ quality: 82 })
    .toBuffer();

  const supabase = getStorageClient();
  const path = `${user.id}/avatar.webp`;
  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, output, { contentType: "image/webp", upsert: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  // Cache-bust so a re-upload to the same path shows immediately.
  return NextResponse.json({ url: `${data.publicUrl}?v=${Date.now()}` });
}
