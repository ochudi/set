"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { rsvpAction } from "./actions";

type Status = "going" | "maybe" | "declined";
const LABEL: Record<Status, string> = {
  going: "I'm going",
  maybe: "Maybe",
  declined: "Can't go",
};

export function RsvpBar({
  eventId,
  current,
}: {
  eventId: string;
  current: "going" | "maybe" | "declined" | "waitlist" | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function set(status: Status) {
    startTransition(async () => {
      const res = await rsvpAction(eventId, status);
      if (res.ok) {
        toast.success("Your RSVP is saved");
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not save your RSVP");
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {(["going", "maybe", "declined"] as const).map((s) => (
        <Button
          key={s}
          disabled={pending}
          variant={current === s ? "default" : "secondary"}
          onClick={() => set(s)}
        >
          {LABEL[s]}
        </Button>
      ))}
    </div>
  );
}
