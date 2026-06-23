import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import sharp from "sharp";

import { EVENT_COVER_BUCKET, getStorageClient } from "../src/lib/storage";
import * as schema from "../src/db/schema";

loadEnvConfig(process.cwd());

const STORY = `The 2010 set is raising funds for a **community bus** for Pan-Atlantic
University alumni events, airport runs for visiting members, and outreach trips.

## Why a bus
- Cuts the cost of every reunion and service project
- Lets us show up together, on time, as a set
- An asset the whole community uses for years

Every pledge counts. Bank transfer, cash, or card — the treasurer will reach out
with details once you pledge.`;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const client = postgres(url, { prepare: false, max: 1 });
  const db = drizzle(client, { schema });

  try {
    const [admin] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, "ofoma.chudi@gmail.com"))
      .limit(1);

    // Generate + upload a real 1200x630 cover so the OpenGraph image works.
    let coverUrl: string | null = null;
    try {
      const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
        <rect width="1200" height="630" fill="#D97757"/>
        <text x="64" y="300" font-family="Inter, Arial, sans-serif" font-size="76" font-weight="700" fill="#0A0A0A">Set bus appeal</text>
        <text x="64" y="380" font-family="Inter, Arial, sans-serif" font-size="34" fill="#0A0A0A">A community bus for the 2010 set</text>
      </svg>`;
      const webp = await sharp(Buffer.from(svg)).webp({ quality: 82 }).toBuffer();
      const supabase = getStorageClient();
      const path = `bus-${randomUUID()}.webp`;
      const { error } = await supabase.storage
        .from(EVENT_COVER_BUCKET)
        .upload(path, webp, { contentType: "image/webp", upsert: false });
      if (error) throw error;
      coverUrl = supabase.storage.from(EVENT_COVER_BUCKET).getPublicUrl(path)
        .data.publicUrl;
      console.log("✓ cover uploaded:", coverUrl);
    } catch (e) {
      console.warn("cover upload skipped:", e instanceof Error ? e.message : e);
    }

    // Idempotent: replace any existing 'bus' campaign.
    await db.delete(schema.fundraisers).where(eq(schema.fundraisers.slug, "bus"));

    const endsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const [row] = await db
      .insert(schema.fundraisers)
      .values({
        title: "Set bus appeal",
        slug: "bus",
        description: STORY,
        coverImage: coverUrl,
        goalAmount: 500_000_000, // ₦5,000,000 in kobo
        currency: "NGN",
        status: "active",
        startsAt: new Date(),
        endsAt,
        publishedAt: new Date(),
        createdBy: admin?.id ?? null,
      })
      .returning({ id: schema.fundraisers.id, slug: schema.fundraisers.slug });

    console.log(`✓ seeded bus campaign: ${row.id} (/p/${row.slug})`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
