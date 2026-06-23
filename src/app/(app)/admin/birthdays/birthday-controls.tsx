"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { sendBirthdayAction } from "./actions";

/**
 * Per-member send control. A first send this year is open to any admin; a
 * re-send (duplicate) is shown only to super admins, who must confirm. The
 * server re-checks both, so the UI gating is convenience, not the guard.
 */
export function BirthdaySendButton({
  memberId,
  name,
  sentThisYear,
  isSuperAdmin,
}: {
  memberId: string;
  name: string;
  sentThisYear: boolean;
  isSuperAdmin: boolean;
}) {
  const [pending, start] = useTransition();

  function run(override: boolean) {
    start(async () => {
      const res = await sendBirthdayAction(memberId, override);
      if (res.ok) {
        toast.success(`Birthday wish sent to ${name}.`);
      } else {
        toast.error(res.error ?? "Could not send.");
      }
    });
  }

  if (sentThisYear) {
    if (!isSuperAdmin) {
      return <span className="text-xs text-muted-foreground">Sent</span>;
    }
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => {
          if (
            window.confirm(
              `A birthday email already went out to ${name} this year. Send another?`,
            )
          ) {
            run(true);
          }
        }}
      >
        {pending ? "Sending..." : "Re-send"}
      </Button>
    );
  }

  return (
    <Button size="sm" disabled={pending} onClick={() => run(false)}>
      {pending ? "Sending..." : "Send"}
    </Button>
  );
}
