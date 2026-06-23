import type { Metadata } from "next";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      {/* CLAUDE.md forbids glass on forms/cards, so this auth surface is a solid
          card rather than the "glass card" the brief suggested. */}
      <div className="w-full max-w-sm rounded-lg border bg-card p-8 shadow-sm">
        <h1 className="mb-1 text-center font-sans text-2xl font-semibold italic tracking-tight">
          Set.
        </h1>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          Sign in to your account.
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
