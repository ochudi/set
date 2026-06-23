"use client";

import { useEffect, useState } from "react";

/**
 * Time-of-day greeting computed on the client only (trap 16: the server runs in
 * UTC and cannot know the viewer's local hour, so rendering the word on the
 * server would hydrate-mismatch). First paint shows the neutral "Hello"; the
 * effect swaps in morning/afternoon/evening after mount, no mismatch.
 */
function partOfDay(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function Greeting({ name }: { name: string }) {
  const [greeting, setGreeting] = useState("Hello");

  useEffect(() => {
    setGreeting(partOfDay(new Date().getHours()));
  }, []);

  return (
    <h1 className="font-sans text-2xl font-semibold tracking-tight">
      {greeting}, {name}
    </h1>
  );
}
