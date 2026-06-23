import * as Sentry from "@sentry/nextjs";

import { scrubEvent } from "@/lib/sentry-scrub";

const scrub = <T,>(event: T): T =>
  scrubEvent(event as unknown as Record<string, unknown>) as unknown as T;

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  sampleRate: 1.0,
  tracesSampleRate: 0.1,
  beforeSend: scrub,
  beforeSendTransaction: scrub,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
