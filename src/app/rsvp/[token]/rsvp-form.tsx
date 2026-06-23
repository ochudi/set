"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";

import { submitRsvp, type RsvpResult } from "./actions";

type Status = "going" | "maybe" | "declined";

const LABEL: Record<Status, string> = {
  going: "I'm going",
  maybe: "Maybe",
  declined: "Can't go",
};

export function RsvpForm({
  token,
  initial,
}: {
  token: string;
  initial: Status;
}) {
  const [state, action, pending] = useActionState<
    RsvpResult | undefined,
    FormData
  >(submitRsvp, undefined);

  if (state?.ok) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium">{state.message}</p>
        <p className="text-xs text-muted-foreground">
          <a href="/login" className="underline">
            Sign in
          </a>{" "}
          to see full details, or change your reply from the event page.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      {state && !state.ok ? (
        <p className="text-sm text-destructive">{state.message}</p>
      ) : null}
      <div className="flex flex-wrap justify-center gap-2">
        {(["going", "maybe", "declined"] as const).map((s) => (
          <Button
            key={s}
            type="submit"
            name="status"
            value={s}
            disabled={pending}
            variant={s === initial ? "default" : "secondary"}
          >
            {LABEL[s]}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">One tap saves your reply.</p>
    </form>
  );
}
