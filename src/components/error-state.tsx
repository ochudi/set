"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

import { Button } from "@/components/ui/button";

// Shared route-level error fallback. Reports to Sentry once on mount, then shows
// a calm message with a way to retry. Each route's error.tsx wraps this so the
// boundary stays a thin client component.
export function ErrorState({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[50vh] w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm text-muted-foreground">
        Something went wrong loading this page. The team has been notified.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
