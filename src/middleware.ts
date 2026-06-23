import { NextResponse, type NextRequest } from "next/server";

// Optimistic only. Real checks live in dal.ts. See CVE-2025-29927.
export function middleware(req: NextRequest) {
  const hasSession =
    req.cookies.has("authjs.session-token") ||
    req.cookies.has("__Secure-authjs.session-token");

  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything EXCEPT the public surfaces, auth/cron APIs, and assets.
  matcher: [
    "/((?!api/auth|api/cron|_next/static|_next/image|favicon.ico|login|invite|p/|rsvp/|unsubscribe/|privacy|terms|opengraph-image|twitter-image|.*\\.|$).*)",
  ],
};
