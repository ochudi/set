import { loadEnvConfig } from "@next/env";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "../src/db/schema";

loadEnvConfig(process.cwd());

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const client = postgres(url, { prepare: false, max: 1 });
  const db = drizzle(client, { schema });

  try {
    const users = await db
      .select({ id: schema.users.id, role: schema.users.role })
      .from(schema.users);
    const members = await db
      .select({ id: schema.members.id, userId: schema.members.userId })
      .from(schema.members);
    const events = await db.select({ id: schema.events.id }).from(schema.events);
    const fundraisers = await db
      .select({ id: schema.fundraisers.id })
      .from(schema.fundraisers);
    const announcements = await db
      .select({ id: schema.announcements.id })
      .from(schema.announcements);

    const actors = users.map((u) => u.id);
    if (actors.length === 0) throw new Error("no users to act as actors");

    type Tpl = () => {
      action: string;
      entityType: string | null;
      entityId: string | null;
      metadata: Record<string, unknown> | null;
    };
    const roles = ["member", "exco", "super_admin"];
    const templates: Tpl[] = [
      () => ({
        action: "member.role_change",
        entityType: "user",
        entityId: pick(members).userId,
        metadata: { from: pick(roles), to: pick(roles) },
      }),
      () => ({
        action: "member.suspend",
        entityType: "user",
        entityId: pick(members).userId,
        metadata: null,
      }),
      () => ({
        action: "member.reactivate",
        entityType: "user",
        entityId: pick(members).userId,
        metadata: null,
      }),
      () => ({
        action: "member.update",
        entityType: "member",
        entityId: pick(members).id,
        metadata: { fields: ["city", "company", "jobTitle"].slice(0, 1 + Math.floor(Math.random() * 3)) },
      }),
      () => ({
        action: "invite.create",
        entityType: "invite",
        entityId: null,
        metadata: { email: `prospect${Math.floor(Math.random() * 9999)}@example.org`, role: pick(roles) },
      }),
      () => ({
        action: "member.export_csv",
        entityType: null,
        entityId: null,
        metadata: { count: Math.floor(Math.random() * 200) },
      }),
      ...(events.length
        ? [
            (): ReturnType<Tpl> => ({
              action: pick(["event.create", "event.update", "event.publish", "event.cancel"]),
              entityType: "event",
              entityId: pick(events).id,
              metadata: { emailed: Math.floor(Math.random() * 50) },
            }),
          ]
        : []),
      ...(announcements.length
        ? [
            (): ReturnType<Tpl> => ({
              action: pick(["announcement.create", "announcement.publish", "announcement.email"]),
              entityType: "announcement",
              entityId: pick(announcements).id,
              metadata: { recipients: Math.floor(Math.random() * 80) },
            }),
          ]
        : []),
      ...(fundraisers.length
        ? [
            (): ReturnType<Tpl> => ({
              action: pick(["fundraiser.create", "fundraiser.update", "pledge.received"]),
              entityType: "fundraiser",
              entityId: pick(fundraisers).id,
              metadata: null,
            }),
          ]
        : []),
      () => ({
        action: "settings.update",
        entityType: "setting",
        entityId: "announcement_daily_cap",
        metadata: { cap: 5 },
      }),
      ...(members.length
        ? [
            (): ReturnType<Tpl> => ({
              action: "birthday.manual_send",
              entityType: "member",
              entityId: pick(members).id,
              metadata: { year: 2026, override: false },
            }),
          ]
        : []),
    ];

    // Idempotent: clear previously seeded rows (tagged in metadata).
    await db.delete(schema.auditLog).where(sql`metadata->>'seed' = 'true'`);

    const COUNT = 120;
    const now = Date.now();
    const rows = [];
    for (let i = 0; i < COUNT; i++) {
      const t = pick(templates)();
      const minutesAgo = Math.floor(Math.random() * 60 * 24 * 45); // up to 45 days
      rows.push({
        actorId: pick(actors),
        action: t.action,
        entityType: t.entityType,
        entityId: t.entityId,
        metadata: { ...(t.metadata ?? {}), seed: true },
        ipAddress: "127.0.0.1",
        userAgent: "seed-script",
        createdAt: new Date(now - minutesAgo * 60 * 1000),
      });
    }
    await db.insert(schema.auditLog).values(rows);
    console.log(`✓ seeded ${COUNT} audit rows`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
