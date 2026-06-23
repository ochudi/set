"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { saveNotifications } from "./actions";

type Notifications = {
  notifyAnnouncements: boolean;
  notifyEvents: boolean;
  notifyFundraisers: boolean;
};

const FIELDS: { key: keyof Notifications; label: string; help: string }[] = [
  {
    key: "notifyAnnouncements",
    label: "Announcements",
    help: "News and updates from the committee.",
  },
  {
    key: "notifyEvents",
    label: "Events",
    help: "Invitations and reminders for reunions and meetups.",
  },
  {
    key: "notifyFundraisers",
    label: "Fundraisers",
    help: "New campaigns and progress updates.",
  },
];

export function NotificationsForm({ defaults }: { defaults: Notifications }) {
  const [state, setState] = useState<Notifications>(defaults);
  const [pending, startTransition] = useTransition();

  function toggle(key: keyof Notifications, value: boolean) {
    const previous = state;
    const next = { ...state, [key]: value };
    setState(next); // optimistic
    startTransition(async () => {
      const res = await saveNotifications(next);
      if (res.ok) {
        toast.success("Preferences updated");
      } else {
        setState(previous);
        toast.error(res.error ?? "Could not save");
      }
    });
  }

  return (
    <div className="max-w-2xl space-y-6">
      {FIELDS.map((f) => (
        <div key={f.key} className="flex items-center justify-between gap-4">
          <div>
            <Label htmlFor={f.key}>{f.label}</Label>
            <p className="text-sm text-muted-foreground">{f.help}</p>
          </div>
          <Switch
            id={f.key}
            checked={state[f.key]}
            disabled={pending}
            onCheckedChange={(v) => toggle(f.key, v)}
          />
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        Sign-in links and account notices are always sent.
      </p>
    </div>
  );
}
