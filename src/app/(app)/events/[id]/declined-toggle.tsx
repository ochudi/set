"use client";

import { useState } from "react";

import { initials } from "@/lib/member-display";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type Person = { name: string; avatarUrl: string | null };

export function DeclinedToggle({ people }: { people: Person[] }) {
  const [open, setOpen] = useState(false);
  if (people.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        {open ? "Hide" : `Show ${people.length} who can't make it`}
      </button>
      {open ? (
        <ul className="mt-2 space-y-2">
          {people.map((p, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <Avatar className="size-6">
                {p.avatarUrl ? <AvatarImage src={p.avatarUrl} alt="" /> : null}
                <AvatarFallback className="text-[10px]">
                  {initials(p.name)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate text-muted-foreground">{p.name}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
