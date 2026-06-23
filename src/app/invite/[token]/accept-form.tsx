"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";

import { acceptInvite, type AcceptState } from "./actions";

export function AcceptForm({ token, email }: { token: string; email: string }) {
  const [state, formAction, pending] = useActionState<
    AcceptState | undefined,
    FormData
  >(acceptInvite, undefined);

  if (state?.ok) {
    return (
      <div className="space-y-2">
        <p className="text-sm">A sign-in link is on its way to {email}.</p>
        <p className="text-xs text-muted-foreground">
          The link expires in 10 minutes.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      {state && !state.ok ? (
        <p className="text-sm text-destructive">{state.message}</p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending..." : "Accept invitation"}
      </Button>
    </form>
  );
}
