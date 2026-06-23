"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

import { Button } from "@/components/ui/button";

// Root error boundary. Reports the error to Sentry (scrubbed by beforeSend) and
// shows a calm fallback. Must render its own <html>/<body> (it replaces the root
// layout when the root itself throws).
export default function GlobalError({
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
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="font-sans text-2xl font-semibold italic tracking-tight">
            Set.
          </h1>
          <p className="text-sm text-muted-foreground">
            Something went wrong on our side. The team has been notified. Please
            try again.
          </p>
          <Button onClick={reset}>Try again</Button>
        </main>
      </body>
    </html>
  );
}
