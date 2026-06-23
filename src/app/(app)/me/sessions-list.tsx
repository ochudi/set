"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Monitor } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { revokeSession, signOutOthers } from "./actions";

export type ClientSession = {
  id: string;
  current: boolean;
  device: string;
  lastActive: Date;
  signedInAt: Date | null;
  expires: Date;
};

export function SessionsList({ sessions }: { sessions: ClientSession[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const otherCount = sessions.filter((s) => !s.current).length;

  function revoke(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const res = await revokeSession(id);
      if (res.ok) {
        toast.success("Device signed out");
        router.refresh();
      } else {
        toast.error(res.error ?? "Could not sign out that device");
      }
      setBusyId(null);
    });
  }

  function revokeOthers() {
    setBusyId("others");
    startTransition(async () => {
      const res = await signOutOthers();
      if (res.ok) {
        toast.success("Signed out other devices");
        router.refresh();
      } else {
        toast.error("Could not sign out other devices");
      }
      setBusyId(null);
    });
  }

  return (
    <div className="max-w-2xl space-y-4">
      <ul className="divide-y rounded-lg border">
        {sessions.map((s) => (
          <li key={s.id} className="flex items-center gap-3 p-4">
            <Monitor className="size-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                {s.device}
                {s.current ? (
                  <Badge variant="secondary">This device</Badge>
                ) : null}
              </p>
              <p className="font-mono text-xs text-muted-foreground">
                {s.current
                  ? "Active now"
                  : `Last active ${formatDistanceToNow(s.lastActive, {
                      addSuffix: true,
                    })}`}
                {s.signedInAt
                  ? ` · signed in ${formatDistanceToNow(s.signedInAt, {
                      addSuffix: true,
                    })}`
                  : ""}
              </p>
            </div>
            {!s.current ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={pending && busyId === s.id}
                onClick={() => revoke(s.id)}
              >
                {pending && busyId === s.id ? "Signing out..." : "Revoke"}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>

      {otherCount > 0 ? (
        <Button
          variant="outline"
          disabled={pending && busyId === "others"}
          onClick={revokeOthers}
        >
          Sign out other devices
        </Button>
      ) : null}
    </div>
  );
}
