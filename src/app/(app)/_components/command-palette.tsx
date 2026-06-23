"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, LogOut, UserPlus } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import type { Role } from "@/lib/privacy";

import { searchPeople, signOutAction, type PersonResult } from "../actions";
import { MAIN_NAV } from "./nav-config";

export function CommandPalette({
  open,
  onOpenChange,
  role,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<PersonResult[]>([]);
  const [, startTransition] = useTransition();
  const isAdmin = role === "exco" || role === "super_admin";

  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setPeople([]);
      return;
    }
    const handle = setTimeout(() => {
      startTransition(async () => {
        setPeople(await searchPeople(q));
      });
    }, 200);
    return () => clearTimeout(handle);
  }, [query]);

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command palette"
      description="Search pages, people, and actions"
    >
      <CommandInput
        placeholder="Search pages, people, actions..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Pages">
          {MAIN_NAV.map((item) => (
            <CommandItem
              key={item.href}
              value={`page ${item.label}`}
              onSelect={() => go(item.href)}
            >
              <item.icon className="size-4" />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>

        {people.length > 0 ? (
          <CommandGroup heading="People">
            {people.map((person) => (
              <CommandItem
                key={person.id}
                value={`person ${person.name} ${person.faculty ?? ""}`}
                onSelect={() => go(`/directory/${person.id}`)}
              >
                {person.name}
                {person.faculty ? (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {person.faculty}
                  </span>
                ) : null}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        <CommandGroup heading="Events">
          <CommandItem value="events browse" onSelect={() => go("/events")}>
            <CalendarDays className="size-4" />
            Browse events
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          {isAdmin ? (
            <>
              <CommandItem
                value="action new event"
                onSelect={() => go("/admin/events")}
              >
                <CalendarDays className="size-4" />
                New event
              </CommandItem>
              <CommandItem
                value="action add member"
                onSelect={() => go("/admin/members")}
              >
                <UserPlus className="size-4" />
                Add member
              </CommandItem>
            </>
          ) : null}
          <CommandItem
            value="action sign out"
            onSelect={() => {
              onOpenChange(false);
              void signOutAction();
            }}
          >
            <LogOut className="size-4" />
            Sign out
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
