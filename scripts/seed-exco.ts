import { loadEnvConfig } from "@next/env";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/db/schema";

loadEnvConfig(process.cwd());

// Current PAUAA leadership (from the General Assembly records). Set labels/emails
// are left blank where not known; admins can fill them in at /admin/exco.
const EXCO = [
  { name: "Onyebuchi Odianjo", role: "President", group: "exco", sortOrder: 1 },
  { name: "Opeyemi Oluleye", role: "Vice President", group: "exco", sortOrder: 2 },
  {
    name: "Chukwudi Ofoma",
    role: "Secretary",
    group: "exco",
    sortOrder: 3,
    email: "ofoma.chudi@gmail.com",
  },
  {
    name: "Stella Uwaechue",
    role: "Financial Secretary",
    group: "exco",
    sortOrder: 4,
  },
  {
    name: "Gbemileke Oscar Oyinsan",
    role: "President Emeritus",
    group: "exco",
    sortOrder: 5,
  },
  {
    name: "Nkiru Ukachukwu",
    role: "Alumni Director",
    group: "alumni_office",
    sortOrder: 1,
  },
  {
    name: "Adanick Anozie",
    role: "Alumni Relations Officer",
    group: "alumni_office",
    sortOrder: 2,
  },
  { name: "Raphael Ndive", role: "Alumni Office", group: "alumni_office", sortOrder: 3 },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const client = postgres(url, { prepare: false, max: 1 });
  const db = drizzle(client, { schema });
  try {
    await db.delete(schema.excoMembers);
    await db.insert(schema.excoMembers).values(
      EXCO.map((e) => ({
        name: e.name,
        role: e.role,
        group: e.group,
        sortOrder: e.sortOrder,
        email: "email" in e ? (e.email as string) : null,
      })),
    );
    console.log(`✓ seeded ${EXCO.length} leadership members`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
