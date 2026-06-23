"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { signIn } from "@/auth";
import { emailIsAllowed, loginWithPassword } from "@/lib/dal";
import {
  magicLinkEmailLimiter,
  magicLinkIpLimiter,
} from "@/lib/ratelimit";

export type LoginState = { ok: boolean; message: string };

// Match Auth.js cookie naming: secure host-prefixed cookie on https, plain on
// http(localhost). Database session strategy stores the raw token in this
// cookie and in sessions.session_token.
function sessionCookieName(): string {
  const url = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
  return url.startsWith("https://")
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";
}

const passwordSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

/**
 * Email + password sign-in (additive to magic links). On success it sets the
 * Auth.js session cookie and redirects; on failure it returns one uniform
 * message so the form never reveals whether the address exists.
 */
export async function signInWithPassword(
  _prev: LoginState | undefined,
  formData: FormData,
): Promise<LoginState> {
  const parsed = passwordSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, message: "Enter your email and password." };
  }

  const result = await loginWithPassword(parsed.data.email, parsed.data.password);
  if (!result) {
    return { ok: false, message: "Wrong email or password." };
  }

  const secure = sessionCookieName().startsWith("__Secure-");
  (await cookies()).set(sessionCookieName(), result.token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure,
    expires: result.expires,
  });
  redirect("/dashboard");
}

// Same neutral message in every branch, so the response never reveals whether
// an address is on the member list (enumeration-safe).
const NEUTRAL = "Check your inbox if that address is on the member list.";

const schema = z.object({ email: z.string().trim().email() });

export async function requestMagicLink(
  _prev: LoginState | undefined,
  formData: FormData,
): Promise<LoginState> {
  const parsed = schema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { ok: false, message: "Enter a valid email address." };
  }

  const email = parsed.data.email.toLowerCase();
  const ip =
    (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  // 3 / email / hour and 10 / IP / hour. If the limiter is unreachable, fail
  // open rather than locking out legitimate members.
  let limited = false;
  try {
    const [byEmail, byIp] = await Promise.all([
      magicLinkEmailLimiter().limit(email),
      magicLinkIpLimiter().limit(ip),
    ]);
    limited = !byEmail.success || !byIp.success;
  } catch {
    limited = false;
  }

  if (!limited) {
    try {
      if (await emailIsAllowed(email)) {
        await signIn("resend", {
          email,
          redirectTo: "/welcome",
          redirect: false,
        });
      }
    } catch {
      // Swallow provider/DB errors so the response stays uniform.
    }
  }

  return { ok: true, message: NEUTRAL };
}
