"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { restoreMemberAction } from "./actions";

export function RestoreButton({
  id,
  disabled,
}: {
  id: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function restore() {
    startTransition(async () => {
      const res = await restoreMemberAction(id);
      if (res.ok) {
        toast.success("Account restored");
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not restore the account");
      }
    });
  }

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={disabled || pending}
      onClick={restore}
    >
      {pending ? "Restoring..." : "Restore"}
    </Button>
  );
}
