import type { Metadata } from "next";

import { formatWat, getRsvpToken } from "@/lib/dal";

import { RsvpForm } from "./rsvp-form";

export const metadata: Metadata = { title: "RSVP" };

type Status = "going" | "maybe" | "declined";

export default async function RsvpPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ r?: string }>;
}) {
  const { token } = await params;
  const { r } = await searchParams;
  const initial: Status =
    r === "maybe" || r === "declined" ? r : "going";

  const data = await getRsvpToken(token);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-lg border bg-card p-8 text-center shadow-sm">
        <h1 className="mb-2 font-sans text-2xl font-semibold italic tracking-tight">
          Set.
        </h1>

        {!data ? (
          <p className="text-sm text-muted-foreground">
            This RSVP link is not valid.
          </p>
        ) : !data.valid ? (
          <p className="text-sm text-muted-foreground">
            This RSVP link has expired.
          </p>
        ) : data.event.canceledAt ? (
          <p className="text-sm text-muted-foreground">
            {data.event.title} has been cancelled.
          </p>
        ) : (
          <>
            <p className="text-base font-semibold">{data.event.title}</p>
            <p className="mb-1 mt-0.5 text-sm text-muted-foreground">
              {formatWat(data.event.startsAt)}
            </p>
            <p className="mb-5 text-sm text-muted-foreground">
              {data.event.isVirtual ? "Virtual" : (data.event.location ?? "")}
            </p>
            <RsvpForm token={token} initial={initial} />
          </>
        )}
      </div>
    </main>
  );
}
