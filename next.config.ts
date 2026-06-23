import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Pin the workspace root. A stray package-lock.json in the home directory
  // makes Next infer the wrong root, which breaks file tracing; scope it here.
  turbopack: {
    root: __dirname,
  },
};

// Sentry: source-map upload only runs when SENTRY_ORG/PROJECT/AUTH_TOKEN are
// set (production CI); otherwise this is a no-op wrapper and the build is clean.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
});
