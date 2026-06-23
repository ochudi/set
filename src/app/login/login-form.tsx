"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  requestMagicLink,
  signInWithPassword,
  type LoginState,
} from "./actions";

export function LoginForm() {
  const [mode, setMode] = useState<"password" | "magic">("password");

  const [pwState, pwAction, pwPending] = useActionState<
    LoginState | undefined,
    FormData
  >(signInWithPassword, undefined);

  const [linkState, linkAction, linkPending] = useActionState<
    LoginState | undefined,
    FormData
  >(requestMagicLink, undefined);

  // Magic link requested: show the neutral confirmation.
  if (mode === "magic" && linkState?.ok) {
    return (
      <div className="space-y-2 text-center">
        <p className="text-sm">{linkState.message}</p>
        <p className="text-xs text-muted-foreground">
          The link expires in 10 minutes.
        </p>
        <button
          type="button"
          onClick={() => setMode("password")}
          className="text-xs text-brand underline underline-offset-2"
        >
          Back to password sign in
        </button>
      </div>
    );
  }

  if (mode === "magic") {
    return (
      <form action={linkAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
          />
        </div>
        {linkState && !linkState.ok ? (
          <p className="text-sm text-destructive">{linkState.message}</p>
        ) : null}
        <Button type="submit" className="w-full" disabled={linkPending}>
          {linkPending ? "Sending..." : "Send sign-in link"}
        </Button>
        <button
          type="button"
          onClick={() => setMode("password")}
          className="block w-full text-center text-xs text-muted-foreground hover:text-foreground"
        >
          Use password instead
        </button>
      </form>
    );
  }

  return (
    <form action={pwAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="Your password"
        />
      </div>
      {pwState && !pwState.ok ? (
        <p className="text-sm text-destructive">{pwState.message}</p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pwPending}>
        {pwPending ? "Signing in..." : "Sign in"}
      </Button>
      <button
        type="button"
        onClick={() => setMode("magic")}
        className="block w-full text-center text-xs text-muted-foreground hover:text-foreground"
      >
        Forgot password? Email me a sign-in link
      </button>
    </form>
  );
}
