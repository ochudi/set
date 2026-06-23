import { loadEnvConfig } from "@next/env";
import { eq, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/db/schema";

loadEnvConfig(process.cwd());

const OWNER_EMAIL = "ofoma.chudi@gmail.com";
const DEMO_DOMAIN = "@demo.set"; // marker for idempotent re-seed

// dd days from now, as a "YYYY-MM-DD" with a believable birth year.
function dob(addDays: number, birthYear: number): string {
  const d = new Date();
  d.setDate(d.getDate() + addDays);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${birthYear}-${mm}-${dd}`;
}

function inDays(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const client = postgres(url, { prepare: false, max: 1 });
  const db = drizzle(client, { schema });

  try {
    const [owner] = await db
      .select({ id: schema.users.id, memberId: schema.members.id, faculty: schema.members.faculty, year: schema.members.graduationYear })
      .from(schema.users)
      .innerJoin(schema.members, eq(schema.members.userId, schema.users.id))
      .where(eq(schema.users.email, OWNER_EMAIL))
      .limit(1);
    if (!owner) throw new Error(`owner ${OWNER_EMAIL} not found`);
    const year = owner.year ?? 2024;
    const faculty = owner.faculty;

    // --- clean previous demo rows (cascades to members/rsvps) ----------------
    await db.delete(schema.users).where(like(schema.users.email, `%${DEMO_DOMAIN}`));
    await db.delete(schema.events).where(like(schema.events.slug, "demo-%"));
    await db
      .delete(schema.announcements)
      .where(like(schema.announcements.slug, "demo-%"));

    // --- setmates ------------------------------------------------------------
    const people = [
      { first: "Amara", last: "Okafor", city: "Lagos", job: "Product Manager", company: "Paystack", dob: dob(0, 1996), showAge: true, emailVis: "members" as const },
      { first: "Tunde", last: "Bello", city: "Abuja", job: "Engineer", company: "Flutterwave", dob: dob(2, 1995), showAge: false, emailVis: "members" as const },
      { first: "Ngozi", last: "Eze", city: "Lagos", job: "Doctor", company: "LUTH", dob: dob(5, 1997), showAge: false, emailVis: "private" as const },
      { first: "Chidi", last: "Nwosu", city: "Port Harcourt", job: "Lawyer", company: "Aluko & Oyebode", dob: dob(40, 1994), showAge: false, emailVis: "members" as const },
    ];

    for (const p of people) {
      const email = `${p.first.toLowerCase()}.${p.last.toLowerCase()}${DEMO_DOMAIN}`;
      const [u] = await db
        .insert(schema.users)
        .values({ email, name: `${p.first} ${p.last}`, role: "member", status: "active" })
        .returning({ id: schema.users.id });
      await db.insert(schema.members).values({
        userId: u.id,
        firstName: p.first,
        lastName: p.last,
        bio: `${p.job} based in ${p.city}.`,
        faculty,
        graduationYear: year,
        city: p.city,
        country: "Nigeria",
        jobTitle: p.job,
        company: p.company,
        dateOfBirth: p.dob,
        showAge: p.showAge,
        profileVisibility: "members",
        emailVisibility: p.emailVis,
      });
    }
    console.log(`✓ ${people.length} setmates (set of ${year})`);

    // --- events --------------------------------------------------------------
    const [goingEvent] = await db
      .insert(schema.events)
      .values({
        title: "Set of 2024 reunion dinner",
        slug: "demo-reunion-dinner",
        description: "An evening to reconnect over dinner.",
        location: "Eko Hotel, Lagos",
        startsAt: inDays(10),
        endsAt: inDays(10),
        publishedAt: new Date(),
        createdBy: owner.id,
      })
      .returning({ id: schema.events.id });
    await db
      .insert(schema.events)
      .values({
        title: "Alumni service day",
        slug: "demo-service-day",
        description: "Give back with the set.",
        location: "Makoko, Lagos",
        startsAt: inDays(21),
        endsAt: inDays(21),
        publishedAt: new Date(),
        createdBy: owner.id,
      });

    // owner is "going" to the first; the second stays pending (drives the
    // "RSVP to next pending event" quick action + a "No RSVP" badge).
    await db.insert(schema.eventRsvps).values({
      eventId: goingEvent.id,
      memberId: owner.memberId,
      status: "going",
    });
    console.log("✓ 2 upcoming events (1 going, 1 pending)");

    // --- a recent, pinned announcement --------------------------------------
    await db.insert(schema.announcements).values({
      title: "Dues for the new term are open",
      slug: "demo-dues-open",
      body: "Annual dues are now open. Pay early to help us plan the reunion and service projects for the year.",
      status: "published",
      pinned: true,
      authorId: owner.id,
      publishedAt: inDays(-1),
    });
    console.log("✓ 1 recent pinned announcement");

    console.log("done.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
