import * as Sentry from "@sentry/nextjs";

import { scrubEvent } from "@/lib/sentry-scrub";

const scrub = <T,>(event: T): T =>
  scrubEvent(event as unknown as Record<string, unknown>) as unknown as T;

export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" ||
    process.env.NEXT_RUNTIME === "edge"
  ) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      // 1.0 = capture every error event; 0.1 = sample 10% of performance traces.
      sampleRate: 1.0,
      tracesSampleRate: 0.1,
      // PII scrubbing (emails, phones, anything under `metadata`).
      beforeSend: scrub,
      beforeSendTransaction: scrub,
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
