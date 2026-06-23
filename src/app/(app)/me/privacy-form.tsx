"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Label } from "@/components/ui/label";

import { savePrivacy } from "./actions";

type Visibility = "public" | "members" | "private";

type Privacy = {
  profileVisibility: Visibility;
  emailVisibility: Visibility;
  phoneVisibility: Visibility;
};

const FIELDS: { key: keyof Privacy; label: string; help: string }[] = [
  {
    key: "profileVisibility",
    label: "Profile",
    help: "Who can find and view your profile.",
  },
  {
    key: "emailVisibility",
    label: "Email address",
    help: "Who can see your email on your profile.",
  },
  {
    key: "phoneVisibility",
    label: "Phone number",
    help: "Who can see your phone number.",
  },
];

const selectClass =
  "h-9 w-36 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring";

export function PrivacyForm({ defaults }: { defaults: Privacy }) {
  const [state, setState] = useState<Privacy>(defaults);
  const [pending, startTransition] = useTransition();

  function update(key: keyof Privacy, value: Visibility) {
    const previous = state;
    const next = { ...state, [key]: value };
    setState(next); // optimistic
    startTransition(async () => {
      const res = await savePrivacy(next);
      if (res.ok) {
        toast.success("Privacy updated");
      } else {
        setState(previous);
        toast.error(res.error ?? "Could not save");
      }
    });
  }

  return (
    <div className="max-w-2xl space-y-6">
      {FIELDS.map((f) => (
        <div
          key={f.key}
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <div>
            <Label htmlFor={f.key}>{f.label}</Label>
            <p className="text-sm text-muted-foreground">{f.help}</p>
          </div>
          <select
            id={f.key}
            value={state[f.key]}
            disabled={pending}
            onChange={(e) => update(f.key, e.target.value as Visibility)}
            className={selectClass}
          >
            <option value="public">Public</option>
            <option value="members">Members</option>
            <option value="private">Excos only</option>
          </select>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        Members means any signed-in alum. Excos only keeps it to you and the
        committee. Public is for opt-in pages outside the members area.
      </p>
    </div>
  );
}
